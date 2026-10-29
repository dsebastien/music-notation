/**
 * One renderer per block language. Each takes the block's source and returns the element to
 * show, or throws an Error whose message is meant for the user.
 */
import {
    baseFretOf,
    parseFingers,
    parseFrets,
    renderGuitarDiagram,
    STANDARD_TUNING,
    type FrettedVoicing
} from '../chord/guitar.js'
import { parseChordPro } from '../chords/chordpro.js'
import { renderChart } from '../chords/chart.js'
import { renderFretboard } from '../fretboard/fretboard.js'
import { parseTuning } from '../fretboard/tuning.js'
import { keyRangeOf, parseKeyRange, renderKeyboard } from '../keyboard/keyboard.js'
import { chordNoteSet, listNoteSet, type NoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { parseChord } from '../theory/chord-symbol.js'
import { readChord, suggestChords } from '../theory/chord-name.js'
import { detectChordFromFrets, detectChordFromPitches } from '../theory/detect.js'
import type { VoicingLookup } from '../voicings/index.js'
import {
    parseHand,
    parseOrientation,
    type Hand,
    type LayoutDefaults,
    type Orientation
} from '../render/layout.js'
import { parseBlockSource, parseRange, type BlockSource } from './block-source.js'
import type { Instrument, PropertyNames } from './properties.js'
import { labelField, marksOf, noteSetOf, orFail } from './note-set-field.js'
import { positionCount, positionOf, scalePosition, type Cell } from '../fretboard/positions.js'

export interface RenderOptions extends LayoutDefaults {
    /** Finds guitar voicings for chord blocks that only give a symbol (see `/voicings`). */
    voicings?: VoicingLookup
    /** Semitones to transpose chord charts by. */
    transpose?: number
    /**
     * The note's properties (or a function returning them, read at each render): an empty
     * `chord`, `fretboard` or `keyboard` block draws from them (see `blockFromProperties`).
     */
    properties?: Record<string, unknown> | (() => Record<string, unknown> | null | undefined) | null
    /** Property names, when they differ from the defaults. */
    propertyNames?: Partial<PropertyNames>
    /** The note's instrument; from its tags when absent. */
    instrument?: Instrument
}

export type Renderer = (doc: Document, source: string, options: RenderOptions) => Element

/** Renders one diagram from a parsed block (the parts of a row share settings, see renderBlock). */
export type DiagramRenderer = (doc: Document, block: BlockSource, options: RenderOptions) => Element

/** Languages that draw diagrams, and so can hold several of them (separated by `---`). */
export type DiagramLanguage = 'chord' | 'keyboard' | 'fretboard'

/** Keys a row's shared settings may hold, per language (plus `columns`, for the row itself). */
export const SHARED_KEYS: Record<DiagramLanguage, readonly string[]> = {
    chord: ['orientation', 'hand', 'labels', 'instrument', 'tuning', 'range'],
    keyboard: ['orientation', 'hand', 'labels', 'range', 'highlight', 'compare'],
    fretboard: [
        'orientation',
        'hand',
        'labels',
        'tuning',
        'frets',
        'highlight',
        'compare',
        'position',
        'shape'
    ]
}

const field = (block: BlockSource, ...names: string[]) => {
    for (const name of names) {
        const value = block.fields.get(name)
        if (value !== undefined && value !== '') return value
    }
    return undefined
}

/** Bounds that keep one block quick to draw: a 12-string neck, a full 88-key piano. */
const MAX_STRINGS = 12
const MAX_KEYS = 88

const tuningOf = (text: string) => {
    const tuning = orFail(parseTuning(text), `Unknown tuning "${text}"`)
    if (tuning.length > MAX_STRINGS) throw new Error(`At most ${MAX_STRINGS} strings`)
    return tuning
}

const rangeOf = (text: string) =>
    orFail(parseKeyRange(text), `Invalid range "${text}": use e.g. C3-B4`)

const keyRange = (range: [number, number]): [number, number] => {
    if (range[1] - range[0] + 1 > MAX_KEYS) {
        throw new Error(`At most ${MAX_KEYS} keys: give a smaller range, e.g. range: C3-B5`)
    }
    return range
}

/** The block's orientation, else the default for that kind of diagram. */
const orientationOf = (
    block: BlockSource,
    fallback: Orientation | undefined
): Orientation | undefined => {
    const text = field(block, 'orientation')
    return text ? parseOrientation(text) : fallback
}

const handOf = (block: BlockSource, options: RenderOptions): Hand | undefined => {
    const text = field(block, 'hand')
    return text ? parseHand(text) : options.hand
}

/** The root of any symbol that starts with a note name. */
const rootOf = (symbol: string): number | null => {
    const parts = splitChordSymbol(symbol)
    return parts && parseChord(symbol) ? chromaOf(parts.root) : null
}

const positiveInt = (text: string, what: string) => {
    const n = Number(text)
    if (!Number.isInteger(n) || n < 1)
        throw new Error(`${what} must be a whole number from 1, got "${text}"`)
    return n
}

/** Chord (a symbol or words), frets and fingers from a shorthand line ("A Major x02220 x01230"). */
function shorthand(head: string | null) {
    const tokens = head?.split(/\s+/).filter(Boolean) ?? []
    // The chord ends where frets may start (a word starting with x or a digit): at the longest
    // start that reads as a chord ("A Major x02220"); else the words before the first fret-like one
    // ("Mystery x02220" still draws, titled Mystery; "A Majr" is one unknown chord).
    const fretLike = (t: string) => /^[xX\d]/.test(t)
    const ends = [tokens.length, ...tokens.map((t, i) => (i > 0 && fretLike(t) ? i : -1))]
        .filter((i) => i > 0)
        .sort((a, b) => b - a)
    let at = ends.find((i) => readChord(tokens.slice(0, i).join(' '))) ?? -1
    if (at < 0) {
        const first = tokens.findIndex(fretLike)
        at = first < 0 ? tokens.length : tokens[0] && parseFrets(tokens[0]) ? 0 : Math.max(first, 1)
    }
    return {
        symbol: tokens.slice(0, at).join(' ') || undefined,
        frets: tokens[at],
        fingers: tokens[at + 1]
    }
}

const unrecognized = (written: string) =>
    new Error(`Didn't recognize "${written}": try ${suggestChords(written)}`)

/** Piano voicing of a chord: root position from octave 4, a slash chord's bass in octave 3. */
function pianoPitches(symbol: string): NoteSet {
    const set = orFail(chordNoteSet(symbol), `Unknown chord "${symbol}"`)
    const bassName = splitChordSymbol(symbol)?.bass
    const bass = bassName ? chromaOf(bassName) : null
    const pitches: number[] = []
    let previous = 59
    for (const member of set.members) {
        // A bass outside the chord only sounds below it.
        if (bass !== null && member.chroma === bass && member.degree === null) continue
        let midi = 60 + member.chroma
        while (midi <= previous) midi += 12
        while (midi - 12 > previous) midi -= 12
        pitches.push(midi)
        previous = midi
    }
    if (bass !== null) pitches.unshift(48 + bass)
    return { ...set, pitches }
}

const renderChord: DiagramRenderer = (doc, block, options) => {
    const short = shorthand(block.head)
    const name = field(block, 'name')
    // A chord written as a symbol or in words; a `name` that reads as a chord ("name: A Major")
    // also gives the root marks. The words stay the title.
    const written = field(block, 'symbol', 'chord') ?? short.symbol
    const chord = written ? readChord(written) : name ? readChord(name) : null
    let symbol = chord?.symbol ?? written
    let title = field(block, 'title') ?? name ?? written
    const instrument = field(block, 'instrument')?.toLowerCase()
    const pitchesText = field(block, 'pitches', 'notes')

    if (instrument === 'piano' || instrument === 'keyboard' || (pitchesText && !instrument)) {
        let set: NoteSet
        if (pitchesText) {
            set = orFail(listNoteSet(pitchesText), `Invalid pitches "${pitchesText}"`)
            if (!set.pitches) {
                // Pitch classes only: stack them upwards from octave 4.
                let previous = 59
                set.pitches = set.members.map((m) => {
                    let midi = 60 + m.chroma
                    while (midi <= previous) midi += 12
                    previous = midi
                    return midi
                })
            }
            const known = symbol ? chordNoteSet(symbol) : null
            if (known) set.root = known.root
            else if (!written) {
                // No symbol: the chord the pitches play names it.
                const detected = detectChordFromPitches(set.pitches)
                if (detected) {
                    symbol = detected.symbol
                    set.root = chordNoteSet(symbol)?.root ?? set.root
                    title ??= symbol
                }
            }
        } else if (symbol) {
            if (!chord) throw unrecognized(symbol)
            set = pianoPitches(symbol)
        } else {
            throw new Error('Add a chord symbol or "pitches:"')
        }
        const fingering = field(block, 'fingering', 'fingers')
        const fingers = fingering ? fingersFor(set.pitches!, fingering) : new Map<number, string>()
        const range = field(block, 'range')
        // Checked even though keyboards ignore it, so a typo doesn't go unnoticed.
        handOf(block, options)
        return renderKeyboard(doc, set, {
            title,
            label: labelField(block, fingers.size ? 'fingers' : 'notes', fingers.size > 0),
            fingers,
            range: keyRange(range ? rangeOf(range) : keyRangeOf(set)),
            // Piano chords follow the keyboards' default.
            orientation: orientationOf(block, options.orientation?.keyboard)
        })
    }

    if (instrument && instrument !== 'guitar' && !field(block, 'tuning')) {
        throw new Error(`Unknown instrument "${instrument}": use guitar or piano, or give a tuning`)
    }
    const fretsText = field(block, 'frets') ?? short.frets
    let voicing: FrettedVoicing
    if (fretsText) {
        const frets = orFail(parseFrets(fretsText), `Invalid frets "${fretsText}": use e.g. x02220`)
        if (frets.length > MAX_STRINGS) throw new Error(`At most ${MAX_STRINGS} strings`)
        const fingersText = field(block, 'fingers') ?? short.fingers
        const fingers = fingersText ? parseFingers(fingersText) : []
        if (fingersText && fingers.length !== frets.length) {
            throw new Error(
                `"${fingersText}" has ${fingers.length} fingers for ${frets.length} strings`
            )
        }
        voicing = { frets, fingers: frets.map((_, i) => fingers[i] ?? null) }
    } else if (written && !chord) {
        throw unrecognized(written)
    } else if (symbol && options.voicings) {
        const n = field(block, 'voicing')
        const index = n ? positiveInt(n, 'voicing') - 1 : 0
        voicing = orFail(
            options.voicings(symbol, index),
            `No voicing ${index + 1} found for "${symbol}": add "frets:"`
        )
    } else {
        throw new Error(
            symbol
                ? `Add "frets:" for ${symbol} (e.g. frets: x02220)`
                : 'Add a chord symbol and "frets:"'
        )
    }
    const position = field(block, 'position', 'base')
    if (position) {
        const base = positiveInt(position, 'position')
        const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0)
        if (fretted.length && base > Math.min(...fretted)) {
            throw new Error(
                `position ${base} is above the lowest fretted note (fret ${Math.min(...fretted)})`
            )
        }
        voicing.baseFret = base
    } else voicing.baseFret ??= baseFretOf(voicing.frets)
    const tuningText = field(block, 'tuning')
    const tuning = tuningText ? tuningOf(tuningText) : undefined
    if (tuning && tuning.length !== voicing.frets.length) {
        throw new Error(
            `The tuning has ${tuning.length} strings, the frets ${voicing.frets.length}`
        )
    }
    if (!written && !chord) {
        // No chord given: the one the frets play names it.
        const detected = detectChordFromFrets(
            voicing.frets,
            tuning ?? (voicing.frets.length === 6 ? STANDARD_TUNING : [])
        )
        if (detected) {
            symbol = detected.symbol
            title ??= symbol
        }
    }
    // A symbol the theory doesn't know still titles the diagram; only its root marks are lost.
    const root = symbol ? (chordNoteSet(symbol)?.root ?? rootOf(symbol)) : null
    return renderGuitarDiagram(doc, voicing, {
        title,
        root,
        tuning,
        orientation: orientationOf(block, options.orientation?.chord),
        hand: handOf(block, options)
    })
}

