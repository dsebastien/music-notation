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
 *   E G B D. Dominant sus chords put the 4th in the 3rd's place and keep the 5th (the 13th when
 *   the symbol names it): G7sus4 A is C D F A, B is F A C D. A major or minor triad is voiced as
 *   its 6/9 chord (C: E G A D). In a key, a dominant's 9th and 13th and a half-diminished
 *   chord's 9th are the key's notes, and a dominant resolving to a minor chord takes the b13 (see
 *   rootlessOf).
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
import { keyNotes, readKey } from '../theory/keys.js'
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
    /**
     * Rootless voicings in a key: its pitch classes (C = 0). A dominant's 9th and 13th and a
     * half-diminished chord's 9th are the key's (G7 in C minor: Ab and Eb), natural when it has
     * neither.
     */
    key?: readonly number[]
    /** Rootless voicings: the chord a dominant resolves to (a fifth below): a minor one flattens its 13th. */
    resolvesTo?: string
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
    /** How many notes the chord has (3 for a triad, 4 for a seventh chord), a slash bass outside it not counted. */
    tones: number
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

/**
 * Rootless form A (3 5 7 9) or B (7 9 3 5), with a dominant's 13th for its 5th. A dominant sus
 * chord (C7sus4, C9sus4, C13sus4) puts its 4th in the 3rd's place: A 4 5 b7 9, B b7 9 4 5 (Bb D F
 * G over C: the Bb/C sound), its 13th for the 5th when it names one. A major or minor triad is
 * voiced as the tonic jazz pianists play for it, its 6/9 chord: C is E G A D (A), A D E G (B); Cm
 * is Eb G A D. In a key (`key`), a dominant's unnamed 9th and 13th and a half-diminished chord's
 * 9th are the key's notes (natural when the key has neither): G7 in C minor is B Eb F Ab (A), C7 in
 * Eb major E Ab Bb D, Bm7b5 in A minor D F A C. A dominant resolving to a minor chord a fifth
 * below (`resolvesTo`) takes the b13 (G7 to Cm: Eb).
 */
function rootlessOf(
    symbol: string,
    tones: Tone[],
    form: RootlessForm,
    key?: readonly number[],
    resolvesTo?: string
): number[] {
    const root = tones[0]!.chroma
    const at = (semitones: number) => (root + semitones) % 12
    const seventh = find(tones, '7m', '7M')
    const sus = seventh?.interval === '7m' && !find(tones, '3M', '3m')
    const third = sus ? find(tones, '4P', '11P') : find(tones, '3M', '3m')
    // A sixth chord's sixth takes the seventh's place: 3 5 6 9. A plain major or minor triad
    // is its 6/9 chord.
    const triad =
        !seventh &&
        tones.length === 3 &&
        third !== undefined &&
        find(tones, '5P') !== undefined &&
        !sus
    const sixth = seventh
        ? undefined
        : (find(tones, '6M', '13M') ?? (triad ? { chroma: at(9), interval: '6M' } : undefined))
    // A diminished seventh has no seventh to keep (7d): it isn't voiced rootless.
    if (!third || !(seventh ?? sixth)) {
        throw new Error(
            `Rootless voicings are for major, minor, dominant (sus4 too) and half-diminished seventh or sixth chords and major or minor triads (Cmaj7, Cm7, C7, C7sus4, Cm7b5, C6, C, Cm): not ${symbol}`
        )
    }
    const sevenChroma = (seventh ?? sixth)!.chroma
    const dominant = third.interval === '3M' && seventh?.interval === '7m'
    const halfDiminished =
        third.interval === '3m' && seventh?.interval === '7m' && find(tones, '5d') !== undefined
    // The key's note among the natural and the flat one; the natural without a key.
    const keyed = (natural: number) =>
        key && !key.includes(at(natural)) && key.includes(at(natural - 1))
            ? at(natural - 1)
            : at(natural)
    const named9 = find(tones, '9m', '9A', '9M', '2m', '2A', '2M')?.chroma
    const ninth = named9 ?? (dominant || halfDiminished ? keyed(2) : at(2))
    // A dominant to a minor chord a fifth below: the b13 (G7 to Cm takes Eb, not E).
    const target = resolvesTo ? chordNoteSet(resolvesTo) : null
    const toMinor =
        target !== null && target.root === at(5) && target.members.some((m) => m.interval === '3m')
    // Dominants: the 13th (or the altered 5th) for the 5th; sus chords keep their 5th unless
    // they name a 13th.
    const fifth = sus
        ? (find(tones, '13M', '6M')?.chroma ?? at(7))
        : dominant
          ? (find(tones, '13M', '13m', '6M', '6m', '5d', '5A')?.chroma ??
            (toMinor ? at(8) : keyed(9)))
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
    else if (style === 'rootless') {
        chromas = rootlessOf(
            symbol,
            tones,
            options.rootless ?? 'A',
            options.key,
            options.resolvesTo
        )
    } else {
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
        tones: tones.length,
        ...(hands ? { hands } : {})
    }
}

/**
 * Right-hand fingers, low to high, for a close chord of three or four notes, by its spacing (the
 * hand in its five-finger position, a second on adjacent fingers). Four notes: 1 2 3 5, or 1 2 4 5
 * with a second on top (C7 first inversion E G Bb C, C6 C E G A). Three notes: the top finger by
 * the span (5 for a fifth or more, 4 for a fourth or a tritone, 3 for less); the middle one next to
 * it when a second is on top (G Bb C: 1 3 4), 2 under a fourth or more (E G C: 1 2 5), else 3 (C G
 * Bb: 1 3 5).
 */
