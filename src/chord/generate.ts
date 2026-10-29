/**
 * Every playable way to play a chord on a fretted instrument, ranked by ease (#18). Computed from
 * the chord's notes and the tuning, so it works for any chord tonal knows, any tuning and any
 * string count (up to 8). Strings in options and results count the way guitarists do: 1 is the
 * highest string.
 */
import { STANDARD_TUNING, baseFretOf, type FrettedVoicing } from './guitar.js'
import { chordNoteSet, type NoteSetMember } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { canonicalSuffix } from '../theory/suffix.js'

/** Shape names, as guitar teachers use them. */
export type VoicingShape =
    | 'Open'
    | 'E-shape barre'
    | 'A-shape barre'
    | 'CAGED C'
    | 'CAGED A'
    | 'CAGED G'
    | 'CAGED E'
    | 'CAGED D'
    | 'Power chord'
    | 'Triad'
    | 'Shell'
    | 'Other barre'

export interface GeneratedVoicing extends FrettedVoicing {
    fingers: (string | null)[]
    baseFret: number
    /** The string the lowest note is on (1 = the highest string). */
    bassString: number
    /** Which chord tone is in the bass: 0 the root, 1 the third, 2 the fifth, 3 the seventh; null
     * for a slash chord's bass outside the chord. */
    inversion: number | null
    shape: VoicingShape | null
    /** Lower is easier. */
    difficulty: number
    /** What makes it harder: "barre", "stretch", "reach", "muted inner string", "no fifth", "thin",
     * "open strings far from the frets". */
    reasons: string[]
}

export interface VoicingOptions {
    /** Open-string pitches (MIDI), lowest string first; standard guitar by default. */
    tuning?: number[]
    /** Frets the fretted notes stay within ([5, 9]), or 'open' for the first position (frets 1–4). */
    area?: [number, number] | 'open'
    /** The string the bass note is on (1 = the highest string). */
    bassString?: number
    /** The strings allowed to sound (1 = the highest string); all by default. */
    strings?: number[]
    /** The chord tone in the bass: 0 (root, the default), 1 (third), 2 (fifth), 3 (seventh), or
     * 'any'. Slash chords keep their bass. */
    inversion?: number | 'any'
    /** Frets the hand covers, 4 by default (5 is a stretch). */
    maxSpan?: number
    /** Open strings may sound; true by default. */
    allowOpen?: boolean
    /** Fewest sounding strings: 4 by default (2 for power chords), fewer when fewer are allowed. */
    minStrings?: number
    /** Muted strings between sounding ones; false by default. */
    gaps?: boolean
    /** The highest fret used, 15 by default (up to 24). */
    maxFret?: number
}

/** Generation explores every combination: more strings than this would be slow. */
export const MAX_GENERATED_STRINGS = 8

interface Tone {
    chroma: number
    /** The interval number (1, 3, 5, 7, 9…); 0 for a slash chord's bass outside the chord. */
    number: number
    required: boolean
}

/**
 * The chord's tones and which of them a voicing must sound: the root, the third (or the sus 2/4),
 * sevenths and sixths, altered notes and the highest extension. The perfect fifth and lower
 * natural extensions may be left out (and an 11th chord's major third).
 */
function tonesOf(
    symbol: string
): { tones: Tone[]; members: NoteSetMember[]; bass: number | null } | null {
    const set = chordNoteSet(symbol)
    if (!set) return null
    const parts = splitChordSymbol(symbol)
    const bass = parts?.bass ? chromaOf(parts.bass) : null
    const members = set.members.filter((m) => m.interval !== null)
    const parsed = members.map((m) => {
        const hit = /^(\d+)([PMmdA]+)$/.exec(m.interval!)
        return { member: m, number: Number(hit?.[1] ?? 0), quality: hit?.[2] ?? '' }
    })
    const natural = (p: { number: number; quality: string }) =>
        p.number > 7 && (p.quality === 'M' || p.quality === 'P')
    const highest = Math.max(0, ...parsed.filter(natural).map((p) => p.number))
    const eleventh = parsed.some((p) => p.number === 11 && p.quality === 'P')
    const tones: Tone[] = parsed.map((p) => {
        let required = true
        if (p.number === 5 && p.quality === 'P') required = members.length === 2
        else if (natural(p) && p.number < highest) required = false
        else if (p.number === 3 && p.quality === 'M' && eleventh) required = false
        return { chroma: p.member.chroma, number: p.number, required }
    })
    if (bass !== null && !tones.some((t) => t.chroma === bass)) {
        tones.push({ chroma: bass, number: 0, required: true })
    }
    return { tones, members, bass }
}

/** The fretted notes of one voicing, with the finger each gets. */
interface Note {
    string: number
    fret: number
}

