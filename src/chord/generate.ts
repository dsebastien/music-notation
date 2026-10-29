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
    /** Which of the chord's notes is in the bass, in the order tonal lists them (0 the root, then
     * usually the third, the fifth, the seventh); null for a slash chord's bass outside the chord. */
    inversion: number | null
    shape: VoicingShape | null
    /** Lower is easier. */
    difficulty: number
    /** What makes it harder: "barre", "stretch", "reach", "awkward fingering", "muted inner
     * string", "open string inside the shape", "open strings far from the frets", "no fifth",
     * "thin". */
    reasons: string[]
}

export interface VoicingOptions {
    /** Open-string pitches (MIDI), lowest string first; standard guitar by default. */
    tuning?: number[]
    /** Frets the fretted notes stay within ([5, 9]; 0 counts as 1), or 'open' for the first
     * position (frets 1–4). */
    area?: [number, number] | 'open'
    /** The string the bass note is on (1 = the highest string). */
    bassString?: number
    /** The strings allowed to sound (1 = the highest string); all by default. */
    strings?: number[]
    /** Which of the chord's notes is in the bass: 0 (the root), 1, 2 or 3 (usually the third, the
     * fifth, the seventh), or 'any'. The root by default, any note on re-entrant tunings
     * (ukulele). Slash chords keep their bass. */
    inversion?: number | 'any'
    /** Frets the hand covers, 4 by default (5 is a stretch, 6 at most). */
    maxSpan?: number
    /** Open strings may sound; true by default. */
    allowOpen?: boolean
    /** Fewest sounding strings: 4 by default (2 for power chords), fewer when fewer are allowed. */
    minStrings?: number
    /** Muted strings between sounding ones; false by default. */
    gaps?: boolean
    /** The highest fret used, 15 by default (up to 24); at least the area's last fret. */
    maxFret?: number
}

/** Generation explores every combination: more strings than this would be slow. */
export const MAX_GENERATED_STRINGS = 8

/** The widest hand the generator considers, in frets. */
const MAX_SPAN = 6

interface Tone {
    chroma: number
    /** The interval number (1, 3, 5, 7, 9…); 0 for a slash chord's bass outside the chord. */
    number: number
    required: boolean
}

interface ChordInfo {
    tones: Tone[]
    members: NoteSetMember[]
    /** A slash chord's bass. */
    bass: number | null
    root: number
    suffix: string
}

/**
 * The chord's tones and which of them a voicing must sound: the root, the third (or the sus 2/4),
 * sevenths and sixths, altered notes and the highest extension. The perfect fifth and lower
 * natural extensions may be left out (and an 11th chord's major third).
 */
function chordInfo(symbol: string): ChordInfo | null {
    const set = chordNoteSet(symbol)
    const parts = splitChordSymbol(symbol)
    if (!set || !parts) return null
    const bass = parts.bass ? chromaOf(parts.bass) : null
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
    return {
        tones,
        members,
        bass,
        root: chromaOf(parts.root)!,
        suffix: canonicalSuffix(parts.suffix)
    }
}

/** One finger: a note, or a barre across adjacent strings at one fret. */
interface Group {
    fret: number
    /** Lowest and highest string it holds (indexes, lowest string first). */
    from: number
    to: number
    /** Strings it presses (at its fret). */
    strings: number[]
    /** Lies over strings fretted higher, which only the index finger can do. */
    under: boolean
}

interface Fingering {
    fingers: (string | null)[]
    cost: number
    /** Two fingers on one fret with a finger between them on a higher fret. */
    awkward: boolean
    /** A barre over four strings or more, or over strings fretted higher (not a small one like
     * F xx3211's). */
    fullBarre: boolean
}

/** Every way to split the notes on one fret into single notes and barres. */
function groupingsAt(
    fret: number,
    strings: number[],
    frets: readonly (number | null)[]
): Group[][] {
    const result: Group[][] = []
    const walk = (i: number, acc: Group[]) => {
        if (i === strings.length) {
            result.push(acc)
            return
        }
        for (let j = i; j < strings.length; j++) {
            const from = strings[i]!
            const to = strings[j]!
            let ok = true
            let under = false
            for (let s = from; s <= to; s++) {
                const f = frets[s]
                if (f === null || f === undefined || f < fret) {
                    ok = false
                    break
                }
                if (f > fret) under = true
            }
            if (!ok) break
            walk(j + 1, [...acc, { fret, from, to, strings: strings.slice(i, j + 1), under }])
        }
    }
    walk(0, [])
    return result
}

