/**
 * Pitch classes and note names. A pitch class is a chroma: 0 = C … 11 = B. Names accept ASCII
 * (`#`, `b`) and Unicode (`♯`, `♭`) accidentals.
 */

export const SHARP_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B'
] as const
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const LETTER_CHROMA: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "C#", "Db", "D♭", "E" → 0..11; null when it isn't a note name. */
export function chromaOf(name: string): number | null {
    const m = /^([A-Ga-g])([#♯b♭]*)$/.exec(name.trim())
    if (!m) return null
    let chroma = LETTER_CHROMA[m[1]!.toUpperCase()]!
    for (const accidental of m[2]!) chroma += accidental === '#' || accidental === '♯' ? 1 : -1
    return ((chroma % 12) + 12) % 12
}

/** A note with its octave, scientific pitch notation ("C4" = MIDI 60); null when invalid. */
export function midiOf(note: string): number | null {
    const m = /^([A-Ga-g][#♯b♭]*)(-?\d)$/.exec(note.trim())
    if (!m) return null
    const chroma = chromaOf(m[1]!)
    if (chroma === null) return null
    // B#3 is C4 and Cb4 is B3: the letter decides the octave, the accidental can cross it.
    const letter = LETTER_CHROMA[m[1]![0]!.toUpperCase()]!
    const shift = Math.round((chroma - letter) / 12)
    return (Number(m[2]) + 1) * 12 + chroma - shift * 12
}

/** Name of a pitch class, with sharps or flats. */
export const nameOf = (chroma: number, preferFlats = false): string =>
    (preferFlats ? FLAT_NAMES : SHARP_NAMES)[((chroma % 12) + 12) % 12]!

/** "C4" for MIDI 60. */
export const noteOf = (midi: number, preferFlats = false): string =>
    `${nameOf(midi, preferFlats)}${Math.floor(midi / 12) - 1}`

/** Whether a name is spelled with a flat ("Bb", "E♭"). */
export const isFlat = (name: string): boolean => /^[A-Ga-g][b♭]/.test(name.trim())
