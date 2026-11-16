/** A French render of each block type: French bars and French messages, English untouched (#136). */
import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import type { NotationLanguage } from '../blocks/renderers.js'

const hosts: HTMLElement[] = []
const host = () => {
    const el = document.body.appendChild(document.createElement('div'))
    hosts.push(el)
    return el
}
afterEach(() => hosts.splice(0).forEach((h) => h.remove()))

const SAMPLES: [NotationLanguage, string][] = [
    ['chord', 'symbol: Am\nfrets: x02210'],
    ['chords', '{title: Song}\n[Am]Hello [G]world'],
    ['keyboard', 'chord: C'],
    ['fretboard', 'scale: A minor pentatonic'],
    ['strum', 'D DU UDU'],
    ['progression', 'key: C\nI IV V I'],
    ['circle', 'key: C']
]

describe('a French render of each block type', () => {
    for (const [language, source] of SAMPLES) {
        it(`${language}: French bar, English by default`, () => {
            const fr = renderBlock(language, source, host(), { play: true, language: 'fr' })
            const en = renderBlock(language, source, host(), { play: true })
            expect(fr.ok, fr.error ?? '').toBe(true)
            expect(en.ok, en.error ?? '').toBe(true)
            const names = (el: Element) =>
                [...el.querySelectorAll('[aria-label], [title]')].map(
                    (e) => e.getAttribute('aria-label') ?? e.getAttribute('title')
                )
            const bar = (el: Element) => [...el.querySelectorAll('.mn-play')]
            if (bar(en.el).length) {
                expect(bar(fr.el).length).toBeGreaterThan(0)
                expect(names(en.el.querySelector('.mn-play')!.parentElement!)).not.toEqual(
                    names(fr.el.querySelector('.mn-play')!.parentElement!)
                )
            }
            expect(JSON.stringify(names(fr.el))).not.toMatch(/\bPlay\b|Copy as image|Full screen/)
            fr.destroy()
            en.destroy()
        })
    }

    const WRONG: [NotationLanguage, string][] = [
        ['keyboard', 'chord: Xyz'],
        ['fretboard', 'nonsense: 1'],
        ['chord', 'symbol: Am\nfrets: abc'],
        ['strum', 'D DU\ntime: 9/x'],
        ['progression', 'key: Q\nI IV'],
        ['circle', 'key: Q'],
        ['picking', 'pattern: zz']
    ]
    for (const [language, source] of WRONG) {
        it(`${language}: the error of a wrong source in French, the keyword prefix kept`, () => {
            const fr = renderBlock(language, source, host(), { language: 'fr-BE' })
            const en = renderBlock(language, source, host())
            expect(fr.ok).toBe(false)
            expect(en.ok).toBe(false)
            expect(fr.error).not.toBe(en.error)
            expect(fr.el.textContent).toStartWith(`${language}: `)
            expect(en.el.textContent).toStartWith(`${language}: `)
        })
    }

    it('reads an invalid language as English', () => {
        const a = renderBlock('keyboard', 'chord: C\nstaves: x', host(), { language: 'klingon' })
        const b = renderBlock('keyboard', 'chord: C\nstaves: x', host())
        expect(a.error).toBe(b.error)
    })
})
