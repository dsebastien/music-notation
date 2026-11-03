/**
 * Chords recognized from their notes: guitar frets (with a tuning) or pitches. tonal lists every
 * reading; common qualities come first, then root position, so E G C reads as C/E, not Em#5.
 */
import { Chord } from 'tonal'
import { parseChord } from './chord-symbol.js'
import { chromaOf, nameOf } from './pitch.js'
import { canonicalSuffix } from './suffix.js'
import { keyPrefersFlats } from './transpose.js'

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
    '9sus4',
    // Altered dominants, as jazz charts name them.
    '7b13',
    '7#5b9',
    '7#5#9',
    '7b9b13',
    '7#9b13',
    '13b9',
    '13#11',
    '7b9#11',
    '7#9#11'
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
    // A 13th voicing leaves out the 9th and the 11th (E G# B D C#): tonal reads 7add6.
    ['7add6', '13'],
    ['m7add6', 'm13'],
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
    // A missing fifth is the usual omission ("G13no5" is G13), like 7no5 and 9no5 above.
    if (!TONAL_SUFFIXES.has(rest) && rest.endsWith('no5')) rest = rest.slice(0, -3)
    const suffix = canonicalSuffix(TONAL_SUFFIXES.get(rest) ?? rest)
    if (!COMMON.includes(suffix) && !EXTENDED.has(suffix)) return null
    const out = `${m[1]}${suffix}${bass ? `/${bass}` : ''}`
    return parseChord(out) ? out : null
}

/** Roots as chords are usually spelled (Bb, not A#; F#, not Gb). */
const USUAL_ROOTS = new Set(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])

/**
 * 1 when a slash chord's bass isn't spelled as the chord would spell it: the matching chord tone
 * (C7/Bb, not C7/A#), else with the accidentals of the chord's key (F7/Eb, D7/C#).
 */
