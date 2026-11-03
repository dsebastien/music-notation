/**
 * Piano voicings of chord symbols, shared by `chord` blocks and chord charts.
 *
 * - close (default): the chord's notes stacked upwards, each the nearest one above the note
 *   before, from the bass (the root, or the inversion's note: the chord's n-th note as tonal
 *   lists it, 1 = the third).
 * - open: the close voicing with its second note from the bottom raised an octave, so the hand
 *   spans more than an octave and the bass stays: R 5 3 for a triad, R 5 7 3 for a seventh chord.
 * - shell: the root, the third (or the sus note) and the seventh (the sixth in sixth chords).
 *   Form R-3 (default) stacks them in that order (Cmaj7: C E B); form R-7 puts the seventh right
 *   above the root and the third on top, a tenth above it (C B E).
 * - rootless (jazz, after Bill Evans): no root; form A is 3 5 7 9, form B is 7 9 3 5. Dominant
 *   chords take the 13th in place of the 5th (form A 3 13 b7 9, form B b7 9 3 13), and their altered
 *   9th or 5th when the symbol has one. Half-diminished chords keep their b5 and take the natural
 *   9th (locrian #2): Bm7b5 A is D F A C#. A ii-V-I in C: Dm7 (A) F A C E, G7 (B) F A B E, Cmaj7 (A)
 *   E G B D.
 *
 * The lowest right-hand note is in `octave` (4 by default: middle C's; 3 for rootless voicings, so
 * they sit in the usual comping range, C3 to C5), a slash chord's bass an octave below it.
 * `hands: 'left+right'` puts the bass (a slash chord's, else the root) in the left hand an octave
 * below; `hands: 'left'` plays it all with the left hand (octave 3 by default).
 *
 * No doubled bass: the right hand leaves out the left hand's note (or a slash chord's bass) when
 * it is the third, the seventh or any note but the root or the fifth (D/F#: F#3 + D4 A4), and in
 * shell, open and rootless voicings, where the root belongs to the bass (Cmaj7 shell with both
 * hands: C3 + E4 B4). A close voicing keeps a root or fifth bass doubled (C with both hands: C3 +
 * C4 E4 G4), as pianists play a left-hand root under a right-hand triad.
 */
