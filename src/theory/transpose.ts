/** Transposing chord symbols and keys by semitones. */
import { chromaOf, isFlat, nameOf, splitChordSymbol } from './pitch.js'

/** Keys written with flats (F♯ over G♭, D♭ over C♯): chords transposed into them use flats. */
const FLAT_KEYS = new Set([5, 10, 3, 8, 1])
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3])

/** Whether a key ("F", "Bb", "Dm") is written with flats. */
export function keyPrefersFlats(key: string): boolean {
    const m = /^([A-G][#♯b♭]?)(m|min|minor)?\b/.exec(key.trim())
    if (!m) return false
    const chroma = chromaOf(m[1]!)
    if (chroma === null) return false
    if (isFlat(m[1]!)) return true
    return m[2] ? FLAT_MINOR_KEYS.has(chroma) : FLAT_KEYS.has(chroma)
}

const shift = (note: string, semitones: number, preferFlats: boolean): string => {
    const chroma = chromaOf(note)
    return chroma === null ? note : nameOf(chroma + semitones, preferFlats)
}

/**
 * Transpose a chord symbol ("F#m7/C#", +2 → "G#m7/D#"). Spelling follows `preferFlats`, or the
 * symbol's own when not given. Text that isn't a chord symbol comes back unchanged.
 */
export function transposeChord(symbol: string, semitones: number, preferFlats?: boolean): string {
    const trimmed = symbol.trim()
    const parts = splitChordSymbol(trimmed)
    const steps = Math.round(semitones) || 0
    if (!parts || steps % 12 === 0) return trimmed
    const flats = preferFlats ?? isFlat(parts.root)
    const bass = parts.bass ? `/${shift(parts.bass, steps, flats)}` : ''
    return `${shift(parts.root, steps, flats)}${parts.suffix}${bass}`
}

/** Transpose a key ("Am", +3 → "Cm"), spelled the way that key is usually written. */
export function transposeKey(key: string, semitones: number): string {
    const m = /^([A-G][#♯b♭]?)(.*)$/.exec(key.trim())
    const chroma = m ? chromaOf(m[1]!) : null
    const steps = Math.round(semitones) || 0
    if (!m || chroma === null || steps % 12 === 0) return key.trim()
    const target = (((chroma + steps) % 12) + 12) % 12
    const minor = /^\s*(m|min|minor)\b/.test(m[2]!)
    const flats = minor ? FLAT_MINOR_KEYS.has(target) : FLAT_KEYS.has(target)
    return `${nameOf(target, flats)}${m[2]}`
}