function spacedFingers(chord: readonly number[]): string[] | null {
    const gaps = chord.slice(1).map((p, i) => p - chord[i]!)
    const span = chord[chord.length - 1]! - chord[0]!
    if (chord.length === 4) return gaps[2]! <= 2 ? ['1', '2', '4', '5'] : ['1', '2', '3', '5']
    if (chord.length !== 3) return null
    const top = span >= 7 ? 5 : span >= 5 ? 4 : 3
    const gap = gaps[1]!
    const middle = top === 3 ? 2 : gap <= 2 ? top - 1 : top === 5 && gap < 5 ? 3 : 2
    return ['1', String(middle), String(top)]
}

/**
 * Fingers for a close triad or seventh chord (`fingering: auto`), low to high. Triads: the right
 * hand 1 3 5 in root position and second inversion, 1 2 5 in first; the left hand 5 3 1 in root
 * position and first inversion, 5 2 1 in second; a left-hand bass under a right-hand chord gets 5.
 * With both hands, a bass that is the triad's third leaves the right hand two notes (D/F#: F#3 + D4
 * A4, C first inversion: E3 + G4 C5): 1 5 a fifth or more apart, 1 4 a fourth or a tritone, 1 3 a
 * third, 1 2 a second. Four-note chords (sevenths, sixths) by their spacing (`spacedFingers`): the
 * right hand's three or four notes (C7 with both hands: root position C3 + 1 2 3 5, first inversion
 * E3 + G4 Bb4 C5 1 3 4, second G3 + 1 2 3 5, third Bb3 + C5 E5 G5 1 3 5; C7/E: E3 + C G Bb 1 3 5),
 * the left hand alone mirrored (5 3 2 1, 5 4 2 1 with a second at the bottom). Null for anything
 * else.
 */
export function triadFingering(voicing: PianoVoicing): Map<number, string> | null {
    if (voicing.style === 'rootless' || voicing.style === 'shell') return jazzFingering(voicing)
    const leftAlone = voicing.hands === 'left'
    const chord = leftAlone ? voicing.left : voicing.right
    const extra = voicing.pitches.filter((p) => !chord.includes(p))
    if (voicing.style !== 'close') return null
    // A bass outside the hands (a slash chord without hands) has no finger to give.
    if (extra.length && voicing.hands !== 'left+right') return null
    const withBass = (fingers: string[]) => {
        const map = new Map<number, string>(chord.map((p, i) => [p, fingers[i]!]))
        for (const p of extra) map.set(p, '5')
        return map
    }
    if (voicing.tones === 4) {
        // The left hand is the right hand upside down: finger the mirrored chord, then reverse.
        const fingers = leftAlone
            ? spacedFingers([...chord].reverse().map((p) => -p))?.reverse()
            : spacedFingers(chord)
        return fingers ? withBass(fingers) : null
    }
    if (voicing.tones !== 3 || voicing.inversion > 2) return null
    // Both hands, the bass not doubled above: the right hand's two notes by their distance.
    if (chord.length === 2 && voicing.hands === 'left+right' && extra.length) {
        const span = chord[1]! - chord[0]!
        return withBass(['1', span >= 7 ? '5' : span >= 5 ? '4' : span >= 3 ? '3' : '2'])
    }
    if (chord.length !== 3) return null
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
    return withBass(fingers)
}

/**
 * Fingers for a rootless or shell voicing (`fingering: auto`), by its spacing as spacedFingers
 * gives them. Without `hands`, the hand that plays it where it sits: the left hand below middle C
 * (the comping register: Dm7 rootless A F3 A3 C4 E4 is 5 3 2 1), else the right (1 2 3 5). With
 * both hands, the left hand's root gets 5 and the right hand its notes (two notes: 1 and 5, 4, 3
 * or 2 by their span). Null for a hand that would span more than an octave (a shell R-7, C B E).
 */
function jazzFingering(voicing: PianoVoicing): Map<number, string> | null {
    const both = voicing.hands === 'left+right'
    const chord = both ? voicing.right : voicing.pitches
    const left =
        !both &&
        (voicing.hands === 'left' || (voicing.hands !== 'right' && voicing.pitches[0]! < 60))
    const span = chord[chord.length - 1]! - chord[0]!
    if (!chord.length || span > 12) return null
    let fingers: string[] | null | undefined
    if (chord.length === 2) {
        fingers = ['1', span >= 7 ? '5' : span >= 5 ? '4' : span >= 3 ? '3' : '2']
    } else {
        fingers = left
            ? spacedFingers([...chord].reverse().map((p) => -p))?.reverse()
            : spacedFingers(chord)
    }
    if (!fingers) return null
    const map = new Map<number, string>(chord.map((p, i) => [p, fingers[i]!]))
    if (both) for (const p of voicing.left) map.set(p, '5')
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
    // A triad voiced as its 6/9 chord adds a 6th, not a 13th.
    const seventh = members.some((m) => m.interval?.startsWith('7'))
    for (const pitch of pitches) {
        const chroma = pitch % 12
        if (members.some((m) => m.chroma === chroma)) continue
        const semitones = (chroma - root.chroma + 12) % 12
        const interval = !seventh && semitones === 9 ? '6M' : ADDED[semitones]!
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
    const keyText = get('key')?.trim()
    if (keyText) {
        const key = readKey(keyText)
        if (!key) throw new Error(`Unknown key "${keyText}": use e.g. key: C minor or key: Eb`)
        options.key = keyNotes(key).map((n) => chromaOf(n)!)
    }
    const resolvesTo = get('resolves-to')?.trim()
    if (resolvesTo) {
        if (!chordNoteSet(resolvesTo)) {
            throw new Error(`resolves-to: write a chord, e.g. resolves-to: Cm, got "${resolvesTo}"`)
        }
        options.resolvesTo = resolvesTo
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
