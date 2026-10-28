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
    options: RenderOptions = {}
): RenderResult {
    const doc = host.ownerDocument
    const el = html(doc, 'div', `mn-block mn-block-${language}`)
    let error: string | null = null
    // An empty block (a template's placeholder) draws nothing rather than an error.
    if (!source.trim()) {
        el.classList.add('mn-empty')
        host.appendChild(el)
        return { ok: true, el, error: null, destroy: () => el.remove() }
    }
    try {
        const parts = isDiagramLanguage(language) ? splitParts(source) : null
        if (parts && isDiagramLanguage(language)) {
            error = renderRow(doc, language, parts, el, options)
        } else {
            el.appendChild(RENDERERS[language](doc, source, options))
        }
    } catch (e) {
        error = messageOf(e)
        el.replaceChildren()
        el.classList.add('mn-error')
        el.appendChild(html(doc, 'div', 'mn-error-message', `${language}: ${error}`))
    }
    host.appendChild(el)
    return { ok: error === null, el, error, destroy: () => el.remove() }
}

/** A first part with no shorthand and only shareable keys holds the row's shared settings. */
function headerOf(language: DiagramLanguage, part: string | undefined): BlockSource | null {
    if (part === undefined) return null
    let block: BlockSource
    try {
        block = parseBlockSource(part)
    } catch {
        return null
    }
    const shared = SHARED_KEYS[language]
    return block.head === null &&
        [...block.fields.keys()].every((key) => key === 'columns' || shared.includes(key))
        ? block
        : null
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
    if (!diagrams.length) {
        throw new Error(
            header ? 'Add a diagram after the shared settings: "---", then it' : 'Add a diagram'
        )
    }
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
            const block = parseBlockSource(part)
            if (block.fields.has('columns')) {
                throw new Error('"columns" goes in the shared settings, before the first "---"')
            }
            // The diagram's own keys win over the shared ones.
            const fields = new Map([...shared, ...block.fields])
            cell.appendChild(DIAGRAMS[language](doc, { head: block.head, fields }, options))
        } catch (e) {
            const message = `diagram ${i + 1}: ${messageOf(e)}`
            errors.push(message)
            cell.classList.add('mn-error')
            cell.appendChild(html(doc, 'div', 'mn-error-message', `${language}, ${message}`))
        }
        row.appendChild(cell)
    })
    el.appendChild(row)
    return errors.length ? errors.join('; ') : null
}
