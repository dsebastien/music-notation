/**
 * Guitar voicings for chord symbols, from @tombatossals/chords-db (MIT, ~2,000 voicings). A
 * separate entry point: the data adds about 230 KB, so only consumers that want it pay for it.
 */
import db from '@tombatossals/chords-db/lib/guitar.json'
import type { FrettedVoicing } from '../chord/guitar.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'

/** Finds the n-th voicing (0-based) of a chord symbol; null when unknown. */
export type VoicingLookup = (symbol: string, index: number) => FrettedVoicing | null

/** The database's own key names: sharps for C# and F#, flats elsewhere. */
const DB_KEYS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B']

/** The database's bass names in slash-chord suffixes. */
const DB_BASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/** Chord-symbol suffix → database suffix, for the spellings the database doesn't use. */
const SUFFIX_ALIASES: Record<string, string> = {
    '': 'major',
    'M': 'major',
    'maj': 'major',
    'm': 'minor',
    'min': 'minor',
    '-': 'minor',
    '°': 'dim',
    '°7': 'dim7',
    '+': 'aug',
    'sus': 'sus4',
    'M7': 'maj7',
    'Δ': 'maj7',
    'Δ7': 'maj7',
    'min7': 'm7',
    '-7': 'm7',
    'ø': 'm7b5',
    'ø7': 'm7b5',
    'm7-5': 'm7b5',
    'add2': 'add9',
    '6/9': '69',
    'mM7': 'mmaj7',
    'mMaj7': 'mmaj7',
    'm(maj7)': 'mmaj7',
    '-(maj7)': 'mmaj7'
}

export const lookupGuitarVoicing: VoicingLookup = (symbol, index) => {
    const parts = splitChordSymbol(symbol)
    if (!parts) return null
    const chroma = chromaOf(parts.root)
    if (chroma === null) return null
    const suffix = Object.prototype.hasOwnProperty.call(SUFFIX_ALIASES, parts.suffix)
        ? SUFFIX_ALIASES[parts.suffix]!
        : parts.suffix
    // Slash chords are stored as "/E" (major) and "m/B" (minor) suffixes.
    const bassChroma = parts.bass ? chromaOf(parts.bass) : null
    const bass = bassChroma === null ? null : DB_BASSES[bassChroma]!
    const wanted = bass
        ? `${suffix === 'major' ? '' : suffix === 'minor' ? 'm' : suffix}/${bass}`
        : suffix
    const chords = db.chords[DB_KEYS[chroma]!] ?? []
    const chord = chords.find((c) => c.suffix === wanted)
    const position = chord?.positions[index]
    if (!position) return null
    const absolute = (f: number) => (f < 0 ? null : f === 0 ? 0 : f + position.baseFret - 1)
    return {
        frets: position.frets.map(absolute),
        fingers: position.fingers.map((f) => (f > 0 ? String(f) : null)),
        baseFret: position.baseFret
    }
}

/** How many voicings the database has for a symbol. */
export function voicingCount(symbol: string): number {
    let n = 0
    while (lookupGuitarVoicing(symbol, n)) n++
    return n
}