/** Increasing finger numbers (1–4) for this many groups. */
function fingerChoices(count: number): number[][] {
    const out: number[][] = []
    const walk = (start: number, acc: number[]) => {
        if (acc.length === count) {
            out.push(acc)
            return
        }
        for (let f = start; f <= 4 - (count - acc.length - 1); f++) walk(f + 1, [...acc, f])
    }
    walk(1, [])
    return out
}

/** The easiest fingering of a voicing; null when a hand can't play it. */
function bestFingering(frets: readonly (number | null)[]): Fingering | null {
    const empty: (string | null)[] = frets.map(() => null)
    const byFret = new Map<number, number[]>()
    frets.forEach((fret, s) => {
        if (fret !== null && fret > 0) byFret.set(fret, [...(byFret.get(fret) ?? []), s])
    })
    if (!byFret.size) return { fingers: empty, cost: 0, awkward: false, fullBarre: false }
    const fretList = [...byFret.keys()].sort((a, b) => a - b)
    const lowest = fretList[0]!
    const top = frets.reduce<number>((t, f, s) => (f === null ? t : s), -1)
    const options = fretList.map((f) => groupingsAt(f, byFret.get(f)!, frets))
    let best: Fingering | null = null
    const consider = (groups: Group[]) => {
        if (groups.length > 4) return
        // Groups in the order fingers take them: by fret, then from the low string.
        const sorted = [...groups].sort((a, b) => a.fret - b.fret || a.from - b.from)
        for (const choice of fingerChoices(sorted.length)) {
            let ok = true
            for (let i = 0; i < sorted.length && ok; i++) {
                const g = sorted[i]!
                // Only the index finger lies over strings fretted higher, on the lowest fret.
                if (g.under && (choice[i] !== 1 || g.fret !== lowest)) ok = false
                for (let j = i + 1; j < sorted.length && ok; j++) {
                    // A finger reaches at most one fret past one fret per finger.
                    if (sorted[j]!.fret - g.fret > choice[j]! - choice[i]! + 1) ok = false
                }
            }
            if (!ok) continue
            let cost = sorted.length
            let awkward = false
            sorted.forEach((g, i) => {
                const finger = choice[i]!
                if (g.strings.length > 1) {
                    cost += 2.5
                    // A small index barre over the top strings (F xx3211, Dm7 xx0211) is the usual way.
                    if (finger === 1 && g.fret === lowest && g.to === top && !g.under) cost -= 2
                }
                // One finger per fret is the relaxed hand.
                cost += 0.1 * Math.abs(g.fret - lowest - (finger - 1))
            })
            // Two fingers on one fret, three strings apart or more, another finger between them.
            for (const a of sorted)
                for (const b of sorted)
                    if (a !== b && a.fret === b.fret && b.from - a.to >= 3)
                        if (sorted.some((c) => c.fret > a.fret && c.from > a.to && c.to < b.from))
                            awkward = true
            if (awkward) cost += 1.5
            if (!best || cost < best.cost - 1e-9) {
                const fingers = [...empty]
                sorted.forEach((g, i) => {
                    for (const s of g.strings) fingers[s] = String(choice[i])
                })
                const fullBarre = sorted.some(
                    (g) => g.strings.length > 1 && (g.under || g.strings.length > 3)
                )
                best = { fingers, cost, awkward, fullBarre }
            }
        }
    }
    const walk = (i: number, acc: Group[]) => {
        if (acc.length > 4) return
        if (i === options.length) {
            consider(acc)
            return
        }
        for (const grouping of options[i]!) walk(i + 1, [...acc, ...grouping])
    }
    walk(0, [])
    return best
}

/**
 * Fingers for a fretted voicing (lowest string first, as frets are): any finger can hold a note or
 * barre adjacent strings on one fret (every string under it sounding at that fret), only the index
 * can lie over strings fretted higher, finger numbers go up with the frets, at most four fingers.
 * The easiest such fingering; null when a hand can't play it.
 */
export function fingerVoicing(frets: readonly (number | null)[]): (string | null)[] | null {
    return bestFingering(frets)?.fingers ?? null
}

/** Where each open-position CAGED chord has its root: string index, lowest first. */
const CAGED_ROOT_STRING: Record<'C' | 'A' | 'G' | 'E' | 'D', number> = {
    C: 1,
    A: 1,
    G: 0,
    E: 0,
    D: 2
}

