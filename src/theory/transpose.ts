/** Transposing chord symbols and keys by semitones. */
import { Interval, Note } from 'tonal'
import { chromaOf, isFlat, nameOf, splitChordSymbol } from './pitch.js'

/** Keys written with flats (F♯ over G♭, D♭ over C♯): chords transposed into them use flats. */
const FLAT_KEYS = new Set([5, 10, 3, 8, 1])
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3])

/** A key's tonic and whether it's minor: "F#m" → F#, minor; "Bb major" → Bb. */
function tonicOf(key: string): { tonic: string; minor: boolean } | null {
    const m = /^([A-G][#♯b♭]?)\s*(.*)$/.exec(key.trim())
    if (!m) return null
    return { tonic: m[1]!, minor: /^(m|min|minor)(?![a-z])/i.test(m[2]!) && !/^maj/i.test(m[2]!) }
}

/** Whether a key ("F", "Bb", "Dm") is written with flats; a tonic written with a sharp ("C#")
 * is a sharp key, one written with a flat a flat key. */
export function keyPrefersFlats(key: string): boolean {
    const parts = tonicOf(key)
    const chroma = parts ? chromaOf(parts.tonic) : null
    if (!parts || chroma === null) return false
    if (isFlat(parts.tonic)) return true
    if (/[#♯]/.test(parts.tonic)) return false
    return parts.minor ? FLAT_MINOR_KEYS.has(chroma) : FLAT_KEYS.has(chroma)
}

/** A move from one key to another (their tonics, "G" → "F#"): chords keep their letters. */
export interface KeyMove {
    from: string
    to: string
}

const shift = (note: string, semitones: number, preferFlats: boolean): string => {
    const chroma = chromaOf(note)
    return chroma === null ? note : nameOf(chroma + semitones, preferFlats)
}

/** A note moved by an interval, by letters (F# up a major 7th is E#); a triple accidental is
 * simplified (G### → A#). */
function moveByLetter(note: string, interval: string): string {
    const moved = Note.transpose(note, interval)
    return /^[A-G](#{3,}|b{3,})$/.test(moved) ? Note.simplify(moved) : moved
}

/**
 * Transpose a chord symbol ("F#m7/C#", +2 → "G#m7/D#"). Spelling follows `spelling`: flats
 * (true), sharps (false), a move between two keys (each note moves by the interval between their
 * tonics, so letters keep their place in the key: G → F# major turns F#dim into E#dim and C into
 * B, Em → Ebm turns C into Cb), or the symbol's own when not given. Text that isn't a chord symbol
 * comes back unchanged.
 */
export function transposeChord(
    symbol: string,
    semitones: number,
    spelling?: boolean | KeyMove
): string {
    const trimmed = symbol.trim()
    const parts = splitChordSymbol(trimmed)
    const steps = Math.round(semitones) || 0
    if (!parts || steps % 12 === 0) return trimmed
    if (typeof spelling === 'object') {
        const interval = Interval.distance(
            spelling.from.replace('♯', '#').replace('♭', 'b'),
            spelling.to.replace('♯', '#').replace('♭', 'b')
        )
        const moves = Interval.semitones(interval)
        // Only when the keys are that many semitones apart; else the new key's sharps or flats.
        if (moves !== undefined && (((moves - steps) % 12) + 12) % 12 === 0) {
            const bass = parts.bass ? `/${moveByLetter(parts.bass, interval)}` : ''
            return `${moveByLetter(parts.root, interval)}${parts.suffix}${bass}`
        }
        spelling = keyPrefersFlats(spelling.to)
    }
    const flats = spelling ?? isFlat(parts.root)
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

/** The move from a key to the same key transposed ("G", -1 → G to F#); null when the key has no
 * tonic. */
export function keyMove(key: string, semitones: number): KeyMove | null {
    const from = tonicOf(key)
    const to = tonicOf(transposeKey(key, semitones))
    return from && to && chromaOf(from.tonic) !== null ? { from: from.tonic, to: to.tonic } : null
}
