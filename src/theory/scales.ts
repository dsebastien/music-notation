/**
 * Scale names as people write them ("A Natural minor", "C Major pentatonic", "A Blues"), the notes
 * that define a mode (its characteristic notes), and the modes of a scale.
 */
import { Note, Scale } from 'tonal'

/** Common names tonal spells differently (lowercase). */
const ALIASES = new Map<string, string>([
    ['natural minor', 'minor'],
    ['blues', 'minor blues'],
    ['whole-tone', 'whole tone'],
    ['pentatonic major', 'major pentatonic'],
    ['pentatonic minor', 'minor pentatonic']
])

/** "A Natural minor" → "A minor": a name tonal knows, as written otherwise. */
export function scaleName(text: string): string {
    const m = /^\s*([A-Ga-g](?:#|b|♯|♭)?)\s+(.+?)\s*$/.exec(text)
    const [tonic, type] = m ? [m[1]!, m[2]!] : ['', text.trim()]
    const lower = type.toLowerCase().replace(/\s+/g, ' ')
    const name = ALIASES.get(lower) ?? lower
    return tonic
        ? `${tonic[0]!.toUpperCase()}${tonic.slice(1).replace('♯', '#').replace('♭', 'b')} ${name}`
        : name
}

/** A scale tonal knows but written without a root ("lydian", "blues"). */
export const isScaleWithoutRoot = (text: string): boolean => {
    const scale = Scale.get(scaleName(text))
    return !scale.empty && !scale.tonic
}

/** The intervals that set a scale apart, by tonal scale type. */
const CHARACTERISTIC: Record<string, string[]> = {
    'lydian': ['4A'],
    'dorian': ['6M'],
    'mixolydian': ['7m'],
    'phrygian': ['2m'],
    'locrian': ['5d'],
    'minor': ['6m'],
    'minor blues': ['5d'],
    'major blues': ['3m'],
    'harmonic minor': ['7M'],
    'melodic minor': ['6M', '7M'],
    'phrygian dominant': ['2m', '3M']
}

const MODE_WORDS = /\b(dorian|phrygian|lydian|mixolydian|aeolian|locrian|blues)\b/i

/** The intervals to mark for a scale ("C lydian" → ["4A"]); empty when it has none. */
export const characteristicIntervals = (type: string): string[] => CHARACTERISTIC[type] ?? []

/** Whether characteristic notes show without asking: modes and blues, as written. */
export const marksByDefault = (written: string): boolean => MODE_WORDS.test(written)

/** The modes of a scale ("C major" → "C major", "D dorian", … "B locrian"); null when it has none. */
export function modesOf(text: string): string[] | null {
    const scale = Scale.get(scaleName(text))
    if (scale.empty || !scale.tonic) return null
    const modes = Scale.modeNames(scale.name)
    // Symmetric scales (chromatic, whole tone) only repeat themselves.
    if (new Set(modes.map(([, mode]) => mode)).size < 2) return null
    return modes.map(([tonic, mode]) => `${tonic} ${mode}`)
}

const DOUBLE_ACCIDENTAL = /^[A-G](##|bb)/

/** The altered scale's superlocrian degrees (1 b2 b3 b4 b5 b6 b7): G# A B C D E F#. */
const SUPERLOCRIAN = ['1P', '2m', '3m', '4d', '5d', '6m', '7m']

/**
 * A scale's notes and intervals as musicians write them. The altered scale switches to its
 * superlocrian degrees when tonal's (b9 #9 3 #11) need a double accidental (G# altered). Other
 * scales keep tonal's spelling, one letter per degree: G# harmonic minor's 7th is F##, not G.
 */
export function scaleSpelling(scale: {
    tonic: string | null
    type: string
    notes: string[]
    intervals: string[]
}): {
    notes: string[]
    intervals: string[]
} {
    const hasDouble = (notes: string[]) => notes.some((n) => DOUBLE_ACCIDENTAL.test(n))
    if (!hasDouble(scale.notes)) return { notes: scale.notes, intervals: scale.intervals }
    if (scale.type === 'altered' && scale.tonic) {
        const notes = SUPERLOCRIAN.map((interval) => Note.transpose(scale.tonic!, interval))
        if (!hasDouble(notes)) return { notes, intervals: SUPERLOCRIAN }
    }
    return { notes: scale.notes, intervals: scale.intervals }
}

/** Scale types tonal knows, for docs and pickers. */
export const scaleTypes = (): string[] => Scale.names()
