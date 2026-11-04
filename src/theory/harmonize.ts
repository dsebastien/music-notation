/**
 * Harmonize a scale (#43): the chord on each degree of any 7-note scale (major, natural minor,
 * the modes, harmonic and melodic minor, and other 7-note scales tonal knows), stacked from the
 * scale's own notes, with its numeral, Nashville number and function.
 *
 * Numerals are written as the progression block writes and reads them, so each one reads back to
 * its chord in `key`: the church modes count from the major scale (D dorian: bIII, vi°, bVII);
 * other scales name their numerals in the major or minor key of their third, and a minor key
 * marks its raised 6th and 7th (A melodic minor: IV7, #viø7, viiø7; vii° is the leading tone).
 */
import { Interval, Key, Note, Scale } from 'tonal'
import {
    isMinorMode,
    keyProblem,
    MAX_SIGNATURE,
    readKey,
    stackedChord,
    type MusicalKey
} from './keys.js'
import { harmonicFunction, numeralOf, type HarmonicFunction } from './numerals.js'
import { scaleName, scaleSpelling } from './scales.js'

export const HARMONIZE_KINDS = ['triads', 'sevenths', 'sus', 'power'] as const

export type HarmonizeKind = (typeof HARMONIZE_KINDS)[number]

export interface HarmonizeOptions {
    /** `triads` (default), `sevenths`, `sus` (sus4, else sus2), `power` (root and fifth). */
    kind?: HarmonizeKind
}

export interface HarmonyScale {
    /** "A harmonic minor", "D dorian", "G major". */
    name: string
    /** The scale's notes, as tonal spells them (G# harmonic minor's 7th is F##). */
    notes: string[]
    /**
     * The key its numerals are written in: the key itself for major, minor and the modes, else
     * the major or minor key of the scale's third (A harmonic minor: A minor).
     */
    key: MusicalKey
}

export interface HarmonizedChord {
    /** 1 to 7. */
    degree: number
    /** The scale note it is built on. */
    note: string
    /** "AmMaj7", "Fsus2", "E5". */
    symbol: string
    /** "imaj7", "#viø7", "bVII", "I5". */
    numeral: string
    /** "1mmaj⁷", "#6ø⁷". */
    nashville: string
    function: HarmonicFunction
}

export interface Harmonized extends HarmonyScale {
    kind: HarmonizeKind
    chords: HarmonizedChord[]
    /** Degrees without a chord of this kind (sus or power chords need a perfect fifth). */
    skipped: { degree: number; note: string; reason: string }[]
}

/** Functions by degree, for chords outside the key a scale's numerals are written in. */
const MAJOR_FUNCTIONS: HarmonicFunction[] = [
    'tonic',
    'subdominant',
    'tonic',
    'subdominant',
    'dominant',
    'tonic',
    'dominant'
]
const MINOR_FUNCTIONS: HarmonicFunction[] = [
    'tonic',
    'subdominant',
    'tonic',
    'subdominant',
    'dominant',
    'subdominant',
    'dominant'
]

const DIATONIC: HarmonicFunction[] = ['tonic', 'subdominant', 'dominant']

const unknown = (text: string) =>
    `Unknown scale "${text.trim()}": use e.g. key: G major, key: A harmonic minor or key: D dorian`

/**
 * A scale to harmonize: a key (`G`, `Em`, `F# minor`, `D dorian`) or any 7-note scale tonal knows
 * (`A harmonic minor`, `C melodic minor`, `A natural minor`, `C phrygian dominant`). An error
 * says why it can't be one.
 */
export function readHarmonyScale(text: string): HarmonyScale | { error: string } {
    const name = scaleName(text)
    const asKey = readKey(name)
    if (asKey) {
        const mode =
            asKey.mode === 'ionian' ? 'major' : asKey.mode === 'aeolian' ? 'minor' : asKey.mode
        const key: MusicalKey = { tonic: asKey.tonic, mode, name: `${asKey.tonic} ${mode}` }
        const problem = keyProblem(key)
        if (problem) return { error: problem }
        return { name: key.name, notes: Scale.get(key.name).notes, key }
    }
    const scale = Scale.get(name)
    if (scale.empty || !scale.tonic) return { error: unknown(text) }
    if (scale.notes.length !== 7) {
        return {
            error: `harmonize needs a scale of 7 notes: ${scale.name} has ${scale.notes.length}`
        }
    }
    const tonic = scale.tonic
    const notes = scaleSpelling(scale).notes
    // The third as the scale spells it (B altered has D, a minor third, though tonal's intervals
    // list a major third for its Eb).
    const minor = Interval.distance(tonic, notes[2]!) === '3m'
    const key: MusicalKey = {
        tonic,
        mode: minor ? 'minor' : 'major',
        name: `${tonic} ${minor ? 'minor' : 'major'}`
    }
    const count = minor ? Key.minorKey(tonic).alteration : Key.majorKey(tonic).alteration
    if (Math.abs(count) > MAX_SIGNATURE) {
        return {
            error: `${scale.name} needs ${Math.abs(count)} ${count > 0 ? 'sharps' : 'flats'}: write ${Note.enharmonic(tonic)} ${scale.type}`
        }
    }
    return { name: scale.name, notes, key }
}

/** The chord of a kind on a degree, or why there is none. */
function chordOn(
    notes: string[],
    i: number,
    kind: HarmonizeKind
): { symbol: string } | { reason: string } {
    const root = notes[i]!
    const above = (step: number) => Interval.distance(root, notes[(i + step) % 7]!)
    if (kind === 'triads' || kind === 'sevenths') {
        const symbol = stackedChord(notes, i, kind === 'sevenths')
        return symbol ? { symbol } : { reason: 'not a named chord' }
    }
    if (above(4) !== '5P') return { reason: 'no perfect fifth' }
    if (kind === 'power') return { symbol: `${root}5` }
    if (above(3) === '4P') return { symbol: `${root}sus4` }
    if (above(1) === '2M') return { symbol: `${root}sus2` }
    return { reason: 'no perfect fourth or major second' }
}

/**
 * The chords of a 7-note scale, one per degree (see the module comment for numerals). Functions:
 * the chord's function in `key` when it is tonic, subdominant or dominant, else by degree (major
 * T S T S D T D, minor T S T S D S D), so a melodic minor's IV7 is a subdominant, not a secondary
 * dominant. Null when the scale or the kind doesn't read.
 */
export function harmonize(scale: string, options: HarmonizeOptions = {}): Harmonized | null {
    const kind = options.kind ?? 'triads'
    if (!HARMONIZE_KINDS.includes(kind)) return null
    const read = readHarmonyScale(scale)
    if ('error' in read) return null
    const { notes, key } = read
    const byDegree = isMinorMode(key.mode) ? MINOR_FUNCTIONS : MAJOR_FUNCTIONS
    const chords: HarmonizedChord[] = []
    const skipped: Harmonized['skipped'] = []
    notes.forEach((note, i) => {
        const made = chordOn(notes, i, kind)
        if ('reason' in made) {
            skipped.push({ degree: i + 1, note, reason: made.reason })
            return
        }
        const { symbol } = made
        const fn = harmonicFunction(symbol, key)
        chords.push({
            degree: i + 1,
            note,
            symbol,
            numeral: numeralOf(symbol, key, 'roman', { byDegree: true }) ?? symbol,
            nashville: numeralOf(symbol, key, 'nashville', { byDegree: true }) ?? symbol,
            function: fn && DIATONIC.includes(fn) ? fn : byDegree[i]!
        })
    })
    return { ...read, kind, chords, skipped }
}
