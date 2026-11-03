/**
 * Finding scales and keys (#42): the scales that hold some notes or the tones of some chords, and
 * the most likely key of a progression.
 */
import { Interval, ScaleType, Scale } from 'tonal'
import { chordNoteSet } from './note-set.js'
import { chromaOf, nameOf } from './pitch.js'
import { scaleSpelling } from './scales.js'
import { parseChord } from './chord-symbol.js'
import { keyNotes, noteName, type MusicalKey } from './keys.js'

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
     * a plain note name (G D Em C); "G C D" reads as three notes unless you say chords.
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

/** Items split on spaces, commas and bar lines: "G D Em C", "G, D | Em C". */
const itemsOf = (input: string | readonly string[]): string[] =>
    (typeof input === 'string' ? [input] : [...input])
        .flatMap((s) => s.split(/[\s,|]+/))
        .filter(Boolean)

interface Material {
    /** Each pitch class played, with its name as written. */
    written: Map<number, string>
    /** Preferred tonics, best first (the first chord's root or the first note, then the others). */
    tonics: number[]
}

/** The notes of a list of notes or chords; null when an item doesn't read. */
function materialOf(items: string[], as: 'notes' | 'chords'): Material | null {
    const written = new Map<number, string>()
    const tonics: number[] = []
    for (const item of items) {
        if (as === 'notes') {
            const name = noteName(item)
            if (!name) return null
            const chroma = chromaOf(name)!
            if (!written.has(chroma)) written.set(chroma, name)
            if (!tonics.length) tonics.push(chroma)
            continue
        }
        const set = parseChord(item) ? chordNoteSet(item) : null
        if (!set) return null
        for (const member of set.members) {
            if (!written.has(member.chroma)) written.set(member.chroma, member.name)
        }
        if (set.root !== null && !tonics.includes(set.root)) tonics.push(set.root)
    }
    return written.size ? { written, tonics } : null
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
            const at = material.tonics.indexOf(tonic)
            const tonicCost = at === 0 ? 0 : at > 0 ? 0.25 : 0.5
            matches.push({
                name: `${spelled.tonic} ${type.name}`,
                tonic: spelled.tonic,
                type: type.name,
                notes: spelled.notes,
                missing,
                outside: outside.map((c) => material.written.get(c)!),
                cost: outside.length * 2 + typeCost(type.name) + tonicCost + missing.length * 0.05
            })
        }
    }
    return matches.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
}

const strip = ({ cost: _cost, ...match }: ScaleMatch & { cost: number }): ScaleMatch => match

/** Whether every item is a plain note name (C, F#, Bb). */
const allNotes = (items: string[]) => items.every((i) => noteName(i) !== null)

/**
 * The scales that hold some notes, or the tones of some chords, best first: fewer outside notes
 * first, major and minor before their modes, then pentatonic and blues scales, then the harmonic
 * and melodic minor and their modes, the others last; a tonic on the first chord's root (or the
 * first note) first. Each match lists its missing notes (in the scale, not played) and outside
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
    return rank(material, Math.max(0, options.maxOutside ?? 1))
        .slice(0, options.limit ?? 20)
        .map(strip)
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

/** Keys as they're usually spelled: F# major and C# minor, Db major and Bb minor. */
const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/**
 * The most likely key of a progression: the key whose chords are in it most (a chord borrowed
 * from the parallel key or a secondary dominant counts a little), with the first and last chords
 * on its tonic and dominant-to-tonic moves as evidence. The tonic is spelled as the chords spell
 * it (Gb major for Gb Db Ebm Cb), else the usual way. Null when a chord doesn't read.
 */
export function findKey(chords: string | readonly string[]): FoundKey | null {
    const items = itemsOf(chords)
    if (!items.length || items.some((c) => !parseChord(c) || !chordNoteSet(c))) return null
    const roots = new Map<number, string>()
    for (const item of items) {
        const root = parseChord(item)!.root
        if (!roots.has(chromaOf(root)!)) roots.set(chromaOf(root)!, root)
    }
    const candidates: KeyCandidate[] = []
    for (let chroma = 0; chroma < 12; chroma++) {
        for (const mode of ['major', 'minor'] as const) {
            const tonic =
                roots.get(chroma) ?? (mode === 'major' ? MAJOR_TONICS : MINOR_TONICS)[chroma]!
            const key: MusicalKey = { tonic, mode, name: `${tonic} ${mode}` }
            const parallel: MusicalKey = {
                tonic,
                mode: mode === 'major' ? 'minor' : 'major',
                name: `${tonic} ${mode === 'major' ? 'minor' : 'major'}`
            }
            let score = 0
            const outside: string[] = []
            items.forEach((item, i) => {
                if (inKey(item, key)) score += 2
                else {
                    outside.push(item)
                    const next = items[i + 1]
                    // A secondary dominant resolving to the next chord, or a borrowed chord.
                    if (next && resolves(item, next) && inKey(next, key)) score += 1
                    else if (inKey(item, parallel)) score += 0.5
                    else score -= 1
                }
                if (isTonic(item, key) && (i === 0 || i === items.length - 1)) score += 2
                const next = items[i + 1]
                if (next && isTonic(next, key) && resolves(item, next)) score += 1
            })
            candidates.push({ ...key, score, outside })
        }
    }
    // Major first on a tie (C F G: C major, not A minor).
    candidates.sort((a, b) => b.score - a.score || (a.mode === 'major' ? -1 : 1))
    const top = candidates.slice(0, 5).filter((c, i) => i === 0 || c.score > 0)
    const best = top[0]!
    return {
        ...best,
        candidates: top,
        clear: top.length < 2 || best.score - top[1]!.score >= 2
    }
}
