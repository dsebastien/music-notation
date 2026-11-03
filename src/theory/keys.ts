/**
 * Keys and modes (#9, #42, #44): reading a key ("G", "Em", "F# minor", "D dorian"), its notes and
 * key signature, its diatonic chords with their roman numerals, and the numeral of any chord.
 * Spelling comes from tonal: F major has Bb, F# major has E#.
 */
import { Interval, Key, Note, Scale } from 'tonal'
import { chromaOf } from './pitch.js'

/** Modes a key can be in: major and minor, and the church modes. */
export const MODES = [
    'major',
    'minor',
    'ionian',
    'dorian',
    'phrygian',
    'lydian',
    'mixolydian',
    'aeolian',
    'locrian'
] as const

export type Mode = (typeof MODES)[number]

export interface MusicalKey {
    /** "F#", "Bb". */
    tonic: string
    mode: Mode
    /** "F# minor", "D dorian". */
    name: string
}

/** Each mode's distance from its parent major scale's tonic (D dorian is C major's second mode). */
const MODE_FROM_PARENT: Record<Mode, string> = {
    major: '1P',
    ionian: '1P',
    dorian: '2M',
    phrygian: '3M',
    lydian: '4P',
    mixolydian: '5P',
    minor: '6M',
    aeolian: '6M',
    locrian: '7M'
}

const MODE_WORDS: Record<string, Mode> = {
    'm': 'minor',
    'min': 'minor',
    'minor': 'minor',
    '': 'major',
    'maj': 'major',
    'major': 'major',
    'ionian': 'ionian',
    'dorian': 'dorian',
    'phrygian': 'phrygian',
    'lydian': 'lydian',
    'mixolydian': 'mixolydian',
    'aeolian': 'aeolian',
    'locrian': 'locrian'
}