/** Finger per key, low to high ("5-3-1", "1 2 3 1 2 3 4 5"). */
function fingersFor(pitches: number[], fingering: string): Map<number, string> {
    const sorted = [...pitches].sort((a, b) => a - b)
    const fingers = new Map<number, string>()
    fingering
        .split(/[\s,-]+/)
        .filter(Boolean)
        .forEach((finger, i) => {
            if (sorted[i] !== undefined) fingers.set(sorted[i], finger)
        })
    return fingers
}

const renderKeyboardBlock: DiagramRenderer = (doc, block, options) => {
    const set = noteSetOf(block)
    const range = field(block, 'range')
    handOf(block, options)
    // A scale's fingering: one octave from the root (middle C's octave), fingers in order.
    const fingering = field(block, 'fingering')
    let fingers: Map<number, string> | undefined
    if (fingering && set.root !== null && !set.pitches) {
        const start = 60 + set.root
        set.pitches = [
            ...set.members.map((m) => start + ((m.chroma - set.root! + 12) % 12)),
            start + 12
        ]
        fingers = fingersFor(set.pitches, fingering)
    }
    return renderKeyboard(doc, set, {
        title: field(block, 'title'),
        label: labelField(block, fingers ? 'fingers' : 'notes', fingers !== undefined),
        fingers,
        // A fingered scale shows its octave, up to the root above.
        range: keyRange(
            range
                ? rangeOf(range)
                : fingers && set.pitches
                  ? [set.pitches[0]!, set.pitches[set.pitches.length - 1]!]
                  : keyRangeOf(set)
        ),
        orientation: orientationOf(block, options.orientation?.keyboard),
        marks: marksOf(block, set)
    })
}