function bassCost(root: string, quality: string, bass: string | undefined): number {
    if (!bass) return 0
    const chroma = chromaOf(bass)
    const tone = Chord.getChord(quality, root).notes.find((note) => chromaOf(note) === chroma)
    if (tone) return tone === bass ? 0 : 1
    const flats = keyPrefersFlats(
        `${root}${quality.startsWith('m') && !quality.startsWith('maj') ? 'm' : ''}`
    )
    return bass.includes('b') === flats || !/[#b]/.test(bass) ? 0 : 1
}

/**
 * How far a reading's spelling is from the notes as written (pitch class → name): its root (2)
 * and bass (1) spelled otherwise, and each other chord tone written another way (1); at most 3.
 */
function spellingCost(symbol: string, spelled: ReadonlyMap<number, string>): number {
    const m = /^([A-G][#b]*)(.*?)(?:\/([A-G][#b]*))?$/.exec(symbol)!
    const differs = (note: string) => {
        const given = spelled.get(chromaOf(note)!)
        return given !== undefined && given !== note
    }
    let cost = (differs(m[1]!) ? 2 : 0) + (m[3] && differs(m[3]) ? 1 : 0)
    for (const note of Chord.getChord(m[2]!, m[1]).notes.slice(1)) if (differs(note)) cost++
    return Math.min(cost, 3)
}

/**
 * Lower is preferred: how common the quality is, a fixed cost for a slash (so Dsus2 wins over
 * Asus4/D, but C/E still wins over the rare Em#5), then the spelling: as the notes are written
 * when they are (Db F B Eb is Db9, not C#9), else the usual root and the bass spelled as the chord
 * spells it.
 */
const rank = (symbol: string, spelled: ReadonlyMap<number, string> | null): number => {
    const m = /^([A-G][#b]*)(.*?)(?:\/([A-G][#b]*))?$/.exec(symbol)!
    const common = COMMON.indexOf(m[2]!)
    return (
        ((common < 0 ? COMMON.length + 5 : common) + (m[3] ? 10 : 0)) * 4 +
        (spelled
            ? spellingCost(symbol, spelled)
            : (USUAL_ROOTS.has(m[1]!) ? 0 : 2) + bassCost(m[1]!, m[2]!, m[3]))
    )
}

/** An augmented 5th read as a flat 13th, the other name of the same note: 7#5b9 → 7b9b13. */
const B13: Record<string, string> = { '7#5': '7b13', '7#5b9': '7b9b13', '7#5#9': '7#9b13' }

/** A reading's sound regardless of spelling: root and bass as pitch classes, and the quality. */
function soundOf(symbol: string): string {
    const m = /^([A-G][#b]*)(.*?)(?:\/([A-G][#b]*))?$/.exec(symbol)!
    return `${chromaOf(m[1]!)}${m[2]}/${m[3] ? chromaOf(m[3]) : ''}`
}

/** Note names (sharps, flats, or as written), lowest first, without repeats. */
function namesOf(
    pitches: number[],
    flats: boolean,
    spelled: ReadonlyMap<number, string> | null = null
): string[] {
    const names: string[] = []
    for (const midi of [...pitches].sort((a, b) => a - b)) {
        const name = spelled?.get(((midi % 12) + 12) % 12) ?? nameOf(midi, flats)
        if (!names.includes(name)) names.push(name)
    }
    return names
}

/** Pitch class → name, from note names as written ("Db", "F4"); null without names. */
function spellingOf(names: readonly string[] | undefined): Map<number, string> | null {
    if (!names?.length) return null
    const spelled = new Map<number, string>()
    for (const raw of names) {
        const name = raw
            .trim()
            .replace(/-?\d+$/, '')
            .replace(/♯/g, '#')
            .replace(/♭/g, 'b')
        const chroma = /^[A-G]/.test(name) ? chromaOf(name) : null
        if (chroma !== null && !spelled.has(chroma)) spelled.set(chroma, name)
    }
    return spelled.size ? spelled : null
}

/**
 * Five notes or more that only move by steps (1 or 2 semitones) within an octave, an octave of the
 * lowest note on top allowed: a hand position or a scale fragment (C D E F G, C D E F G C), not a
 * chord, though tonal would name one (Dm11/C). Four-note clusters stay chords (Cmaj9/B, G9/F).
 */
function isStepwiseRun(pitches: number[]): boolean {
    let sorted = [...new Set(pitches)].sort((a, b) => a - b)
    if (sorted.length > 1 && sorted[sorted.length - 1]! - sorted[0]! === 12)
        sorted = sorted.slice(0, -1)
    if (sorted.length < 5 || sorted[sorted.length - 1]! - sorted[0]! >= 12) return false
    return sorted.every((pitch, i) => i === 0 || pitch - sorted[i - 1]! <= 2)
}

/**
 * The chord played by these pitches (MIDI); null when no chord fits. With `names`, the notes as
 * written (Db, F, B, Eb), the name follows their spelling: Db9, not C#9; and G B F Ab Eb is
 * G7b9b13 (Eb is a flat 13th), G B F Ab D# G7#5b9.
 */
export function detectChordFromPitches(
    pitches: number[],
    names?: readonly string[]
): DetectedChord | null {
    if (pitches.length < 2 || isStepwiseRun(pitches)) return null
    const spelled = spellingOf(names)
    const readings = new Set<string>()
    for (const pass of spelled ? ['written', 'sharps', 'flats'] : ['sharps', 'flats']) {
        const written = namesOf(pitches, pass === 'flats', pass === 'written' ? spelled : null)
        // Shell voicings (root, third, seventh) are named with the fifth assumed: 3x44xx is Gmaj7.
        for (const symbol of Chord.detect(written, { assumePerfectFifth: true })) {
            const normalized = normalize(symbol)
            if (!normalized) continue
            readings.add(normalized)
            // The same chord with a flat 13th, for notes written that way (Eb over G).
            const m = /^([A-G][#b]*)(7#5(?:b9|#9)?)((?:\/.*)?)$/.exec(normalized)
            if (spelled && m) readings.add(`${m[1]}${B13[m[2]!]}${m[3]}`)
        }
    }
    // One spelling per reading: as written, else the usual one (Bb, not A#), which ranks first.
    const seen = new Set<string>()
    const sorted = [...readings]
        .sort((a, b) => rank(a, spelled) - rank(b, spelled))
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
