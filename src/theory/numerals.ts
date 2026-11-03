/**
 * Roman numerals and Nashville numbers (#9): "I V vi IV" or "1 5 6m 4" in a key → chord symbols,
 * and back: the numeral of a chord in a key, with its harmonic function.
 */
import { Note } from 'tonal'
import { chordNoteSet } from './note-set.js'
import { parseChord } from './chord-symbol.js'
import { chromaOf, splitChordSymbol } from './pitch.js'
import { canonicalSuffix } from './suffix.js'
import { inKey } from './find.js'
import {
    degreeOf,
    isMinorMode,
    keyNotes,
    nashvilleText,
    plainDigits,
    readKey,
    romanText,
    type Degree,
    type MusicalKey
} from './keys.js'

/** What a chord does in its key. */
export type HarmonicFunction =
    'tonic' | 'subdominant' | 'dominant' | 'secondary dominant' | 'borrowed' | 'chromatic'

export interface ProgressionChord {
    /** As written: "V7/V", "6m", "Em". */
    written: string
    /** The chord: "D7", "Em". */
    symbol: string
    /** Its roman numeral: as written for numerals, worked out for chord names ("bVII", "V7/V"). */
    numeral: string
    /** Its Nashville number ("b7", "6m", "5/3"). */
    nashville: string
    function: HarmonicFunction
}

const MAJOR = ['1P', '2M', '3M', '4P', '5P', '6M', '7M']
const NATURAL_MINOR = ['1P', '2M', '3m', '4P', '5P', '6m', '7m']
const ROMAN_NUMBERS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 }

/** A key for numerals: major, or minor (a mode is read as major or minor by its third). */
const keyOf = (key: string | MusicalKey): MusicalKey | null =>
    typeof key === 'string' ? readKey(key) : key

/**
 * The note on a degree of a key. Major keys count from the major scale. Minor keys read an unmarked
 * 3rd, 6th or 7th as their own (natural) note, so VI and bVI are both the 6th of the natural minor
 * scale, and #VI, #vii° raise it; a diminished chord on an unmarked 7th takes the raised 7th (the
 * leading tone: vii° in A minor is G#dim).
 */
function noteOn(key: MusicalKey, degree: number, accidental: string, diminished: boolean): string {
    const minor = isMinorMode(key.mode)
    let interval = MAJOR[degree - 1]!
    let shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
    if (minor && [3, 6, 7].includes(degree)) {
        interval = NATURAL_MINOR[degree - 1]!
        // b is the natural note already; # raises it to the major scale's.
        shift = accidental === '#' || (!accidental && degree === 7 && diminished) ? 1 : 0
    }
    const note = Note.transpose(key.tonic, interval)
    return shift === 0 ? note : Note.transpose(note, shift > 0 ? '1A' : '-1A')
}

/** The chord suffix a numeral's quality mark asks for; null when it isn't one. */
function suffixOf(mark: string, lower: boolean): string | null {
    let s = mark.replace(/♭/g, 'b').replace(/♯/g, '#')
    s = s.replace(/^o/, '°').replace(/^Δ7?$/, 'maj7').replace(/^M7$/, 'maj7')
    if (s === '°' || s === 'dim') return 'dim'
    if (s === '°7' || s === 'dim7') return 'dim7'
    if (s === 'ø' || s === 'ø7' || s === 'm7b5') return 'm7b5'
    if (s === '+' || s === 'aug') return 'aug'
    if (s === '+7') return '7#5'
    if (!lower) return s
    if (s.startsWith('maj')) return `mMaj${s.slice(3)}`
    if (s.startsWith('sus')) return s
    return `m${s}`
}

const isDiminished = (suffix: string) => /^(dim|m7b5)/.test(suffix)

/** A suffix the chord parser and tonal know: "m7" → "m7", "mmaj7" → "mMaj7"; null otherwise. */
function chordFrom(root: string, suffix: string): string | null {
    const symbol = `${root}${canonicalSuffix(suffix)}`
    return parseChord(symbol) && chordNoteSet(symbol) ? symbol : null
}