/** One finger per note in order, spaced one per fret when the hand allows it; null past 4. */
function assign(notes: Note[], first: number, lowest: number): Map<Note, number> | null {
    const sorted = [...notes].sort((a, b) => a.fret - b.fret || a.string - b.string)
    for (const spaced of [true, false]) {
        const fingers = new Map<Note, number>()
        let previous = first - 1
        for (const note of sorted) {
            const finger = spaced
                ? Math.max(previous + 1, Math.min(4, note.fret - lowest + 1))
                : previous + 1
            fingers.set(note, finger)
            previous = finger
        }
        if (previous <= 4) return fingers
    }
    return null
}

/**
 * Fingers for a fretted voicing (lowest string first, as frets are): one finger per note when four
 * are enough, else the index finger barres the lowest fret (every string under the barre sounding
 * at that fret or above) and the other fingers take the rest, a finger barring the highest fret
 * when needed. Null when the hand can't play it.
 */
export function fingerVoicing(frets: readonly (number | null)[]): (string | null)[] | null {
    const notes: Note[] = []
    frets.forEach((fret, string) => {
        if (fret !== null && fret > 0) notes.push({ string, fret })
    })
    const result: (string | null)[] = frets.map(() => null)
    if (!notes.length) return result
    const lowest = Math.min(...notes.map((n) => n.fret))
    const write = (fingers: Map<Note, number>) => {
        for (const [note, finger] of fingers) result[note.string] = String(finger)
        return result
    }
    if (notes.length <= 4) {
        const fingers = assign(notes, 1, lowest)
        if (fingers) return write(fingers)
    }
    // The index finger barres the lowest fret, from the first to the last string there.
    const atLowest = notes.filter((n) => n.fret === lowest).map((n) => n.string)
    if (atLowest.length < 2) return null
    const from = Math.min(...atLowest)
    const to = Math.max(...atLowest)
    for (let s = from; s <= to; s++) {
        const fret = frets[s]
        if (fret === null || fret === undefined || fret < lowest) return null
    }
    const barred = new Set(notes.filter((n) => n.fret === lowest))
    const rest = notes.filter((n) => !barred.has(n))
    const fingers = assign(rest, 2, lowest)
    if (fingers) {
        for (const note of barred) fingers.set(note, 1)
        return write(fingers)
    }
    // A second barre: one finger across the adjacent strings on the highest fret (A-shape).
    const highest = Math.max(...rest.map((n) => n.fret))
    const top = rest.filter((n) => n.fret === highest).sort((a, b) => a.string - b.string)
    if (top.length < 2 || top[top.length - 1]!.string - top[0]!.string !== top.length - 1) {
        return null
    }
    const others = rest.filter((n) => !top.includes(n))
    const lower = assign(others, 2, lowest)
    const finger = others.length + 2
    if (!lower || finger > 4) return null
    for (const note of barred) lower.set(note, 1)
    for (const note of top) lower.set(note, finger)
    return write(lower)
}

/** Where each open-position CAGED chord has its root: string index, lowest first. */
const CAGED_ROOT_STRING: Record<'C' | 'A' | 'G' | 'E' | 'D', number> = {
    C: 1,
    A: 1,
    G: 0,
    E: 0,
    D: 2
}

const sameTuning = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])

/** Strings at the lowest fret held by one finger across two strings or more. */
const hasBarre = (frets: readonly (number | null)[], fingers: readonly (string | null)[]) => {
    const counts = new Map<string, number>()
    frets.forEach((fret, s) => {
        const finger = fingers[s]
        if (fret && finger)
            counts.set(`${finger}@${fret}`, (counts.get(`${finger}@${fret}`) ?? 0) + 1)
    })
    return [...counts.values()].some((n) => n >= 2)
}

/**
 * The shape a voicing is played with: power chord, triad (three adjacent strings), open (open
 * strings, frets 1–4), E- or A-shape barre and the other CAGED shapes (in standard tuning: the
 * open C, A, G, E or D chord moved up the neck), shell (root, third and seventh), other barre.
 * Null when it's none of them.
 */
