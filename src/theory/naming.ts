/**
 * Note names in solfège (Do Ré Mi) and German (H for B) (#12). Reading: names in any of the three
 * systems become letters before anything parses them (`toLetters`, `lettersInBlock`), so the
 * library keeps working in letters (where B is B natural). Letters come first: what already reads
 * in letters stays as it is (`Do` is D diminished), unless the block says `naming: solfege`.
 * Showing: what a drawing shows goes through `shown`, under the naming a block is drawn with
 * (`withNaming`); titles written by hand are never rewritten.
 */
import { parseChord } from './chord-symbol.js'
import { midiOf } from './pitch.js'

export type Naming = 'letters' | 'solfege' | 'german'
export const NAMINGS: readonly Naming[] = ['letters', 'solfege', 'german']

const NAMING_ERROR = 'naming: write letters, solfege or german'
const DIRECTIVE_ERROR = 'naming: write {naming: letters}, {naming: solfege} or {naming: german}'

const plain = (text: string) => text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** A naming from a block or an option ("Solfège", "GERMAN"); throws what to write otherwise. */
export function parseNaming(text: string): Naming {
    const value = plain(text)
    if ((NAMINGS as readonly string[]).includes(value)) return value as Naming
    throw new Error(NAMING_ERROR)
}

/** A naming given by an app (any value): a valid one, else null. */
export function namingOf(value: unknown): Naming | null {
    if (typeof value !== 'string') return null
    try {
        return parseNaming(value)
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------------------------
// Reading

const SYLLABLE_LETTER: Record<string, string> = {
    do: 'C',
    re: 'D',
    mi: 'E',
    fa: 'F',
    sol: 'G',
    la: 'A',
    si: 'B'
}
/** A syllable, capitalized (lowercase `la`, `do` are words). */
const SYLLABLE = '(Do|DO|R[eé]|R[EÉ]|Mi|MI|Fa|FA|Sol|SOL|La|LA|Si|SI)'
// No x after a syllable: `Six`, `Mix` are words.
const SIGN = '(##|bb|#|b|♯|♭)?'
const syllableLetter = (syllable: string) => SYLLABLE_LETTER[plain(syllable)]!

/** What may follow a root in a chord: never a letter that would make a word ("Solo", "Laisse"). */
const AFTER_ROOT = /^(?:$|[0-9/(+°øΔ^-]|m|M|a(?:dd|ug|lt)|sus|dim)/
/** A quality that may follow a solfège root after a space ("Ré m7", "Sol 7/Si"). */
const QUALITY_WORD = /^(?:[0-9(+°øΔ^]|m|M|a(?:dd|ug|lt)|sus|dim)/
/**
 * The English major and minor stay a word: "Do major" is C major (a scale or a chord in words),
 * never "Cmajor", which parses as a chord and made a fretboard draw an arpeggio (0.16.0).
 */
const WORD_QUALITY = /^(?:major|minor)$/i
const joinsAsQuality = (word: string) => QUALITY_WORD.test(word) && !WORD_QUALITY.test(word)

/** Whether letters read as a note with an octave, or a chord the library knows. */
const reads = (letters: string): boolean =>
    midiOf(letters) !== null || (/^[A-G]/.test(letters) && parseChord(letters) !== null)

export interface ReadOptions {
    /** One chord: a space between a solfège root and its quality is allowed (`Ré m7`). */
    chord?: boolean
    /** Read H as B natural (true by default; blocks read it only where it was an error). */
    h?: boolean
}

/** One root (and what follows it) in letters; null when it isn't one, or reads as letters already. */
function rootToken(token: string, naming: Naming, h: boolean, solfegeLine = false): string | null {
    // German: a bare B is B flat.
    const b = naming === 'german' ? /^B(?![#♯b♭x])(.*)$/.exec(token) : null
    if (b && AFTER_ROOT.test(b[1]!)) {
        const letters = `Bb${b[1]!}`
        if (reads(letters)) return letters
    }
    // Letters first, except in solfège or among solfège names: `Do` is D diminished.
    if (naming !== 'solfege' && !solfegeLine && reads(token)) return null
    const solfege = new RegExp(`^${SYLLABLE}${SIGN}(.*)$`).exec(token)
    if (solfege) {
        // The longest sign first, then none ("Sibdim7": Si, b, dim7).
        for (const sign of [solfege[2] ?? '', ''].filter((s, i, all) => all.indexOf(s) === i)) {
            const rest = token.slice(solfege[1]!.length + sign.length)
            const letters = `${syllableLetter(solfege[1]!)}${sign}${rest}`
            if (AFTER_ROOT.test(rest) && reads(letters)) return letters
        }
    }
    if (h) {
        const hm = /^H(##|bb|#|b|♯|♭|x)?(.*)$/.exec(token)
        if (hm && AFTER_ROOT.test(hm[2]!)) {
            const letters = `B${hm[1] ?? ''}${hm[2]!}`
            if (reads(letters)) return letters
        }
    }
    return null
}

/** A root that reads alone, for a bass: the note after a slash. */
const NOTE_ONLY = /^[A-G](?:##|bb|#|b|♯|♭|x)?$/

/** One piece of a word in letters: a note, a note with an octave, a chord (and its bass), a range. */
function letterPiece(piece: string, naming: Naming, h: boolean, line = false): string {
    if (!piece) return piece
    const lower = plain(piece)
    if (/^majeure?$/.test(lower)) return 'major'
    if (/^mineure?$/.test(lower)) return 'minor'
    // A range of keys: Do3-Si4.
    const range = /^(.+\d)-(.+\d)$/.exec(piece)
    if (range) {
        const [from, to] = [range[1]!, range[2]!].map((n) => rootToken(n, naming, h, line) ?? n)
        return `${from}-${to}`
    }
    const slash = piece.indexOf('/')
    if (slash > 0) {
        const head = piece.slice(0, slash)
        const bass = piece.slice(slash + 1)
        const bassLetters = rootToken(bass, naming, h, line) ?? (NOTE_ONLY.test(bass) ? bass : null)
        if (bassLetters && NOTE_ONLY.test(bassLetters)) {
            const headLetters = rootToken(head, naming, h, line) ?? head
            const whole = `${headLetters}/${bassLetters}`
            // Letters first: a chord that read in letters as written stays.
            if (whole !== piece && !(naming === 'letters' && !line && reads(piece))) return whole
            return piece
        }
    }
    return rootToken(piece, naming, h, line) ?? piece
}

/** One word: its pieces between commas and bar lines; trailing commas and semicolons kept. */
function letterWord(
    word: string,
    naming: Naming,
    h: boolean,
    changes: [string, string][],
    line = false
): string {
    const out = word
        .split(/([,|;])/)
        .map((piece, i) => (i % 2 ? piece : letterPiece(piece, naming, h, line)))
        .join('')
    if (out !== word) changes.push([word, out])
    return out
}

/** Whether a word is a solfège root alone (a syllable and a sign). */
const syllableOnly = (word: string) => new RegExp(`^${SYLLABLE}${SIGN}$`).test(word)

function read(
    text: string,
    naming: Naming,
    options: ReadOptions,
    changes: [string, string][]
): string {
    const h = options.h ?? true
    // `Fa dièse`, `Si bémol` (also after a slash): one note.
    let out = text
        .normalize('NFC')
        .replace(
            new RegExp(`(^|[\\s,/|])${SYLLABLE}\\s+(dièse|diese|bémol|bemol)(?=$|[\\s,|])`, 'g'),
            (_, before: string, syllable: string, sign: string) =>
                `${before}${syllable}${/^d/.test(sign) ? '#' : 'b'}`
        )
    if (options.chord) {
        const joined = new RegExp(`^\\s*${SYLLABLE}${SIGN}\\s+(\\S+)\\s*$`).exec(out)
        if (joined && joinsAsQuality(joined[3]!)) {
            const word = `${joined[1]!}${joined[2] ?? ''}${joined[3]!}`
            const letters = rootToken(word, naming, h) ?? letterPiece(word, naming, h)
            if (letters !== word) {
                changes.push([out.trim(), letters])
                return letters
            }
        }
    }
    // A solfège root, a space, a quality: the forms the library shows (`Ré m7 Sol 7 Do`).
    const words = out.split(/(\s+)/)
    for (let i = 0; i + 2 < words.length; i += 2) {
        const head = words[i]!
        const next = words[i + 2]!
        if (!syllableOnly(head) || !joinsAsQuality(next)) continue
        if (naming !== 'solfege' && reads(head)) continue
        const joined = `${head}${next}`
        const letters = letterPiece(joined, naming, h)
        if (letters !== joined) {
            words.splice(i, 3, joined)
            i -= 2
        }
    }
    out = words.join('')
    // Among other solfège names (`Sol Rém Do`), `Do` is C, not D diminished.
    const line = out
        .split(/[\s,|;]+/)
        .some(
            (w) =>
                w !== '' && !/^Do/.test(w) && !reads(w) && rootToken(w, 'solfege', false) !== null
        )
    return out.replace(/\S+/g, (word) => letterWord(word, naming, h, changes, line))
}

/**
 * Note names, chords, ranges and scale roots in solfège, German or letters, read into letters:
 * `Rém Sol7` → `Dm G7`, `La mineur` → `A minor`, `H7` → `B7`. Letters first: what reads in letters
 * stays (`Do` is D diminished), except with the solfège naming. A bare `B` is B flat only with the
 * german naming. Solfège roots are capitalized (`la`, `do` are words).
 */
export function toLetters(
    text: string,
    naming: Naming = 'letters',
    options: ReadOptions = {}
): string {
    return read(text, naming, options, [])
}

/** Keys whose values hold notes, chords, scales, keys or tunings. */
const NOTE_KEYS = new Set([
    'chord',
    'chords',
    'symbol',
    'name',
    'from',
    'to',
    'scale',
    'notes',
    'root',
    'key',
    'arpeggio',
    'compare',
    'scales-for',
    'scales-for-notes',
    'modes',
    'progression',
    'tuning',
    'range',
    'highlight',
    'pitches',
    'sounds',
    'mode'
])
const SINGLE_CHORD_KEYS = new Set(['chord', 'symbol', 'from', 'to', 'sounds'])
const KEY_LINE = /^(\s*)([A-Za-z][A-Za-z-]*)(\s*:\s*)(.*)$/
const NAMING_LINE = /^\s*naming\s*:\s*(.*)$/i
const NAMING_DIRECTIVE = /^\s*\{\s*naming\s*:\s*([^}]*)\}\s*$/i
const DIAGRAM_SHORTHAND = new Set(['chord', 'keyboard', 'fretboard', 'circle'])

export interface BlockReading {
    /** The source in letters. */
    text: string
    /** The block's own naming (its `naming:` line or `{naming: …}` directive); null without one. */
    naming: Naming | null
    /** What was read: [as written, in letters], to quote the user in messages. */
    changes: [string, string][]
    /** Titles written by hand (`title:`), never rewritten when shown. */
    titles: string[]
    /** A chart's wrong `{naming: …}`: drawn as a warning, the chart read as letters. */
    warning: string | null
}

/** A compact tuning (`EADGHE`) as notes with spaces, when it has an H or the naming is german. */
function spacedTuning(value: string, naming: Naming): string {
    const compact = /^\s*((?:[A-Ha-h](?:#|b|♯|♭)?){4,})\s*$/.exec(value)
    if (!compact || (naming !== 'german' && !/h/i.test(compact[1]!))) return value
    return compact[1]!
        .match(/[A-Ha-h](?:#|b|♯|♭)?/g)!
        .map((n) => n[0]!.toUpperCase() + n.slice(1))
        .join(' ')
}

/**
 * A block's source read into letters, its own naming (its `naming:` line, taken out; charts: a
 * `{naming: …}` directive), what was read and the hand-written titles. Without its own naming a
 * block reads letters first, and H only in the values of keys (where it was an error); a chart
 * without a `{naming: …}` directive is left as written. Reads the values of the keys that hold
 * notes, the shorthand line of diagrams and the circle, progression lines, strum and picking chord
 * changes (`[Sol]`), chart chords and directives; never titles, lyrics or patterns. Throws what to
 * write for a wrong naming (charts: a warning instead).
 */
export function lettersInBlock(language: string, text: string): BlockReading {
    const result: BlockReading = { text, naming: null, changes: [], titles: [], warning: null }
    if (language === 'tab' || language === 'score') return result
    const lines: string[] = []
    for (const line of text.split('\n')) {
        const own = (language === 'chords' ? NAMING_DIRECTIVE : NAMING_LINE).exec(line)
        if (!own) {
            lines.push(line)
            continue
        }
        if (language !== 'chords') result.naming = parseNaming(own[1]!)
        else {
            const naming = namingOf(own[1]!)
            if (naming) result.naming = naming
            else result.warning = DIRECTIVE_ERROR
        }
    }
    const naming = result.naming ?? 'letters'
    const named = result.naming !== null
    const changes = result.changes
    if (language === 'chords') {
        // A chart without its own naming stays as written: its brackets hold any text.
        if (!named) {
            result.text = lines.join('\n')
            return result
        }
        result.text = lines
            .map((line) =>
                line
                    .replace(/\[([^\]]+)\]/g, (whole, inside: string) => {
                        const letters = read(inside, naming, { chord: true }, changes)
                        return letters === inside ? whole : `[${letters}]`
                    })
                    .replace(
                        /^(\s*\{\s*(?:key|define|chord)\s*:\s*)([^}]*?)(\s*\}\s*)$/i,
                        (_, head: string, value: string, tail: string) => {
                            // {define: name frets…}: only the name; {key: La mineur}: all of it.
                            if (/^\s*\{\s*key/i.test(head))
                                return `${head}${read(value, naming, {}, changes)}${tail}`
                            const [name, ...rest] = value.split(/(\s+)/)
                            return `${head}${read(name!, naming, { chord: true }, changes)}${rest.join('')}${tail}`
                        }
                    )
            )
            .join('\n')
        return result
    }
    const shorthand = DIAGRAM_SHORTHAND.has(language)
    result.text = lines
        .map((line) => {
            if (/^\s*-{3,}\s*$/.test(line) || !line.trim()) return line
            const kv = KEY_LINE.exec(line)
            if (kv) {
                const key = kv[2]!.toLowerCase()
                if (key === 'title') {
                    result.titles.push(kv[4]!.trim())
                    return line
                }
                if (!NOTE_KEYS.has(key)) return line
                if (key === 'name') result.titles.push(kv[4]!.trim())
                const value = key === 'tuning' ? spacedTuning(kv[4]!, naming) : kv[4]!
                const letters = read(value, naming, { chord: SINGLE_CHORD_KEYS.has(key) }, changes)
                if (letters !== kv[4]) changes.push([kv[4]!.trim(), letters.trim()])
                return `${kv[1]}${kv[2]}${kv[3]}${letters}`
            }
            // Shorthand and progression lines: H as before (a title or a chord name), unless the
            // block names its naming.
            if (shorthand)
                return read(line, naming, { chord: language === 'chord', h: named }, changes)
            if (language === 'progression') return read(line, naming, { h: named }, changes)
            if (language === 'strum' || language === 'picking')
                return line.replace(/\[([^\]]+)\]/g, (whole, inside: string) => {
                    const letters = read(inside, naming, { chord: true, h: named }, changes)
                    return letters === inside ? whole : `[${letters}]`
                })
            return line
        })
        .join('\n')
    return result
}

/** A message with what the user wrote in place of what it was read as ("H dorian", not "B dorian"). */
export function quoteAsWritten(message: string, changes: readonly [string, string][]): string {
    let out = message
    for (const [written, letters] of [...changes].sort((a, b) => b[1].length - a[1].length)) {
        if (written !== letters) out = out.split(`"${letters}"`).join(`"${written}"`)
    }
    return out
}

// ---------------------------------------------------------------------------------------------
// Showing

const LETTER_SYLLABLE: Record<string, string> = {
    C: 'Do',
    D: 'Ré',
    E: 'Mi',
    F: 'Fa',
    G: 'Sol',
    A: 'La',
    B: 'Si'
}
const SOLFEGE_SIGNS: Record<string, string> = {
    '#': '♯',
    '♯': '♯',
    'b': '♭',
    '♭': '♭',
    '##': '♯♯',
    'x': '♯♯',
    'bb': '♭♭',
    '♭♭': '♭♭',
    '♯♯': '♯♯'
}
const ROOT = /^([A-G])(##|bb|♯♯|♭♭|#|b|♯|♭|x)?/

/** A note name (letters: "F#", "Bb", "E♭") in a naming: "Fa♯", "Si♭"; German "H", "B". */
export function noteInNaming(name: string, naming: Naming): string {
    if (naming === 'letters') return name
    const m = /^([A-G])(##|bb|♯♯|♭♭|#|b|♯|♭|x)?$/.exec(name.trim())
    if (!m) return name
    const [, letter, sign = ''] = m
    if (naming === 'solfege') return `${LETTER_SYLLABLE[letter!]}${SOLFEGE_SIGNS[sign] ?? ''}`
    if (letter !== 'B') return name.trim()
    return sign === 'b' || sign === '♭' ? 'B' : `H${sign}`
}

/** A chord symbol in a naming: solfège "Ré m7", "Do/Sol"; German "H7", "Bmaj7". Signs as written. */
export function chordInNaming(symbol: string, naming: Naming): string {
    if (naming === 'letters') return symbol
    const text = symbol.trim()
    const root = ROOT.exec(text)
    if (!root || !parseChord(text)) return symbol
    const rest = text.slice(root[0].length)
    const slash = /^(.*)\/([A-G](?:##|bb|♯♯|♭♭|#|b|♯|♭|x)?)$/.exec(rest)
    const suffix = slash ? slash[1]! : rest
    const bass = slash ? `/${noteInNaming(slash[2]!, naming)}` : ''
    const shownSuffix = naming === 'solfege' && suffix ? ` ${suffix}` : suffix
    return `${noteInNaming(root[0], naming)}${shownSuffix}${bass}`
}

/** Words after which a lone A is the note, not the English article. */
const AFTER_A_NOTE = new Set([
    'major',
    'minor',
    'pentatonic',
    'blues',
    'dorian',
    'phrygian',
    'lydian',
    'mixolydian',
    'aeolian',
    'ionian',
    'locrian',
    'harmonic',
    'melodic',
    'chromatic',
    'whole',
    'augmented',
    'diminished',
    'bebop',
    'arpeggio',
    'chord',
    'string',
    'position',
    'box',
    'scale',
    'mode'
])
const OCTAVE = /^([A-G](?:##|bb|#|b|♯|♭|x)?)(-?\d)$/

/**
 * A generated text with its chords and notes in a naming: "Fretboard: A minor pentatonic" →
 * "Fretboard: La minor pentatonic". A letter and 5, 6, 7 or 9 is a chord (`G7`) unless it stands
 * among other notes with octaves (`C5 E5 G5`); a CAGED shape keeps its letter (`E shape`); a lone
 * A before a word that isn't a scale or mode word stays (the English article).
 */
export function shownText(text: string, naming: Naming): string {
    if (naming === 'letters' || !text) return text
    const parts = text.split(/(\s+|[,;:()])/)
    const word = (i: number, step: number) => {
        for (let j = i + step; j >= 0 && j < parts.length; j += step) {
            const p = parts[j]!
            if (!p.trim()) continue
            return /^[,;:()]$/.test(p) ? null : p
        }
        return null
    }
    return parts
        .map((part, i) => {
            if (!/^[A-G]/.test(part)) return part
            const next = word(i, 1)
            if (next === 'shape') return part
            const octave = OCTAVE.exec(part)
            if (octave) {
                const amongNotes = [word(i, -1), next].some((w) => w !== null && OCTAVE.test(w))
                if (amongNotes || !/^[5679]$/.test(octave[2]!))
                    return `${noteInNaming(octave[1]!, naming)}${octave[2]}`
            }
            if (part === 'A' && next && /^[a-z]/.test(next) && !AFTER_A_NOTE.has(next)) return part
            if (parseChord(part)) return chordInNaming(part, naming)
            // Two chords of one cell (D♯m/E♭m).
            const both = part.split('/')
            if (both.length === 2 && both.every((p) => /^[A-G]/.test(p) && parseChord(p)))
                return both.map((p) => chordInNaming(p, naming)).join('/')
            return part
        })
        .join('')
}

let current: Naming = 'letters'
let verbatim: readonly string[] = []

/**
 * Draws under a naming: what `shown` gives inside `draw`. `titles` written by hand are never
 * rewritten (nor a name that starts with one). Letters again after, even on a throw.
 */
export function withNaming<T>(naming: Naming, draw: () => T, titles: readonly string[] = []): T {
    const before = [current, verbatim] as const
    current = naming
    verbatim = titles.filter(Boolean)
    try {
        return draw()
    } finally {
        ;[current, verbatim] = before
    }
}

/**
 * A text as the drawing in progress shows it (letters outside `withNaming`). A title written by
 * hand, or the start of a name that is one, stays as written.
 */
export function shown(text: string): string {
    if (current === 'letters' || !text) return text
    for (const title of verbatim) {
        if (text === title) return text
        if (text.startsWith(`${title},`))
            return title + shownText(text.slice(title.length), current)
    }
    return shownText(text, current)
}
