/** Render a notation block into a host element. Never throws: errors render inline. */
import {
    DIAGRAMS,
    RENDERERS,
    SHARED_KEYS,
    type DiagramLanguage,
    type NotationLanguage,
    type RenderOptions
} from '../blocks/renderers.js'
import { parseBlockSource, splitParts, type BlockSource } from '../blocks/block-source.js'
import { html } from './dom.js'
import { layoutDefaults, parseHand, parseOrientation } from './layout.js'
import { blockFromProperties } from '../blocks/properties.js'
import { modesOf } from '../theory/scales.js'
import { scaleNoteSet } from '../theory/note-set.js'
import { CAGED_SHAPES, positionCount } from '../fretboard/positions.js'
import { generateVoicings, MAX_GENERATED_STRINGS, type VoicingOptions } from '../chord/generate.js'
import { parseTuning } from '../fretboard/tuning.js'
import { readChord, suggestChords } from '../theory/chord-name.js'
import { parseRange } from '../blocks/block-source.js'

export const LANGUAGES = Object.keys(RENDERERS) as NotationLanguage[]

export const isNotationLanguage = (language: string): language is NotationLanguage =>
    Object.prototype.hasOwnProperty.call(RENDERERS, language)

const isDiagramLanguage = (language: string): language is DiagramLanguage =>
    Object.prototype.hasOwnProperty.call(DIAGRAMS, language)

/** More diagrams than this in one block is an error, so a page stays quick to draw. */
export const MAX_DIAGRAMS = 32

