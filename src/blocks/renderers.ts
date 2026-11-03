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
import {
    capoTuning,
    fretsFromCapo,
    parseCapo,
    parseFretsFrom,
    soundingChord,
    soundsLike
} from '../chord/capo.js'
import { parseChordPro } from '../chords/chordpro.js'
import { renderChart } from '../chords/chart.js'
import { renderFretboard } from '../fretboard/fretboard.js'
import { parseTuning } from '../fretboard/tuning.js'
import { keyRangeOf, parseKeyRange, renderKeyboard } from '../keyboard/keyboard.js'
import {
    pianoOptionsOf,
    pianoPitches,
    pianoVoicing,
    triadFingering
} from '../keyboard/piano-chord.js'
import {
    chordNoteSet,
    intervalLabel,
    listNoteSet,
    respell,
    type NoteSet
} from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { parseChord } from '../theory/chord-symbol.js'
import { readChord, suggestChords } from '../theory/chord-name.js'
import { detectChordFromFrets, detectChordFromPitches } from '../theory/detect.js'
import type { VoicingLookup } from '../voicings/index.js'
import type { PlayOptions } from '../playback/controls.js'
import {
    parseHand,
    parseOrientation,
    type Hand,
    type LayoutDefaults,
    type Orientation
} from '../render/layout.js'
import { parseBlockSource, parseRange, parseStrings, type BlockSource } from './block-source.js'
import type { Instrument, PropertyNames } from './properties.js'
import { labelField, marksOf, noteSetOf, orFail } from './note-set-field.js'
import {
    isArpeggio,
    MAX_FRET,
    numberingOf,
    positionCount,
    positionOf,
    scalePosition,
    type Cell
} from '../fretboard/positions.js'
import { withScalesFor } from './scales-for.js'
import { renderProgression } from './progression.js'
import { renderCircleBlock } from '../circle/circle.js'
import { renderStrumBlock } from '../strum/render.js'

export interface RenderOptions extends LayoutDefaults {
    /** Finds guitar voicings for chord blocks that only give a symbol (see `/voicings`). */
    voicings?: VoicingLookup
    /** Semitones to transpose chord charts by. */
    transpose?: number
    /**
     * The note's properties (or a function of the block's element returning them, read at each
     * render, so a page can tell embeds from the note itself): an empty
     * `chord`, `fretboard` or `keyboard` block draws from them (see `blockFromProperties`).
     */
    properties?:
        | Record<string, unknown>
        | ((el: Element) => Record<string, unknown> | null | undefined)
        | null
    /** Property names, when they differ from the defaults. */
    propertyNames?: Partial<PropertyNames>
    /** The note's instrument; from its tags when absent. */
    instrument?: Instrument
    /** A playback bar on chord, keyboard and fretboard diagrams and strum patterns (true for the defaults). */
    play?: boolean | PlayOptions
    /**
     * The chords used row of `chords` blocks, when a chart has no `{diagrams}`: `'top'`,
     * `'bottom'` or `'off'` (the default). Guitar or piano diagrams follow `instrument`.
     */
    chartDiagrams?: 'top' | 'bottom' | 'off'
}

export type Renderer = (doc: Document, source: string, options: RenderOptions) => Element

/** Renders one diagram from a parsed block (the parts of a row share settings, see renderBlock). */
export type DiagramRenderer = (doc: Document, block: BlockSource, options: RenderOptions) => Element

/** Languages that draw diagrams, and so can hold several of them (separated by `---`). */
export type DiagramLanguage = 'chord' | 'keyboard' | 'fretboard'

