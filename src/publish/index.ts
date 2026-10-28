/**
 * Obsidian Publish (and any page): turn `<pre><code class="language-chord">` blocks into
 * notation. Idempotent (`data-mp-rendered`), follows the page as it changes (Publish swaps and
 * virtualises content), and hides the source only after a successful render.
 */
import { LANGUAGES, renderBlock } from '../render/render-block'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers'

const SELECTOR = LANGUAGES.map((l) => `pre > code.language-${l}`).join(', ')
const MARK = 'mpRendered'

const languageOf = (code: Element): NotationLanguage | undefined =>
    LANGUAGES.find((l) => code.classList.contains(`language-${l}`))

/** Render every block not rendered yet under `root`. Returns how many were rendered. */
export function renderAll(root: ParentNode, options: RenderOptions = {}): number {
    let count = 0
    root.querySelectorAll(SELECTOR).forEach((code) => {
        const pre = code.parentElement
        const language = languageOf(code)
        if (!pre?.parentElement || !language || pre.dataset[MARK]) return
        pre.dataset[MARK] = 'pending'
        const holder = pre.ownerDocument.createElement('div')
        const result = renderBlock(language, code.textContent ?? '', holder, options)
        if (!result.ok) {
            // Leave the source visible; the error explains what's wrong.
            pre.dataset[MARK] = 'error'
            pre.insertAdjacentElement('afterend', result.el)
            return
        }
        pre.insertAdjacentElement('afterend', result.el)
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
    const observer = new view.MutationObserver(() => {
        if (scheduled) return
        scheduled = true
        // One pass per frame, however many mutations Publish makes.
        view.requestAnimationFrame(() => {
            scheduled = false
            renderAll(doc, options)
        })
    })
    observer.observe(doc.body, { childList: true, subtree: true })
    return () => observer.disconnect()
}