/** The bass of "I/3", "5/b7": a degree of the key. */
function bassOf(key: MusicalKey, text: string): string | null {
    const m = /^([b#♭♯]?)([1-7])$/.exec(text)
    if (!m) return null
    const accidental = m[1]!.replace('♭', 'b').replace('♯', '#')
    return noteOn(key, Number(m[2]), accidental, false)
}

const ROMAN = /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/
const NASHVILLE = /^([b#♭♯]?)([1-7])(.*)$/

/** One numeral without a "/": its root, suffix and whether it was roman. */
function readOne(
    key: MusicalKey,
    text: string
): { symbol: string; degree: number; roman: boolean } | null {
    const roman = ROMAN.exec(text)
    const nashville = roman ? null : NASHVILLE.exec(text)
    const m = roman ?? nashville
    if (!m) return null
    const accidental = m[1]!.replace('♭', 'b').replace('♯', '#')
    let suffix: string | null
    let degree: number
    if (roman) {
        const numeral = m[2]!
        const lower = numeral === numeral.toLowerCase()
        degree = ROMAN_NUMBERS[numeral.toLowerCase()]!
        suffix = suffixOf(m[3]!, lower)
    } else {
        degree = Number(m[2])
        // 6m, 6-, 2m7, 2-7: minor; a plain number is a major chord.
        const mark = m[3]!.replace(/^-/, 'm')
        suffix = /^m(?!aj)/.test(mark) ? suffixOf(mark.slice(1), true) : suffixOf(mark, false)
    }
    if (suffix === null) return null
    const root = noteOn(key, degree, accidental, isDiminished(suffix))
    const symbol = chordFrom(root, suffix)
    return symbol ? { symbol, degree, roman: !!roman } : null
}

/**
 * A roman numeral or Nashville number in a key → its chord symbol; null when it doesn't read.
 * Roman: case for the quality (V major, vi minor), °, ø, +, and any chord suffix (V7, ii7, Imaj7,
 * vii°7, IVadd9); accidentals (bVII, #iv°); secondary chords (V/V, V7/ii, vii°/V: the chord in
 * the major key of the numeral after the slash); a bass degree (I/3). Nashville: 1 5 6m 4, minor
 * with m or - (6-, 2-7), b7, 5/3 (bass).
 */
export function readNumeral(token: string, key: string | MusicalKey): string | null {
    const k = keyOf(key)
    if (!k) return null
    const [head, after, ...rest] = plainDigits(token.trim()).split('/')
    if (!head || rest.length) return null
    if (after === undefined) return readOne(k, head)?.symbol ?? null
    // A bass degree (I/3, 5/b7), else a secondary chord (V/V).
    const bass = bassOf(k, after)
    if (bass !== null) {
        const chord = readOne(k, head)
        return chord ? `${chord.symbol}/${bass}` : null
    }
    if (!ROMAN.test(head)) return null
    const target = readOne(k, after)
    if (!target?.roman) return null
    const targetRoot = splitChordSymbol(target.symbol)!.root
    return (
        readOne({ tonic: targetRoot, mode: 'major', name: `${targetRoot} major` }, head)?.symbol ??
        null
    )
}

/**
 * A note as the key spells it when the key has that pitch (Fdim in F# is E#dim, the leading tone's
 * chord; a minor key's raised 7th counts: Abdim7 in A minor is G#dim7); else as written.
 */
function keySpelling(note: string, key: MusicalKey): string {
    const chroma = chromaOf(note)
    const notes = keyNotes(key)
    if (isMinorMode(key.mode) && notes.length === 7) notes.push(Note.transpose(notes[6]!, '1A'))
    if (notes.includes(note)) return note
    return notes.find((n) => chromaOf(n) === chroma) ?? note
}

/** The degree of a chord's root, and the symbol's suffix and bass. */
function partsOf(symbol: string) {
    const parts = splitChordSymbol(symbol)
    if (!parts || !parseChord(symbol)) return null
    return { root: parts.root, suffix: canonicalSuffix(parts.suffix), bass: parts.bass }
}

/** partsOf, with the root and bass spelled as the key spells those pitches. */
function partsIn(symbol: string, key: MusicalKey) {
    const parts = partsOf(symbol)
    if (!parts) return null
    return {
        root: keySpelling(parts.root, key),
        suffix: parts.suffix,
        bass: parts.bass ? keySpelling(parts.bass, key) : null
    }
}

/** A minor key's diminished chord on its raised 7th is the leading tone's vii°, written plain. */
function leadingTone(degree: Degree, suffix: string, minor: boolean): Degree {
    return minor && degree.number === 7 && degree.accidental === '#' && isDiminished(suffix)
        ? { ...degree, accidental: '' }
        : degree
}

/** Diatonic functions by degree. */
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
    'subdominant'
]

/** A major or dominant chord whose root is a fifth above a chord of the key (not its vii°). */
function secondaryTarget(symbol: string, key: MusicalKey): string | null {
    const set = chordNoteSet(symbol)
    const parts = partsOf(symbol)
    if (!set || !parts || !set.members.some((m) => m.interval === '3M')) return null
    // A dominant has a perfect fifth and no major seventh (Dmaj7 doesn't lead to G).
    if (set.members.some((m) => ['5d', '5A', '7M'].includes(m.interval ?? ''))) return null
    const target = Note.transpose(parts.root, '-5P')
    for (const suffix of ['', 'm']) {
        if (inKey(`${target}${suffix}`, key)) return `${target}${suffix}`
    }
    return null
}

/** What a chord does in a key: its diatonic function, or secondary dominant, borrowed, chromatic. */
export function harmonicFunction(
    symbol: string,
    key: string | MusicalKey
): HarmonicFunction | null {
    const k = keyOf(key)
    const parts = k ? partsIn(symbol, k) : null
    if (!k || !parts || !chordNoteSet(symbol)) return null
    const plain = `${parts.root}${parts.suffix}`
    const minor = isMinorMode(k.mode)
    if (inKey(plain, k)) {
        const degree = degreeOf(k.tonic, parts.root)!
        // A minor key's raised 7th (vii°) leads to the tonic.
        if (minor && degree.number === 7 && degree.accidental === '') return 'dominant'
        return (minor ? MINOR_FUNCTIONS : MAJOR_FUNCTIONS)[degree.number - 1]!
    }
    const parallel: MusicalKey = {
        tonic: k.tonic,
        mode: minor ? 'major' : 'minor',
        name: `${k.tonic} ${minor ? 'major' : 'minor'}`
    }
    if (inKey(plain, parallel)) return 'borrowed'
    if (secondaryTarget(plain, k)) return 'secondary dominant'
    return 'chromatic'
}

/**
 * A chord's numeral in a key: "bVII", "ii7", "vii°" (in minor too: the leading tone), a
 * secondary dominant as "V7/V", a bass as a degree ("I/3"). Roman numerals by default, or
 * Nashville numbers ("b7", "2m7", "1/3"). Null when the chord or the key doesn't read.
 */
export function numeralOf(
    symbol: string,
    key: string | MusicalKey,
    style: 'roman' | 'nashville' = 'roman'
): string | null {
    const k = keyOf(key)
    const parts = k ? partsIn(symbol, k) : null
    if (!k || !parts || !chordNoteSet(symbol)) return null
    const minor = isMinorMode(k.mode)
    const text = (degree: Degree, suffix: string) =>
        style === 'nashville' ? nashvilleText(degree, suffix) : romanText(degree, suffix)
    const degree = degreeOf(k.tonic, parts.root, minor)
    if (!degree) return null
    const bass = parts.bass ? degreeOf(k.tonic, parts.bass, minor) : null
    const slash = bass ? `/${bass.accidental}${bass.number}` : ''
    const plain = `${parts.root}${parts.suffix}`
    // A secondary dominant (D7 in C is V7/V), named from the chord it leads to.
    if (style === 'roman' && !bass && harmonicFunction(plain, k) === 'secondary dominant') {
        const target = secondaryTarget(plain, k)!
        const targetNumeral = numeralOf(target, k)
        if (targetNumeral)
            return `${text({ number: 5, accidental: '' }, parts.suffix)}/${targetNumeral}`
    }
    return `${text(leadingTone(degree, parts.suffix, minor), parts.suffix)}${slash}`
}

/** Tokens of a progression: spaces, commas and bar lines separate them. */
export const progressionTokens = (text: string): string[] => text.split(/[\s,|]+/).filter(Boolean)

/**
 * A progression in a key: roman numerals ("I V vi IV", "ii7 V7 Imaj7", "I bVII IV", "I V/V V"),
 * Nashville numbers ("1 5 6m 4") or chord names ("G D Em C"), each with its chord, numeral,
 * Nashville number and function. Null when the key or a token doesn't read.
 */
export function progressionChords(
    numerals: string | readonly string[],
    key: string | MusicalKey
): ProgressionChord[] | null {
    const k = keyOf(key)
    if (!k) return null
    const tokens = typeof numerals === 'string' ? progressionTokens(numerals) : [...numerals]
    const out: ProgressionChord[] = []
    for (const written of tokens) {
        const chord = progressionChord(written, k)
        if (!chord) return null
        out.push(chord)
    }
    return out
}

/** One token of a progression (see progressionChords); null when it doesn't read. */
export function progressionChord(written: string, key: MusicalKey): ProgressionChord | null {
    const token = written.trim()
    // A chord name starts with a capital letter A to G; numerals never do.
    const isChord = /^[A-G]/.test(token)
    const symbol = isChord
        ? parseChord(token) && chordNoteSet(token)
            ? token
            : null
        : readNumeral(token, key)
    if (!symbol) return null
    // A written secondary dominant (V/IV, vii°/V) is one, even when its chord is in the key.
    const secondary = !isChord && /^[b#♭♯]?(V|v|VII|vii)(?![IViv])[^/]*\/[b#♭♯]?[IViv]/.test(token)
    return {
        written: token,
        symbol: isChord ? symbol.replace(/♯/g, '#').replace(/♭/g, 'b') : symbol,
        numeral: isChord ? numeralOf(symbol, key)! : token,
        nashville: numeralOf(symbol, key, 'nashville')!,
        function: secondary ? 'secondary dominant' : harmonicFunction(symbol, key)!
    }
}
