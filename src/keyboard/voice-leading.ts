/**
 * Piano voicings for a progression with the smallest movement between chords (#9, #63).
 *
 * Movement is counted voice by voice: each note of one chord goes to its own note of the next
 * (a one-to-one assignment, the smallest total distance in semitones), so two voices never land on
 * one note and a common tone counts zero. When one chord has more notes than the other, its extra
 * notes each count their distance to the nearest note of the other chord. Ties go to the voicing
 * that keeps more common tones, then to the one nearer the middle of the range.
 *
 * - `voiceLead`: close (or open) position, each chord in the inversion that moves least, with a
 *   left-hand bass under it when asked.
 * - `voiceLeadVoicings`: shell or rootless voicings, each chord in the form (R-3 or R-7 shells,
 *   rootless A or B) and octave that moves least, so the forms alternate as pianists play them;
 *   never a shell with its third below the low interval limit (A2 C3) when the other form fits.
 */
import { chordNoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import {
    pianoVoicing,
    type PianoHands,
    type PianoVoicingOptions,
    type RootlessForm,
    type ShellForm
} from './piano-chord.js'

/** The lowest note of the upper voices stays within F3 to G4, so a long progression doesn't drift. */
const LOW = 53
const HIGH = 67
/** The first chord sits nearest this pitch (D4, just above middle C), on average. */
const CENTER = 62

/**
 * The smallest total distance, in semitones, when each note of the smaller chord moves to its own
 * note of the larger one; the larger one's other notes each count their distance to the nearest
 * note. Pitches low to high.
 */
export function voiceMotion(a: readonly number[], b: readonly number[]): number {
    const [small, big] = a.length <= b.length ? [a, b] : [b, a]
    if (!small.length) return 0
    const sortedSmall = [...small].sort((x, y) => x - y)
    const sortedBig = [...big].sort((x, y) => x - y)
    const nearest = (n: number) => Math.min(...sortedSmall.map((m) => Math.abs(m - n)))
    let best = Infinity
    // On a line, pairing notes in order is the cheapest one-to-one assignment: try each choice of
    // the larger chord's notes that pair (chords have a handful of notes).
    const choose = (from: number, picked: number[]) => {
        if (picked.length === sortedSmall.length) {
            let cost = 0
            picked.forEach((j, i) => (cost += Math.abs(sortedBig[j]! - sortedSmall[i]!)))
            sortedBig.forEach((n, j) => {
                if (!picked.includes(j)) cost += nearest(n)
            })
            best = Math.min(best, cost)
            return
        }
        const left = sortedSmall.length - picked.length
        for (let j = from; j <= sortedBig.length - left; j++) choose(j + 1, [...picked, j])
    }
    choose(0, [])
    return best
}

/** How many pitches two chords share. */
const common = (a: readonly number[], b: readonly number[]) => a.filter((p) => b.includes(p)).length

const mean = (list: readonly number[]) => list.reduce((s, n) => s + n, 0) / list.length

interface Scored<T> {
    value: T
    cost: number
    common: number
    center: number
}

/** The least movement, then the most common tones, then the nearest the center. */
function bestOf<T>(candidates: Scored<T>[]): T | null {
    let best: Scored<T> | null = null
    for (const c of candidates) {
        if (
            !best ||
            c.cost < best.cost ||
            (c.cost === best.cost &&
                (c.common > best.common || (c.common === best.common && c.center < best.center)))
        ) {
            best = c
        }
    }
    return best?.value ?? null
}

/** A chord's tones stacked upwards from one of them (close position), from a given pitch. */
function stacked(chromas: number[], first: number, low: number): number[] {
    const order = [...chromas.slice(first), ...chromas.slice(0, first)]
    const out: number[] = []
    let previous = low - 1
    for (const chroma of order) {
        let midi = previous + 1 + ((((chroma - previous - 1) % 12) + 12) % 12)
        if (!out.length) midi = low + ((((chroma - low) % 12) + 12) % 12)
        out.push(midi)
        previous = midi
    }
    return out
}

export interface CloseLeadOptions {
    /**
     * Open voicings: each inversion with its second note from the bottom an octave up (C G E),
     * the lowest note within C3–C4.
     */
    open?: boolean
    /**
     * A bass for the left hand under every chord (the pop texture): the root, or a slash chord's
     * bass, at least a fourth under the chord, from octave 3 down. The chord keeps a root or
     * fifth bass doubled.
     */
    bass?: boolean
}

/** Open voicings' lowest note stays within C3 to C4, nearest G3 on average. */
const OPEN_LOW = 48
const OPEN_HIGH = 60
const OPEN_CENTER = 58

/**
 * MIDI pitches for each chord, low to high: the first in root position nearest middle C, each next
 * one in the close-position inversion that moves least from the one before (see the module
 * comment), its lowest note within F3–G4 (open voicings: see CloseLeadOptions). A slash chord's
 * bass sounds below (its third or seventh not doubled in the chord). Null for a chord that doesn't
 * read.
 */
export function voiceLead(
    symbols: readonly string[],
    options: CloseLeadOptions = {}
): (number[] | null)[] {
    const [lowest, highest, center] = options.open
        ? [OPEN_LOW, OPEN_HIGH, OPEN_CENTER]
        : [LOW, HIGH, CENTER]
    // Open: the second note from the bottom an octave up.
    const spread = (pitches: number[]) =>
        options.open && pitches.length >= 3
            ? pitches.map((p, i) => (i === 1 ? p + 12 : p)).sort((a, b) => a - b)
            : pitches
    let previous: number[] | null = null
    return symbols.map((symbol) => {
        const set = chordNoteSet(symbol)
        if (!set) return null
        const bassName = splitChordSymbol(symbol)?.bass
        const bass = bassName ? chromaOf(bassName) : null
        // A bass outside the chord only sounds below it; a bass that is the third or the seventh
        // isn't doubled above (G/B: B2 under G3 D4), as pianoVoicing does. A root or fifth stays.
        const doubled = (interval: string | null) =>
            interval === null || interval.startsWith('3') || interval.startsWith('7')
        const tones = set.members
            .filter((m) => !(bass !== null && m.chroma === bass && doubled(m.interval)))
            .map((m) => m.chroma)
        const candidates: Scored<number[]>[] = []
        for (let first = 0; first < (previous ? tones.length : 1); first++) {
            for (let low = lowest; low <= highest; low++) {
                if ((((low - tones[first]!) % 12) + 12) % 12 !== 0) continue
                const pitches = spread(stacked(tones, first, low))
                candidates.push({
                    value: pitches,
                    cost: previous ? voiceMotion(pitches, previous) : 0,
                    common: previous ? common(pitches, previous) : 0,
                    center: Math.abs(mean(pitches) - center)
                })
            }
        }
        const best = bestOf(candidates)!
        previous = best
        if (bass === null && !options.bass) return best
        if (bass === null) {
            // The pop texture: the root in the left hand, at least a fourth under the chord.
            let low = 48 + set.root!
            while (low > best[0]! - 5) low -= 12
            return [low, ...best]
        }
        // A bass below the left hand's usual reach of the chord: at least a fourth under it.
        let low = 48 + bass
        while (low > best[0]! - 5) low -= 12
        return [low, ...best]
    })
}

export interface VoiceLeadOptions {
    voicing: 'shell' | 'rootless'
    /** The first chord's form (rootless A, shell R-3 by default); the next ones move least. */
    form?: RootlessForm | ShellForm
    /** Moves the range by octaves: 3 (the default) keeps it around middle C. */
    octave?: number
    hands?: PianoHands
    /** The key's pitch classes, for rootless voicings' 9ths and 13ths (see pianoVoicing). */
    key?: readonly number[]
}

export interface LedVoicing {
    /** The chord's voicing options: style, form, octave (and hands). */
    options: PianoVoicingOptions
    /** Every key, low to high (MIDI). */
    pitches: number[]
}

/**
 * The low interval limits: for each interval up to a major tenth (in semitones), the lowest note
 * (MIDI) it may start on and still sound clear on a piano. Below it the two notes blur. The usual
 * arranging table: minor second E3, major second Eb3, minor third C3, major third Bb2, fourth Bb2,
 * tritone B2, fifth Bb1, minor sixth G2, major sixth F2, minor and major seventh F2, minor ninth
 * E2, major ninth Eb2, minor tenth C2, major tenth Bb1. Octaves and wider intervals have none.
 */
const LOW_INTERVAL_LIMITS: Record<number, number> = {
    1: 52,
    2: 51,
    3: 48,
    4: 46,
    5: 46,
    6: 47,
    7: 34,
    8: 43,
    9: 41,
    10: 41,
    11: 41,
    13: 40,
    14: 39,
    15: 36,
    16: 34
}

/**
 * Whether two neighbouring notes of a voicing (pitches low to high) sit below their low interval
 * limit, so the chord sounds muddy: A2 C3 (a minor third under C3) does, A2 G3 C4 doesn't.
 */
export function belowLowIntervalLimit(pitches: readonly number[]): boolean {
    const sorted = [...pitches].sort((a, b) => a - b)
    return sorted.some((low, i) => {
        const high = sorted[i + 1]
        if (high === undefined) return false
        const limit = LOW_INTERVAL_LIMITS[high - low]
        return limit !== undefined && low < limit
    })
}

/**
 * Where each form may sit, by its lowest note (MIDI, at the default octave 3). Rootless voicings
 * start between C3 and D4, so they stay in the comping range (C3 to C5). Shells keep their root
 * low enough for a bass: an R-7 shell's root from F2 to E3, an R-3 shell's from Ab2 to G3. Each
 * shell window spans twelve semitones, so every root has a place in it.
 */
const WINDOWS: Record<RootlessForm | ShellForm, [number, number]> = {
    'A': [48, 62],
    'B': [48, 62],
    'R-7': [41, 52],
    'R-3': [44, 55]
}

/**
 * Shell or rootless voicings for each chord of a progression, low to high: the first chord in its
 * form (rootless A, shell R-3 unless `form` says) at the bottom of its range, each next one in
 * the form and octave that moves least from the one before (shells count their third and seventh:
 * the root is the bass's and leaps). A shell whose notes, as played, would sit below their low
 * interval limit (`belowLowIntervalLimit`) takes the other form: Am7 R-3 is A2 C3 G3, a minor third
 * under C3, so it is played R-7, A2 G3 C4 (the first chord too, whatever `form` says). With both
 * hands the third sounds a tenth above the root (A2 + C4 G4), so R-3 stays. Null for a chord that
 * doesn't read or can't take the voicing (a triad has no seventh for a shell).
 */
export function voiceLeadVoicings(
    symbols: readonly string[],
    options: VoiceLeadOptions
): (LedVoicing | null)[] {
    const shell = options.voicing === 'shell'
    const forms: (RootlessForm | ShellForm)[] = shell ? ['R-3', 'R-7'] : ['A', 'B']
    const shift = ((options.octave ?? 3) - 3) * 12
    const formKey = shell ? 'shell' : 'rootless'
    // Rootless voicings take the key's 9ths and 13ths, and a dominant knows the chord after it.
    let context: PianoVoicingOptions = {}
    const voiced = (symbol: string, form: RootlessForm | ShellForm, octave: number) => {
        try {
            return pianoVoicing(symbol, {
                voicing: options.voicing,
                [formKey]: form,
                octave,
                ...context
            })
        } catch {
            return null
        }
    }
    // Both hands: a shell's root stays where it was chosen, in the left hand; its third and
    // seventh go to the right hand, an octave up (C3 + E4 B4). A rootless voicing stays put.
    const both = options.hands === 'left+right' && shell
    const optionsOf = (form: RootlessForm | ShellForm, octave: number): PianoVoicingOptions => ({
        voicing: options.voicing,
        [formKey]: form,
        octave: octave + (both ? 1 : 0),
        ...(options.hands ? { hands: options.hands } : {}),
        ...context
    })
    // The keys as they are played (with the hands), or null when they don't fit the piano.
    const played = (symbol: string, form: RootlessForm | ShellForm, octave: number) => {
        try {
            return pianoVoicing(symbol, optionsOf(form, octave))
        } catch {
            return null
        }
    }
    // The notes that lead: shells' third and seventh, every note of a rootless voicing.
    const leading = (pitches: number[]) => (shell ? pitches.slice(1) : pitches)
    let previous: number[] | null = null
    return symbols.map((symbol, i) => {
        const next = symbols[i + 1]
        context = {
            ...(options.key && !shell ? { key: options.key } : {}),
            ...(next && !shell ? { resolvesTo: next } : {})
        }
        type Candidate = Scored<{ form: RootlessForm | ShellForm; octave: number }> & {
            outside: number
            muddy: boolean
        }
        // Each candidate with how far its lowest note is outside its window (0 inside), and
        // whether the notes as they sound (an octave up for both hands) are muddy (or off the keys).
        const candidatesOf = (allowed: (RootlessForm | ShellForm)[]) => {
            const candidates: Candidate[] = []
            for (const form of allowed) {
                const [low, high] = WINDOWS[form]
                for (let octave = 0; octave <= 8; octave++) {
                    const v = voiced(symbol, form, octave)
                    if (!v) continue
                    const lowest = v.pitches[0]!
                    const notes = leading(v.pitches)
                    const sounding = both ? played(symbol, form, octave)?.pitches : v.pitches
                    candidates.push({
                        value: { form, octave },
                        cost: previous ? voiceMotion(notes, previous) : lowest - low - shift,
                        common: previous ? common(notes, previous) : 0,
                        center: Math.abs(mean(v.pitches) - (CENTER - 5 + shift)),
                        outside: Math.max(0, low + shift - lowest, lowest - high - shift),
                        muddy: !sounding || belowLowIntervalLimit(sounding)
                    })
                }
            }
            return candidates
        }
        const first = options.form ?? forms[0]!
        let pool = candidatesOf(previous ? forms : [first])
        if (shell) {
            // A shell whose third would blur with the root (A2 C3: a minor third under C3) takes
            // the other form (A2 G3 C4): the first chord in its window, the next ones anywhere.
            const clear = (list: Candidate[]) =>
                list.filter((c) => !c.muddy && (previous || c.outside === 0))
            const other = forms.find((f) => f !== first)!
            const fallback = previous ? [] : clear(candidatesOf([other]))
            const kept = clear(pool).length ? clear(pool) : fallback
            if (kept.length) pool = kept
        }
        // Inside a window when one fits; else the nearest to its window (never a null for a chord
        // that takes the voicing).
        const nearest = Math.min(...pool.map((c) => c.outside))
        const best = bestOf(pool.filter((c) => c.outside === nearest))
        if (!best) return null
        const chosen = optionsOf(best.form, best.octave)
        previous = leading(voiced(symbol, best.form, best.octave)!.pitches)
        return { options: chosen, pitches: pianoVoicing(symbol, chosen)!.pitches }
    })
}