export function voicingShape(
    frets: readonly (number | null)[],
    symbol: string,
    tuning: readonly number[] = STANDARD_TUNING,
    fingers: readonly (string | null)[] | null = fingerVoicing(frets)
): VoicingShape | null {
    const info = tonesOf(symbol)
    const parts = splitChordSymbol(symbol)
    if (!info || !parts) return null
    const sounding = frets.flatMap((f, s) => (f === null ? [] : [s]))
    if (!sounding.length || tuning.length !== frets.length) return null
    const chromas = new Set(sounding.map((s) => (tuning[s]! + frets[s]!) % 12))
    if (info.members.length === 2 && info.tones.every((t) => t.number === 1 || t.number === 5)) {
        return 'Power chord'
    }
    const adjacent = sounding[sounding.length - 1]! - sounding[0]! === sounding.length - 1
    if (sounding.length === 3 && adjacent && chromas.size === 3) return 'Triad'
    const fretted = sounding.map((s) => frets[s]!).filter((f) => f > 0)
    const open = sounding.some((s) => frets[s] === 0)
    // Open chords sound the highest string and at least four strings, fretted within frets 1–4.
    const top = sounding[sounding.length - 1] === frets.length - 1
    if (open && top && sounding.length >= 4 && (!fretted.length || Math.max(...fretted) <= 4)) {
        return 'Open'
    }
    // Root, third and seventh (or sixth) only, on three or four strings.
    const shell =
        sounding.length <= 4 &&
        info.tones.some((t) => t.number === 7 || t.number === 6) &&
        [...chromas].every((c) =>
            info.tones.some((t) => t.chroma === c && [1, 3, 6, 7].includes(t.number))
        )
    if (shell) return 'Shell'
    const barre = fingers ? hasBarre(frets, fingers) : false
    if (sameTuning(tuning, STANDARD_TUNING) && !open && fretted.length) {
        const root = chromaOf(parts.root)!
        const suffix = canonicalSuffix(parts.suffix)
        for (const letter of ['E', 'A', 'C', 'G', 'D'] as const) {
            // Slide the shape down to the nut: it must be that letter's open chord, root in place.
            const shift = (((root - chromaOf(letter)!) % 12) + 12) % 12
            const lowest = Math.min(...fretted)
            if (shift === 0 || lowest < shift) continue
            const moved = frets.map((f) => (f === null ? null : f - shift))
            const movedFretted = moved.filter((f): f is number => f !== null && f > 0)
            if (movedFretted.some((f) => f > 4)) continue
            const bassString = sounding[0]!
            if (bassString !== CAGED_ROOT_STRING[letter]) continue
            const asOpen = new Set(sounding.map((s) => (tuning[s]! + moved[s]!) % 12))
            const target = chordNoteSet(letter + suffix)
            if (!target || ![...asOpen].every((c) => target.members.some((m) => m.chroma === c))) {
                continue
            }
            if (letter === 'E' || letter === 'A') {
                return barre
                    ? letter === 'E'
                        ? 'E-shape barre'
                        : 'A-shape barre'
                    : `CAGED ${letter}`
            }
            return `CAGED ${letter}`
        }
    }
    return barre ? 'Other barre' : null
}

const KNOWN_SHAPES = new Set<VoicingShape>([
    'Open',
    'E-shape barre',
    'A-shape barre',
    'CAGED C',
    'CAGED A',
    'CAGED G',
    'CAGED E',
    'CAGED D',
    'Power chord'
])

/** Guitarist string number (1 = highest) ↔ index (0 = lowest). */
const indexOf = (number: number, count: number) => count - number

/**
 * Every playable voicing of a chord, easiest first; empty when the chord is unknown or nothing
 * fits the options. See VoicingOptions for the filters.
 */
