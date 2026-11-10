/**
 * Copy as image on the bars (#11): a PNG of the selected diagram (or the whole block) to the
 * clipboard, in the window the bar is in, and a short message after it.
 */
import { toPng } from '../export/image.js'
import { html } from '../render/dom.js'
import { iconButton } from './bar-parts.js'

/** What the button says after a click. */
export const COPY_SAID = {
    copied: 'Copied',
    refused: 'Allow clipboard access for this page, then try again.',
    unsupported: "This browser can't copy images: use a recent Chrome, Edge, Safari or Firefox.",
    failed: "The image couldn't be made."
} as const

/** How long a message stays. */
const SAID_FOR = 2000

type ClipboardWindow = Window & {
    ClipboardItem?: new (items: Record<string, Blob | Promise<Blob>>) => ClipboardItem
}

/** The image of a block bar's diagram: its captioned figure when it has one, else its wrapper. */
export function diagramImage(wrap: HTMLElement): HTMLElement {
    const figure = wrap.parentElement
    return figure?.classList.contains('mn-captioned') ? figure : wrap
}

/**
 * The button and its message (a polite live region). `target(whole)` is what to copy, `whole`
 * when Shift is held; nothing is copied when it returns null.
 */
export function copyImageButton(
    doc: Document,
    win: Window,
    target: (whole: boolean) => Element | null,
    make: (el: Element) => Promise<Blob> = (el) => toPng(el)
): [HTMLButtonElement, HTMLElement] {
    const button = iconButton(doc, 'mn-play-copy', 'Copy as image', 'copy')
    button.setAttribute('aria-description', 'Shift+click copies the whole block')
    const said = html(doc, 'span', 'mn-play-said')
    said.setAttribute('aria-live', 'polite')
    let timer: { id: number; win: Window } | null = null
    const say = (here: Window, text: string) => {
        if (timer) timer.win.clearTimeout(timer.id)
        said.textContent = text
        timer = {
            win: here,
            id: here.setTimeout(() => {
                timer = null
                if (said.textContent === text) said.textContent = ''
            }, SAID_FOR)
        }
    }
    button.addEventListener('click', (event) => {
        const el = target(event.shiftKey)
        if (!el) return
        // The window the bar is in now: a popout has its own clipboard.
        const here = (button.ownerDocument.defaultView ?? win) as ClipboardWindow
        const clipboard = here.navigator.clipboard as Clipboard | undefined
        const Item = here.ClipboardItem
        if (typeof clipboard?.write !== 'function' || typeof Item !== 'function')
            return say(here, COPY_SAID.unsupported)
        let madeIt = true
        const png = make(el).catch((error: unknown) => {
            madeIt = false
            throw error
        })
        // Read by the clipboard; never an unhandled rejection when it isn't.
        png.catch(() => {})
        let wrote: Promise<void>
        try {
            // A promise, inside the click: Safari keeps the user gesture while the PNG is made.
            wrote = clipboard.write([new Item({ 'image/png': png })])
        } catch {
            return say(here, COPY_SAID.refused)
        }
        wrote.then(
            () => say(here, COPY_SAID.copied),
            () =>
                png.then(
                    () => say(here, COPY_SAID.refused),
                    () => say(here, madeIt ? COPY_SAID.refused : COPY_SAID.failed)
                )
        )
    })
    return [button, said]
}