import { Note } from 'tonal'
import { orFail } from '../blocks/note-set-field.js'
import { chordNoteSet, type NoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'

export type PianoVoicingStyle = 'close' | 'open' | 'shell' | 'rootless'
export type RootlessForm = 'A' | 'B'
/** Shell forms: R-3 (root, third, seventh) or R-7 (root, seventh, third a tenth above the root). */
export type ShellForm = 'R-3' | 'R-7'
export type PianoHands = 'right' | 'left' | 'left+right'

export interface PianoVoicingOptions {
    /** The chord's note in the bass: 0 (root position, default), 1 (first inversion)… */
    inversion?: number
    /** The lowest right-hand note's octave: 4 (middle C's) by default, 3 for the left hand alone. */
    octave?: number
    voicing?: PianoVoicingStyle
    /** Rootless voicings: form A (3 5 7 9, default) or B (7 9 3 5). */
    rootless?: RootlessForm
    /** Shell voicings: form R-3 (R 3 7, default) or R-7 (R 7 3). */
    shell?: ShellForm
    /** Which hand plays what; unset draws no hands. */
    hands?: PianoHands
}

export interface PianoVoicing {
    /** Every key, low to high (MIDI). */
    pitches: number[]
    /** The left hand's keys (empty unless `hands` gives it some). */
    left: number[]
    /** The right hand's keys (with `hands`; else every key but a slash chord's bass). */
    right: number[]
    style: PianoVoicingStyle
    inversion: number
    hands?: PianoHands
}

/** The lowest and highest keys of an 88-key piano. */
const LOWEST = 21
const HIGHEST = 108

interface Tone {
    chroma: number
    interval: string
}

/** A pitch class's MIDI pitch in an octave (C4 = 60). */
const inOctave = (chroma: number, octave: number) => 12 * (octave + 1) + chroma

/** Each chroma the nearest pitch above the one before, the first in `octave`. */
function stack(chromas: number[], octave: number): number[] {
    const out: number[] = []
    for (const chroma of chromas) {
        const previous = out[out.length - 1]
        out.push(
            previous === undefined
                ? inOctave(chroma, octave)
                : previous + ((((chroma - previous) % 12) + 12) % 12 || 12)
        )
    }
    return out
}

const find = (tones: Tone[], ...intervals: string[]) =>
    intervals.map((i) => tones.find((t) => t.interval === i)).find((t) => t !== undefined)

/** Shell: root, third (or sus note), seventh (or sixth); R-7 puts the seventh below the third. */
function shellOf(symbol: string, tones: Tone[], form: ShellForm): number[] {
    const root = tones[0]!
    const third = find(tones, '3M', '3m', '4P', '2M')
    const seventh = find(tones, '7m', '7M', '7d', '6M', '13M')
    if (!third || !seventh) {
        throw new Error(
            `Shell voicings need a third and a seventh or sixth (C7, Cmaj7, Cm7, C6): ${symbol} has none`
        )
    }
    return form === 'R-7'
        ? [root.chroma, seventh.chroma, third.chroma]
        : [root.chroma, third.chroma, seventh.chroma]
}

/** Rootless form A (3 5 7 9) or B (7 9 3 5), with a dominant's 13th for its 5th. */
function rootlessOf(symbol: string, tones: Tone[], form: RootlessForm): number[] {
    const root = tones[0]!.chroma
    const at = (semitones: number) => (root + semitones) % 12
    const third = find(tones, '3M', '3m')
    const seventh = find(tones, '7m', '7M')
    // A sixth chord's sixth takes the seventh's place: 3 5 6 9.
    const sixth = seventh ? undefined : find(tones, '6M', '13M')
    // A diminished seventh has no seventh to keep (7d): it isn't voiced rootless.
    if (!third || !(seventh ?? sixth)) {
        throw new Error(
            `Rootless voicings are for major, minor, dominant and half-diminished seventh or sixth chords (Cmaj7, Cm7, C7, Cm7b5, C6): not ${symbol}`
        )
    }
    const sevenChroma = (seventh ?? sixth)!.chroma
    const dominant = third.interval === '3M' && seventh?.interval === '7m'
    const ninth = find(tones, '9m', '9A', '9M', '2m', '2A', '2M')?.chroma ?? at(2)
    // Dominants: the 13th (or the altered 5th) for the 5th.
    const fifth = dominant
        ? (find(tones, '13M', '13m', '6M', '6m', '5d', '5A')?.chroma ?? at(9))
        : (find(tones, '5P', '5A', '5d')?.chroma ?? at(7))
    return form === 'A'
        ? [third.chroma, fifth, sevenChroma, ninth]
        : [sevenChroma, ninth, third.chroma, fifth]
}

/**
 * A chord's piano voicing (see the module comment for each style). Null when the chord is
 * unknown; throws an Error saying what to write when an option doesn't fit the chord.
 */
export function pianoVoicing(
    symbol: string,
    options: PianoVoicingOptions = {}
): PianoVoicing | null {
    const set = chordNoteSet(symbol)
    if (!set) return null
    const tones: Tone[] = set.members
        .filter((m) => m.interval !== null)
        .map((m) => ({ chroma: m.chroma, interval: m.interval! }))
    const bassName = splitChordSymbol(symbol)?.bass
    const slash = bassName ? chromaOf(bassName) : null
    const style = options.voicing ?? 'close'
    const inversion = options.inversion ?? 0
    const hands = options.hands
    const octave = options.octave ?? (hands === 'left' || style === 'rootless' ? 3 : 4)
    if (!Number.isInteger(octave) || octave < 0 || octave > 8) {
        throw new Error(`octave: use a number from 0 to 8, got "${octave}"`)
    }
    if (!Number.isInteger(inversion) || inversion < 0) {
        throw new Error(`inversion: use 0 (root position), 1, 2 or 3, got "${inversion}"`)
    }
    if (inversion > 0) {
        if (slash !== null) {
            throw new Error(`${symbol} already says its bass: leave inversion out`)
        }
        if (style === 'shell' || style === 'rootless') {
            throw new Error(`inversion goes with close or open voicings, not ${style}`)
        }
        if (inversion >= tones.length) {
            throw new Error(
                `${symbol} has ${tones.length} notes: inversion goes up to ${tones.length - 1}`
            )
        }
    }
    let chromas: number[]
    if (style === 'shell') chromas = shellOf(symbol, tones, options.shell ?? 'R-3')
    else if (style === 'rootless') chromas = rootlessOf(symbol, tones, options.rootless ?? 'A')
    else {
        // The inversion's note lowest, the others in order above it (a slash chord's bass outside
        // the chord isn't among them: it sounds only below).
        const order = [...tones.slice(inversion), ...tones.slice(0, inversion)]
        chromas = order.map((t) => t.chroma)
    }
    if (style === 'open' && chromas.length < 3) {
        throw new Error(`Open voicings need three notes or more: ${symbol} has ${chromas.length}`)
    }
    let right = stack(chromas, octave)
    // Open: the note above the bass goes up an octave.
    if (style === 'open') right = right.map((p, i) => (i === 1 ? p + 12 : p)).sort((a, b) => a - b)
    let left: number[] = []
    let bass: number[] = []
    // The note under the right hand: the left hand's (a slash chord's, else the root), or a slash
    // chord's bass. The inversion's note when both hands play (C first inversion: E3 under it).
    const under =
        hands === 'left+right'
            ? (slash ?? (style === 'close' || style === 'open' ? chromas[0]! : tones[0]!.chroma))
            : slash
    if (hands === 'left+right') left = [inOctave(under!, octave - 1)]
    else if (slash !== null) bass = [inOctave(slash, octave - 1)]
    if (under !== null) {
        // Not doubled above (see the module comment): kept only for a close voicing's root or fifth.
        const interval = tones.find((t) => t.chroma === under)?.interval
        const keep = style === 'close' && (interval === '1P' || interval === '5P')
        const thinned = keep ? right : right.filter((p) => p % 12 !== under)
        if (thinned.length) right = thinned
    }
    if (hands === 'left') {
        left = [...bass, ...right]
        bass = []
        right = []
    }
    const pitches = [...new Set([...left, ...bass, ...right])].sort((a, b) => a - b)
    if (pitches[0]! < LOWEST || pitches[pitches.length - 1]! > HIGHEST) {
        throw new Error(`octave ${octave} puts ${symbol} off the piano's keys: try octave 3 or 4`)
    }
    return {
        pitches,
        left,
        right,
        style,
        inversion,
        ...(hands ? { hands } : {})
    }
}

/**
 * Fingers for a close triad (`fingering: auto`), low to high: the right hand 1 3 5 in root position
 * and second inversion, 1 2 5 in first; the left hand 5 3 1 in root position and first inversion,
 * 5 2 1 in second; a left-hand bass under a right-hand chord gets 5. Null for anything else.
 */
export function triadFingering(voicing: PianoVoicing): Map<number, string> | null {
    const leftAlone = voicing.hands === 'left'
    const chord = leftAlone ? voicing.left : voicing.right
    const extra = voicing.pitches.filter((p) => !chord.includes(p))
    if (voicing.style !== 'close' || chord.length !== 3 || voicing.inversion > 2) return null
    // A bass outside the hands (a slash chord without hands) has no finger to give.
    if (extra.length && voicing.hands !== 'left+right') return null
    const fingers = leftAlone
        ? [
              ['5', '3', '1'],
              ['5', '3', '1'],
              ['5', '2', '1']
          ][voicing.inversion]!
        : [
              ['1', '3', '5'],
              ['1', '2', '5'],
              ['1', '3', '5']
          ][voicing.inversion]!
    const map = new Map<number, string>(chord.map((p, i) => [p, fingers[i]!]))
    for (const p of extra) map.set(p, '5')
    return map
}

/** Piano voicing of a chord as a note set: close root position from octave 4, a slash chord's bass in octave 3. */
export function pianoPitches(symbol: string, options: PianoVoicingOptions = {}): NoteSet {
    const set = orFail(chordNoteSet(symbol), `Unknown chord "${symbol}"`)
    const pitches = pianoVoicing(symbol, options)!.pitches
    // Rootless voicings add a 9th or a 13th the symbol doesn't list: they join the chord's notes
    // (lit, spelled and labeled from the root: G7's A is 9, its E 13).
    const members = [...set.members]
    const root = members[0]!
    for (const pitch of pitches) {
        const chroma = pitch % 12
        if (members.some((m) => m.chroma === chroma)) continue
        const interval = ADDED[(chroma - root.chroma + 12) % 12]!
        members.push({
            chroma,
            name: Note.pitchClass(Note.transpose(root.name, interval)),
            degree: Number(/^\d+/.exec(interval)![0]),
            interval
        })
    }
    return { ...set, members, pitches }
}

/** The interval a note a rootless voicing adds is, by semitones above the root. */
const ADDED = ['1P', '9m', '9M', '9A', '3M', '11P', '5d', '5P', '13m', '13M', '7m', '7M']

const INVERSIONS: Record<string, number> = {
    root: 0,
    first: 1,
    second: 2,
    third: 3
}

/**
 * A `chord` block's piano keys (`inversion`, `octave`, `voicing`, `hands`) as options; throws a
 * message that says what to write. A numbered `voicing` (guitar's n-th voicing) is left alone.
 */
export function pianoOptionsOf(get: (key: string) => string | undefined): PianoVoicingOptions {
    const options: PianoVoicingOptions = {}
    const inversion = get('inversion')?.trim().toLowerCase()
    if (inversion) {
        const n = INVERSIONS[inversion.replace(/\s*inversion$/, '')] ?? Number(inversion)
        if (!Number.isInteger(n) || n < 0) {
            throw new Error(
                `inversion: use root, first, second, third (or 0 to 3), got "${inversion}"`
            )
        }
        options.inversion = n
    }
    const octave = get('octave')?.trim()
    if (octave) {
        const n = Number(octave)
        if (!Number.isInteger(n) || n < 0 || n > 8) {
            throw new Error(`octave: use a number from 0 to 8 (4 is middle C's), got "${octave}"`)
        }
        options.octave = n
    }
    const voicing = get('voicing')?.trim().toLowerCase()
    if (voicing && !/^\d+$/.test(voicing)) {
        const m = /^(close|open|shell|rootless)(?:[\s:-]*(?:form\s*)?([ab]|r\s*-?\s*[37]))?$/.exec(
            voicing
        )
        const form = m?.[2]?.replace(/[\s-]/g, '').toUpperCase()
        const fits =
            !form ||
            (m![1] === 'rootless' && /^[AB]$/.test(form)) ||
            (m![1] === 'shell' && /^R[37]$/.test(form))
        if (!m || !fits) {
            throw new Error(
                `voicing: use close, open, shell, shell R-7, rootless A or rootless B, got "${voicing}"`
            )
        }
        options.voicing = m[1] as PianoVoicingStyle
        if (form && m[1] === 'rootless') options.rootless = form as RootlessForm
        if (form && m[1] === 'shell') options.shell = `R-${form[1]}` as ShellForm
    }
    const hands = get('hands')?.trim().toLowerCase().replace(/\s+/g, '')
    if (hands) {
        if (['left+right', 'both', 'two', 'right+left'].includes(hands))
            options.hands = 'left+right'
        else if (hands === 'left' || hands === 'right') options.hands = hands
        else throw new Error(`hands: use left+right, left or right, got "${hands}"`)
    }
    return options
}