/** Keys a row's shared settings may hold, per language (plus `columns`, for the row itself). */
export const SHARED_KEYS: Record<DiagramLanguage, readonly string[]> = {
    chord: [
        'orientation',
        'hand',
        'labels',
        'instrument',
        'tuning',
        'range',
        'capo',
        'frets-from',
        'sounds',
        // Piano voicings (#16): one style for a row of chords (a ii-V-I, rootless).
        'voicing',
        'inversion',
        'octave',
        'hands',
        'fingering'
    ],
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
        'shape',
        'numbering',
        'strings',
        'capo',
        'frets-from'
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
    // A chord is a few words: longer starts aren't tried (a long line stays quick).
    const ends = [tokens.length, ...tokens.map((t, i) => (i > 0 && fretLike(t) ? i : -1))]
        .filter((i) => i > 0 && i <= 8)
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

/** root: in a chord block (or a row it expands into): it only applies to note lists. */
export const ROOT_FOR_LISTS_ONLY =
    'root only applies to lists of notes on fretboards and keyboards (notes: C E G with root: C): a chord has its own root'

const renderChord: DiagramRenderer = (doc, block, options) => {
    // root: is for note lists (#33); a chord has its own root.
    if (block.fields.get('root')?.trim()) throw new Error(ROOT_FOR_LISTS_ONLY)
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

    const capoText = field(block, 'capo')
    const capo = capoText ? parseCapo(capoText) : 0
    if (instrument === 'piano' || instrument === 'keyboard' || (pitchesText && !instrument)) {
        if (capo) throw new Error('capo is for guitar and other fretted instruments, not piano')
        // Inversion, octave, voicing style and hands (#16).
        const voicingOptions = pianoOptionsOf((key) => field(block, key))
        const fingering = field(block, 'fingering', 'fingers')
        let auto: Map<number, string> | null = null
        let hands: Map<number, 'left' | 'right'> | undefined
        let set: NoteSet
        if (pitchesText) {
            const given =
                ['inversion', 'octave', 'hands'].find((key) => field(block, key)) ??
                (voicingOptions.voicing ? 'voicing' : undefined)
            if (given) {
                throw new Error(
                    `${given} goes with a chord symbol: pitches are already the keys to play`
                )
            }
            if (fingering?.trim().toLowerCase() === 'auto') {
                throw new Error(
                    'fingering: auto goes with a chord symbol: write the fingers, e.g. 1 3 5'
                )
            }
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
            // A symbol spells the keys (Cdim7: Bbb, as from the symbol alone).
            if (known) respell(set, known)
            else if (!written) {
                // No symbol: the chord the pitches play names it, spelled as they are (Db9).
                const detected = detectChordFromPitches(
                    set.pitches,
                    set.members.map((m) => m.name)
                )
                if (detected) {
                    symbol = detected.symbol
                    set.root = chordNoteSet(symbol)?.root ?? set.root
                    title ??= symbol
                }
            }
        } else if (symbol) {
            if (!chord) throw unrecognized(symbol)
            set = pianoPitches(symbol, voicingOptions)
            const voiced = pianoVoicing(symbol, voicingOptions)!
            if (voiced.hands) {
                hands = new Map([
                    ...voiced.left.map((p): [number, 'left'] => [p, 'left']),
                    ...voiced.right.map((p): [number, 'right'] => [p, 'right'])
                ])
            }
            if (fingering?.trim().toLowerCase() === 'auto') {
                auto = triadFingering(voiced)
                if (!auto) {
                    throw new Error(
                        'fingering: auto covers three-note chords in close position: write the fingers, e.g. fingering: 1 2 3 5'
                    )
                }
            }
        } else {
            throw new Error('Add a chord symbol or "pitches:"')
        }
        const fingers =
            auto ?? (fingering ? fingersFor(set.pitches!, fingering) : new Map<number, string>())
        const range = field(block, 'range')
        // Checked even though keyboards ignore it, so a typo doesn't go unnoticed.
        handOf(block, options)
        return named(
            renderKeyboard(doc, set, {
                // A piano chord plays together.
                playAs: 'chord',
                title,
                label: labelField(block, fingers.size ? 'fingers' : 'notes', fingers.size > 0),
                fingers,
                ...(hands ? { hands } : {}),
                range: keyRange(range ? rangeOf(range) : keyRangeOf(set)),
                // Piano chords follow the keyboards' default.
                orientation: orientationOf(block, options.orientation?.keyboard)
            }),
            symbol
        )
    }

    if (instrument && instrument !== 'guitar' && !field(block, 'tuning')) {
        throw new Error(`Unknown instrument "${instrument}": use guitar or piano, or give a tuning`)
    }
    const fretsText = field(block, 'frets') ?? short.frets
    // Checked even without a capo, so a typo doesn't go unnoticed.
    const fretsFrom = parseFretsFrom(field(block, 'frets-from'))
    // Frets written from the nut: the diagram shows the real neck (only frets you write).
    const fromNut = capo > 0 && fretsFrom === 'nut' && fretsText !== undefined
    let voicing: FrettedVoicing
    if (fretsText) {
        const frets = orFail(parseFrets(fretsText), `Invalid frets "${fretsText}": use e.g. x02220`)
        if (frets.length > MAX_STRINGS) throw new Error(`At most ${MAX_STRINGS} strings`)
        if (fromNut && !fretsFromCapo(frets, capo)) {
            throw new Error(
                `With frets-from: nut, every sounding fret is at the capo (${capo}) or above: write x for strings behind it`
            )
        }
        if (!fromNut && capo && frets.some((f) => f !== null && f + capo > 36)) {
            throw new Error(`With capo ${capo}, frets go up to ${36 - capo}`)
        }
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
    // The shape as played: frets from the capo. Chords are named from it (an A shape is A), and
    // sound `capo` semitones higher (B with a capo on 2).
    const shape: FrettedVoicing = fromNut
        ? { ...voicing, frets: fretsFromCapo(voicing.frets, capo)! }
        : voicing
    if (!written && !chord) {
        // No chord given: the one the frets play names it.
        const detected = detectChordFromFrets(
            shape.frets,
            tuning ?? (voicing.frets.length === 6 ? STANDARD_TUNING : [])
        )
        if (detected) {
            symbol = detected.symbol
            title ??= symbol
        }
    }
    const sounding = symbol && capo ? soundingChord(symbol, capo) : symbol
    const sounds = soundsField(field(block, 'sounds'), symbol, capo)
    // A symbol the theory doesn't know still titles the diagram; only its root marks are lost.
    // Root marks follow the sounding notes (B's with an A shape and a capo on 2).
    const root = sounding ? (chordNoteSet(sounding)?.root ?? rootOf(sounding)) : null
    const strings = tuning ?? (voicing.frets.length === 6 ? STANDARD_TUNING : undefined)
    const labels = dotLabels(
        field(block, 'labels'),
        sounding,
        shape,
        strings && capo ? capoTuning(strings, capo) : tuning
    )
    // Transitions: strings whose finger stays (anchors) or slides (guides), as guitarists count.
    const count = voicing.frets.length
    const marked = (key: string) => {
        const text = field(block, key)
        return text ? parseStrings(text, count).map((n) => count - n) : []
    }
    const anchors = marked('anchors')
    const guides = marked('guides')
    const marks = voicing.frets.map((_, s) =>
        anchors.includes(s) ? 'anchor' : guides.includes(s) ? 'guide' : null
    )
    const diagram = named(
        renderGuitarDiagram(doc, voicing, {
            title,
            root,
            tuning,
            ...(labels ? { labels } : {}),
            ...(anchors.length || guides.length ? { marks } : {}),
            ...(capo ? { capo, fretsFrom: fromNut ? 'nut' : 'capo' } : {}),
            ...(capo && sounds ? { sounds } : {}),
            orientation: orientationOf(block, options.orientation?.chord),
            hand: handOf(block, options)
        }),
        symbol
    )
    // What the shape sounds, for playback's redrawing and tools that read diagrams.
    if (capo && sounding && sounding !== symbol) diagram.setAttribute('data-mn-sounds', sounding)
    return diagram
}

/**
 * `sounds:` with a capo: `yes` (or `auto`) captions the chord the shape sounds, a chord name
 * captions that chord when it is the one the shape sounds, `no` (default) captions nothing.
 * Undefined for no caption.
 */
function soundsField(
    text: string | undefined,
    shape: string | undefined,
    capo: number
): string | undefined {
    const value = text?.trim()
    if (!value || /^(no|false|off)$/i.test(value)) return undefined
    const auto = /^(yes|true|on|auto)$/i.test(value)
    if (!capo) {
        if (auto) return undefined
        throw new Error(`sounds goes with a capo: add e.g. capo: 2`)
    }
    if (auto) {
        // A title the library can't read as a chord can't be moved up.
        if (!shape || !chordNoteSet(shape)) {
            throw new Error(
                'sounds: yes needs a chord the library knows: add its symbol (e.g. symbol: A), or write the chord: sounds: B'
            )
        }
        return soundingChord(shape, capo)
    }
    const read = readChord(value)
    if (!read) throw unrecognized(value)
    if (shape && !soundsLike(read.symbol, shape, capo)) {
        throw new Error(
            `With capo ${capo}, ${shape} sounds ${soundingChord(shape, capo)}, not ${value}: write sounds: ${soundingChord(shape, capo)} (or sounds: yes)`
        )
    }
    return value
}

/** The chord a diagram draws, for tools that read diagrams. */
function named(el: SVGElement, symbol: string | undefined): SVGElement {
    if (symbol) el.setAttribute('data-mn-chord', symbol)
    return el
}

/**
 * What a guitar diagram's dots say: fingers (default), the chord's intervals (R, 3, 5, as triad
 * charts show them), note names, or nothing. Null for fingers.
 */
function dotLabels(
    text: string | undefined,
    symbol: string | undefined,
    voicing: FrettedVoicing,
    tuning: number[] | undefined
): (string | null)[] | null {
    const value = text?.toLowerCase()
    if (value === undefined || value === 'fingers') return null
    if (!['intervals', 'notes', 'none'].includes(value)) {
        throw new Error(`Unknown labels "${text}": use fingers, intervals, notes or none`)
    }
    if (value === 'none') return voicing.frets.map(() => null)
    const set = symbol ? chordNoteSet(symbol) : null
    const strings = tuning ?? (voicing.frets.length === 6 ? STANDARD_TUNING : null)
    if (!set || !strings) throw new Error(`labels: ${value} needs a chord the library knows`)
    return voicing.frets.map((fret, s) => {
        if (fret === null || fret === 0) return null
        const member = set.members.find((m) => m.chroma === (strings[s]! + fret) % 12)
        if (!member) return null
        return value === 'notes' || member.interval === null
            ? member.name
            : intervalLabel(member.interval)
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
    // A scale's fingering: one octave from the root, fingers in order. Without a range the
    // keyboard shows that octave (middle C's); with one, every octave stays lit and the fingering
    // starts on the first root inside it (or the lowest one).
    const fingering = field(block, 'fingering')
    const keys = range ? rangeOf(range) : undefined
    let fingers: Map<number, string> | undefined
    // A list's root (`root:`) only labels and colors it: no fingering from it.
    if (fingering && set.root !== null && !set.list && !set.pitches) {
        let start = 60 + set.root
        if (keys) {
            const first = keys[0] + ((((set.root - keys[0]) % 12) + 12) % 12)
            start = first <= keys[1] ? first : keys[0] - ((((keys[0] - set.root) % 12) + 12) % 12)
        }
        const octave = [
            ...set.members.map((m) => start + ((m.chroma - set.root! + 12) % 12)),
            start + 12
        ].sort((a, b) => a - b)
        fingers = fingersFor(octave, fingering)
        if (!keys) set.pitches = octave
    } else if (fingering && set.list) {
        // A list (a five-finger position, a hand position): one finger per note, in the order
        // written, so G F E D C with 5 4 3 2 1 puts 5 on G. Exact pitches as written; pitch
        // classes each in the octave nearest the note before, the first in middle C's octave (or
        // its first key inside the range): C D E F G is C4 to G4, G F E D C is G4 down to C4.
        const fingerList = fingering.split(/[\s,-]+/).filter(Boolean)
        let pitches = set.pitches
        if (!pitches) {
            const chromas = set.title
                .split(/[\s,]+/)
                .filter(Boolean)
                .map((name) => chromaOf(name) ?? 0)
            const first = chromas[0] ?? 0
            let at = keys ? keys[0] + ((((first - keys[0]) % 12) + 12) % 12) : 60 + first
            pitches = chromas.map((chroma, i) => {
                if (i > 0) {
                    const up = (((chroma - at) % 12) + 12) % 12
                    // The same note again is the octave above; else the nearer way (a tritone up).
                    at += up === 0 ? 12 : up <= 6 ? up : up - 12
                }
                return at
            })
            if (!keys) set.pitches = pitches
        }
        if (fingerList.length !== pitches.length) {
            throw new Error(
                `fingering has ${fingerList.length} fingers for ${pitches.length} notes: one finger per note, in the order written`
            )
        }
        if (new Set(pitches).size !== pitches.length) {
            throw new Error('A key is listed twice: one finger per key')
        }
        if (keys && pitches.some((midi) => midi < keys[0] || midi > keys[1])) {
            throw new Error('The fingered notes go past the range: widen range: or leave it out')
        }
        fingers = new Map(pitches.map((midi, i) => [midi, fingerList[i]!]))
    }
    return renderKeyboard(doc, set, {
        // A chord plays together; scales, lists and arpeggios one note at a time.
        playAs:
            !set.scaleType && !set.list && set.root !== null && !block.fields.has('arpeggio')
                ? 'chord'
                : 'scale',
        title: field(block, 'title'),
        label: labelField(block, fingers ? 'fingers' : 'notes', fingers !== undefined),
        fingers,
        // A fingered scale shows its octave, up to the root above.
        range: keyRange(
            keys
                ? keys
                : fingers && set.pitches
                  ? [Math.min(...set.pitches), Math.max(...set.pitches)]
                  : keyRangeOf(set)
        ),
        orientation: orientationOf(block, options.orientation?.keyboard),
        marks: marksOf(block, set)
    })
}

const renderFretboardBlock: DiagramRenderer = (doc, block, options) => {
    const set = noteSetOf(block)
    const at = positionOf(field(block, 'position'), field(block, 'shape'))
    const capoText = field(block, 'capo')
    const capo = capoText ? parseCapo(capoText) : 0
    const fretsFrom = parseFretsFrom(field(block, 'frets-from'))
    // With a capo, frets count from it (as players read them) unless they count from the nut.
    const fromNut = capo > 0 && fretsFrom === 'nut'
    const fretsText = field(block, 'frets')
    const frets = fretsText
        ? orFail(parseRange(fretsText), `Invalid frets "${fretsText}": use e.g. 5-8`)
        : undefined
    if (frets && frets[1] > MAX_FRET - (fromNut ? 0 : capo)) {
        throw new Error(`Frets go up to ${MAX_FRET - (fromNut ? 0 : capo)}`)
    }
    if (frets && fromNut && frets[0] < capo) {
        throw new Error(
            `With frets-from: nut, frets start at the capo (${capo}) or above: e.g. frets: ${capo}-${capo + 5}`
        )
    }
    const tuningText = field(block, 'tuning')
    const tuning = tuningText ? tuningOf(tuningText) : undefined
    let cells: Cell[] | undefined
    if (!at && field(block, 'numbering')) {
        throw new Error('numbering goes with a position: e.g. position: 1 or positions: all')
    }
    // A chord's positions are arpeggios: they show which chord tone each note is.
    const arpeggio = at !== null && isArpeggio(set)
    if (at) {
        if (set.root === null || set.list) {
            throw new Error(
                'Positions need a scale or a chord: e.g. scale: A minor or arpeggio: Am7'
            )
        }
        // A numbered position of a 7-note scale is a CAGED one; boxes are for 5-note scales.
        // Arpeggios have CAGED shapes.
        if (at.system === 'box' && (arpeggio || set.members.length !== 5)) at.system = 'caged'
        if (arpeggio && at.system === '3nps') {
            throw new Error(
                'Arpeggios use CAGED shapes: position 1 to 5, or shape: E, D, C, A or G (not 3nps)'
            )
        }
        const count = positionCount(set, at.system)
        const named = { 'box': 'box', 'caged': 'CAGED', '3nps': '3nps' }[at.system]
        // With frets, the lowest octave inside them (how `positions:` puts them in neck order).
        const numbering = numberingOf(field(block, 'numbering'), set, at.system)
        // Positions are found from the capo, as if it were the nut.
        const shift = fromNut ? capo : 0
        const relative = orFail(
            scalePosition(set, capoTuning(tuning ?? STANDARD_TUNING, capo), at.system, at.n, {
                within: frets ? [frets[0] - shift, frets[1] - shift] : undefined,
                numbering
            }),
            `${set.title} has ${count} ${named} positions: use position 1 to ${count}`
        )
        cells = relative.map((cell) => ({ ...cell, fret: cell.fret + shift }))
        if (frets && cells.some((cell) => cell.fret < frets[0] || cell.fret > frets[1])) {
            throw new Error(
                `${set.title}, position ${at.n} doesn't fit in frets ${frets[0]}-${frets[1]}: widen frets: or leave it out`
            )
        }
    }
    const stringsText = field(block, 'strings')
    const count = (tuning ?? STANDARD_TUNING).length
    const strings = stringsText ? parseStrings(stringsText, count).map((n) => count - n) : undefined
    return renderFretboard(doc, set, {
        title: field(block, 'title'),
        ...(strings ? { strings } : {}),
        // Arpeggios (`arpeggio:`, or a chord's position) show intervals unless told otherwise.
        label: labelField(block, arpeggio || block.fields.has('arpeggio') ? 'intervals' : 'notes'),
        frets,
        cells,
        marks: marksOf(block, set),
        tuning,
        ...(capo ? { capo, fretsFrom } : {}),
        orientation: orientationOf(block, options.orientation?.fretboard),
        hand: handOf(block, options)
    })
}

/** Diagram languages and their renderers. */
export const DIAGRAMS: Record<DiagramLanguage, DiagramRenderer> = {
    chord: renderChord,
    keyboard: withScalesFor(renderKeyboardBlock),
    fretboard: withScalesFor(renderFretboardBlock)
}

const fromSource =
    (render: DiagramRenderer): Renderer =>
    (doc, source, options) =>
        render(doc, parseBlockSource(source), options)

const renderChordsBlock: Renderer = (doc, source, options) =>
    renderChart(doc, parseChordPro(source), {
        transpose: options.transpose,
        ...(options.chartDiagrams ? { diagrams: options.chartDiagrams } : {}),
        ...(options.instrument ? { instrument: options.instrument } : {}),
        ...(options.voicings ? { voicings: options.voicings } : {}),
        ...(options.orientation ? { orientation: options.orientation } : {}),
        ...(options.hand ? { hand: options.hand } : {})
    })

/** Block languages (code fence names) and their renderers. */
export const RENDERERS = {
    chord: fromSource(renderChord),
    chords: renderChordsBlock,
    keyboard: fromSource(DIAGRAMS.keyboard),
    fretboard: fromSource(DIAGRAMS.fretboard),
    strum: renderStrumBlock,
    progression: (doc: Document, source: string, options: RenderOptions) =>
        renderProgression(doc, source, options, DIAGRAMS.chord),
    circle: renderCircleBlock
} satisfies Record<string, Renderer>

export type NotationLanguage = keyof typeof RENDERERS