const renderFretboardBlock: DiagramRenderer = (doc, block, options) => {
    const set = noteSetOf(block)
    const at = positionOf(field(block, 'position'), field(block, 'shape'))
    const fretsText = field(block, 'frets')
    const frets = fretsText
        ? orFail(parseRange(fretsText), `Invalid frets "${fretsText}": use e.g. 5-8`)
        : undefined
    if (frets && frets[1] > 36) throw new Error('Frets go up to 36')
    const tuningText = field(block, 'tuning')
    const tuning = tuningText ? tuningOf(tuningText) : undefined
    let cells: Cell[] | undefined
    if (at) {
        if (set.root === null) throw new Error('Positions need a scale: e.g. scale: A minor')
        const count = positionCount(set, at.system)
        const named = { 'box': 'box', 'caged': 'CAGED', '3nps': '3nps' }[at.system]
        cells = orFail(
            scalePosition(set, tuning ?? STANDARD_TUNING, at.system, at.n),
            `${set.title} has ${count} ${named} positions: use position 1 to ${count}`
        )
    }
    return renderFretboard(doc, set, {
        title: field(block, 'title'),
        label: labelField(block, 'notes'),
        frets,
        cells,
        marks: marksOf(block, set),
        tuning,
        orientation: orientationOf(block, options.orientation?.fretboard),
        hand: handOf(block, options)
    })
}

/** Diagram languages and their renderers. */
export const DIAGRAMS: Record<DiagramLanguage, DiagramRenderer> = {
    chord: renderChord,
    keyboard: renderKeyboardBlock,
    fretboard: renderFretboardBlock
}

const fromSource =
    (render: DiagramRenderer): Renderer =>
    (doc, source, options) =>
        render(doc, parseBlockSource(source), options)

const renderChordsBlock: Renderer = (doc, source, options) =>
    renderChart(doc, parseChordPro(source), { transpose: options.transpose })

/** Block languages (code fence names) and their renderers. */
export const RENDERERS = {
    chord: fromSource(renderChord),
    chords: renderChordsBlock,
    keyboard: fromSource(renderKeyboardBlock),
    fretboard: fromSource(renderFretboardBlock)
} satisfies Record<string, Renderer>

export type NotationLanguage = keyof typeof RENDERERS
