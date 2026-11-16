/** The bars speak the block's language, also in what runs after the draw (#136). */
import { afterEach, describe, expect, it } from 'bun:test'
import { attachCopy } from './copy-image.js'
import { attachPlayback } from './controls.js'
import { renderBlock } from '../render/render-block.js'
import { withLanguage } from '../i18n/translate.js'

const hosts: HTMLElement[] = []
const host = () => {
    const el = document.body.appendChild(document.createElement('div'))
    hosts.push(el)
    return el
}
afterEach(() => hosts.splice(0).forEach((h) => h.remove()))

const labels = (el: Element, selector: string) =>
    [...el.querySelectorAll(selector)].map((b) => b.getAttribute('aria-label') ?? b.textContent)

describe('the language of the bars', () => {
    it('is English by default and French when asked, for one standalone call', () => {
        const h = host()
        const result = renderBlock('keyboard', 'chord: C', h)
        const stop = attachPlayback(h, { language: 'fr' })
        const bar = h.querySelector('.mn-block-bar')!
        expect(bar.getAttribute('aria-label')).toStartWith('Lire ')
        expect(labels(bar, 'button')).toContain('Boucle')
        stop()
        result.destroy()
    })

    it('keeps the block language for a click after the draw, two languages on one page', () => {
        const fr = host()
        const en = host()
        const a = renderBlock('keyboard', 'chord: C', fr, { play: true, language: 'fr' })
        const b = renderBlock('keyboard', 'chord: C', en, { play: true })
        const toggle = (h: HTMLElement) =>
            h.querySelector<HTMLButtonElement>('.mn-block-bar .mn-play-toggle')!
        expect(toggle(fr).title).toBe('Lecture')
        expect(toggle(en).title).toBe('Play')
        // A click runs later, under no language at all: the bar still speaks its own.
        toggle(fr).click()
        expect(toggle(fr).title).toBe('Arrêter')
        toggle(en).click()
        expect(toggle(en).title).toBe('Stop')
        a.destroy()
        b.destroy()
    })

    it('copy bar: the language of the call, else the block language in progress', () => {
        const h = host()
        const result = renderBlock('keyboard', 'chord: C', h, { copy: false, fullScreen: false })
        const inside = withLanguage('fr', () => attachCopy(h))
        const bar = h.querySelector('.mn-copy-bar')!
        expect(bar.getAttribute('aria-label')).toBe('Image')
        expect(labels(bar, 'button')).toContain('Copier comme image')
        inside()
        const again = attachCopy(h, undefined, { language: 'fr-CA' })
        expect(labels(h.querySelector('.mn-copy-bar')!, 'button')).toContain('Copier comme image')
        again()
        result.destroy()
    })
})
