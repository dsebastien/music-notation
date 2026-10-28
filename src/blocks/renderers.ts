/**
 * One renderer per block language. Each takes the block's source and returns the element to
 * show, or throws an Error whose message is meant for the user.
 */
import {
    baseFretOf,
    parseFingers,
    parseFrets,
    renderGuitarDiagram,
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
import type { VoicingLookup } from '../voicings/index.js'
import {
    parseHand,
    parseOrientation,
    type Hand,
    type LayoutDefaults,
    type Orientation
} from '../render/layout.js'
import { parseBlockSource, parseRange, type BlockSource } from './block-source.js'
import { labelField, noteSetOf, orFail } from './note-set-field.js'

export interface RenderOptions extends LayoutDefaults {
    /** Finds guitar voicings for chord blocks that only give a symbol (see `/voicings`). */
    voicings?: VoicingLookup
    /** Semitones to transpose chord charts by. */
    transpose?: number
}

export type Renderer = (doc: Document, source: string, options: RenderOptions) => Element

/** Renders one diagram from a parsed block (the parts of a row share settings, see renderBlock). */
export type DiagramRenderer = (doc: Document, block: BlockSource, options: RenderOptions) => Element

/** Languages that draw diagrams, and so can hold several of them (separated by `---`). */
export type DiagramLanguage = 'chord' | 'keyboard' | 'fretboard'

/** Keys a row's shared settings may hold, per language (plus `columns`, for the row itself). */
export const SHARED_KEYS: Record<DiagramLanguage, readonly string[]> = {
    chord: ['orientation', 'hand', 'labels', 'instrument', 'tuning'],
    keyboard: ['orientation', 'hand', 'labels', 'range'],
    fretboard: ['orientation', 'hand', 'labels', 'tuning', 'frets']
}

const field = (block: BlockSource, ...names: string[]) => {
    for (const name of names) {
        const value = block.fields.get(name)
        if (value !== undefined && value !== '') return value
    }
    return undefined
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

/** Chord symbol, frets and fingers from a shorthand line ("A x02220 x01230"). */
function shorthand(head: string | null) {
    const tokens = head?.split(/\s+/).filter(Boolean) ?? []
    const symbol = tokens[0] && !parseFrets(tokens[0]) ? tokens.shift() : undefined
    return { symbol, frets: tokens[0], fingers: tokens[1] }
}

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
    // A `name` that is a chord symbol ("name: A") also gives the root marks.
    const symbol =
        field(block, 'symbol', 'chord') ??
        short.symbol ??
        (name && parseChord(name) ? name : undefined)
    const title = field(block, 'title') ?? name ?? symbol
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
            const chord = symbol ? chordNoteSet(symbol) : null
            if (chord) set.root = chord.root
        } else if (symbol) {
            set = pianoPitches(symbol)
        } else {
            throw new Error('Add a chord symbol or "pitches:"')
        }
        const fingering = field(block, 'fingering', 'fingers')
        const fingers = new Map<number, string>()
        if (fingering) {
            const sorted = [...set.pitches!].sort((a, b) => a - b)
            fingering
                .split(/[\s,-]+/)
                .filter(Boolean)
                .forEach((finger, i) => {
                    if (sorted[i] !== undefined) fingers.set(sorted[i], finger)
                })
        }
        const range = field(block, 'range')
        // Checked even though keyboards ignore it, so a typo doesn't go unnoticed.
        handOf(block, options)
        return renderKeyboard(doc, set, {
            title,
            label: labelField(block, fingers.size ? 'fingers' : 'notes', fingers.size > 0),
            fingers,
            range: range
                ? orFail(parseKeyRange(range), `Invalid range "${range}": use e.g. C3-B4`)
                : keyRangeOf(set),
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
        const fingersText = field(block, 'fingers') ?? short.fingers
        const fingers = fingersText ? parseFingers(fingersText) : []
        if (fingersText && fingers.length !== frets.length) {
            throw new Error(
                `"${fingersText}" has ${fingers.length} fingers for ${frets.length} strings`
            )
        }
        voicing = { frets, fingers: frets.map((_, i) => fingers[i] ?? null) }
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
    const tuning = tuningText
        ? orFail(parseTuning(tuningText), `Unknown tuning "${tuningText}"`)
        : undefined
    if (tuning && tuning.length !== voicing.frets.length) {
        throw new Error(
            `The tuning has ${tuning.length} strings, the frets ${voicing.frets.length}`
        )
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

const renderKeyboardBlock: DiagramRenderer = (doc, block, options) => {
    const set = noteSetOf(block)
    const range = field(block, 'range')
    handOf(block, options)
    return renderKeyboard(doc, set, {
        title: field(block, 'title'),
        label: labelField(block, 'notes'),
        range: range
            ? orFail(parseKeyRange(range), `Invalid range "${range}": use e.g. C3-B4`)
            : undefined,
        orientation: orientationOf(block, options.orientation?.keyboard)
    })
}

const renderFretboardBlock: DiagramRenderer = (doc, block, options) => {
    const set = noteSetOf(block)
    const fretsText = field(block, 'frets')
    const frets = fretsText
        ? orFail(parseRange(fretsText), `Invalid frets "${fretsText}": use e.g. 5-8`)
        : undefined
    if (frets && frets[1] > 36) throw new Error('Frets go up to 36')
    const tuningText = field(block, 'tuning')
    return renderFretboard(doc, set, {
        title: field(block, 'title'),
        label: labelField(block, 'notes'),
        frets,
        tuning: tuningText
            ? orFail(parseTuning(tuningText), `Unknown tuning "${tuningText}"`)
            : undefined,
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
