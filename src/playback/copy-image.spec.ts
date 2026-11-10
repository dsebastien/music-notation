/**
 * Copy as image on the bars (#11): the button, what it copies (the selected diagram, the whole
 * block with Shift or one diagram), and what it says.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { COPY_SAID, copyImageButton, diagramImage } from './copy-image.js'
import { renderBlock } from '../render/render-block.js'
import type { TimedBar } from './controls.js'

const host = () => document.body.appendChild(document.createElement('div'))
const click = (el: Element, shiftKey = false) =>
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey }))
const settle = () => new Promise((r) => setTimeout(r, 0))

type Written = { types: Record<string, unknown> }[]

/** A clipboard that takes images, refuses them, or isn't there. */
function clipboard(mode: 'takes' | 'refuses' | 'reads' | 'none' | 'no-item') {
    const written: Written = []
    const nav = window.navigator as Navigator & { clipboard?: unknown }
    const before = Object.getOwnPropertyDescriptor(nav, 'clipboard')
    const beforeItem = (window as { ClipboardItem?: unknown }).ClipboardItem
    Object.defineProperty(nav, 'clipboard', {
        configurable: true,
        value:
            mode === 'none'
                ? undefined
                : {
                      write(items: { types: Record<string, unknown> }[]) {
                          written.push(...items)
                          if (mode === 'refuses')
                              return Promise.reject(new Error('NotAllowedError'))
                          // A real clipboard reads the image, and fails with it.
                          if (mode === 'reads')
                              return Promise.resolve(items[0]?.types['image/png']).then(() => {})
                          return Promise.resolve()
                      }
                  }
    })
    class Item {
        constructor(public types: Record<string, unknown>) {}
    }
    ;(window as { ClipboardItem?: unknown }).ClipboardItem = mode === 'no-item' ? undefined : Item
    restore.push(() => {
        if (before) Object.defineProperty(nav, 'clipboard', before)
        else delete (nav as { clipboard?: unknown }).clipboard
        ;(window as { ClipboardItem?: unknown }).ClipboardItem = beforeItem
    })
    return written
}
const restore: (() => void)[] = []
afterEach(() => {
    while (restore.length) restore.pop()!()
})

describe('the Copy as image button (#11)', () => {
    const made: Element[] = []
    const make = (el: Element) => {
        made.push(el)
        return Promise.resolve(new Blob(['png'], { type: 'image/png' }))
    }

    it('is a named button with a picture icon, and a polite message after it', () => {
        const [button, said] = copyImageButton(document, window, () => null, make)
        expect(button.getAttribute('aria-label')).toBe('Copy as image')
        expect(button.title).toBe('Copy as image')
        expect(button.querySelector('.mn-play-icon-copy')).not.toBeNull()
        expect(said.getAttribute('aria-live')).toBe('polite')
    })

    it('copies a PNG of the target, the whole one with Shift, and says so', async () => {
        const written = clipboard('takes')
        const part = document.createElement('div')
        const whole = document.createElement('div')
        const [button, said] = copyImageButton(
            document,
            window,
            (all) => (all ? whole : part),
            make
        )
        made.length = 0
        click(button)
        await settle()
        expect(made).toEqual([part])
        expect(Object.keys(written[0]!.types)).toEqual(['image/png'])
        // The PNG is handed over as a promise, inside the click (Safari keeps the gesture).
        expect(written[0]!.types['image/png']).toBeInstanceOf(Promise)
        expect(said.textContent).toBe(COPY_SAID.copied)
        click(button, true)
        await settle()
        expect(made).toEqual([part, whole])
    })

    it('says what to do when the browser refuses or cannot copy images', async () => {
        clipboard('refuses')
        const [button, said] = copyImageButton(document, window, () => document.body, make)
        click(button)
        await settle()
        expect(said.textContent).toBe(COPY_SAID.refused)
        restore.pop()!()
        clipboard('no-item')
        click(button)
        await settle()
        expect(said.textContent).toBe(COPY_SAID.unsupported)
    })

    it('says so when the image cannot be made', async () => {
        clipboard('reads')
        const failing = () => Promise.reject(new Error('no canvas'))
        const [button, said] = copyImageButton(document, window, () => document.body, failing)
        click(button)
        await settle()
        await settle()
        expect(said.textContent).toBe(COPY_SAID.failed)
    })
})

describe('what the block bar copies (#11)', () => {
    it('is the selected diagram with its caption, or its wrapper', () => {
        const { el } = renderBlock('chord', 'A x02220\ncaption: fingering\n---\nD xx0232', host(), {
            play: {}
        })
        const wraps = [...el.querySelectorAll('.mn-playable')] as HTMLElement[]
        expect(diagramImage(wraps[0]!).tagName.toLowerCase()).toBe('figure')
        const { el: row } = renderBlock('chord', 'A x02220\n---\nD xx0232', host(), { play: {} })
        const wrap = row.querySelector('.mn-playable') as HTMLElement
        expect(diagramImage(wrap)).toBe(wrap)
    })
})

describe('Copy as image on every bar that draws (#11)', () => {
    const lastControl = (bar: Element) =>
        [...bar.children].filter((c) => !c.classList.contains('mn-play-said')).pop()

    it('ends the block bar, after the sound', () => {
        const { el } = renderBlock('chord', 'A x02220\n---\nD xx0232', host(), { play: {} })
        const bar = el.querySelector('.mn-block-bar')!
        expect(lastControl(bar)!.classList.contains('mn-play-copy')).toBe(true)
        expect(bar.querySelector('.mn-play-said')).not.toBeNull()
    })

    it('is on progression, chart, strum and picking bars, before the app controls (#77)', () => {
        const timedBar = (bar: TimedBar) => bar.add(document.createElement('button'))
        for (const [lang, source] of [
            ['progression', 'key: C\nI vi IV V'],
            ['chords', '[C]Hello [G]world'],
            ['strum', 'D DU UDU'],
            ['picking', 'pattern: travis\nchords: C Am']
        ] as const) {
            const { el } = renderBlock(lang, source, host(), { play: { timedBar } })
            const copy = el.querySelector('.mn-play .mn-play-copy')
            expect(copy).not.toBeNull()
            const bar = copy!.closest('.mn-play')!
            const app = bar.querySelector('.mn-play-app')!
            expect(
                copy!.compareDocumentPosition(app) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy()
        }
    })

    it('is left out with copyImage: false', () => {
        const { el } = renderBlock('chord', 'A x02220', host(), { play: { copyImage: false } })
        expect(el.querySelector('.mn-play-copy')).toBeNull()
        const { el: strum } = renderBlock('strum', 'D DU UDU', host(), {
            play: { copyImage: false }
        })
        expect(strum.querySelector('.mn-play-copy')).toBeNull()
    })
})