export interface RenderResult {
    ok: boolean
    /** The block's container, appended to the host. */
    el: HTMLElement
    /** The message shown when ok is false (every failing diagram's, for a row). */
    error: string | null
    /** Removes what was rendered. */
    destroy(): void
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function renderBlock(
    language: NotationLanguage,
    source: string,
    host: HTMLElement,
    given: RenderOptions = {}
): RenderResult {
    const doc = host.ownerDocument
    const el = html(doc, 'div', `mn-block mn-block-${language}`)
    let error: string | null = null
    // Layout defaults come from apps and pages: keep only valid values ("Left" reads as left).
    const layout = layoutDefaults(given)
    const options: RenderOptions = {
        ...(given ?? {}),
        orientation: layout.orientation ?? {},
        hand: layout.hand ?? 'right'
    }
    let text = source
    // An empty block in a note draws from the note's properties, when they describe one.
    if (!text.trim() && isDiagramLanguage(language)) {
        const fromProperties = propertiesSource(language, options, host)
        if (fromProperties) {
            text = fromProperties
            el.classList.add('mn-from-properties')
        }
    }
    let parts: string[] | null = null
    try {
        parts = isDiagramLanguage(language)
            ? (splitParts(text) ??
              modeParts(language, text) ??
              positionParts(language, text) ??
              voicingParts(language, text))
            : null
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    // An empty block (a template's placeholder, or only separators) draws nothing, not an error.
    if (!text.trim() || parts?.length === 0) {
        el.classList.add('mn-empty')
        host.appendChild(el)
        return { ok: true, el, error: null, destroy: () => el.remove() }
    }
    try {
        if (parts && isDiagramLanguage(language)) {
            error = renderRow(doc, language, parts, el, options)
        } else {
            el.appendChild(RENDERERS[language](doc, text, options))
        }
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    host.appendChild(el)
    return { ok: error === null, el, error, destroy: () => el.remove() }
}

/** The block as an inline error that says what's wrong. */
function failed(el: HTMLElement, host: HTMLElement, language: string, error: string): RenderResult {
    el.replaceChildren()
    el.classList.add('mn-error')
    el.appendChild(html(el.ownerDocument, 'div', 'mn-error-message', `${language}: ${error}`))
    host.appendChild(el)
    return { ok: false, el, error, destroy: () => el.remove() }
}

/** Properties as given, or what a function of the block's element returns; null when it fails. */
export function resolveProperties(properties: unknown, el: Element): unknown {
    if (typeof properties !== 'function') return properties
    try {
        return (properties as (el: Element) => unknown)(el)
    } catch {
        return null
    }
}

/** An empty block's source from the note's properties (an object, or a function returning one). */
function propertiesSource(
    language: DiagramLanguage,
    options: RenderOptions,
    host: Element
): string | null {
    const properties = resolveProperties(options.properties, host)
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
    // Properties come from notes and pages: a value that throws when read draws nothing.
    try {
        return blockFromProperties(language, properties as Record<string, unknown>, {
            ...(options.propertyNames ? { names: options.propertyNames } : {}),
            ...(options.instrument ? { instrument: options.instrument } : {})
        })
    } catch {
        return null
    }
}

/**
 * `positions: all` (or `1 3 5`) on a fretboard with a scale: one diagram per position, in a row.
 * Boxes for 5-note scales, CAGED shapes for 7-note scales, or 3NPS with `shape: 3nps`. Null when
 * the block has no `positions:`.
 */
function positionParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'fretboard') return null
    let block: BlockSource
    try {
        block = parseBlockSource(source)
    } catch {
        return null
    }
    const value = block.fields.get('positions')?.trim()
    if (value === undefined) return null
    const scale = block.fields.get('scale') ?? block.head
    const set = scale ? scaleNoteSet(scale) : null
    if (!scale || !set) throw new Error('positions needs a scale: e.g. A minor pentatonic')
    const nps = block.fields.get('shape')?.trim().toLowerCase() === '3nps'
    const system = nps ? '3nps' : set.members.length === 5 ? 'box' : 'caged'
    const count = positionCount(set, system)
    const wanted =
        value.toLowerCase() === 'all'
            ? Array.from({ length: count }, (_, i) => i + 1)
            : value.split(/[\s,]+/).map(Number)
    const bad = wanted.find((n) => !Number.isInteger(n) || n < 1 || n > count)
    if (bad !== undefined) {
        throw new Error(`positions: use all, or numbers from 1 to ${count} for ${set.title}`)
    }
    // Shared keys (and columns) go in a shared part; the others repeat in every diagram.
    const shared = SHARED_KEYS.fretboard
    const others = [...block.fields].filter(
        ([key]) => !['positions', 'scale', 'shape', 'position', 'title'].includes(key)
    )
    const header = others
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const own = others
        .filter(([key]) => key !== 'columns' && !shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const diagrams = wanted.map((n) => {
        const at =
            system === 'caged'
                ? [
                      `shape: ${CAGED_SHAPES[n - 1]}`,
                      `title: ${set.title}, ${CAGED_SHAPES[n - 1]} shape`
                  ]
                : system === '3nps'
                  ? ['shape: 3nps', `position: ${n}`, `title: ${set.title}, 3nps ${n}`]
                  : [`position: ${n}`, `title: ${set.title}, box ${n}`]
        return [`scale: ${scale}`, ...at, ...own].join('\n')
    })
    return [...(header.length ? [header.join('\n')] : []), ...diagrams]
}

/** Keys that choose which voicings `voicings:` draws; they don't reach the diagrams. */
const VOICING_FILTERS = [
    'voicings',
    'area',
    'root-string',
    'strings',
    'inversion',
    'stretch',
    'open',
    'gaps'
]

const yes = (text: string | undefined, key: string): boolean | undefined => {
    if (text === undefined || text === '') return undefined
    const value = text.trim().toLowerCase()
    if (['yes', 'true', 'on'].includes(value)) return true
    if (['no', 'false', 'off'].includes(value)) return false
    throw new Error(`${key} must be yes or no, got "${text}"`)
}

const stringList = (text: string, count: number): number[] => {
    const range = parseRange(text)
    const numbers = range
        ? Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i)
        : text
              .split(/[\s,]+/)
              .filter(Boolean)
              .map(Number)
    if (!numbers.length || numbers.some((n) => !Number.isInteger(n) || n < 1 || n > count)) {
        throw new Error(`strings: use string numbers from 1 (the highest) to ${count}, e.g. 1-4`)
    }
    return numbers
}

/**
 * `voicings: all` (or a number) on a chord block: the chord's playable voicings, easiest first, in
 * a row (see generateVoicings). Filters: `area`, `root-string`, `strings`, `inversion`, `stretch`,
 * `open`, `gaps`. Null when the block has no `voicings:`.
 */
function voicingParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'chord') return null
    let block: BlockSource
    try {
        block = filled(parseBlockSource(source))
    } catch {
        return null
    }
    const value = block.fields.get('voicings')?.trim()
    if (value === undefined) return null
    const fields = block.fields
    if (fields.has('frets') || fields.has('fingers') || fields.has('voicing')) {
        throw new Error('voicings finds the frets itself: remove frets, fingers and voicing')
    }
    const instrument = fields.get('instrument')?.toLowerCase()
    if (instrument === 'piano' || instrument === 'keyboard' || fields.has('pitches')) {
        throw new Error('voicings are for guitar and other fretted instruments')
    }
    const written = fields.get('symbol') ?? fields.get('chord') ?? block.head ?? fields.get('name')
    if (!written) throw new Error('voicings needs a chord: e.g. A Major')
    const chord = readChord(written)
    if (!chord) throw new Error(`Didn't recognize "${written}": try ${suggestChords(written)}`)
    const tuningText = fields.get('tuning')
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(`Unknown tuning "${tuningText}"`)
    const count = tuning?.length ?? 6
    if (count > MAX_GENERATED_STRINGS) {
        throw new Error(`voicings works on up to ${MAX_GENERATED_STRINGS} strings`)
    }
    const all = value.toLowerCase() === 'all'
    const wanted = all ? MAX_DIAGRAMS : Number(value)
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_DIAGRAMS) {
        throw new Error(`voicings: use all, or a number from 1 to ${MAX_DIAGRAMS}`)
    }
    const options: VoicingOptions = {}
    if (tuning) options.tuning = tuning
    const area = fields.get('area')
    if (area) {
        const range = area.trim().toLowerCase() === 'open' ? 'open' : parseRange(area)
        if (!range || (range !== 'open' && (range[0] < 1 || range[1] > 24))) {
            throw new Error(`area: use open, or frets like 5-9 (from 1 to 24), got "${area}"`)
        }
        options.area = range
        if (range !== 'open') options.maxFret = Math.max(15, range[1])
    }
    const rootString = fields.get('root-string')
    if (rootString) {
        const n = Number(rootString)
        if (!Number.isInteger(n) || n < 1 || n > count) {
            throw new Error(`root-string: use a string number from 1 (the highest) to ${count}`)
        }
        options.bassString = n
    }
    const strings = fields.get('strings')
    if (strings) options.strings = stringList(strings, count)
    const inversion = fields.get('inversion')?.trim().toLowerCase()
    if (inversion) {
        const n = inversion === 'root' ? 0 : Number(inversion)
        if (inversion === 'any') options.inversion = 'any'
        else if (Number.isInteger(n) && n >= 0 && n <= 3) options.inversion = n
        else throw new Error(`inversion: use 0 (root), 1, 2, 3 or any, got "${inversion}"`)
    }
    if (yes(fields.get('stretch'), 'stretch')) options.maxSpan = 5
    const open = yes(fields.get('open'), 'open')
    if (open === false) options.allowOpen = false
    if (yes(fields.get('gaps'), 'gaps')) options.gaps = true
    // Only the strings asked for: three strings make triads.
    if (options.strings) options.minStrings = Math.min(options.strings.length, 4)
    const voicings = generateVoicings(chord.symbol, options).slice(0, wanted)
    if (!voicings.length) {
        throw new Error(
            `No playable voicing of ${written} fits: widen the area, allow open strings or add stretch: yes`
        )
    }
    // Shared keys (and columns) go in a shared part; the others repeat in every diagram.
    const shared = SHARED_KEYS.chord
    const others = [...fields].filter(
        ([key]) =>
            !VOICING_FILTERS.includes(key) && !['symbol', 'chord', 'name', 'title'].includes(key)
    )
    const header = others
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const own = others
        .filter(([key]) => key !== 'columns' && !shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const frets = (list: (number | null)[]) =>
        list.some((f) => f !== null && f > 9)
            ? list.map((f) => (f === null ? 'x' : f)).join('-')
            : list.map((f) => (f === null ? 'x' : f)).join('')
    const diagrams = voicings.map((v) =>
        [
            `symbol: ${chord.symbol}`,
            `title: ${written}${v.shape ? `, ${v.shape}` : ''}`,
            `frets: ${frets(v.frets)}`,
            `fingers: ${v.fingers.map((f) => f ?? 'x').join('')}`,
            ...own
        ].join('\n')
    )
    return [...(header.length ? [header.join('\n')] : []), ...diagrams]
}

