/**
 * Chord names in words ("A Major", "F Sharp Minor 7", "C Major over G") → chord symbols. The
 * reverse of `parseChord().name`, so both directions round-trip.
 */
import { parseChord, type ParsedChord } from './chord-symbol.js'

/** Quality in words (lowercase, single spaces) → suffix. The words `parseChord` writes, and a few more. */
const QUALITY_WORDS = new Map<string, string>([
    ['', ''],
    ['major', ''],
    ['maj', ''],
    ['minor', 'm'],
    ['min', 'm'],
    ['minor 7 flat 5', 'm7b5'],
    ['half diminished', 'm7b5'],
    ['diminished 7', 'dim7'],
    ['major 9', 'maj9'],
    ['major 7', 'maj7'],
    ['7sus4', '7sus4'],
    ['7 sus4', '7sus4'],
    ['minor 9', 'm9'],
    ['minor 7', 'm7'],
    ['minor 6', 'm6'],
    ['diminished', 'dim'],
    ['augmented', 'aug'],
    ['sus2', 'sus2'],
    ['suspended 2', 'sus2'],
    ['sus4', 'sus4'],
    ['suspended 4', 'sus4'],
    ['add9', 'add9'],
    ['add 9', 'add9'],
    ['5', '5'],
    ['power', '5'],
    ['6/9', '6/9'],
    ['minor major 7', 'mMaj7'],
    ['dominant 7', '7'],
    ['13', '13'],
    ['11', '11'],
    ['9', '9'],
    ['7', '7'],
    ['6', '6']
])

/** The words for the qualities most chords use, for suggestions. */
const COMMON_QUALITIES = ['Major', 'Minor', '7', 'Major 7', 'Minor 7', 'Sus4', 'Diminished']

const ACCIDENTAL: Record<string, string> = {
    'sharp': '#',
    'flat': 'b',
    '#': '#',
    '♯': '#',
    'b': 'b',
    '♭': 'b'
}

/** "f sharp", "B-flat", "Bb", "e♭" → "F#", "Bb", "Bb", "Eb"; null when it isn't a note. */
function noteOf(text: string): string | null {
    const m = /^([a-g])[\s-]*(sharp|flat|#|♯|♭|b)?$/i.exec(text.trim())
    if (!m) return null
    return m[1]!.toUpperCase() + (m[2] ? ACCIDENTAL[m[2].toLowerCase()]! : '')
}

const NOTE = '[a-g](?:[\\s-]*(?:sharp|flat)\\b|[#♯♭b](?![a-z]))?'
const NAME = new RegExp(`^(${NOTE})(.*?)(?:(?:\\s+over\\s+|\\s*/\\s*)(${NOTE}))?$`, 'i')

/** Splits "F Sharp Minor 7 over A" (or "… Minor 7/A") into root, quality words and bass. */
function split(text: string): { root: string; quality: string; bass: string | null } | null {
    const m = NAME.exec(text.trim().replace(/\s+/g, ' '))
    if (!m) return null
    const root = noteOf(m[1]!)
    const bass = m[3] === undefined ? null : noteOf(m[3])
    if (!root || (m[3] !== undefined && !bass)) return null
    return { root, quality: m[2]!.trim().toLowerCase(), bass }
}

/** A chord name in words as a parsed chord ("A Major" → A); null when it isn't one. */
export function parseChordName(text: string): ParsedChord | null {
    const parts = split(text)
    if (!parts) return null
    const known = QUALITY_WORDS.get(parts.quality)
    // Any other quality is tried as written ("C 7b9"), when it looks like a chord suffix.
    const suffix = known ?? parts.quality.replace(/\s+/g, '')
    if (known === undefined && !/^[\w#+()°ø]+$/.test(suffix)) return null
    const parsed = parseChord(`${parts.root}${suffix}${parts.bass ? `/${parts.bass}` : ''}`)
    return parsed
}

/**
 * A chord written as a symbol or in words. Without a space the symbol reading wins ("A", "Am",
 * "Bb"); with one, the words do ("E 5" is E5, "F# minor" is F#m).
 */
export const readChord = (text: string): ParsedChord | null =>
    /\s/.test(text.trim())
        ? (parseChordName(text) ?? parseChord(text))
        : (parseChord(text) ?? parseChordName(text))

const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0]!
        row[0] = i
        for (let j = 1; j <= b.length; j++) {
            const current = row[j]!
            row[j] = Math.min(
                row[j]! + 1,
                row[j - 1]! + 1,
                previous + (a[i - 1] === b[j - 1] ? 0 : 1)
            )
            previous = current
        }
    }
    return row[b.length]!
}

/** What to write instead of a chord that didn't read ("A Majr" → "A, Am, A7 or A Major"). */
export function suggestChords(text: string): string {
    const parts = split(text)
    const root = parts?.root ?? 'A'
    const spelled = root[0]! + (root[1] === '#' ? ' Sharp' : root[1] === 'b' ? ' Flat' : '')
    const quality = parts?.quality ?? ''
    const closest = COMMON_QUALITIES.reduce((best, q) =>
        distance(quality, q.toLowerCase()) < distance(quality, best.toLowerCase()) ? q : best
    )
    // Nothing close: offer the plain major chord.
    const near =
        quality && distance(quality, closest.toLowerCase()) <= Math.max(2, quality.length / 2)
    return `${root}, ${root}m, ${root}7 or ${spelled} ${near ? closest : 'Major'}`
}