export function generateVoicings(symbol: string, options: VoicingOptions = {}): GeneratedVoicing[] {
    const tuning = options.tuning ?? STANDARD_TUNING
    const count = tuning.length
    if (count < 2 || count > MAX_GENERATED_STRINGS) return []
    const info = tonesOf(symbol)
    if (!info) return []
    const { tones, members, bass } = info
    const allowedChromas = new Set(tones.map((t) => t.chroma))
    const maxFret = Math.min(24, Math.max(1, options.maxFret ?? 15))
    const [lo, hi] = options.area === 'open' ? [1, 4] : (options.area ?? [1, maxFret])
    const maxSpan = Math.max(1, options.maxSpan ?? 4)
    const allowOpen = options.allowOpen ?? true
    const allowed = new Set(
        (options.strings ?? Array.from({ length: count }, (_, i) => i + 1))
            .filter((n) => n >= 1 && n <= count)
            .map((n) => indexOf(n, count))
    )
    const minStrings = Math.min(allowed.size, options.minStrings ?? (members.length === 2 ? 2 : 4))
    // The bass: a slash chord's, else the chord tone the inversion asks for.
    const inversion = options.inversion ?? 0
    const power = members.length === 2 && tones.every((t) => t.number === 1 || t.number === 5)
    const wantedBass =
        bass !== null ? bass : inversion === 'any' ? null : (members[inversion]?.chroma ?? -1)
    if (wantedBass === -1) return []

    const choices: (number | null)[][] = tuning.map((open, s) => {
        const list: (number | null)[] = [null]
        if (!allowed.has(s)) return list
        if (allowOpen && allowedChromas.has(open % 12)) list.push(0)
        for (let f = Math.max(1, lo); f <= Math.min(hi, maxFret); f++) {
            if (allowedChromas.has((open + f) % 12)) list.push(f)
        }
        return list
    })

    const results = new Map<string, GeneratedVoicing>()
    const frets: (number | null)[] = new Array<number | null>(count).fill(null)
    const visit = (s: number, min: number, max: number) => {
        if (s === count) {
            const voicing = evaluate(frets)
            if (voicing) results.set(frets.join(','), voicing)
            return
        }
        for (const fret of choices[s]!) {
            const fretted = fret !== null && fret > 0
            const nextMin = fretted ? Math.min(min, fret) : min
            const nextMax = fretted ? Math.max(max, fret) : max
            if (fretted && nextMax - nextMin + 1 > maxSpan) continue
            frets[s] = fret
            visit(s + 1, nextMin, nextMax)
        }
        frets[s] = null
    }

    const evaluate = (candidate: (number | null)[]): GeneratedVoicing | null => {
        const sounding = candidate.flatMap((f, s) => (f === null ? [] : [s]))
        if (sounding.length < minStrings) return null
        const first = sounding[0]!
        const last = sounding[sounding.length - 1]!
        const inner = last - first + 1 - sounding.length
        if (inner > 0 && !options.gaps) return null
        const pitches = sounding.map((s) => tuning[s]! + candidate[s]!)
        const chromas = new Set(pitches.map((p) => p % 12))
        if (tones.some((t) => t.required && !chromas.has(t.chroma))) return null
        // On three strings or fewer, a doubled note can't take the place of a missing one.
        if (sounding.length <= 3 && chromas.size < Math.min(sounding.length, tones.length)) {
            return null
        }
        const low = Math.min(...pitches)
        const bassAt = sounding[pitches.indexOf(low)]!
        if (wantedBass !== null && low % 12 !== wantedBass) return null
        const bassString = count - bassAt
        if (options.bassString !== undefined && bassString !== options.bassString) return null
        const fingers = fingerVoicing(candidate)
        if (!fingers) return null
        const shape = voicingShape(candidate, symbol, tuning, fingers)
        const fretted = sounding.map((s) => candidate[s]!).filter((f) => f > 0)
        const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) + 1 : 0
        const used = new Set(fingers.filter(Boolean)).size
        const barre = hasBarre(candidate, fingers)
        const base = baseFretOf(candidate)
        const reasons: string[] = []
        let difficulty = used + Math.max(0, span - 1) + base * 0.15
        if (barre) {
            difficulty += 3
            reasons.push('barre')
        }
        // A reach: two notes three frets apart or more, two strings apart or more.
        const notes = sounding.filter((s) => candidate[s]! > 0)
        const reach = notes.some((a) =>
            notes.some((b) => b - a >= 2 && Math.abs(candidate[a]! - candidate[b]!) >= 3)
        )
        if (reach) {
            difficulty += 1.5
            reasons.push('reach')
        }
        if (span >= 5) {
            difficulty += 2
            reasons.push('stretch')
        }
        if (inner > 0) {
            difficulty += 2 * inner
            reasons.push('muted inner string')
        }
        // Muted strings: the low ones are usual (the bass starts higher), the high ones harder to
        // keep quiet. Power chords are played that way.
        if (!power) {
            const strings = [...allowed]
            difficulty += strings.filter((s) => s < first).length
            difficulty += 1.5 * strings.filter((s) => s > last).length
        }
        if (sounding.length < 4 && !power) reasons.push('thin')
        // Open strings with the fretted notes far up the neck.
        const open = sounding.some((s) => candidate[s] === 0)
        if (open && fretted.length && Math.min(...fretted) > 4) {
            difficulty += 0.5 * (Math.min(...fretted) - 3)
            reasons.push('open strings far from the frets')
        }
        const fifth = tones.find((t) => t.number === 5)
        if (fifth && !chromas.has(fifth.chroma)) {
            difficulty += 0.5
            reasons.push('no fifth')
        }
        if (shape && KNOWN_SHAPES.has(shape)) difficulty -= 1.5
        const lowChroma = low % 12
        const inBass = members.findIndex((m) => m.chroma === lowChroma)
        return {
            frets: [...candidate],
            fingers,
            baseFret: base,
            bassString,
            inversion: inBass < 0 ? null : inBass,
            shape,
            difficulty: Math.max(0, Math.round(difficulty * 10) / 10),
            reasons
        }
    }

    visit(0, Infinity, -Infinity)
    const sounding = (v: GeneratedVoicing) => v.frets.filter((f) => f !== null).length
    return [...results.values()].sort(
        (a, b) =>
            a.difficulty - b.difficulty ||
            sounding(b) - sounding(a) ||
            a.baseFret - b.baseFret ||
            a.frets.join(',').localeCompare(b.frets.join(','))
    )
}
