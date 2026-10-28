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
} from '../chord/guitar'
import { parseChordPro } from '../chords/chordpro'
import { renderChart } from '../chords/chart'
import { renderFretboard } from '../fretboard/fretboard'
import { parseTuning } from '../fretboard/tuning'
import { keyRangeOf, parseKeyRange, renderKeyboard } from '../keyboard/keyboard'
import { chordNoteSet, listNoteSet, type NoteSet } from '../theory/note-set'
import { parseChord } from '../theory/chord-symbol'
import type { VoicingLookup } from '../voicings'
import { parseBlockSource, parseRange, type BlockSource } from './block-source'
import { labelField, noteSetOf, orFail } from './note-set-field'

export interface RenderOptions {
    /** Finds guitar voicings for chord blocks that only give a symbol (see `/voicings`). */
    voicings?: VoicingLookup
    /** Semitones to transpose chord charts by. */
    transpose?: number
}

export type Renderer = (doc: Document, source: string, options: RenderOptions) => Element

const field = (block: BlockSource, ...names: string[]) => {
    for (const name of names) {
        const value = block.fields.get(name)
        if (value !== undefined && value !== '') return value
    }
    return undefined
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
    const bass = symbol.includes('/') ? symbol.split('/')[1]!.trim() : null
    const pitches: number[] = []
    let previous = 59
    for (const member of set.members) {
        if (bass && member.name === bass && member.degree === null) continue
        let midi = 60 + member.chroma
        while (midi <= previous) midi += 12
        while (midi - 12 > previous) midi -= 12
        pitches.push(midi)
        previous = midi
    }
    if (bass) {
        const bassMember = set.members.find((m) => m.name === bass)
        if (bassMember) pitches.unshift(48 + bassMember.chroma)
    }
    return { ...set, pitches }
}

const renderChord: Renderer = (doc, source, options) => {
    const block = parseBlockSource(source)
    const short = shorthand(block.head)
    const symbol = field(block, 'symbol', 'chord') ?? short.symbol
    const title = field(block, 'title', 'name') ?? symbol
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
        return renderKeyboard(doc, set, {
            title,
            label: labelField(block, fingers.size ? 'fingers' : 'notes'),
            fingers,
            range: range
                ? orFail(parseKeyRange(range), `Invalid range "${range}": use e.g. C3-B4`)
                : keyRangeOf(set)
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
    if (position) voicing.baseFret = positiveInt(position, 'position')
    else voicing.baseFret ??= baseFretOf(voicing.frets)
    const tuningText = field(block, 'tuning')
    const tuning = tuningText
        ? orFail(parseTuning(tuningText), `Unknown tuning "${tuningText}"`)
        : undefined
    if (tuning && tuning.length !== voicing.frets.length) {
        throw new Error(
            `The tuning has ${tuning.length} strings, the frets ${voicing.frets.length}`
        )
    }
    const root = symbol ? (chordNoteSet(symbol)?.root ?? null) : null
    if (symbol && root === null && !parseChord(symbol)) {
        throw new Error(`"${symbol}" is not a chord symbol`)
    }
    return renderGuitarDiagram(doc, voicing, { title, root, tuning })
}

const renderKeyboardBlock: Renderer = (doc, source) => {
    const block = parseBlockSource(source)
    const set = noteSetOf(block)
    const range = field(block, 'range')
    return renderKeyboard(doc, set, {
        title: field(block, 'title'),
        label: labelField(block, 'notes'),
        range: range
            ? orFail(parseKeyRange(range), `Invalid range "${range}": use e.g. C3-B4`)
            : undefined
    })
}

const renderFretboardBlock: Renderer = (doc, source) => {
    const block = parseBlockSource(source)
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
            : undefined
    })
}

const renderChordsBlock: Renderer = (doc, source, options) =>
    renderChart(doc, parseChordPro(source), { transpose: options.transpose })

/** Block languages (code fence names) and their renderers. */
export const RENDERERS = {
    chord: renderChord,
    chords: renderChordsBlock,
    keyboard: renderKeyboardBlock,
    fretboard: renderFretboardBlock
} satisfies Record<string, Renderer>

export type NotationLanguage = keyof typeof RENDERERS
