/**
 * Guitar voicings for chord symbols, from @tombatossals/chords-db (MIT, about 2,000 voicings, 1,800 of them by symbol). A
 * separate entry point: the data adds about 230 KB, so only consumers that want it pay for it.
 */
import db from '@tombatossals/chords-db/lib/guitar.json'
import type { FrettedVoicing } from '../chord/guitar.js'
import { generateVoicings } from '../chord/generate.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { canonicalSuffix } from '../theory/suffix.js'

/** Finds the n-th voicing (0-based) of a chord symbol; null when unknown. Chords the database
 * doesn't have get the generator's easiest voicings. */
export type VoicingLookup = (symbol: string, index: number) => FrettedVoicing | null

/** The database's own key names: sharps for C# and F#, flats elsewhere. */
const DB_KEYS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B']

/** The database's bass names in slash-chord suffixes. */
const DB_BASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/** Canonical suffix → the database's name, where they differ. */
const DB_SUFFIXES: Record<string, string> = {
    '': 'major',
    'm': 'minor',
    'mMaj7': 'mmaj7',
    '6/9': '69'
}

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
    const chords = db.chords[DB_KEYS[chroma]!] ?? []
    const chord = chords.find((c) => c.suffix === wanted)
    // A chord the database doesn't have (Cmaj9#11, C7b5#9, Cmaj7b5…): the generator's easiest ones.
    if (!chord) return generated(symbol)[index] ?? null
    const position = chord.positions[index]
    if (!position) return null
    const absolute = (f: number) => (f < 0 ? null : f === 0 ? 0 : f + position.baseFret - 1)
    return {
        frets: position.frets.map(absolute),
        fingers: position.fingers.map((f) => (f > 0 ? String(f) : null)),
        baseFret: position.baseFret
    }
}

/** Voicings for chords the database doesn't have: the generator's easiest, like a database entry. */
const GENERATED_PER_CHORD = 4
const generatedCache = new Map<string, FrettedVoicing[]>()
function generated(symbol: string): FrettedVoicing[] {
    const hit = generatedCache.get(symbol)
    if (hit) return hit
    const list = generateVoicings(symbol)
        .slice(0, GENERATED_PER_CHORD)
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
