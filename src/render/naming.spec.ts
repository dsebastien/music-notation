import { describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'
import { accessibleName } from './dom.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

/** #12: blocks drawn with their names in solfège or German. */
const block = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    return renderBlock(language, source, host, options)
}
const texts = (el: Element, selector: string) =>
    [...el.querySelectorAll(selector)].map((e) => e.textContent ?? '')

describe('naming in blocks', () => {
    it('changes nothing without it', () => {
        const r = block('fretboard', 'A minor pentatonic\nfrets: 5-8')
        expect(r.ok).toBe(true)
        expect(texts(r.el, '.mn-string-name')).toEqual(['E', 'B', 'G', 'D', 'A', 'E'])
        expect(texts(r.el, '.mn-dot-text')).toContain('A')
    })

    it('shows a fretboard in solfège: labels, string names, the name', () => {
        const r = block('fretboard', 'La mineur pentatonic\nfrets: 5-8\nnaming: solfege')
        expect(r.ok).toBe(true)
        const svg = r.el.querySelector('svg.mn-fretboard')!
        expect(texts(svg, '.mn-string-name')).toEqual(['Mi', 'Si', 'Sol', 'Ré', 'La', 'Mi'])
        const labels = texts(svg, '.mn-dot-text')
        expect(labels).toContain('La')
        expect(labels).toContain('Do')
        expect(labels).not.toContain('A')
        expect(accessibleName(svg)).toBe('Fretboard: La minor pentatonic')
        // What apps and playback read stays in letters.
        expect(svg.getAttribute('data-mn-set')).toBe('A minor pentatonic')
        expect(svg.querySelector('.mn-dot[data-mn-note="A"]')).not.toBeNull()
    })

    it('takes the naming from the app, and the block key wins', () => {
        const app = block('keyboard', 'C major', { naming: 'solfege' })
        expect(texts(app.el, '.mn-key-label')).toContain('Do')
        const own = block('keyboard', 'C major\nnaming: letters', { naming: 'solfege' })
        expect(texts(own.el, '.mn-key-label')).toContain('C')
        const bad = block('keyboard', 'C major', { naming: 'klingon' as never })
        expect(bad.ok).toBe(true)
        expect(texts(bad.el, '.mn-key-label')).toContain('C')
    })

    it('shows German H and B, and reads a bare B as B flat in a german block', () => {
        const r = block('keyboard', 'chord: B7\nnaming: german')
        const svg = r.el.querySelector('svg')!
        // B7 in German is B flat 7: drawn as Bb7, shown as B7.
        expect(svg.getAttribute('data-mn-set')).toBe('Bb7')
        expect(accessibleName(svg)).toBe('Keyboard: B7')
        const h = block('keyboard', 'H major\nnaming: german')
        expect(h.ok).toBe(true)
        expect(texts(h.el, '.mn-key-label')).toContain('H')
        expect(h.el.querySelector('svg')!.getAttribute('data-mn-set')).toBe('B major')
    })

    it('shows a chord diagram title in solfège, and reads solfège input', () => {
        const r = block('chord', 'Rém x00231\nnaming: solfege')
        expect(r.ok).toBe(true)
        expect(texts(r.el, '.mn-title')).toEqual(['Ré m'])
        const letters = block('chord', 'Rém x00231')
        expect(letters.ok).toBe(true)
        expect(texts(letters.el, '.mn-title')).toEqual(['Dm'])
    })

    it('shows chart chords and progression names, and the play bar names follow', () => {
        const chart = block('chords', '{naming: solfege}\n[Sol]Hello [Rém]world [Solo]', {
            play: true
        })
        expect(chart.ok).toBe(true)
        expect(texts(chart.el, '.mn-chord')).toEqual(['Sol', 'Ré m', 'Solo'])
        const progression = block('progression', 'key: Do\nI vi IV V\nnaming: solfege')
        expect(progression.ok).toBe(true)
        expect(texts(progression.el, '.mn-title')).toEqual(['Do', 'La m', 'Fa', 'Sol'])
        expect(texts(progression.el, '.mn-progression-key')).toEqual(['Key: Do major'])
        const german = block('progression', 'key: F\nI IV V\nnaming: german')
        expect(texts(german.el, '.mn-title')).toEqual(['F', 'B', 'C'])
    })

    it('shows the circle of fifths in solfège', () => {
        const r = block('circle', 'key: Sol\nnaming: solfege')
        expect(r.ok).toBe(true)
        expect(r.el.textContent).toContain('Sol')
        expect(r.el.textContent).not.toMatch(/\bG major\b/)
    })

    it('keeps user titles with an English article', () => {
        const r = block('fretboard', 'C major\ntitle: A long way\nnaming: solfege')
        expect(texts(r.el, '.mn-title').join('')).toBe('A long way')
    })

    it("keeps a German title's B as B flat and its H as B natural", () => {
        const r = block('fretboard', 'Bb major\ntitle: B major, H major\nnaming: german')
        expect(texts(r.el, '.mn-title').join('')).toBe('B major, H major')
    })

    it('says what to write for a wrong naming', () => {
        const r = block('chord', 'C\nnaming: french')
        expect(r.ok).toBe(false)
        expect(r.error).toContain('naming: write letters, solfege or german')
    })
})
