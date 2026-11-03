/**
 * Capos: a bar across every string at one fret. Frets are counted from the capo (as players read
 * them: an A shape with a capo on 2 is still x02220) unless they count from the nut. The chord a
 * shape sounds moves up by the capo's fret (an A shape with a capo on 2 sounds B).
 */
import { chromaOf, isFlat, splitChordSymbol } from '../theory/pitch.js'
import { transposeChord, transposeKey } from '../theory/transpose.js'
import { chordNoteSet } from '../theory/note-set.js'

/** The highest fret a capo goes on. */
export const MAX_CAPO = 12

/** Where frets are counted from when a capo is on: the capo (default) or the nut. */
export type FretsFrom = 'capo' | 'nut'

/** `capo:` → its fret (0 is no capo); throws a message that says what to write. */
export function parseCapo(text: string): number {
    const value = text.trim().toLowerCase()
    const n = value === 'none' || value === 'no' ? 0 : Number(value)
    if (!Number.isInteger(n) || n < 0 || n > MAX_CAPO) {
        throw new Error(`capo: use a fret from 1 to ${MAX_CAPO}, got "${text}"`)
    }
    return n
}

/** `frets-from:` → capo (default) or nut; throws a message that says what to write. */
export function parseFretsFrom(text: string | undefined): FretsFrom {
    const value = text?.trim().toLowerCase()
    if (!value || value === 'capo') return 'capo'
    if (value === 'nut') return 'nut'
    throw new Error(`frets-from: use capo (the default) or nut, got "${text}"`)
}

/**
 * The chord a shape sounds with a capo: "A" with a capo on 2 → "B". Spelled the way the new key is
 * usually written (a capo on 1 turns C into Db, Am into Bbm); text that isn't a chord symbol comes
 * back unchanged.
 */
export function soundingChord(shape: string, capo: number): string {
    const parts = splitChordSymbol(shape.trim())
    if (!parts || !capo) return shape.trim()
    // Minor chords take the minor key's spelling (Am + 1 → Bbm), others the major key's.
    const minor = /^(m(?!aj)|min|-)/.test(parts.suffix)
    const root = transposeKey(`${parts.root}${minor ? 'm' : ''}`, capo)
    return transposeChord(shape, capo, isFlat(root))
}

/**
 * Frets counted from the nut → counted from the capo; null when a sounding string is behind the
 * capo (it can't sound there).
 */
export function fretsFromCapo(frets: (number | null)[], capo: number): (number | null)[] | null {
    if (frets.some((f) => f !== null && f < capo)) return null
    return frets.map((f) => (f === null ? null : f - capo))
}

/** Open-string pitches with the capo on: each string sounds `capo` semitones higher. */
export const capoTuning = (tuning: number[], capo: number): number[] =>
    tuning.map((pitch) => pitch + capo)

/**
 * Whether `written` names the chord `shape` sounds with the capo (same root and notes, any
 * spelling: A#m and Bbm alike). Unknown chords can't be checked: true.
 */
export function soundsLike(written: string, shape: string, capo: number): boolean {
    const a = chordNoteSet(written)
    const b = chordNoteSet(shape)
    if (!a || !b || a.root === null || b.root === null) return true
    const chromas = (set: typeof a, shift: number) =>
        [...new Set(set.members.map((m) => (m.chroma + shift) % 12))].sort((x, y) => x - y).join()
    const bass = (symbol: string, shift: number) => {
        const name = splitChordSymbol(symbol)?.bass
        const chroma = name ? chromaOf(name) : null
        return chroma === null ? null : (chroma + shift) % 12
    }
    return (
        a.root === (b.root + capo) % 12 &&
        chromas(a, 0) === chromas(b, capo) &&
        bass(written, 0) === bass(shape, capo)
    )
}
