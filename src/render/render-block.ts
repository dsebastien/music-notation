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
        const fromProperties = propertiesSource(language, options)
        if (fromProperties) {
            text = fromProperties
            el.classList.add('mn-from-properties')
        }
    }
    let parts: string[] | null = null
    try {
        parts = isDiagramLanguage(language)
            ? (splitParts(text) ?? modeParts(language, text) ?? positionParts(language, text))
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

/** An empty block's source from the note's properties (an object, or a function returning one). */
function propertiesSource(language: DiagramLanguage, options: RenderOptions): string | null {
    let properties: unknown = options.properties
    if (typeof properties === 'function') {
        try {
            properties = (properties as () => unknown)()
        } catch {
            return null
        }
    }
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
    return blockFromProperties(language, properties as Record<string, unknown>, {
        ...(options.propertyNames ? { names: options.propertyNames } : {}),
        ...(options.instrument ? { instrument: options.instrument } : {})
    })
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
    const others = [...block.fields]
        .filter(([key]) => !['positions', 'scale', 'shape', 'position', 'title'].includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    return wanted.map((n) => {
        const at =
            system === 'caged'
                ? [
                      `shape: ${CAGED_SHAPES[n - 1]}`,
                      `title: ${set.title}, ${CAGED_SHAPES[n - 1]} shape`
                  ]
                : system === '3nps'
                  ? ['shape: 3nps', `position: ${n}`, `title: ${set.title}, 3nps ${n}`]
                  : [`position: ${n}`, `title: ${set.title}, box ${n}`]
        return [`scale: ${scale}`, ...at, ...others].join('\n')
    })
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
    const named = modes.map((m) => m.replace(/ major$/, ' ionian').replace(/ minor$/, ' aeolian'))
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
