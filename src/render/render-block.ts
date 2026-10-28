/** Render a notation block into a host element. Never throws: errors render inline. */
import { RENDERERS, type NotationLanguage, type RenderOptions } from '../blocks/renderers.js'
import { html } from './dom.js'

export const LANGUAGES = Object.keys(RENDERERS) as NotationLanguage[]

export const isNotationLanguage = (language: string): language is NotationLanguage =>
    Object.prototype.hasOwnProperty.call(RENDERERS, language)

export interface RenderResult {
    ok: boolean
    /** The block's container, appended to the host. */
    el: HTMLElement
    /** The message shown when ok is false. */
    error: string | null
    /** Removes what was rendered. */
    destroy(): void
}

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
        el.appendChild(RENDERERS[language](doc, source, options))
    } catch (e) {
        error = e instanceof Error ? e.message : String(e)
        el.classList.add('mn-error')
        el.appendChild(html(doc, 'div', 'mn-error-message', `${language}: ${error}`))
    }
    host.appendChild(el)
    return { ok: error === null, el, error, destroy: () => el.remove() }
}
