/**
 * Chords recognized from their notes: guitar frets (with a tuning) or pitches. tonal lists every
 * reading; common qualities come first, then root position, so E G C reads as C/E, not Em#5.
 */
import { Chord } from 'tonal'
import { parseChord } from './chord-symbol.js'
import { nameOf } from './pitch.js'
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

/** tonal's "AM", "C6/A", "Em#5" → our spelling ("A", "C6/A"); null when the symbol parser refuses it. */
function normalize(symbol: string): string | null {
    const m = /^([A-G][#b]*)([^/]*)(?:\/(.+))?$/.exec(symbol)
    if (!m) return null
    const suffix = m[2] === 'M' ? '' : canonicalSuffix(m[2]!)
    const out = `${m[1]}${suffix}${m[3] ? `/${m[3]}` : ''}`
    return parseChord(out) ? out : null
}

/** Roots as chords are usually spelled (Bb, not A#; F#, not Gb). */
const USUAL_ROOTS = new Set(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])

const rank = (symbol: string): number => {
    const m = /^([A-G][#b]*)([^/]*)(\/.*)?$/.exec(symbol)!
    const common = COMMON.indexOf(m[2]!)
    return (
        ((common < 0 ? COMMON.length : common) * 2 + (m[3] ? 1 : 0)) * 2 +
        (USUAL_ROOTS.has(m[1]!) ? 0 : 1)
    )
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
    const sorted = [...readings].sort((a, b) => rank(a) - rank(b))
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
