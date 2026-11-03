/**
 * Finding scales and keys (#42, #48): the scales that hold some notes or the tones of some chords,
 * the scales to play over a chord, the chords in a scale, and the most likely key of a
 * progression.
 */
import { Interval, ScaleType, Scale } from 'tonal'
import { chordNoteSet } from './note-set.js'
import { chromaOf, nameOf } from './pitch.js'
import { scaleSpelling } from './scales.js'
import { parseChord } from './chord-symbol.js'
import {
    degreeOf,
    keyNotes,
    keyProblem,
    noteName,
    romanText,
    stackedChord,
    type MusicalKey
} from './keys.js'

export interface ScaleMatch {
    /** "G major", "E minor pentatonic". */
    name: string
    tonic: string
    /** tonal's scale type: "major", "minor pentatonic". */
    type: string
    /** The scale's notes, from the tonic. */
    notes: string[]
    /** The scale's notes that the notes or chords don't play. */
    missing: string[]
    /** The notes or chord tones that aren't in the scale, as written. */
    outside: string[]
}

export interface FindScalesOptions {
    /**
     * How to read the items: note names or chord symbols. By default, chords when any item isn't
     * a plain note name (G D Em C); "G C D" reads as three notes unless you say chords. Notes with
     * octaves (C4 E4 G4) are notes, unless every one could be a power chord (A5 D5 E5) or a seventh
     * chord (A7 D7 E7).
     */
    as?: 'notes' | 'chords'
    /** Scales with up to this many outside notes are listed too (after the others); 1 by default. */
    maxOutside?: number
    /** At most this many scales, 20 by default. */
    limit?: number
}

/**
 * How far down the list a scale type goes: major and minor first, then their modes, then the
 * pentatonic and blues scales, then the harmonic and melodic minor and their usual modes; the
 * others last.
 */
function typeCost(type: string): number {
    if (type === 'major' || type === 'minor') return 0
    if (['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'].includes(type)) return 0.5
    if (['major pentatonic', 'minor pentatonic', 'major blues', 'minor blues'].includes(type))
        return 1
    if (
        [
            'harmonic minor',
            'melodic minor',
            'phrygian dominant',
            'lydian dominant',
            'altered',
            'locrian #2',
            'mixolydian b6',
            'dorian b2',
            'lydian augmented',
            'bebop',
            'diminished',
            'half-whole diminished',
            'whole tone'
        ].includes(type)
    )
        return 1.25
    return 3
}

/** Scale types worth offering: up to 8 notes (the chromatic scale and 9-note ones hold too much). */
let types: { name: string; chromas: number[] }[] | null = null
function scaleTypes() {
    types ??= ScaleType.all()
        .filter((t) => t.intervals.length <= 8)
        .map((t) => ({
            name: t.name,
            chromas: t.intervals.map((i) => (((Interval.semitones(i) ?? 0) % 12) + 12) % 12)
        }))
    return types
}

