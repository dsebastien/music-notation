/**
 * Roman numerals and Nashville numbers (#9): "I V vi IV" or "1 5 6m 4" in a key → chord symbols,
 * and back: the numeral of a chord in a key, with its harmonic function.
 */
import { Note } from 'tonal'
import { chordNoteSet } from './note-set.js'
import { parseChord } from './chord-symbol.js'
import { chromaOf, splitChordSymbol } from './pitch.js'
import { canonicalSuffix } from './suffix.js'
import { bluesTonic, inKey } from './find.js'
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
    | 'tonic'
    | 'subdominant'
    | 'dominant'
    | 'secondary dominant'
    | 'neapolitan'
    | 'borrowed'
    | 'chromatic'
    | 'tonicization'

/** How to read the chords of a progression. */
export interface NumeralOptions {
    /**
     * A dominant-seventh blues (see `bluesTonic`): a dominant seventh on I or IV is the key's own
     * chord (A7 is I7 and tonic in an A blues, not V7/IV), as blues players read it.
     */
    blues?: boolean
}

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
    // Only minor keys read their own 3rd, 6th and 7th unmarked; modes count from the major scale
    // (D dorian: bIII, IV, vi°, bVII), as numeralOf writes them.
    const minor = key.mode === 'minor' || key.mode === 'aeolian'
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
    // An added sixth, written out (a plain 6 after a roman numeral is first inversion).
    if (s === 'add6') return lower ? 'm6' : '6'
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

/** Figured bass after a roman numeral: the inversion and whether the chord is a seventh. */
const FIGURES: Record<string, { inversion: number; seventh: boolean }> = {
    '6': { inversion: 1, seventh: false },
    '64': { inversion: 2, seventh: false },
    '65': { inversion: 1, seventh: true },
    '43': { inversion: 2, seventh: true },
    '42': { inversion: 3, seventh: true }
}

