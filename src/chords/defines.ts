/**
 * ChordPro chord definitions (`{define: …}` and `{chord: …}`, ChordPro 6 syntax):
 *
 *     {define: Bes base-fret 1 frets 1 1 3 3 3 1 fingers 1 1 2 3 4 1}
 *     {define: Am7 copy Am7 frets x 0 2 0 1 3}
 *     {define: Am keys 0 3 7}
 *     {define: As display "A flat" base-fret 4 frets 1 3 3 2 1 1 diagram off}
 *
 * Frets are relative to the base fret (with base-fret 4, fret 1 is the 4th fret); `x`, `X`, `N`
 * or `-1` mute a string. Fingers are 1–9 or A–Z; any other value means no finger. Keys (keyboard)
 * are semitones above the root. Parsing is linear in the input (no backtracking regexes).
 */
import { canonicalSuffix } from '../theory/suffix.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'

export interface ChordDefinition {
    /** The chord's name, without brackets. */
    name: string
    /** Written in brackets (`{chord: [Am]}`): transposed with the song. */
    transposable: boolean
    /** The fret the frets count from (1 when not given). */
    baseFret: number | null
    /** As written, lowest string first: relative to the base fret, 0 open, null muted. */
    frets: (number | null)[] | null
    /** Finger per string, as written; null for none. */
    fingers: (string | null)[] | null
    /** Keyboard keys: semitones above the root. */
    keys: number[] | null
    /** The name to show instead of `name`. */
    display: string | null
    /** False with `diagram off`: no diagram for this chord. */
    diagram: boolean
    /** A chord to copy the shape from that the song doesn't define (the voicing database). */
    copy: string | null
}

/** The most strings and keys a definition may give, like a `chord` block. */
const MAX_STRINGS = 12
const MAX_KEYS = 24
/** The highest fret a diagram draws. */
const MAX_FRET = 36

const KEYWORDS = new Set([
    'base-fret',
    'base_fret',
    'frets',
    'fingers',
    'keys',
    'copy',
    'copyall',
    'display',
    'format',
    'diagram',
    'diagrams'
])

/** Words split on spaces; "double" or 'single' quotes keep spaces inside one word. */
function tokenize(text: string): string[] {
    const tokens: string[] = []
    let i = 0
    while (i < text.length) {
        while (i < text.length && /\s/.test(text[i]!)) i++
        if (i >= text.length) break
        const quote = text[i]
        if (quote === '"' || quote === "'") {
            const end = text.indexOf(quote, i + 1)
            tokens.push(text.slice(i + 1, end < 0 ? text.length : end))
            i = end < 0 ? text.length : end + 1
        } else {
            const start = i
            while (i < text.length && !/\s/.test(text[i]!)) i++
            tokens.push(text.slice(start, i))
        }
    }
    return tokens
}

/** One name for every spelling of a chord (A#7 and Bb7, Cmaj7 and CM7); the name itself otherwise. */
export function chordKey(name: string): string {
    const parts = splitChordSymbol(name)
    const root = parts ? chromaOf(parts.root) : null
    if (!parts || root === null) return `=${name}`
    const bass = parts.bass ? chromaOf(parts.bass) : null
    return `${root}|${canonicalSuffix(parts.suffix)}|${bass ?? ''}`
}

/** The definition of a chord among earlier ones: the last of its name, else of its spelling. */
export function findDefinition(
    definitions: readonly ChordDefinition[],
    name: string
): ChordDefinition | undefined {
    const last = (test: (d: ChordDefinition) => boolean) => {
        for (let i = definitions.length - 1; i >= 0; i--)
            if (test(definitions[i]!)) return definitions[i]
        return undefined
    }
    const key = chordKey(name)
    return last((d) => d.name === name) ?? last((d) => chordKey(d.name) === key)
}

const hasShape = (d: ChordDefinition) => d.frets !== null || d.keys !== null

export interface ParsedDefinition {
    /** Null when the directive has no name. */
    definition: ChordDefinition | null
    /** What was wrong and what to write instead; the rest of the definition still counts. */
    problems: string[]
}

/**
 * A `{define}` or `{chord}` value. `earlier` holds the song's definitions so far: `copy` and
 * `copyall` take their shape from there (or, for a chord the song doesn't define, from the voicing
 * database when drawn).
 */