const DOUBLE = /^[A-G](##|bb|x)/

/** The usual spelling of a scale on a pitch class: no double accidental, the input's own name
 * when it has one, then the fewest accidentals. */
function spelledScale(type: string, chroma: number, written: Map<number, string>) {
    const names = [...new Set([written.get(chroma), nameOf(chroma), nameOf(chroma, true)])].filter(
        (n): n is string => n !== undefined
    )
    let best: { tonic: string; notes: string[]; cost: number } | null = null
    for (const tonic of names) {
        const scale = Scale.get(`${tonic} ${type}`)
        if (scale.empty) continue
        const { notes } = scaleSpelling(scale)
        const cost =
            notes.filter((n) => DOUBLE.test(n)).length * 100 +
            (tonic === written.get(chroma) ? 0 : 10) +
            notes.filter((n) => n.length > 1).length
        if (!best || cost < best.cost) best = { tonic, notes, cost }
    }
    return best
}

const withoutOctave = (item: string) => item.replace(/-?\d+$/, '')

/** Items split on spaces, commas and bar lines: "G D Em C", "G, D | Em C". */
const itemsOf = (input: string | readonly string[]): string[] =>
    (typeof input === 'string' ? [input] : [...input])
        .flatMap((s) => s.split(/[\s,|]+/))
        .filter(Boolean)

interface Material {
    /** Each pitch class played, with its name as written. */
    written: Map<number, string>
    /**
     * How strongly each pitch class reads as the tonic, as a cost (0 is the strongest): for
     * notes, the first note; for chords, the first chord's root, then a root the music ends on or
     * resolves to (a V or V7 a fifth above the next chord), then the other roots.
     */
    tonicCost: (chroma: number) => number
}

/** Tonic costs for a progression's roots: first, last and cadence targets (see Material). */
function chordTonicCost(roots: (number | null)[], symbols: string[]): (chroma: number) => number {
    const costs = new Map<number, number>()
    const set = (chroma: number | null | undefined, cost: number) => {
        if (chroma === null || chroma === undefined) return
        costs.set(chroma, Math.min(costs.get(chroma) ?? Infinity, cost))
    }
    const last = roots[roots.length - 1]
    const targets = new Set<number>()
    symbols.forEach((symbol, i) => {
        const next = symbols[i + 1]
        if (next && resolves(symbol, next) && roots[i + 1] !== null) targets.add(roots[i + 1]!)
    })
    for (const root of roots) set(root, 0.75)
    for (const target of targets) set(target, 0.375)
    set(last, last !== null && last !== undefined && targets.has(last) ? 0 : 0.375)
    set(roots[0], 0)
    return (chroma) => costs.get(chroma) ?? 1
}

/** The notes of a list of notes or chords; null when an item doesn't read. */
function materialOf(items: string[], as: 'notes' | 'chords'): Material | null {
    const written = new Map<number, string>()
    if (as === 'notes') {
        let first: number | null = null
        for (const item of items) {
            // An octave ("C4") says nothing about the scale.
            const name = noteName(withoutOctave(item))
            if (!name) return null
            const chroma = chromaOf(name)!
            if (!written.has(chroma)) written.set(chroma, name)
            first ??= chroma
        }
        return written.size
            ? { written, tonicCost: (chroma) => (chroma === first ? 0 : 0.5) }
            : null
    }
    const roots: (number | null)[] = []
    for (const item of items) {
        const set = parseChord(item) ? chordNoteSet(item) : null
        if (!set) return null
        for (const member of set.members) {
            if (!written.has(member.chroma)) written.set(member.chroma, member.name)
        }
        roots.push(set.root)
    }
    return written.size ? { written, tonicCost: chordTonicCost(roots, items) } : null
}

/** The scales over some material, ranked (see findScales). */
function rank(
    material: Material,
    maxOutside: number,
    onlyTonic: number | null = null
): (ScaleMatch & { cost: number })[] {
    const played = [...material.written.keys()]
    const matches: (ScaleMatch & { cost: number })[] = []
    for (const type of scaleTypes()) {
        for (let tonic = 0; tonic < 12; tonic++) {
            if (onlyTonic !== null && tonic !== onlyTonic) continue
            const chromas = new Set(type.chromas.map((c) => (c + tonic) % 12))
            const outside = played.filter((c) => !chromas.has(c))
            if (outside.length > maxOutside) continue
            const spelled = spelledScale(type.name, tonic, material.written)
            if (!spelled) continue
            const missing = spelled.notes.filter((n) => !material.written.has(chromaOf(n)!))
            // A usual scale with exactly the notes played, no more, wins over a larger one
            // (C D E G A is C major pentatonic, not C major without F and B).
            const exact = !outside.length && !missing.length && typeCost(type.name) <= 1.25
            matches.push({
                name: `${spelled.tonic} ${type.name}`,
                tonic: spelled.tonic,
                type: type.name,
                notes: spelled.notes,
                missing,
                outside: outside.map((c) => material.written.get(c)!),
                cost:
                    outside.length * 2 +
                    typeCost(type.name) +
                    material.tonicCost(tonic) +
                    missing.length * 0.05 -
                    (exact ? 2 : 0)
            })
        }
    }
    return matches.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
}

const strip = ({ cost: _cost, ...match }: ScaleMatch & { cost: number }): ScaleMatch => match

/**
 * Whether the items are notes: plain note names (C, F#, Bb), or notes with octaves (C4 E4 G4)
 * unless every one could be a power chord or a seventh chord (A5 D5 E5, A7 D7 E7 are chords).
 */
const allNotes = (items: string[]) =>
    items.every((i) => noteName(i) !== null) ||
    (items.every((i) => /^[A-Ga-g][#♯b♭]?-?\d$/.test(i) && noteName(withoutOctave(i)) !== null) &&
        !items.every((i) => /^[A-G][#♯b♭]?5$/.test(i)) &&
        !items.every((i) => /^[A-G][#♯b♭]?7$/.test(i)))

/**
 * The scales that hold some notes, or the tones of some chords, best first: fewer outside notes
 * first, a usual scale with exactly the notes played before larger ones (C D E G A: C major
 * pentatonic), major and minor before their modes, then pentatonic and blues scales, then the
 * harmonic and melodic minor and their modes, the others last; the tonic from the first chord's
 * root (or the first note), then the last chord's and a V → I move's (Dm C G: D dorian; Dm7 G7
 * Cmaj7: C major). Over a blues (see bluesTonic), the blues scale, the minor pentatonic and the
 * mixolydian first. Each match lists its missing notes (in the scale, not played) and outside
 * notes (played, not in the scale). Empty when an item doesn't read.
 */
export function findScales(
    input: string | readonly string[],
    options: FindScalesOptions = {}
): ScaleMatch[] {
    const items = itemsOf(input)
    if (!items.length) return []
    const as = options.as ?? (allNotes(items) ? 'notes' : 'chords')
    const material = materialOf(items, as)
    if (!material) return []
    const ranked = rank(material, Math.max(0, options.maxOutside ?? 1))
    // A blues: what a teacher says first, whatever the chords' other notes.
    const blues = as === 'chords' ? bluesTonic(items) : null
    const onTonic = blues ? rank(material, 12, chromaOf(blues)) : []
    const first = BLUES_SCALES.flatMap((type) => onTonic.filter((m) => m.type === type))
    const rest = ranked.filter((m) => !first.some((f) => f.name === m.name))
    return [...first, ...rest].slice(0, options.limit ?? 20).map(strip)
}

/** The scales a teacher suggests over a blues, in order: the blues scale (tonal's "minor
 * blues"), the minor pentatonic, the mixolydian. */
export const BLUES_SCALES = ['minor blues', 'minor pentatonic', 'mixolydian']

/** A dominant seventh chord (A7, A9, A13, A7#9): a major third and a minor seventh. */
function isDominant(symbol: string): boolean {
    const set = chordNoteSet(symbol)
    return (
        !!set &&
        set.members.some((m) => m.interval === '3M') &&
        set.members.some((m) => m.interval === '7m')
    )
}

/** Roots a blues uses, in semitones from its tonic: I, IV, V, and a jazz blues' ii, #iv°7, VI7. */
const BLUES_ROOTS = new Set([0, 2, 5, 6, 7, 9])

/**
 * The tonic of a dominant-seventh blues, as written (A7 D7 E7 A7: A): dominant seventh chords on
 * I and IV, and every chord on I, IV or V (or a jazz blues' ii, #iv°7 and VI7). The first chord's
 * root wins when several could be. Null when the chords aren't a blues (C C7 F: IV isn't a
 * seventh; D7 G7 C: C isn't a blues chord in D).
 */
export function bluesTonic(chords: string | readonly string[]): string | null {
    const items = itemsOf(chords)
    const parsed = items.map((item) => {
        const set = parseChord(item) ? chordNoteSet(item) : null
        return set && set.root !== null
            ? { root: set.root, name: parseChord(item)!.root, dominant: isDominant(item) }
            : null
    })
    if (!parsed.length || parsed.some((p) => p === null)) return null
    const chords7 = parsed as { root: number; name: string; dominant: boolean }[]
    const candidates = chords7.filter(
        (tonic) =>
            tonic.dominant &&
            chords7.some((c) => c.dominant && (c.root - tonic.root + 12) % 12 === 5) &&
            chords7.every((c) => BLUES_ROOTS.has((c.root - tonic.root + 12) % 12))
    )
    return (candidates.find((c) => c.root === chords7[0]!.root) ?? candidates[0])?.name ?? null
}

/**
 * Scales to play over a chord (chord-scale): the scales on its root that hold every chord tone,
 * best first (Cmaj7: C major, C lydian, C major pentatonic…; Dm7: D minor, D dorian, D phrygian…).
 * Empty when the chord doesn't read.
 */
export function scalesForChord(symbol: string, options: { limit?: number } = {}): ScaleMatch[] {
    const set = parseChord(symbol) ? chordNoteSet(symbol) : null
    if (!set || set.root === null) return []
    const material = materialOf([symbol], 'chords')!
    return rank(material, 0, set.root)
        .slice(0, options.limit ?? 20)
        .map(strip)
}

export interface ScaleChord {
    /** 1-based position in the scale. */
    degree: number
    root: string
    /** The triad stacked in thirds on the scale (seven-note scales); null otherwise. */
    triad: string | null
    /** The seventh chord stacked in thirds (seven-note scales); null otherwise. */
    seventh: string | null
    /** The triad's numeral from the scale's tonic ("ii", "bVII"); null without a triad. */
    numeral: string | null
    /** Every common chord on this root whose notes are all in the scale. */
    chords: string[]
}

/** Common chord types tried on every note of a scale, most used first. */
const COMMON = ['', 'm', '7', 'm7', 'maj7', 'dim', 'm7b5', 'dim7', 'aug', 'sus2', 'sus4', '6', 'm6']

/**
 * The chords in a scale: on each note, the triad and the seventh chord stacked in thirds (for
 * seven-note scales), their numeral, and every common chord whose notes are all in the scale.
 * Null when the scale doesn't read.
 */
export function chordsInScale(scaleName: string): ScaleChord[] | null {
    const scale = Scale.get(scaleName.trim())
    if (scale.empty || !scale.tonic) return null
    const { notes } = scaleSpelling(scale)
    const inScale = new Set(notes.map((n) => chromaOf(n)))
    const heptatonic = notes.length === 7
    return notes.map((root, i) => {
        const triad = heptatonic ? stackedChord(notes, i, false) : null
        const seventh = heptatonic ? stackedChord(notes, i, true) : null
        const chords = COMMON.map((suffix) => `${root}${suffix}`).filter((symbol) =>
            chordNoteSet(symbol)?.members.every((m) => inScale.has(m.chroma))
        )
        const degree = degreeOf(scale.tonic!, root)
        return {
            degree: i + 1,
            root,
            triad,
            seventh,
            numeral: triad && degree ? romanText(degree, triad.slice(root.length)) : null,
            chords
        }
    })
}

export interface KeyCandidate extends MusicalKey {
    /** Higher is likelier. */
    score: number
    /** The chords that aren't in the key, as written. */
    outside: string[]
}

export interface FoundKey extends KeyCandidate {
    /** The likeliest keys, this one first. */
    candidates: KeyCandidate[]
    /** False when another key scores about as well (C major and A minor for C F G Am). */
    clear: boolean
    /**
     * A dominant-seventh blues on the key's tonic (A7 D7 E7 A7 in A major): its I7 and IV7 are
     * the key's own chords.
     */
    blues?: boolean
    /**
     * The mode the chords play in, when it isn't plain major or minor: dorian for a minor key
     * whose chords use the major 6th, not the minor one nor the raised 7th of a V7 (Dm C G: D
     * dorian; Dm G A7 Dm stays D minor), mixolydian for a
     * major key whose chords use the minor 7th and not the major one (C Bb F C: C mixolydian).
     */
    modal?: MusicalKey
}

/** Pitch classes of a key's chords: the scale, plus the raised 7th for a minor key (its V and vii°). */
function keyChromas(key: MusicalKey): Set<number>[] {
    const natural = new Set(keyNotes(key).map((n) => chromaOf(n)!))
    if (key.mode !== 'minor') return [natural]
    const harmonic = new Set(
        Scale.get(`${key.tonic} harmonic minor`).notes.map((n) => chromaOf(n)!)
    )
    return [natural, harmonic]
}

/** Whether every tone of a chord is in the key (a minor key's V and vii° included). */
export function inKey(symbol: string, key: MusicalKey): boolean {
    const set = chordNoteSet(symbol)
    if (!set) return false
    return keyChromas(key).some((scale) => set.members.every((m) => scale.has(m.chroma)))
}

/** Whether a chord is the key's tonic chord (G or G7 in G major; Em, Em7 in E minor). */
function isTonic(symbol: string, key: MusicalKey): boolean {
    const set = chordNoteSet(symbol)
    if (!set || set.root !== chromaOf(key.tonic)) return false
    const third = set.members.find((m) => m.interval?.startsWith('3'))
    return third?.interval === (key.mode === 'minor' ? '3m' : '3M')
}

/** A major or dominant chord a fifth above another chord's root (D7 → G). */
function resolves(from: string, to: string): boolean {
    const a = chordNoteSet(from)
    const b = chordNoteSet(to)
    if (!a || !b || a.root === null || b.root === null) return false
    const major = a.members.some((m) => m.interval === '3M')
    return major && (a.root - b.root + 12) % 12 === 7
}

/** A blues's own chords: a dominant seventh on its I or IV (A7, D7 in an A blues). */
function bluesChord(symbol: string, key: MusicalKey): boolean {
    const set = chordNoteSet(symbol)
    const tonic = chromaOf(key.tonic)
    if (!set || set.root === null || tonic === null || !isDominant(symbol)) return false
    return [0, 5].includes((set.root - tonic + 12) % 12)
}

/** A major chord on a minor key's 4th degree, the dorian IV (D or D7 in A minor). */
function dorianFour(symbol: string, key: MusicalKey): boolean {
    const set = chordNoteSet(symbol)
    const tonic = chromaOf(key.tonic)
    return (
        !!set &&
        set.root !== null &&
        tonic !== null &&
        (set.root - tonic + 12) % 12 === 5 &&
        set.members.some((m) => m.interval === '3M') &&
        set.members.some((m) => m.interval === '5P')
    )
}

/** Each mode's notes, in semitones from its tonic. */
const MODE_STEPS = {
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10]
} as const

/**
 * The mode a key's chords play in (see FoundKey.modal); null for plain major or minor. Every chord
 * stays inside the mode, and one of them plays the mode's own note (dorian's major 6th,
 * mixolydian's minor 7th). A dominant seventh on the tonic going to IV is a V7/IV (C C7 F C): its
 * minor 7th isn't the mode's.
 */
function modalOf(items: string[], key: MusicalKey): MusicalKey | null {
    const tonic = chromaOf(key.tonic)!
    const mode = key.mode === 'minor' ? 'dorian' : key.mode === 'major' ? 'mixolydian' : null
    if (!mode) return null
    const steps = new Set<number>(MODE_STEPS[mode])
    const sets = items.map((item) => chordNoteSet(item)!)
    const relative = (chroma: number) => (chroma - tonic + 12) % 12
    if (!sets.every((set) => set.members.every((m) => steps.has(relative(m.chroma))))) return null
    const evidence = mode === 'dorian' ? 9 : 10
    const shows = sets.some((set, i) => {
        if (!set.members.some((m) => relative(m.chroma) === evidence)) return false
        const next = sets[i + 1]
        const toFour =
            mode === 'mixolydian' &&
            set.root === tonic &&
            isDominant(items[i]!) &&
            next?.root !== null &&
            next !== undefined &&
            relative(next.root) === 5
        return !toFour
    })
    return shows ? { tonic: key.tonic, mode, name: `${key.tonic} ${mode}` } : null
}

/** Keys as they're usually spelled: F# major and C# minor, Db major and Bb minor. */
const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/**
 * The most likely key of a progression: the key whose chords are in it most (a chord borrowed
 * from the parallel key or a secondary dominant counts a little), with the first chord (most) and
 * the last chord on its tonic and dominant-to-tonic moves (V7 → I more than V → I) as evidence.
 * A dominant-seventh blues (A7 D7 E7 A7) is in the major key of its tonic, its I7 and IV7 counted
 * in the key. The tonic is spelled as the chords spell it (Gb major for Gb Db Ebm Cb), else the
 * usual way. Null when a chord doesn't read.
 */
export function findKey(chords: string | readonly string[]): FoundKey | null {
    const items = itemsOf(chords)
    if (!items.length || items.some((c) => !parseChord(c) || !chordNoteSet(c))) return null
    const roots = new Map<number, string>()
    for (const item of items) {
        const root = parseChord(item)!.root
        if (!roots.has(chromaOf(root)!)) roots.set(chromaOf(root)!, root)
    }
    const blues = bluesTonic(items)
    const bluesChroma = blues === null ? null : chromaOf(blues)
    const candidates: KeyCandidate[] = []
    for (let chroma = 0; chroma < 12; chroma++) {
        for (const mode of ['major', 'minor'] as const) {
            const usual = (mode === 'major' ? MAJOR_TONICS : MINOR_TONICS)[chroma]!
            const written = roots.get(chroma)
            // The chords' spelling, unless it needs double sharps or flats (Gbm: F# minor).
            const tonic =
                written && !keyProblem({ tonic: written, mode, name: `${written} ${mode}` })
                    ? written
                    : usual
            const key: MusicalKey = { tonic, mode, name: `${tonic} ${mode}` }
            const parallel: MusicalKey = {
                tonic,
                mode: mode === 'major' ? 'minor' : 'major',
                name: `${tonic} ${mode === 'major' ? 'minor' : 'major'}`
            }
            let score = 0
            const outside: string[] = []
            const isBlues = mode === 'major' && chroma === bluesChroma
            items.forEach((item, i) => {
                if (inKey(item, key) || (isBlues && bluesChord(item, key))) score += 2
                else {
                    outside.push(item)
                    const next = items[i + 1]
                    // A secondary dominant resolving to the next chord, or a borrowed chord.
                    if (next && resolves(item, next) && inKey(next, key)) score += 1
                    // A minor key's major IV (dorian: Am D) is common; other borrowed chords less.
                    else if (mode === 'minor' && dorianFour(item, key)) score += 1
                    else if (inKey(item, parallel)) score += 0.5
                    else score -= 1
                }
                // The first chord says the most about the key, then the last one.
                if (isTonic(item, key)) score += i === 0 ? 2.5 : i === items.length - 1 ? 2 : 0
                const next = items[i + 1]
                // A V7 → I cadence more than V → I, and most when it ends the progression.
                if (next && isTonic(next, key) && resolves(item, next)) {
                    const final = i + 1 === items.length - 1
                    score += (isDominant(item) ? 1.5 : 1) + (final ? 1 : 0)
                }
            })
            candidates.push({ ...key, score, outside })
        }
    }
    // Major first on a tie (C F G: C major, not A minor).
    candidates.sort((a, b) => b.score - a.score || (a.mode === 'major' ? -1 : 1))
    const [best, runnerUp] = candidates as [KeyCandidate, KeyCandidate]
    // The other keys: those that hold the most chords first (Am F C G: C major before G major),
    // then by score. The best key stays the best score (C Bb F C is C major with a borrowed bVII).
    const others = candidates
        .slice(1)
        .filter((c) => c.score > 0)
        .sort((a, b) => a.outside.length - b.outside.length || b.score - a.score)
    const top = [best, ...others.slice(0, 4)]
    const isBlues = best.mode === 'major' && chromaOf(best.tonic) === bluesChroma
    const modal = isBlues ? null : modalOf(items, best)
    return {
        ...best,
        candidates: top,
        clear: isBlues || runnerUp.score <= 0 || best.score - runnerUp.score >= 2.5,
        ...(isBlues ? { blues: true } : {}),
        ...(modal ? { modal } : {})
    }
}
