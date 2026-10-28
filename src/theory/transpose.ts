/** Transposing chord symbols and keys by semitones. */
import { chromaOf, isFlat, nameOf } from './pitch'

/** Keys written with flats (F♯ over G♭, D♭ over C♯): chords transposed into them use flats. */
const FLAT_KEYS = new Set([5, 10, 3, 8, 1])
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3])

const CHORD = /^([A-G][#♯b♭]?)([^/]*)(?:\/([A-G][#♯b♭]?))?$/

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
    const m = CHORD.exec(trimmed)
    if (!m || semitones % 12 === 0) return trimmed
    const flats = preferFlats ?? isFlat(m[1]!)
    const bass = m[3] ? `/${shift(m[3], semitones, flats)}` : ''
    return `${shift(m[1]!, semitones, flats)}${m[2]}${bass}`
}

/** Transpose a key ("Am", +3 → "Cm"), spelled the way that key is usually written. */
export function transposeKey(key: string, semitones: number): string {
    const m = /^([A-G][#♯b♭]?)(.*)$/.exec(key.trim())
    const chroma = m ? chromaOf(m[1]!) : null
    if (!m || chroma === null || semitones % 12 === 0) return key.trim()
    const target = (((chroma + semitones) % 12) + 12) % 12
    const minor = /^\s*(m|min|minor)\b/.test(m[2]!)
    const flats = minor ? FLAT_MINOR_KEYS.has(target) : FLAT_KEYS.has(target)
    return `${nameOf(target, flats)}${m[2]}`
}