export function parseDefinition(
    value: string,
    earlier: readonly ChordDefinition[] = [],
    directive = 'define'
): ParsedDefinition {
    const problems: string[] = []
    const tokens = tokenize(value)
    let name = tokens.shift() ?? ''
    // A colon after the name (an older form): "{define: Am: base-fret 1 …}".
    if (name.endsWith(':')) name = name.slice(0, -1)
    const transposable = name.startsWith('[') && name.endsWith(']') && name.length > 2
    if (transposable) name = name.slice(1, -1).trim()
    if (!name) {
        return {
            definition: null,
            problems: [
                `{${directive}} needs a chord name: e.g. {${directive}: Am frets x 0 2 2 1 0}`
            ]
        }
    }
    const at = `{${directive}: ${name}}`
    const definition: ChordDefinition = {
        name,
        transposable,
        baseFret: null,
        frets: null,
        fingers: null,
        keys: null,
        display: null,
        diagram: true,
        copy: null
    }
    /** The words after a keyword, up to the next keyword. */
    const valuesAfter = (i: number) => {
        let end = i + 1
        while (end < tokens.length && !KEYWORDS.has(tokens[end]!.toLowerCase())) end++
        return tokens.slice(i + 1, end)
    }
    let wroteFingers = false
    let i = 0
    while (i < tokens.length) {
        const word = tokens[i]!.toLowerCase()
        const values = valuesAfter(i)
        i += 1 + values.length
        if (word === 'base-fret' || word === 'base_fret') {
            const n = Number(values[0])
            if (values.length !== 1 || !Number.isInteger(n) || n < 1 || n > 24) {
                problems.push(
                    `${at}: base-fret takes one whole number from 1 to 24, e.g. base-fret 3`
                )
            } else definition.baseFret = n
        } else if (word === 'frets') {
            const frets = values.map((t) =>
                /^(x|X|N|-1)$/.test(t) ? null : /^\d{1,2}$/.test(t) ? Number(t) : NaN
            )
            if (
                frets.length < 2 ||
                frets.length > MAX_STRINGS ||
                frets.some((f) => Number.isNaN(f) || (f ?? 0) > 24)
            ) {
                problems.push(
                    `${at}: frets takes one value per string (2 to ${MAX_STRINGS}): a fret from 0 to 24, or x for a muted string, e.g. frets x 0 2 2 1 0`
                )
            } else definition.frets = frets
        } else if (word === 'fingers') {
            wroteFingers = true
            definition.fingers = values.map((t) => (/^([1-9]|[A-Z])$/.test(t) ? t : null))
        } else if (word === 'keys') {
            const keys = values.map((t) => (/^\d{1,2}$/.test(t) ? Number(t) : NaN))
            if (!keys.length || keys.some((k) => Number.isNaN(k) || k >= MAX_KEYS)) {
                problems.push(
                    `${at}: keys takes semitones above the root, from 0 to ${MAX_KEYS - 1}, e.g. keys 0 4 7`
                )
            } else definition.keys = keys
        } else if (word === 'copy' || word === 'copyall') {
            const from = values[0]
            if (values.length !== 1 || !from) {
                problems.push(`${at}: ${word} takes the name of one chord, e.g. ${word} Am`)
                continue
            }
            const source = findDefinition(earlier, from)
            if (source && (hasShape(source) || source.copy)) {
                definition.copy = source.copy
                definition.baseFret ??= source.baseFret
                definition.frets ??= source.frets
                definition.fingers ??= source.fingers
                definition.keys ??= source.keys
                if (word === 'copyall') definition.display ??= source.display
            } else definition.copy = from
        } else if (word === 'display') {
            if (values.length) definition.display = values.join(' ')
        } else if (word === 'format') {
            // How the name is printed: the chart shows names as written.
        } else if (word === 'diagram' || word === 'diagrams') {
            definition.diagram = values[0]?.toLowerCase() !== 'off'
        } else {
            problems.push(
                `${at}: unknown "${tokens[i - 1 - values.length]}": use base-fret, frets, fingers, keys, copy, display or diagram`
            )
        }
    }
    if (
        definition.frets &&
        definition.fingers &&
        definition.fingers.length !== definition.frets.length
    ) {
        // Copied fingers that don't fit the new frets are dropped quietly (ChordPro keeps them).
        if (wroteFingers) {
            problems.push(
                `${at}: fingers has ${definition.fingers.length} values for ${definition.frets.length} strings: give one per string (0 for none)`
            )
        }
        definition.fingers = null
    }
    const top = Math.max(0, ...(absoluteFrets(definition) ?? []).map((f) => f ?? 0))
    if (top > MAX_FRET) {
        problems.push(`${at}: the shape reaches fret ${top}: frets go up to ${MAX_FRET}`)
        definition.frets = null
    }
    return { definition, problems }
}

/** A definition's frets as absolute frets (the base fret's frets counted from the nut). */
export function absoluteFrets(definition: ChordDefinition): (number | null)[] | null {
    const base = definition.baseFret ?? 1
    return definition.frets?.map((f) => (f === null || f === 0 ? f : f + base - 1)) ?? null
}
