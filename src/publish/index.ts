/**
 * Obsidian Publish (and any page): turn `<pre><code class="language-chord">` blocks into
 * notation. Idempotent (`data-mp-rendered`), follows the page as it changes (Publish swaps and
 * virtualises content), and hides the source only after a successful render.
 */
import { LANGUAGES, renderBlock, resolveProperties } from '../render/render-block.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

const SELECTOR = LANGUAGES.map((l) => `pre > code.language-${l}`).join(', ')
const MARK = 'mpRendered'
const SOURCE = 'mpSource'

const languageOf = (code: Element): NotationLanguage | undefined =>
    LANGUAGES.find((l) => code.classList.contains(`language-${l}`))

/** Properties as text for the fingerprint; empty when they can't be read. */
function stamp(properties: unknown): string {
    if (!properties || typeof properties !== 'object') return ''
    try {
        return JSON.stringify(properties)
    } catch {
        return ''
    }
}

/** A short fingerprint of a block's source, to notice edits in place. */
function fingerprint(text: string): string {
    let hash = 5381
    for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0
    return `${text.length}:${hash.toString(36)}`
}

/** The rendering that follows a `<pre>`, if it's still there. */
const renderingOf = (pre: HTMLElement): Element | null => {
    const next = pre.nextElementSibling
    return next?.classList.contains('mn-block') ? next : null
}

/** Render every block not rendered yet (or changed, or whose rendering vanished) under `root`. */
export function renderAll(root: ParentNode, options: RenderOptions = {}): number {
    let count = 0
    root.querySelectorAll(SELECTOR).forEach((code) => {
        const pre = code.parentElement
        const language = languageOf(code)
        if (!pre?.parentElement || !language) return
        const source = code.textContent ?? ''
        // An empty block draws from the page's properties: they're part of what it shows.
        const properties = source.trim() ? null : resolveProperties(options.properties, code)
        const print = fingerprint(source + '\u0000' + stamp(properties))
        const previous = renderingOf(pre)
        if (pre.dataset[MARK] && pre.dataset[SOURCE] === print && previous) return
        // New, edited, or its rendering was removed: (re)render from scratch.
        previous?.remove()
        pre.style.removeProperty('display')
        pre.dataset[SOURCE] = print
        pre.dataset[MARK] = 'pending'
        const holder = pre.ownerDocument.createElement('div')
        const result = renderBlock(language, source, holder, {
            ...options,
            properties: (properties ?? null) as RenderOptions['properties']
        })
        pre.insertAdjacentElement('afterend', result.el)
        if (!result.ok) {
            // Leave the source visible; the error explains what's wrong.
            pre.dataset[MARK] = 'error'
            return
        }
        pre.style.display = 'none'
        pre.dataset[MARK] = 'done'
        count++
    })
    return count
}

/** Render now and whenever the page changes. Returns a function that stops watching. */
export function autoRender(doc: Document, options: RenderOptions = {}): () => void {
    renderAll(doc, options)
    const view = doc.defaultView
    if (!view) return () => undefined
    let scheduled = false
    let stopped = false
    const observer = new view.MutationObserver(() => {
        if (scheduled || stopped) return
        scheduled = true
        // One pass per frame, however many mutations Publish makes.
        view.requestAnimationFrame(() => {
            scheduled = false
            if (!stopped) renderAll(doc, options)
        })
    })
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
    return () => {
        stopped = true
        observer.disconnect()
    }
}
