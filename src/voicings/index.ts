/**
 * Guitar voicings for chord symbols, from @tombatossals/chords-db (MIT, about 2,000 voicings, 1,800 of them by symbol). A
 * separate entry point: the data adds about 230 KB, so only consumers that want it pay for it.
 *
 * The data is checked before it's handed out (#62): the standard shapes teachers expect come first
 * (`curated.ts`), a voicing with the wrong bass loses its lowest strings when that leaves the chord
 * (B 224442 → x24442), wrong voicings are dropped, wrong fingers are worked out again, and the
 * generator's easiest voicings fill the gaps.
 */
import db from '@tombatossals/chords-db/lib/guitar.json'
import { baseFretOf, type FrettedVoicing } from '../chord/guitar.js'
import { chordInfo, fingerVoicing, generateVoicings } from '../chord/generate.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { canonicalSuffix } from '../theory/suffix.js'
import { fingeringProblem, strummable, voicingProblem } from './check.js'
import { CURATED } from './curated.js'

/** Finds the n-th voicing (0-based) of a chord symbol; null when unknown. Chords the database
 * doesn't have get the generator's easiest voicings. */
export type VoicingLookup = (symbol: string, index: number) => FrettedVoicing | null

/** The database's own key names: sharps for C# and F#, flats elsewhere. */
const DB_KEYS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B']

/** The database's bass names in slash-chord suffixes. */
const DB_BASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/** Note names in the curated list's keys ("Ebmaj7", "Am/G", "D/F#"). */
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

/** Canonical suffix → the database's name, where they differ. */
const DB_SUFFIXES: Record<string, string> = {
    '': 'major',
    'm': 'minor',
    'mMaj7': 'mmaj7',
    'mMaj9': 'mmaj9',
    'M7b5': 'maj7b5',
    '7alt': 'alt',
    '6/9': '69',
    '7#5': 'aug7',
    '9#5': 'aug9'
}

/** Voicings for chords the database doesn't have: the generator's easiest, like a database entry. */
const GENERATED_PER_CHORD = 4

export const lookupGuitarVoicing: VoicingLookup = (symbol, index) => {
    const parts = splitChordSymbol(symbol)
    if (!parts) return null
    const chroma = chromaOf(parts.root)
    if (chroma === null) return null
    const canonical = canonicalSuffix(parts.suffix)
    const suffix = Object.prototype.hasOwnProperty.call(DB_SUFFIXES, canonical)
        ? DB_SUFFIXES[canonical]!
        : canonical
    // Slash chords are stored as "/E" (major) and "m/B" (minor) suffixes.
    const bassChroma = parts.bass ? chromaOf(parts.bass) : null
    const bass = bassChroma === null ? null : DB_BASSES[bassChroma]!
    const wanted = bass
        ? `${suffix === 'major' ? '' : suffix === 'minor' ? 'm' : suffix}/${bass}`
        : suffix
    const key = `${NAMES[chroma]}${canonical}${bass ? `/${bass}` : ''}`
    const chord = (db.chords[DB_KEYS[chroma]!] ?? []).find((c) => c.suffix === wanted)
    // A chord the database doesn't have (Cmaj9#11, C7b5#9, Cmaj7b5…): the generator's easiest ones.
    const list =
        chord || CURATED[key]
            ? checked(key, chord)
            : generated(symbol).slice(0, GENERATED_PER_CHORD)
    const found = list[index]
    // A copy: callers may change it (a block's position sets its base fret).
    return found ? { ...found, frets: [...found.frets], fingers: [...found.fingers] } : null
}

type Frets = (number | null)[]

const compact = (frets: readonly (number | null)[]) =>
    frets.map((f) => (f === null ? 'x' : f)).join(',')

/** "x32000" or "x-7-6-7-8-x" (frets past 9) → frets, lowest string first. */
function parseFrets(text: string): Frets {
    return (text.includes('-') ? text.split('-') : [...text]).map((t) =>
        t === 'x' ? null : Number(t)
    )
}

/** A voicing of the chord, its fingers kept when they're fine, else worked out again. */
function voicing(frets: Frets, fingers: (string | null)[] | null): FrettedVoicing | null {
    const kept = fingers && !fingeringProblem(frets, fingers) ? fingers : fingerVoicing(frets)
    return kept ? { frets, fingers: kept, baseFret: baseFretOf(frets) } : null
}

/**
 * A database voicing with the wrong note in the bass, its lowest strings muted one by one until
 * the bass is right (B 224442 → x24442), keeping four strings or more (two for power chords).
 */
