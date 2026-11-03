import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

describe('scales-for', () => {
    it('draws the best scale for some chords on a fretboard', () => {
        const h = host()
        const result = renderBlock('fretboard', 'scales-for: G D Em C\nfrets: 0-5', h)
        expect(result.error).toBeNull()
        const svg = h.querySelector('svg')!
        expect(svg.getAttribute('data-mn-set')).toBe('G major')
        expect(h.querySelector('.mn-title')?.textContent).toBe('G major for G D Em C')
        expect(svg.getAttribute('data-mn-frets')).toBe('0-5')
    })

    it('names the outside notes in the title', () => {
        const h = host()
        renderBlock('keyboard', 'scales-for: G, D | Em C B7', h)
        expect(h.querySelector('.mn-title')?.textContent).toBe(
            'G major for G D Em C B7, D# outside'
        )
    })

    it('reads notes with scales-for-notes, and keeps a title and labels', () => {
        const h = host()
        const result = renderBlock(
            'keyboard',
            'scales-for-notes: C# E G#\ntitle: Mine\nlabels: degrees',
            h
        )
        expect(result.error).toBeNull()
        expect(h.querySelector('svg')!.getAttribute('data-mn-set')).toBe('C# minor')
        expect(h.querySelector('.mn-title')?.textContent).toBe('Mine')
        expect(h.querySelector('.mn-root + .mn-key-label')?.textContent).toBe('1')
    })

    it('works in a row of diagrams', () => {
        const h = host()
        const result = renderBlock('fretboard', 'scales-for: Am Dm E7\n---\nscale: A minor', h)
        expect(result.error).toBeNull()
        expect(h.querySelectorAll('svg')[0]!.getAttribute('data-mn-set')).toBe('A harmonic minor')
    })

    it('says what to write instead', () => {
        const error = (source: string) => renderBlock('fretboard', source, host()).error
        expect(error('scales-for: G Xyz')).toContain('scales-for: G D Em C')
        expect(error('scales-for-notes: C H')).toContain('scales-for-notes: C D E G A')
        expect(error('scales-for: G C\nscale: C major')).toBe(
            'scales-for finds the scale itself: remove "scale"'
        )
        expect(error('scales-for: G C\nscales-for-notes: C')).toContain('not both')
        expect(error('scales-for:')).toContain('Add the chords')
    })
})