/**
 * `modes: C major` on a fretboard or keyboard: one diagram per mode, in a row, with the block's
 * other keys shared. Null when the block has no `modes:`.
 */
function modeParts(language: DiagramLanguage, source: string): string[] | null {
    if (language === 'chord') return null
    let block: BlockSource
    try {
        block = parseBlockSource(source)
    } catch {
        return null
    }
    const value = block.fields.get('modes')
    if (value === undefined) return null
    const modes = modesOf(value)
    if (!modes) throw new Error(`"${value}" has no modes: use e.g. modes: C major`)
    const shared = SHARED_KEYS[language]
    const others = [...block.fields].filter(([key]) => key !== 'modes')
    const refused = others.find(([key]) => key !== 'columns' && !shared.includes(key))
    if (refused || block.head) {
        throw new Error(
            `"${refused?.[0] ?? block.head}" can't be used with modes: only ${shared.join(', ')}, columns`
        )
    }
    // Every mode by its own name (C ionian, A aeolian), so their characteristic notes show.
    const named = modes.map((m) =>
        m.replace(/^(\S+) major$/, '$1 ionian').replace(/^(\S+) minor$/, '$1 aeolian')
    )
    const header = others.map(([key, v]) => `${key}: ${v}`).join('\n')
    return [...(header ? [header] : []), ...named.map((m) => `scale: ${m}\ntitle: ${m}`)]
}