function repaired(symbol: string, frets: Frets): Frets | null {
    if (!voicingProblem(symbol, frets)) return frets
    const fewest = /^[A-G][#b]?5$/.test(symbol) ? 2 : 4
    const next = [...frets]
    for (;;) {
        const lowest = next.findIndex((f) => f !== null)
        next[lowest] = null
        if (next.filter((f) => f !== null).length < fewest) return null
        const problem = voicingProblem(symbol, next)
        if (!problem) return next
        // Muting can't bring back a missing note.
        if (problem.startsWith('misses') || problem.startsWith('no altered')) return null
    }
}

const checkedCache = new Map<string, FrettedVoicing[]>()

/** The curated voicings, then the database's that are right (repaired when they can be), then the
 * generator's easiest, up to the database's count (4 at least). */
function checked(
    key: string,
    chord: { positions: { frets: number[]; fingers: number[]; baseFret: number }[] } | undefined
): FrettedVoicing[] {
    const hit = checkedCache.get(key)
    if (hit) return hit
    // Suffixes the library doesn't read (aug9, mmaj11, mmaj7b5, 7sg): the database as it is.
    if (!chordInfo(key)) {
        const raw = (chord?.positions ?? []).map((position) => ({
            frets: position.frets.map((f) =>
                f < 0 ? null : f === 0 ? 0 : f + position.baseFret - 1
            ),
            fingers: position.fingers.map((f) => (f > 0 ? String(f) : null)),
            baseFret: position.baseFret
        }))
        checkedCache.set(key, raw)
        return raw
    }
    const list: FrettedVoicing[] = []
    const seen = new Set<string>()
    const add = (v: FrettedVoicing | null) => {
        if (!v || seen.has(compact(v.frets)) || voicingProblem(key, v.frets)) return
        seen.add(compact(v.frets))
        list.push(v)
    }
    for (const entry of CURATED[key] ?? []) {
        const [frets, fingers] = entry.split(' ')
        add(
            voicing(
                parseFrets(frets!),
                fingers ? [...fingers].map((f) => (f === '-' ? null : f)) : null
            )
        )
    }
    for (const position of chord?.positions ?? []) {
        const absolute = position.frets.map((f) =>
            f < 0 ? null : f === 0 ? 0 : f + position.baseFret - 1
        )
        const frets = repaired(key, absolute)
        if (!frets) continue
        const fingers = position.fingers.map((f, s) => (f > 0 && frets[s] ? String(f) : null))
        const same = frets.every((f, s) => f === absolute[s])
        const v = voicing(frets, fingers)
        // Untouched voicings keep the database's base fret.
        add(v && same ? { ...v, baseFret: position.baseFret } : v)
    }
    const count = Math.max(chord?.positions.length ?? 0, GENERATED_PER_CHORD)
    if (list.length < count) {
        for (const v of generated(key)) {
            if (list.length >= count) break
            // Not a shape the list has an octave lower (C11 x-15-15-15-15-15 after x33333).
            const lower = v.frets.map((f) => (f === null ? null : f - 12))
            if (lower.every((f) => f === null || f > 0) && seen.has(compact(lower))) continue
            add({ frets: v.frets, fingers: v.fingers, baseFret: v.baseFret })
        }
    }
    // A strummable voicing first: one with a muted string inside the shape goes after the others,
    // unless it's curated (the Hendrix grip) (#72).
    const curated = new Set((CURATED[key] ?? []).map((e) => compact(parseFrets(e.split(' ')[0]!))))
    const first = (v: FrettedVoicing) => curated.has(compact(v.frets)) || strummable(v.frets)
    const ordered = [...list.filter(first), ...list.filter((v) => !first(v))]
    checkedCache.set(key, ordered)
    return ordered
}

const generatedCache = new Map<string, FrettedVoicing[]>()
function generated(symbol: string): FrettedVoicing[] {
    const hit = generatedCache.get(symbol)
    if (hit) return hit
    const list = generateVoicings(symbol)
        .slice(0, 12)
        .map(({ frets, fingers, baseFret }) => ({ frets, fingers, baseFret }))
    generatedCache.set(symbol, list)
    if (generatedCache.size > 64) generatedCache.delete(generatedCache.keys().next().value!)
    return list
}

/** How many voicings the database (or, for chords it doesn't have, the generator) has for a symbol. */
export function voicingCount(symbol: string): number {
    let n = 0
    while (lookupGuitarVoicing(symbol, n)) n++
    return n
}