/** A note name as tonal writes it: "f#" → "F#", "E♭" → "Eb"; null when it isn't one. */
export function noteName(text: string): string | null {
    const m = /^([A-Ga-g])([#♯b♭]?)$/.exec(text.trim())
    if (!m) return null
    return m[1]!.toUpperCase() + m[2]!.replace('♯', '#').replace('♭', 'b')
}

/**
 * "G", "Em", "F# minor", "Bb major", "D dorian", "c#m" → the key; null when it isn't one. A key
 * with no mode is major.
 */
export function readKey(text: string): MusicalKey | null {
    const m = /^\s*([A-Ga-g][#♯b♭]?)\s*([A-Za-z]*)\s*$/.exec(text)
    if (!m) return null
    let tonic = noteName(m[1]!)
    let word = m[2]!
    // "bb" is B flat and "bbm" B flat minor, not B with a mode called "b".
    if (tonic && /^[bB]$/.test(m[1]!) && /^b(m|min|minor|maj|major)?$/i.test(word)) {
        tonic = 'Bb'
        word = word.slice(1)
    }
    const mode = MODE_WORDS[word === 'M' ? 'major' : word.toLowerCase()]
    if (!tonic || !mode) return null
    return { tonic, mode, name: `${tonic} ${mode}` }
}

/** Whether a mode has a minor third (minor, aeolian, dorian, phrygian, locrian). */
export const isMinorMode = (mode: Mode): boolean =>
    ['minor', 'aeolian', 'dorian', 'phrygian', 'locrian'].includes(mode)

/** The key's notes (G major: G A B C D E F#). */
export const keyNotes = (key: MusicalKey): string[] => Scale.get(key.name).notes

/** The tonic of the major scale whose notes a mode uses (D dorian → C, A minor → C). */
export function parentMajor(key: MusicalKey): string {
    return Note.transpose(key.tonic, `-${MODE_FROM_PARENT[key.mode]}`)
}

export interface KeySignature {
    /** Sharps (positive) or flats (negative); 0 for C major and A minor. */
    count: number
    /** The altered notes in the order a signature writes them: F# C# G#…, Bb Eb Ab…. */
    accidentals: string[]
}

const SHARP_ORDER = 'FCGDAEB'
const FLAT_ORDER = 'BEADGCF'

/** The key signature (D dorian has C major's: none). */
export function keySignature(key: MusicalKey): KeySignature {
    const count = Key.majorKey(parentMajor(key)).alteration
    const order = count < 0 ? FLAT_ORDER : SHARP_ORDER
    const accidentals = keyNotes(key)
        .filter((n) => n.length > 1)
        .sort((a, b) => order.indexOf(a[0]!) - order.indexOf(b[0]!))
    return { count, accidentals }
}

/** Most sharps or flats a key signature has (C# major, Cb major). */
export const MAX_SIGNATURE = 7

/**
 * Why a key can't be written: its signature would need more than 7 sharps or flats (double sharps
 * or flats), with the other spelling to write ("G# major needs 8 sharps: write Ab major"); null
 * when it can.
 */
export function keyProblem(key: MusicalKey): string | null {
    const count = Key.majorKey(parentMajor(key)).alteration
    if (Math.abs(count) <= MAX_SIGNATURE) return null
    const other = Note.enharmonic(key.tonic)
    return `${key.name} needs ${Math.abs(count)} ${count > 0 ? 'sharps' : 'flats'}: write ${other} ${key.mode}`
}

/** "1♯", "3♭", "no ♯ or ♭". */
export const signatureText = (count: number): string =>
    count === 0 ? 'no ♯ or ♭' : `${Math.abs(count)}${count > 0 ? '♯' : '♭'}`

/** Chord suffix from the intervals of a stacked triad or seventh chord. */
const STACKED: Record<string, string> = {
    '3M 5P': '',
    '3m 5P': 'm',
    '3m 5d': 'dim',
    '3M 5A': 'aug',
    '3M 5d': 'Mb5',
    '3M 5P 7M': 'maj7',
    '3M 5P 7m': '7',
    '3m 5P 7m': 'm7',
    '3m 5P 7M': 'mMaj7',
    '3m 5d 7m': 'm7b5',
    '3m 5d 7d': 'dim7',
    '3M 5A 7M': 'maj7#5',
    '3M 5A 7m': '7#5',
    '3M 5d 7m': '7b5'
}

/** The triad or seventh chord stacked in thirds from `root` on these notes; null when unnamed. */
export function stackedChord(notes: string[], index: number, sevenths: boolean): string | null {
    const at = (step: number) => notes[(index + step) % notes.length]!
    const root = at(0)
    const tones = sevenths ? [at(2), at(4), at(6)] : [at(2), at(4)]
    const intervals = tones.map((n) => Interval.distance(root, n)).join(' ')
    const suffix = STACKED[intervals]
    return suffix === undefined ? null : `${root}${suffix}`
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const MAJOR_INTERVALS = ['1P', '2M', '3M', '4P', '5P', '6M', '7M']

/** A chord's quality as roman numerals write it: lowercase or not, and the mark after it. */
function numeralQuality(suffix: string): { lower: boolean; mark: string } {
    switch (suffix) {
        case '':
            return { lower: false, mark: '' }
        case 'm':
            return { lower: true, mark: '' }
        case 'dim':
            return { lower: true, mark: '°' }
        case 'dim7':
            return { lower: true, mark: '°7' }
        case 'm7b5':
            return { lower: true, mark: 'ø7' }
        case 'aug':
            return { lower: false, mark: '+' }
        case 'mMaj7':
            return { lower: true, mark: 'maj7' }
    }
    if (/^m(?!aj)/.test(suffix)) return { lower: true, mark: suffix.slice(1) }
    return { lower: false, mark: suffix }
}

/** A chord's quality as Nashville numbers write it: 6m, 5-7 written 5m7, 7°. */
function nashvilleQuality(suffix: string): string {
    return (
        { dim: '°', dim7: '°7', m7b5: 'ø7', aug: '+' }[suffix] ??
        (suffix === 'mMaj7' ? 'mmaj7' : suffix)
    )
}

export interface Degree {
    /** 1 to 7. */
    number: number
    /** "b", "#", "" (or "bb", "##"). */
    accidental: string
}

/**
 * The degree of a note in a key, by letters: in G, F is b7 and F# is 7. Degrees count from the
 * major scale, so a minor key's own 3rd, 6th and 7th are b3, b6, b7 (bIII, bVI, bVII). With
 * `minorKey`, the raised ones are #3, #6, #7: a minor key reads an unmarked VI as its own 6th
 * (see readNumeral), so the mark keeps numerals reading back to the same chord.
 */
export function degreeOf(tonic: string, note: string, minorKey = false): Degree | null {
    if (chromaOf(note) === null || chromaOf(tonic) === null) return null
    const interval = Interval.distance(tonic, note)
    const m = /^(\d+)/.exec(interval)
    if (!m) return null
    const number = ((Number(m[1]) - 1) % 7) + 1
    const offset =
        (((Interval.semitones(interval) ?? 0) -
            (Interval.semitones(MAJOR_INTERVALS[number - 1]!) ?? 0) +
            18) %
            12) -
        6
    let accidental = offset > 0 ? '#'.repeat(offset) : 'b'.repeat(-offset)
    // Minor keys: their 3rd, 6th and 7th are already "b"; raised ones are "#" (see readNumeral).
    if (minorKey && [3, 6, 7].includes(number) && offset === 0) accidental = '#'
    return { number, accidental }
}

/** The numeral's text for a chord on a degree: "bVII", "ii7", "vii°", "V7". */
export function romanText(degree: Degree, suffix: string): string {
    const { lower, mark } = numeralQuality(suffix)
    const roman = ROMAN[degree.number - 1]!
    return `${degree.accidental}${lower ? roman.toLowerCase() : roman}${mark}`
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/**
 * The Nashville number for a chord on a degree: "b7", "6m", "2m7", and "5⁷" (a seventh right after
 * the number is raised, as charts write it, so it doesn't read as 57).
 */
export function nashvilleText(degree: Degree, suffix: string): string {
    const quality = nashvilleQuality(suffix).replace(/^\d+/, (digits) =>
        [...digits].map((d) => SUPERSCRIPT[Number(d)]).join('')
    )
    return `${degree.accidental}${degree.number}${quality}`
}

/** "5⁷" → "57": superscript digits as plain ones. */
export const plainDigits = (text: string): string =>
    text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => String(SUPERSCRIPT.indexOf(d)))

export interface KeyChord {
    /** 1 to 7. */
    degree: number
    /** "ii", "bVII", "V7", "viiø7". */
    numeral: string
    /** "Am", "F", "D7". */
    symbol: string
}

/**
 * The key's seven chords, stacked in thirds on its notes: triads, or seventh chords. Numerals
 * count from the major scale (A minor: i ii° bIII iv v bVI bVII; D dorian: i ii bIII IV v vi°
 * bVII).
 */
export function keyChords(key: MusicalKey, sevenths = false): KeyChord[] {
    const notes = keyNotes(key)
    if (notes.length !== 7) return []
    return notes.map((root, i) => {
        const symbol = stackedChord(notes, i, sevenths) ?? root
        const degree = degreeOf(key.tonic, root)!
        return {
            degree: i + 1,
            numeral: romanText(degree, symbol.slice(root.length)),
            symbol
        }
    })
}
