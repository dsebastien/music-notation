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
    belowLowIntervalLimit,
    pianoVoicing,
    type PianoHands,
    type PianoVoicingOptions,
    type RootlessForm,
    type ShellForm
} from './piano-chord.js'

export { belowLowIntervalLimit }

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
     * bass, at least a fourth under the chord, from octave 3 down; a slash chord's bass, and the
     * next chord's, the nearest to the bass before (C C7/Bb F/A: C3 Bb2 A2), not below C2. The
     * chord keeps a root or fifth bass doubled.
     */
    bass?: boolean
}

/** A bass line written with slash chords leads down to C2 at most. */
const BASS_FLOOR = 36

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
    // The left hand's last bass, and whether it was a slash chord's.
    let previousBass: number | null = null
    let previousSlash = false
    // The bass under a chord: at least a fourth under it, from octave 3 down, as high as it fits.
    // A written bass line leads instead: a slash chord's bass, and the bass of the chord right
    // after one, is the nearest to the bass before (ties: the higher), never below C2 when another
    // fits, so a stepwise line stays stepwise (C G/B Am C/G F: C3 B2 A2 G2 F2).
    const bassUnder = (chroma: number, chord: number[], slash: boolean) => {
        let high = 48 + chroma
        while (high > chord[0]! - 5) high -= 12
        const fits: number[] = []
        for (let p = high; p >= BASS_FLOOR; p -= 12) fits.push(p)
        if (previousBass === null || !(slash || previousSlash) || !fits.length) return high
        const from = previousBass
        return fits.reduce((a, b) => (Math.abs(b - from) < Math.abs(a - from) ? b : a))
    }
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
        // The pop texture: the root (or a slash chord's bass) in the left hand, at least a fourth
        // under the chord.
        const low = bassUnder(bass ?? set.root!, best, bass !== null)
        // Without hands, a slash chord's bass stands alone: it doesn't lead the next one.
        if (options.bass) {
            previousBass = low
            previousSlash = bass !== null
        }
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

/** Rootless voicings with both hands: the right hand's lowest note from F3 to F4. */
const BOTH_HANDS_ROOTLESS: [number, number] = [53, 65]

/**
 * Shells with both hands, after the first chord: the left hand's root anywhere from C2 to G3, and
 * the right hand's lowest note (the third or the seventh, an octave above the one-hand shell) from
 * G3 to C5, where the first chord's windows put it. The guide tones lead, so the root goes where they need it (E7 after Bm7b5 D4 A4: E2
 * under D4 G#4), and the right hand doesn't drift over a long progression.
 */
const BOTH_HANDS_SHELL_ROOT: [number, number] = [36, 55]
const BOTH_HANDS_SHELL_RIGHT: [number, number] = [55, 72]

/**
 * After the first chord, rootless voicings start at D3 or above: a long progression that drifts
 * down is brought back up rather than sitting on C3.
 */
const ROOTLESS_FLOOR = 50

/**
 * Where each form may sit, by its lowest note (MIDI, at the default octave 3). Rootless voicings
 * start between C3 and D4 (D3 after the first chord: ROOTLESS_FLOOR), so they stay in the comping
 * range (C3 to C5). Shells keep their root
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
    const bothRootless = options.hands === 'left+right' && !shell
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
                // Rootless with both hands: the right hand from F3 up, clear of the left hand.
                const [bottom, high] = bothRootless ? BOTH_HANDS_ROOTLESS : WINDOWS[form]
                const low = !shell && previous ? Math.max(bottom, ROOTLESS_FLOOR) : bottom
                for (let octave = 0; octave <= 8; octave++) {
                    const v = voiced(symbol, form, octave)
                    if (!v) continue
                    const lowest = v.pitches[0]!
                    const notes = leading(v.pitches)
                    const sounding = both ? played(symbol, form, octave)?.pitches : v.pitches
                    // Both-hand shells after the first chord: the root and the right hand each in
                    // their own window (the right hand's lowest note is the one-hand third or
                    // seventh, an octave up).
                    const outside =
                        both && previous
                            ? Math.max(
                                  0,
                                  BOTH_HANDS_SHELL_ROOT[0] + shift - lowest,
                                  lowest - BOTH_HANDS_SHELL_ROOT[1] - shift,
                                  BOTH_HANDS_SHELL_RIGHT[0] + shift - (notes[0]! + 12),
                                  notes[0]! + 12 - BOTH_HANDS_SHELL_RIGHT[1] - shift
                              )
                            : Math.max(0, low + shift - lowest, lowest - high - shift)
                    candidates.push({
                        value: { form, octave },
                        cost: previous ? voiceMotion(notes, previous) : lowest - low - shift,
                        common: previous ? common(notes, previous) : 0,
                        center: Math.abs(mean(v.pitches) - (CENTER - 5 + shift)),
                        outside,
                        muddy: !sounding || belowLowIntervalLimit(sounding)
                    })
                }
            }
            return candidates
        }
        const first = options.form ?? forms[0]!
        let pool = candidatesOf(previous ? forms : [first])
        // A voicing whose notes would blur (a shell's A2 C3, a minor third under C3; a rootless
        // C3 D3, a second under Eb3) takes the other form (A2 G3 C4; F3 A3 C4 D4): the first
        // chord in its window, the next ones anywhere.
        const clear = (list: Candidate[]) =>
            list.filter((c) => !c.muddy && (previous || c.outside === 0))
        const other = forms.find((f) => f !== first)!
        const fallback = previous ? [] : clear(candidatesOf([other]))
        // The first chord blurring in its window takes the other form there, not an octave up.
        const blurs = !previous && pool.some((c) => c.muddy && c.outside === 0)
        const kept = clear(pool).length && !(blurs && fallback.length) ? clear(pool) : fallback
        if (kept.length) pool = kept
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
