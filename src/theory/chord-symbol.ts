/**
 * Chord symbols ("F#m7", "C/G") → root, quality, bass and a name spelled out in ASCII
 * ("F Sharp Minor 7"), safe for file names and wikilinks.
 */
import { splitChordSymbol } from './pitch.js'
import { chordNoteSet } from './note-set.js'
import { withoutParentheses } from './suffix.js'

/** Suffix → quality name. Order matters: the first match wins. */
const QUALITY_SUFFIXES: [RegExp, string][] = [
    [/^(m7b5|m7-5|ø7?)$/, 'Minor 7 flat 5'],
    [/^(dim7|°7)$/, 'Diminished 7'],
    [/^(maj9|M9|Δ9)$/, 'Major 9'],
    [/^(maj7|M7|Δ7?)$/, 'Major 7'],
    [/^(7sus4)$/, '7sus4'],
    [/^(m9|min9|-9)$/, 'Minor 9'],
    [/^(m7|min7|-7)$/, 'Minor 7'],
    [/^(m6|min6|-6)$/, 'Minor 6'],
    [/^(m|min|-)$/, 'Minor'],
    [/^(dim|°)$/, 'Diminished'],
    [/^(aug|\+|\+5|#5)$/, 'Augmented'],
    [/^(sus2)$/, 'Sus2'],
    [/^(sus4|sus)$/, 'Sus4'],
    [/^(add9|add2)$/, 'Add9'],
    [/^5$/, '5 (Power)'],
    [/^(6\/9|69)$/, '6/9'],
    [/^(m6\/9|m69|m6add9)$/, 'Minor 6/9'],
    [/^(Mb5|b5|-5)$/, 'Major flat 5'],
    [/^(mM7|mMaj7|mmaj7|m\(maj7\)|-\(maj7\))$/, 'Minor major 7'],
    [/^(13|11|9|7|6)$/, '$1'],
    [/^(maj|M)?$/, 'Major']
]

export interface ParsedChord {
    symbol: string
    root: string
    quality: string
    bass: string | null
    /** "F Sharp Minor 7", "C Major over G". */
    name: string
}

const ACCIDENTAL_WORDS: Record<string, string> = {
    '#': ' Sharp',
    '##': ' Double Sharp',
    'b': ' Flat',
    'bb': ' Double Flat'
}

/** "F#" → "F Sharp", "Ebb" → "E Double Flat". */
export const spellNote = (note: string): string =>
    note[0]! + (ACCIDENTAL_WORDS[note.slice(1)] ?? '')

/** "5 (Power)" → "5" for names. */
const plain = (quality: string) => quality.replace(/\s*\([^)]*\)/g, '').trim()

/** Parse a chord symbol; null when it isn't one. */
export function parseChord(symbol: string): ParsedChord | null {
    const parts = splitChordSymbol(symbol)
    if (!parts) return null
    const trimmed = symbol.trim()
    const { root, bass } = parts
    // Alterations in parentheses read like the same symbol without them: C7(b9) is C7b9. The
    // written suffix is tried first, for spellings with their own name (C-(maj7)).
    const suffix = withoutParentheses(parts.suffix)
    let quality: string | null = null
    for (const written of suffix === null || suffix === parts.suffix
        ? [parts.suffix]
        : [parts.suffix, suffix]) {
        for (const [re, label] of QUALITY_SUFFIXES) {
            const hit = re.exec(written)
            if (hit) {
                quality = label.replace('$1', hit[1] ?? '')
                break
            }
        }
        if (quality) break
    }
    if (suffix === null && !quality) return null
    // Any other chord tonal knows ("C7b9", "Cm11"): its suffix is its quality.
    if (!quality && suffix !== null && chordNoteSet(trimmed)) quality = suffix
    if (!quality) return null
    return {
        symbol: trimmed,
        root,
        quality,
        bass,
        name: `${spellNote(root)} ${plain(quality)}${bass ? ` over ${spellNote(bass)}` : ''}`
    }
}