/**
 * The open chords guitarists learn first, in standard tuning: they rank as the easiest of their
 * chord.
 */
const OPEN_CHORDS = new Set(
    [
        'x32010 x02220 320003 320033 022100 xx0232',
        'x02210 022000 xx0231',
        'x32310 x02020 x02223 320001 020100 022130 xx0212 x21202',
        'x02010 x02213 020000 022030 022033 xx0211',
        'x32000 x02120 320002 xx0222 021100 xx3210',
        'x02200 x02230 xx0230 xx0233 022200',
        'x32030 x32033 x02222 x32210 xx0202 022120 320000 x02212 022020 xx0201',
        'x20003 332010 200232 032010 330013 330033'
    ]
        .join(' ')
        .split(' ')
)

const compact = (frets: readonly (number | null)[]) =>
    frets.some((f) => f !== null && f > 9)
        ? frets.map((f) => (f === null ? 'x' : f)).join('-')
        : frets.map((f) => (f === null ? 'x' : f)).join('')

const sameTuning = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])

/** One finger across two strings or more. */
const hasBarre = (frets: readonly (number | null)[], fingers: readonly (string | null)[]) => {
    const counts = new Map<string, number>()
    frets.forEach((fret, s) => {
        const finger = fingers[s]
        if (fret && finger) {
            const key = `${finger}@${fret}`
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
    })
    return [...counts.values()].some((n) => n >= 2)
}

/** The CAGED letters' chords of the same quality, looked up once per chord. */
type CagedTargets = Map<string, Set<number> | null>

function cagedTargets(info: ChordInfo): CagedTargets {
    const targets: CagedTargets = new Map()
    for (const letter of ['E', 'A', 'C', 'G', 'D']) {
        const set = chordNoteSet(letter + info.suffix)
        targets.set(letter, set ? new Set(set.members.map((m) => m.chroma)) : null)
    }
    return targets
}

function shapeOf(
    frets: readonly (number | null)[],
    info: ChordInfo,
    targets: CagedTargets,
    tuning: readonly number[],
    fingers: readonly (string | null)[] | null
): VoicingShape | null {
    const sounding = frets.flatMap((f, s) => (f === null ? [] : [s]))
    if (!sounding.length || tuning.length !== frets.length) return null
    const chromas = new Set(sounding.map((s) => (tuning[s]! + frets[s]!) % 12))
    if (info.members.length === 2 && info.tones.every((t) => t.number === 1 || t.number === 5)) {
        return 'Power chord'
    }
    // Root, third and seventh (or sixth) only, on three or four strings.
    const shell =
        sounding.length <= 4 &&
        info.tones.some((t) => t.number === 7 || t.number === 6) &&
        [...chromas].every((c) =>
            info.tones.some((t) => t.chroma === c && [1, 3, 6, 7].includes(t.number))
        )
    if (shell) return 'Shell'
    const adjacent = sounding[sounding.length - 1]! - sounding[0]! === sounding.length - 1
    if (sounding.length === 3 && adjacent && chromas.size === 3) return 'Triad'
    const fretted = sounding.map((s) => frets[s]!).filter((f) => f > 0)
    const open = sounding.some((s) => frets[s] === 0)
    // Open chords sound the highest string and at least four strings, fretted within frets 1–4.
    const top = sounding[sounding.length - 1] === frets.length - 1
    if (open && top && sounding.length >= 4 && (!fretted.length || Math.max(...fretted) <= 4)) {
        return 'Open'
    }
    const barre = fingers ? hasBarre(frets, fingers) : false
    if (sameTuning(tuning, STANDARD_TUNING) && !open && fretted.length) {
        const lowest = Math.min(...fretted)
        for (const letter of ['E', 'A', 'C', 'G', 'D'] as const) {
            if (sounding[0] !== CAGED_ROOT_STRING[letter]) continue
            const target = targets.get(letter)
            if (!target) continue
            // Slide the shape down to the nut (from an octave up too): it must be that letter's
            // open chord, its root on the same string.
            const base = (((info.root - chromaOf(letter)!) % 12) + 12) % 12
            for (const shift of [base, base + 12]) {
                if (shift === 0 || lowest < shift) continue
                const moved = frets.map((f) => (f === null ? null : f - shift))
                if (moved.some((f) => f !== null && f > 4)) continue
                if (!sounding.every((s) => target.has((tuning[s]! + moved[s]!) % 12))) continue
                if (letter === 'E' || letter === 'A')
                    return barre ? `${letter}-shape barre` : `CAGED ${letter}`
                return `CAGED ${letter}`
            }
        }
    }
    return barre ? 'Other barre' : null
}

/**
 * The shape a voicing is played with: power chord, shell (root, third and seventh or sixth on three
 * or four strings), triad (three adjacent strings, three notes), open (open strings, frets 1–4),
 * E- or A-shape barre and the other CAGED shapes (in standard tuning: the open C, A, G, E or D
 * chord moved up the neck), other barre. Null when it's none of them.
 */
export function voicingShape(
    frets: readonly (number | null)[],
    symbol: string,
    tuning: readonly number[] = STANDARD_TUNING,
    fingers: readonly (string | null)[] | null = fingerVoicing(frets)
): VoicingShape | null {
    const info = chordInfo(symbol)
    return info ? shapeOf(frets, info, cagedTargets(info), tuning, fingers) : null
}

/** Usual shapes rank higher: they're the ones teachers and songbooks use. */
const KNOWN_SHAPES = new Set<VoicingShape>([
    'CAGED C',
    'CAGED A',
    'CAGED G',
    'CAGED E',
    'CAGED D',
    'Power chord'
])

/** Guitarist string number (1 = highest) ↔ index (0 = lowest). */
const indexOf = (number: number, count: number) => count - number

const bits = (n: number) => {
    let count = 0
    for (let v = n; v; v &= v - 1) count++
    return count
}

/**
 * Every playable voicing of a chord, easiest first; empty when the chord is unknown or nothing
 * fits the options. See VoicingOptions for the filters.
 */
export function generateVoicings(symbol: string, options: VoicingOptions = {}): GeneratedVoicing[] {
    const tuning = options.tuning ?? STANDARD_TUNING
    const count = tuning.length
    if (count < 2 || count > MAX_GENERATED_STRINGS) return []
    const info = chordInfo(symbol)
    if (!info) return []
    const { tones, members, bass } = info
    const targets = cagedTargets(info)
    const standard = sameTuning(tuning, STANDARD_TUNING)
    const allowedChromas = new Set(tones.map((t) => t.chroma))
    const [lo, hi] = options.area === 'open' ? [1, 4] : (options.area ?? [1, options.maxFret ?? 15])
    const maxFret = Math.min(24, Math.max(1, options.maxFret ?? 15, hi))
    const maxSpan = Math.min(MAX_SPAN, Math.max(1, options.maxSpan ?? 4))
    const allowOpen = options.allowOpen ?? true
    const allowed = new Set(
        (options.strings ?? Array.from({ length: count }, (_, i) => i + 1))
            .filter((n) => n >= 1 && n <= count)
            .map((n) => indexOf(n, count))
    )
    const minStrings = Math.min(allowed.size, options.minStrings ?? (members.length === 2 ? 2 : 4))
    // Re-entrant tunings (ukulele) put a higher string's note below: any chord note may be lowest.
    const ascending = tuning.every((p, i) => i === 0 || p > tuning[i - 1]!)
    const inversion = options.inversion ?? (ascending ? 0 : 'any')
    const power = members.length === 2 && tones.every((t) => t.number === 1 || t.number === 5)
    // The bass: a slash chord's, else the chord note the inversion asks for.
    const wantedBass =
        bass !== null ? bass : inversion === 'any' ? null : (members[inversion]?.chroma ?? -1)
    if (wantedBass === -1) return []
    const required = tones.reduce((mask, t) => (t.required ? mask | (1 << t.chroma) : mask), 0)
    // Strings still allowed after each one, for pruning.
    const allowedAfter = tuning.map((_, s) => [...allowed].filter((a) => a > s).length)

    const choices: (number | null)[][] = tuning.map((open, s) => {
        const list: (number | null)[] = [null]
        if (!allowed.has(s)) return list
        if (allowOpen && allowedChromas.has(open % 12)) list.push(0)
        for (let f = Math.max(1, lo); f <= Math.min(hi, maxFret); f++) {
            if (allowedChromas.has((open + f) % 12)) list.push(f)
        }
        return list
    })

    const evaluate = (candidate: (number | null)[]): GeneratedVoicing | null => {
        const sounding = candidate.flatMap((f, s) => (f === null ? [] : [s]))
        const first = sounding[0]!
        const last = sounding[sounding.length - 1]!
        const inner = last - first + 1 - sounding.length
        const pitches = sounding.map((s) => tuning[s]! + candidate[s]!)
        const chromas = new Set(pitches.map((p) => p % 12))
        // On three strings or fewer, a doubled note can't take the place of a missing one.
        if (sounding.length <= 3 && chromas.size < Math.min(sounding.length, tones.length)) {
            return null
        }
        const low = Math.min(...pitches)
        const bassAt = sounding[pitches.indexOf(low)]!
        if (wantedBass !== null && low % 12 !== wantedBass) return null
        const bassString = count - bassAt
        if (options.bassString !== undefined && bassString !== options.bassString) return null
        const fingering = bestFingering(candidate)
        if (!fingering) return null
        const { fingers } = fingering
        const shape = shapeOf(candidate, info, targets, tuning, fingers)
        const fretted = sounding.map((s) => candidate[s]!).filter((f) => f > 0)
        const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) + 1 : 0
        const used = new Set(fingers.filter(Boolean)).size
        const barre = hasBarre(candidate, fingers)
        const base = baseFretOf(candidate)
        const reasons: string[] = []
        const usual = standard && OPEN_CHORDS.has(compact(candidate))
        let difficulty = used + Math.max(0, span - 1) + base * 0.15
        if (barre) {
            // E- and A-shape barres are the barre chords everyone learns; a small barre over two or
            // three strings (F xx3211) is easy.
            difficulty +=
                shape === 'E-shape barre' || shape === 'A-shape barre' || !fingering.fullBarre
                    ? 1
                    : 3
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
        if (fingering.awkward) {
            difficulty += 1.5
            reasons.push('awkward fingering')
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
        const open = sounding.filter((s) => candidate[s] === 0)
        if (open.length && fretted.length && !usual) {
            // Open strings with the fretted notes far up the neck.
            if (Math.min(...fretted) > 4) {
                difficulty += 0.5 * (Math.min(...fretted) - 3)
                reasons.push('open strings far from the frets')
            }
            // An open string ringing between fretted ones, outside the usual open chords.
            const inside = open.filter(
                (s) => notes.some((n) => n < s) && notes.some((n) => n > s)
            ).length
            if (inside) {
                difficulty += inside
                reasons.push('open string inside the shape')
            }
        }
        const fifth = tones.find((t) => t.number === 5)
        if (fifth && !chromas.has(fifth.chroma)) {
            difficulty += 0.5
            reasons.push('no fifth')
        }
        if (usual) difficulty -= 3
        else if (shape === 'E-shape barre' || shape === 'A-shape barre') difficulty -= 2
        else if (shape && KNOWN_SHAPES.has(shape)) difficulty -= 1.5
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

    const results = new Map<string, GeneratedVoicing>()
    const frets: (number | null)[] = new Array<number | null>(count).fill(null)
    // Depth-first, string by string; branches that can't make a voicing stop early.
    const visit = (
        s: number,
        min: number,
        max: number,
        have: number,
        sounded: number,
        closed: boolean
    ) => {
        if (s === count) {
            if (sounded < minStrings || (required & ~have) !== 0) return
            const voicing = evaluate(frets)
            if (voicing) results.set(frets.join(','), voicing)
            return
        }
        // Not enough strings left for the missing notes, or for the fewest strings.
        const left = closed ? 0 : (allowed.has(s) ? 1 : 0) + allowedAfter[s]!
        if (bits(required & ~have) > left || sounded + left < minStrings) return
        for (const fret of choices[s]!) {
            if (fret === null) {
                frets[s] = null
                // Without gaps, a muted string after a sounding one ends the voicing.
                visit(s + 1, min, max, have, sounded, closed || (sounded > 0 && !options.gaps))
                continue
            }
            if (closed) continue
            const fretted = fret > 0
            const nextMin = fretted ? Math.min(min, fret) : min
            const nextMax = fretted ? Math.max(max, fret) : max
            if (fretted && nextMax - nextMin + 1 > maxSpan) continue
            frets[s] = fret
            visit(
                s + 1,
                nextMin,
                nextMax,
                have | (1 << ((tuning[s]! + fret) % 12)),
                sounded + 1,
                false
            )
        }
        frets[s] = null
    }

    visit(0, Infinity, -Infinity, 0, 0, false)
    const sounding = (v: GeneratedVoicing) => v.frets.filter((f) => f !== null).length
    return [...results.values()].sort(
        (a, b) =>
            a.difficulty - b.difficulty ||
            sounding(b) - sounding(a) ||
            a.baseFret - b.baseFret ||
            a.frets.join(',').localeCompare(b.frets.join(','))
    )
}