/** A block's keys without the empty ones (`labels:` alone says nothing). */
const filled = (block: BlockSource): BlockSource => ({
    head: block.head,
    fields: new Map([...block.fields].filter(([, value]) => value !== ''))
})

/**
 * The row's shared settings: a first part with no shorthand that holds `columns` or only shareable
 * keys. With `columns`, any other key is refused by name (a diagram can't hide there).
 */
function headerOf(language: DiagramLanguage, part: string | undefined): BlockSource | null {
    if (part === undefined) return null
    let block: BlockSource
    try {
        block = filled(parseBlockSource(part))
    } catch {
        return null
    }
    if (block.head !== null) return null
    const shared = SHARED_KEYS[language]
    const others = [...block.fields.keys()].filter(
        (key) => key !== 'columns' && !shared.includes(key)
    )
    if (!others.length) return block.fields.size ? block : null
    if (!block.fields.has('columns')) return null
    throw new Error(
        `"${others[0]}" can't be shared: move it to a diagram. Shared settings: ${shared.join(', ')}, columns`
    )
}

/** Checks the shared settings once, rather than once per diagram. */
function checkShared(header: BlockSource): void {
    const orientation = header.fields.get('orientation')
    if (orientation !== undefined) parseOrientation(orientation)
    const hand = header.fields.get('hand')
    if (hand !== undefined) parseHand(hand)
}

/** Whether a part with no shorthand holds a shareable key (it may have been meant as settings). */
function sharesSomething(language: DiagramLanguage, part: string): boolean {
    try {
        const block = parseBlockSource(part)
        return (
            block.head === null &&
            [...block.fields.keys()].some((k) => SHARED_KEYS[language].includes(k))
        )
    } catch {
        return false
    }
}

function columnsOf(header: BlockSource | null): number | null {
    const text = header?.fields.get('columns')
    if (text === undefined) return null
    const n = Number(text)
    if (!Number.isInteger(n) || n < 1 || n > 12) {
        throw new Error(`columns must be a whole number from 1 to 12, got "${text}"`)
    }
    return n
}

/**
 * Several diagrams in a row (or a grid), each in its own cell. A diagram with a mistake shows its
 * message in its cell and the others still draw. Returns the failing diagrams' messages, or null.
 */
function renderRow(
    doc: Document,
    language: DiagramLanguage,
    parts: string[],
    el: HTMLElement,
    options: RenderOptions
): string | null {
    const header = headerOf(language, parts[0])
    const diagrams = header ? parts.slice(1) : parts
    if (header && !diagrams.length) {
        throw new Error('Add a diagram after the shared settings: a "---" line, then the diagram')
    }
    if (header) checkShared(header)
    if (diagrams.length > MAX_DIAGRAMS) {
        throw new Error(`At most ${MAX_DIAGRAMS} diagrams per block, found ${diagrams.length}`)
    }
    const columns = columnsOf(header)
    const shared = [...(header?.fields ?? [])].filter(([key]) => key !== 'columns')
    const row = html(doc, 'div', columns ? `mn-grid mn-cols-${columns}` : 'mn-row')
    const errors: string[] = []
    diagrams.forEach((part, i) => {
        const cell = html(doc, 'div', 'mn-cell')
        try {
            const block = filled(parseBlockSource(part))
            if (block.fields.has('columns')) {
                throw new Error('"columns" goes in the shared settings, before the first "---"')
            }
            const directive = ['positions', 'modes', 'voicings'].find((key) =>
                block.fields.has(key)
            )
            if (directive) {
                throw new Error(`"${directive}" draws its own row: use it in a block of its own`)
            }
            // The diagram's own keys win over the shared ones.
            const fields = new Map([...shared, ...block.fields])
            cell.appendChild(DIAGRAMS[language](doc, { head: block.head, fields }, options))
        } catch (e) {
            let message = `diagram ${i + 1}: ${messageOf(e)}`
            // A first part meant as shared settings but holding another key draws as a diagram.
            if (i === 0 && !header && sharesSomething(language, part)) {
                message += ` (shared settings before the first "---" may only hold: ${SHARED_KEYS[language].join(', ')}, columns)`
            }
            errors.push(message)
            cell.classList.add('mn-error')
            cell.appendChild(html(doc, 'div', 'mn-error-message', `${language}, ${message}`))
        }
        row.appendChild(cell)
    })
    el.appendChild(row)
    return errors.length ? errors.join('; ') : null
}
