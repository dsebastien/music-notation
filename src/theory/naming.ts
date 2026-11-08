/**
 * Note names in solfège (Do Ré Mi) and German (H for B) (#12). Reading: names in any of the three
 * systems become letters before anything parses them (`toLetters`, `lettersInBlock`), so the
 * library keeps working in letters (where B is B natural). Showing: what a drawing shows goes
 * through `shown`, under the naming a block is drawn with (`withNaming`).
 */
import { parseChord } from './chord-symbol.js'
import { midiOf, splitChordSymbol } from './pitch.js'

export type Naming = 'letters' | 'solfege' | 'german'
export const NAMINGS: readonly Naming[] = ['letters', 'solfege', 'german']

const NAMING_ERROR = 'naming: write letters, solfege or german'

/** A naming from a block or an option ("Solfège", "GERMAN"); throws what to write otherwise. */
export function parseNaming(text: string): Naming {
    const value = text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
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
const SYLLABLE = '(do|r[eé]|mi|fa|sol|la|si)'
const SIGN = '(##|bb|#|b|♯|♭|x)?'
const syllableLetter = (syllable: string) =>
    SYLLABLE_LETTER[syllable.toLowerCase().replace('é', 'e')]!

/** What may follow a root in a chord: never a letter that would make a word ("Solo", "Laisse"). */
const AFTER_ROOT = /^(?:$|[0-9/(+°øΔ^-]|m|M|a(?:dd|ug|lt)|sus|dim)/

/** Whether letters read as a note with an octave, or a chord the library knows. */
const reads = (letters: string): boolean =>
    midiOf(letters) !== null || (/^[A-G]/.test(letters) && parseChord(letters) !== null)

/** One root (and what follows it) in letters; null when it isn't one. */
function rootToken(token: string, naming: Naming): string | null {
    const solfege = new RegExp(`^${SYLLABLE}${SIGN}(.*)$`, 'i').exec(token)
    if (solfege) {
        // The longest sign first, then shorter ones ("Sibdim7": Si, b, dim7).
        for (const sign of [solfege[2] ?? '', ''].filter((s, i, all) => all.indexOf(s) === i)) {
            const rest = token.slice(solfege[1]!.length + sign.length)
            const letters = `${syllableLetter(solfege[1]!)}${sign}${rest}`
            if (AFTER_ROOT.test(rest) && reads(letters)) return letters
        }
    }
    const h = /^H(##|bb|#|b|♯|♭|x)?(.*)$/.exec(token)
    if (h && AFTER_ROOT.test(h[2]!)) {
        const letters = `B${h[1] ?? ''}${h[2]!}`
        if (reads(letters)) return letters
    }
    // German: a bare B is B flat.
    const b = naming === 'german' ? /^B(?![#♯b♭x])(.*)$/.exec(token) : null
    if (b && AFTER_ROOT.test(b[1]!)) {
        const letters = `Bb${b[1]!}`
        if (reads(letters)) return letters
    }
    return null
}

/** One word in letters: a note, a note with an octave, a chord (and its bass), a range. */
function letterWord(word: string, naming: Naming): string {
    const trailing = /[,;.]*$/.exec(word)![0]
    const core = word.slice(0, word.length - trailing.length)
    if (!core) return word
    const lower = core.toLowerCase()
    if (/^majeure?$/.test(lower)) return `major${trailing}`
    if (/^mineure?$/.test(lower)) return `minor${trailing}`
    // A range of keys: Do3-Si4.
    const range = /^(.+\d)-(.+\d)$/.exec(core)
    if (range) {
        const [from, to] = [range[1]!, range[2]!].map((n) => rootToken(n, naming) ?? n)
        return `${from}-${to}${trailing}`
    }
    const slash = core.indexOf('/')
    if (slash > 0) {
        const head = core.slice(0, slash)
        const bass = core.slice(slash + 1)
        const bassLetters = rootToken(bass, naming)
        if (bassLetters && /^[A-G](?:##|bb|#|b|♯|♭|x)?$/.test(bassLetters)) {
            const headLetters = rootToken(head, naming) ?? head
            return `${headLetters}/${bassLetters}${trailing}`
        }
    }
    return `${rootToken(core, naming) ?? core}${trailing}`
}

/**
 * Note names, chords, ranges and scale roots in solfège, German or letters, read into letters:
 * `Rém Sol7` → `Dm G7`, `La mineur` → `A minor`, `H7` → `B7`. A bare `B` is B flat only with the
 * german naming. With `chord`, a space between a solfège root and its quality is allowed
 * (`Ré m7`, as solfège chords are shown): the text is one chord.
 */
export function toLetters(
    text: string,
    naming: Naming = 'letters',
    options: { chord?: boolean } = {}
): string {
    let out = text.replace(
        new RegExp(`(^|[\\s,])${SYLLABLE}\\s+(dièse|diese|bémol|bemol)(?=$|[\\s,])`, 'gi'),
        (_, before: string, syllable: string, sign: string) =>
            `${before}${syllable}${/^d/i.test(sign) ? '#' : 'b'}`
    )
    if (options.chord) {
        const joined = new RegExp(`^\\s*${SYLLABLE}${SIGN}\\s+(\\S+)\\s*$`, 'i').exec(out)
        if (joined) {
            const word = `${joined[1]!}${joined[2] ?? ''}${joined[3]!}`
            const letters = rootToken(word, naming)
            if (letters) return letters
        }
    }
    out = out.replace(/\S+/g, (word) => letterWord(word, naming))
    return out
}

/** Keys whose values hold notes, chords, scales, keys or tunings, per block language. */
const NOTE_KEYS = new Set([
    'chord',
    'chords',
    'scale',
    'notes',
    'root',
    'key',
    'arpeggio',
    'compare',
    'scales-for',
    'progression',
    'tuning',
    'range',
    'highlight',
    'pitches',
    'mode'
])
const KEY_LINE = /^(\s*)([A-Za-z][A-Za-z-]*)(\s*:\s*)(.*)$/
const NAMING_LINE = /^\s*naming\s*:\s*(.*)$/i
const NAMING_DIRECTIVE = /^\s*\{\s*naming\s*:\s*([^}]*)\}\s*$/i

/**
 * A block's source read into letters, and its naming: the block's `naming:` line (taken out;
 * charts: a `{naming: …}` directive), else the app's. Reads the values of the keys that hold
 * notes, the shorthand line of diagrams, progression lines and chart chords and directives; never
 * titles, lyrics, or strum and picking pattern lines. Throws what to write for a wrong naming.
 */
export function lettersInBlock(
    language: string,
    text: string,
    appNaming: Naming
): { text: string; naming: Naming } {
    if (language === 'tab' || language === 'score') return { text, naming: appNaming }
    let naming = appNaming
    const lines: string[] = []
    for (const line of text.split('\n')) {
        const own = (language === 'chords' ? NAMING_DIRECTIVE : NAMING_LINE).exec(line)
        if (own) naming = parseNaming(own[1]!)
        else lines.push(line)
    }
    if (language === 'chords') {
        const read = lines.map((line) =>
            line
                .replace(/\[([^\]]+)\]/g, (whole, inside: string) => {
                    const letters = toLetters(inside, naming, { chord: true })
                    return letters === inside ? whole : `[${letters}]`
                })
                .replace(
                    /^(\s*\{\s*(?:key|define|chord)\s*:\s*)([^\s}]+)/i,
                    (_, head: string, name: string) => `${head}${toLetters(name, naming)}`
                )
        )
        return { text: read.join('\n'), naming }
    }
    const shorthand = language === 'chord' || language === 'keyboard' || language === 'fretboard'
    const read = lines.map((line) => {
        if (/^\s*-{3,}\s*$/.test(line) || !line.trim()) return line
        const kv = KEY_LINE.exec(line)
        if (kv && (language !== 'progression' || !/^\s*[A-G]/.test(line) || kv[2]!.length > 1)) {
            return NOTE_KEYS.has(kv[2]!.toLowerCase())
                ? `${kv[1]}${kv[2]}${kv[3]}${toLetters(kv[4]!, naming, { chord: kv[2]!.toLowerCase() === 'chord' })}`
                : line
        }
        if (shorthand) return toLetters(line, naming, { chord: language === 'chord' })
        if (language === 'progression') return toLetters(line, naming)
        return line
    })
    return { text: read.join('\n'), naming }
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
    'bb': '♭♭'
}

/** A note name (letters: "F#", "Bb", "E♭") in a naming: "Fa♯", "Si♭"; German "H", "B". */
export function noteInNaming(name: string, naming: Naming): string {
    if (naming === 'letters') return name
    const m = /^([A-G])(##|bb|#|b|♯|♭|x)?$/.exec(name.trim())
    if (!m) return name
    const [, letter, sign = ''] = m
    if (naming === 'solfege') return `${LETTER_SYLLABLE[letter!]}${SOLFEGE_SIGNS[sign] ?? ''}`
    if (letter !== 'B') return name.trim()
    return sign === 'b' || sign === '♭' ? 'B' : `H${sign}`
}

/** A chord symbol in a naming: solfège "Ré m7", "Do/Sol"; German "H7", "Bmaj7". */
export function chordInNaming(symbol: string, naming: Naming): string {
    if (naming === 'letters') return symbol
    const parts = splitChordSymbol(symbol)
    if (!parts) return symbol
    const root = noteInNaming(parts.root, naming)
    const bass = parts.bass ? `/${noteInNaming(parts.bass, naming)}` : ''
    const suffix = naming === 'solfege' && parts.suffix ? ` ${parts.suffix}` : parts.suffix
    return `${root}${suffix}${bass}`
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
    'shape',
    'position',
    'box',
    'scale',
    'mode'
])

/**
 * A text with its chords and notes (with or without an octave) in a naming: "Fretboard: A minor
 * pentatonic" → "Fretboard: La minor pentatonic". A lone A before a word that isn't a scale,
 * mode or shape word is the English article and stays ("A long title").
 */
export function shownText(text: string, naming: Naming): string {
    if (naming === 'letters' || !text) return text
    const parts = text.split(/(\s+|[,;:()])/)
    return parts
        .map((part, i) => {
            if (!/^[A-G]/.test(part)) return part
            const octave = /^([A-G](?:##|bb|#|b|♯|♭|x)?)(-?\d)$/.exec(part)
            if (octave) return `${noteInNaming(octave[1]!, naming)}${octave[2]}`
            if (part === 'A') {
                const next = parts.slice(i + 1).find((p) => p.trim() && !/^[,;:()]$/.test(p))
                if (next && /^[a-z]/.test(next) && !AFTER_A_NOTE.has(next)) return part
            }
            return parseChord(part) ? chordInNaming(part, naming) : part
        })
        .join('')
}

let current: Naming = 'letters'

/** Draws under a naming: what `shown` gives inside `draw`. Letters again after, even on a throw. */
export function withNaming<T>(naming: Naming, draw: () => T): T {
    const before = current
    current = naming
    try {
        return draw()
    } finally {
        current = before
    }
}

/** A text as the drawing in progress shows it (letters outside `withNaming`). */
export const shown = (text: string): string => shownText(text, current)
