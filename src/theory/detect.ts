/**
 * Chords recognized from their notes: guitar frets (with a tuning) or pitches. tonal lists every
 * reading; common qualities come first, then root position, so E G C reads as C/E, not Em#5.
 */
import { Chord } from 'tonal'
import { parseChord } from './chord-symbol.js'
import { chromaOf, nameOf } from './pitch.js'
import { canonicalSuffix } from './suffix.js'

/** Standard tuning, lowest string first (MIDI). */
const STANDARD = [40, 45, 50, 55, 59, 64]

/** Qualities in the order a reading is preferred (lower is more common). */
const COMMON = [
    '',
    'm',
    '7',
    'm7',
    'maj7',
    '5',
    'sus4',
    'sus2',
    'dim',
    'm7b5',
    'dim7',
    'aug',
    '6',
    'm6',
    'add9',
    '9',
    'm9',
    'maj9',
    '7sus4',
    'mMaj7'
]

export interface DetectedChord {
    /** The preferred reading ("A", "C/E", "Am7"). */
    symbol: string
    /** Every reading, the preferred one first. */
    readings: string[]
}

/**
 * Readings worth offering beyond the common ones. tonal's rarer names ("sus24", "4") are dropped,
 * and so is "m#5": an augmented spelling of a major triad's inversion (C reads as Em#5/C).
 */
const EXTENDED = new Set([
    '7b5',
    '7#5',
    '7b9',
    '7#9',
    '7#11',
    'maj7#11',
    '11',
    'm11',
    '13',
    'm13',
    '6/9',
    'm6/9',
    '9sus4'
])

/** tonal's suffixes, spelled as chord symbols are. */
const TONAL_SUFFIXES = new Map<string, string>([
    ['M', ''],
    ['Madd9', 'add9'],
    ['Maj7', 'maj7'],
    ['m/ma7', 'mMaj7'],
    ['m/maj7', 'mMaj7'],
    ['mM7', 'mMaj7'],
    ['7no5', '7'],
    ['9no5', '9'],
    ['M6', '6'],
    ['M9', 'maj9'],
    ['M7', 'maj7'],
    ['M69', '6/9'],
    ['m69', 'm6/9'],
    ['Msus2', 'sus2'],
    ['Msus4', 'sus4'],
    ['o', 'dim'],
    ['o7', 'dim7']
])

/**
 * tonal's "AM", "Am/ma7", "C7no5/E" → our spelling ("A", "AmMaj7", "C7/E"); null when it isn't a
 * reading worth offering or the symbol parser refuses it.
 */
function normalize(symbol: string): string | null {
    const m = /^([A-G][#b]*)(.*)$/.exec(symbol)
    if (!m) return null
    let rest = m[2]!
    let bass = ''
    // A slash that's part of tonal's quality ("m/ma7") isn't a bass.
    const slash = rest.search(/\/[A-G][#b]*$/)
    if (slash >= 0) {
        bass = rest.slice(slash + 1)
        rest = rest.slice(0, slash)
    }
    const suffix = canonicalSuffix(TONAL_SUFFIXES.get(rest) ?? rest)
    if (!COMMON.includes(suffix) && !EXTENDED.has(suffix)) return null
    const out = `${m[1]}${suffix}${bass ? `/${bass}` : ''}`
    return parseChord(out) ? out : null
}

/** Roots as chords are usually spelled (Bb, not A#; F#, not Gb). */
const USUAL_ROOTS = new Set(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])

/**
 * Lower is preferred: how common the quality is, a fixed cost for a slash (so Dsus2 wins over
 * Asus4/D, but C/E still wins over the rare Em#5), then the usual spelling of the root.
 */
const rank = (symbol: string): number => {
    const m = /^([A-G][#b]*)(.*?)(\/[A-G][#b]*)?$/.exec(symbol)!
    const common = COMMON.indexOf(m[2]!)
    return (
        ((common < 0 ? COMMON.length + 5 : common) + (m[3] ? 10 : 0)) * 2 +
        (USUAL_ROOTS.has(m[1]!) ? 0 : 1)
    )
}

/** A reading's sound regardless of spelling: root and bass as pitch classes, and the quality. */
function soundOf(symbol: string): string {
    const m = /^([A-G][#b]*)(.*?)(?:\/([A-G][#b]*))?$/.exec(symbol)!
    return `${chromaOf(m[1]!)}${m[2]}/${m[3] ? chromaOf(m[3]) : ''}`
}

/** Note names (sharps, or flats when asked), lowest first, without repeats. */
function namesOf(pitches: number[], flats: boolean): string[] {
    const names: string[] = []
    for (const midi of [...pitches].sort((a, b) => a - b)) {
        const name = nameOf(midi, flats)
        if (!names.includes(name)) names.push(name)
    }
    return names
}

/** The chord played by these pitches (MIDI); null when no chord fits. */
export function detectChordFromPitches(pitches: number[]): DetectedChord | null {
    if (pitches.length < 2) return null
    const readings = new Set<string>()
    for (const flats of [false, true]) {
        for (const symbol of Chord.detect(namesOf(pitches, flats))) {
            const normalized = normalize(symbol)
            if (normalized) readings.add(normalized)
        }
    }
    // One spelling per reading: the usual one (Bb, not A#), which ranks first.
    const seen = new Set<string>()
    const sorted = [...readings]
        .sort((a, b) => rank(a) - rank(b))
        .filter((symbol) => {
            const key = soundOf(symbol)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    return sorted.length ? { symbol: sorted[0]!, readings: sorted } : null
}

/** The chord played by these frets (lowest string first; null = muted); null when no chord fits. */
export function detectChordFromFrets(
    frets: (number | null)[],
    tuning: number[] = STANDARD
): DetectedChord | null {
    if (tuning.length !== frets.length) return null
    const pitches = frets.flatMap((fret, i) => (fret === null ? [] : [tuning[i]! + fret]))
    return detectChordFromPitches(pitches)
}