/** A roman numeral with figured bass: the numeral, an optional quality mark, the figures. */
const FIGURED = /^([b#♭♯]?(?:VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i|N))([°oø+]?)(64|65|43|42|6)$/

/**
 * One roman numeral, with figured bass read as an inversion, as theory books write it: 6 and 64
 * are a triad's first and second inversions (I6 C/E, IV64 F/C, bII6 Db/F), 65, 43 and 42 a
 * seventh chord's (V65 G7/B, V43 G7/D, V42 G7/F, viiø65 Bm7b5/D). N is the Neapolitan, bII (N6
 * Db/F in C). Anything else as readOne reads it.
 */
function readHead(
    key: MusicalKey,
    text: string
): { symbol: string; degree: number; roman: boolean } | null {
    const m = FIGURED.exec(text.replace(/^N(?=\d|$)/, 'bII'))
    const plain = text === 'N' ? 'bII' : text
    if (!m) return readOne(key, plain)
    const figure = FIGURES[m[3]!]!
    const mark = m[2]!.replace('o', '°')
    const chord = readOne(key, `${m[1]}${mark}${figure.seventh ? '7' : ''}`)
    if (!chord) return null
    const members = chordNoteSet(chord.symbol)?.members.filter((x) => x.interval !== null) ?? []
    const bass = members[figure.inversion]
    if (!bass || members.length !== (figure.seventh ? 4 : 3)) return null
    return { ...chord, symbol: `${chord.symbol}/${bass.name}` }
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
    if (after === undefined) return readHead(k, head)?.symbol ?? null
    // A bass degree (I/3, 5/b7), else a secondary chord (V/V, V65/V).
    const bass = bassOf(k, after)
    if (bass !== null) {
        // Figured bass already says the bass: I6/3 is one bass too many.
        if (FIGURED.test(head)) return null
        const chord = readOne(k, head)
        return chord ? `${chord.symbol}/${bass}` : null
    }
    if (!ROMAN.test(head)) return null
    const target = readOne(k, after)
    if (!target?.roman) return null
    const targetRoot = splitChordSymbol(target.symbol)!.root
    return (
        readHead({ tonic: targetRoot, mode: 'major', name: `${targetRoot} major` }, head)?.symbol ??
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

/**
 * The chord of the key a chord leads to, as a secondary dominant: a major or dominant chord a
 * fifth above it (D7 → G in C), or a diminished chord a half step below it, the leading tone's
 * chord (F#dim, F#dim7 or F#m7b5 → G in C). Only major and minor chords of the key are targets.
 */
function secondaryTarget(symbol: string, key: MusicalKey): string | null {
    const set = chordNoteSet(symbol)
    const parts = partsOf(symbol)
    if (!set || !parts) return null
    const has = (interval: string) => set.members.some((m) => m.interval === interval)
    let target: string
    if (has('3m') && has('5d')) {
        // A leading-tone chord: no major 7th (a m(maj7)b5 leads nowhere).
        if (has('7M')) return null
        target = Note.transpose(parts.root, '2m')
    } else {
        if (!has('3M')) return null
        // A dominant has a perfect fifth and no major seventh (Dmaj7 doesn't lead to G).
        if (set.members.some((m) => ['5d', '5A', '7M'].includes(m.interval ?? ''))) return null
        target = Note.transpose(parts.root, '-5P')
    }
    // The tonic's own dominant or leading-tone chord is V or vii°, not a secondary one.
    if (chromaOf(target) === chromaOf(key.tonic)) return null
    for (const suffix of ['', 'm']) {
        const chord = `${keySpelling(target, key)}${suffix}`
        if (inKey(chord, key)) return chord
    }
    return null
}

/** A diminished chord (dim, dim7, m7b5): a leading-tone chord rather than a dominant. */
function isLeadingTone(symbol: string): boolean {
    const members = chordNoteSet(symbol)?.members ?? []
    return members.some((m) => m.interval === '3m') && members.some((m) => m.interval === '5d')
}

/**
 * The Neapolitan: a major chord (or major seventh) on the lowered 2nd degree (Db in C, Bb in A
 * minor), often over the 4th (bII6, Db/F).
 */
function isNeapolitan(root: string, suffix: string, key: MusicalKey): boolean {
    const degree = degreeOf(key.tonic, root)
    return degree?.number === 2 && degree.accidental === 'b' && ['', 'maj7'].includes(suffix)
}

/** A blues chord: a dominant seventh on the key's I or IV (see NumeralOptions.blues). */
function bluesDegree(root: string, symbol: string, key: MusicalKey): number | null {
    const set = chordNoteSet(symbol)
    const degree = degreeOf(key.tonic, root)
    if (!set || !degree || degree.accidental || ![1, 4].includes(degree.number)) return null
    const dominant =
        set.members.some((m) => m.interval === '3M') && set.members.some((m) => m.interval === '7m')
    return dominant ? degree.number : null
}

/**
 * What a chord does in a key: its diatonic function, or secondary dominant (leading-tone chords
 * included: F#dim in C leads to G), neapolitan (bII), borrowed, chromatic.
 */
export function harmonicFunction(
    symbol: string,
    key: string | MusicalKey,
    options: NumeralOptions = {}
): HarmonicFunction | null {
    const k = keyOf(key)
    const parts = k ? partsIn(symbol, k) : null
    if (!k || !parts || !chordNoteSet(symbol)) return null
    const plain = `${parts.root}${parts.suffix}`
    const minor = isMinorMode(k.mode)
    if (options.blues && !minor) {
        const blues = bluesDegree(parts.root, plain, k)
        if (blues) return blues === 1 ? 'tonic' : 'subdominant'
    }
    if (inKey(plain, k)) {
        const degree = degreeOf(k.tonic, parts.root)!
        // A minor key's raised 7th (vii°) leads to the tonic.
        if (minor && degree.number === 7 && degree.accidental === '') return 'dominant'
        // A mode's own bVII (mixolydian) moves to the tonic as IV does.
        if (degree.number === 7 && degree.accidental === 'b') return 'subdominant'
        return (minor ? MINOR_FUNCTIONS : MAJOR_FUNCTIONS)[degree.number - 1]!
    }
    if (isNeapolitan(parts.root, parts.suffix, k)) return 'neapolitan'
    // A leading-tone chord before borrowed: G#dim7 in C leads to Am (vii°7/vi), though C minor
    // has its notes. A major tonic in minor stays borrowed (A in A minor), not V/iv.
    const leading = isLeadingTone(plain)
    if (leading && secondaryTarget(plain, k)) return 'secondary dominant'
    const parallel: MusicalKey = {
        tonic: k.tonic,
        mode: minor ? 'major' : 'minor',
        name: `${k.tonic} ${minor ? 'major' : 'minor'}`
    }
    if (inKey(plain, parallel)) return 'borrowed'
    if (!leading && secondaryTarget(plain, k)) return 'secondary dominant'
    return 'chromatic'
}

/**
 * A chord's numeral in a key: "bVII", "ii7", "vii°" (in minor too: the leading tone), a
 * secondary dominant as "V7/V" and a secondary leading-tone chord as "vii°7/V", a bass as a
 * degree ("I/3"). Roman numerals by default, or Nashville numbers ("b7", "2m7", "1/3"). In a
 * blues (see NumeralOptions), A7 in A is I7. Null when the chord or the key doesn't read.
 */
export function numeralOf(
    symbol: string,
    key: string | MusicalKey,
    style: 'roman' | 'nashville' = 'roman',
    options: NumeralOptions = {}
): string | null {
    const k = keyOf(key)
    const parts = k ? partsIn(symbol, k) : null
    if (!k || !parts || !chordNoteSet(symbol)) return null
    // Degrees count from the major scale; only minor keys mark their raised 3rd, 6th and 7th
    // (#vi in A minor), as dorian's 6th and mixolydian's 3rd are their own.
    const minor = k.mode === 'minor' || k.mode === 'aeolian'
    const text = (degree: Degree, suffix: string) =>
        style === 'nashville' ? nashvilleText(degree, suffix) : romanText(degree, suffix)
    const degree = degreeOf(k.tonic, parts.root, minor)
    if (!degree) return null
    const bass = parts.bass ? degreeOf(k.tonic, parts.bass, minor) : null
    const slash = bass ? `/${bass.accidental}${bass.number}` : ''
    const plain = `${parts.root}${parts.suffix}`
    // A secondary dominant (D7 in C is V7/V) or leading-tone chord (F#dim7 is vii°7/V), named
    // from the chord it leads to; a blues's I7 and IV7 are its own.
    if (
        style === 'roman' &&
        !bass &&
        harmonicFunction(plain, k, options) === 'secondary dominant'
    ) {
        const target = secondaryTarget(plain, k)!
        const targetNumeral = numeralOf(target, k)
        const number = isLeadingTone(plain) ? 7 : 5
        if (targetNumeral)
            return `${text({ number, accidental: '' }, parts.suffix)}/${targetNumeral}`
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
    const read = (options: NumeralOptions) => {
        const out: ProgressionChord[] = []
        for (const written of tokens) {
            const chord = progressionChord(written, k, options)
            if (!chord) return null
            out.push(chord)
        }
        return out
    }
    const chords = read({})
    if (!chords) return null
    // A blues on the key's tonic reads its I7 and IV7 as the key's own.
    const blues = isBluesIn(
        chords.map((c) => c.symbol),
        k
    )
    return blues ? read({ blues: true }) : withTonicizations(chords, k)
}

/** A dominant seventh chord's quality: a major third and a minor seventh, no sus. */
function isDominantSeventh(symbol: string): boolean {
    const members = chordNoteSet(symbol)?.members ?? []
    return members.some((m) => m.interval === '3M') && members.some((m) => m.interval === '7m')
}

/** A major or minor chord (a perfect fifth over a third): a chord a dominant can tonicize. */
function isTonicizable(symbol: string): boolean {
    const members = chordNoteSet(symbol)?.members ?? []
    return (
        members.some((m) => m.interval === '3M' || m.interval === '3m') &&
        members.some((m) => m.interval === '5P')
    )
}

/** A minor seventh or half-diminished chord: the ii of a ii-V. */
function isTwo(symbol: string): boolean {
    const members = chordNoteSet(symbol)?.members ?? []
    return members.some((m) => m.interval === '3m') && members.some((m) => m.interval === '7m')
}

/**
 * Local tonicizations, read from each chord and the next: a dominant seventh going to a major or
 * minor chord a fifth below, other than the tonic, is that chord's V7 (secondary dominant), even
 * when the key has it (G7 to C in A minor: V7/bIII, not bVII7) or the chord it goes to is outside
 * the key (Ab7 to Dbmaj7 in C minor: V7/bII). A minor seventh or half-diminished chord outside the
 * key right before it is its ii (Ebm7 Ab7 Dbmaj7 in C minor: ii7/bII V7/bII), and a chord outside
 * the key that is tonicized so is a tonicization (not neapolitan or chromatic). Numerals change only
 * for chord names (a written numeral stays as written); a dominant the key already reads as a
 * secondary dominant keeps its numeral (E7 A7 in C: V7/vi). A blues is left alone.
 */
export function withTonicizations(
    chords: readonly ProgressionChord[],
    key: MusicalKey,
    options: NumeralOptions = {}
): ProgressionChord[] {
    const out = chords.map((c) => ({ ...c }))
    if (options.blues) return out
    const tonic = chromaOf(key.tonic)
    const rootOf = (symbol: string) => chordNoteSet(symbol)?.root ?? null
    const named = (c: ProgressionChord) => /^[A-G]/.test(c.written)
    out.forEach((chord, i) => {
        const next = out[i + 1]
        if (!next || chord.function === 'secondary dominant') return
        const root = rootOf(chord.symbol)
        const target = rootOf(next.symbol)
        if (root === null || target === null || target === tonic) return
        if (!isDominantSeventh(chord.symbol) || !isTonicizable(next.symbol)) return
        if ((root - target + 12) % 12 !== 7) return
        if (splitChordSymbol(chord.symbol)?.bass || splitChordSymbol(next.symbol)?.bass) return
        // The chord it goes to, as a triad: Dbmaj7 is bII, Am7 vi.
        const parts = partsIn(next.symbol, key)
        const minorTarget = chordNoteSet(next.symbol)!.members.some((m) => m.interval === '3m')
        const targetNumeral = parts
            ? numeralOf(`${parts.root}${minorTarget ? 'm' : ''}`, key)
            : null
        if (!targetNumeral) return
        const suffix = partsOf(chord.symbol)!.suffix
        chord.function = 'secondary dominant'
        if (named(chord))
            chord.numeral = `${romanText({ number: 5, accidental: '' }, suffix)}/${targetNumeral}`
        const outside = (c: ProgressionChord) =>
            ['chromatic', 'neapolitan', 'borrowed'].includes(c.function)
        if (outside(next)) next.function = 'tonicization'
        const two = out[i - 1]
        const twoRoot = two ? rootOf(two.symbol) : null
        if (
            two &&
            twoRoot !== null &&
            (twoRoot - root + 12) % 12 === 7 &&
            isTwo(two.symbol) &&
            !splitChordSymbol(two.symbol)?.bass &&
            outside(two)
        ) {
            two.function = 'tonicization'
            if (named(two)) {
                const twoSuffix = partsOf(two.symbol)!.suffix
                two.numeral = `${romanText({ number: 2, accidental: '' }, twoSuffix)}/${targetNumeral}`
            }
        }
    })
    return out
}

/** Whether chords are a dominant-seventh blues on a major key's tonic (A7 D7 E7 in A). */
export function isBluesIn(symbols: readonly string[], key: MusicalKey): boolean {
    const tonic = bluesTonic(symbols)
    return (
        tonic !== null &&
        (key.mode === 'major' || key.mode === 'ionian') &&
        chromaOf(tonic) === chromaOf(key.tonic)
    )
}

/** One token of a progression (see progressionChords); null when it doesn't read. */
export function progressionChord(
    written: string,
    key: MusicalKey,
    options: NumeralOptions = {}
): ProgressionChord | null {
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
        numeral: isChord ? numeralOf(symbol, key, 'roman', options)! : token,
        nashville: numeralOf(symbol, key, 'nashville', options)!,
        function: secondary ? 'secondary dominant' : harmonicFunction(symbol, key, options)!
    }
}
