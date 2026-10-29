import { describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'

const host = () => document.createElement('div')
const titles = (h: HTMLElement) => [...h.querySelectorAll('.mn-title')].map((t) => t.textContent)
const cells = (h: HTMLElement) => h.querySelectorAll('.mn-cell svg')

describe('voicings blocks', () => {
    it('draws the easiest voicings of a chord in a row', () => {
        const h = host()
        const result = renderBlock('chord', 'A Major\nvoicings: 4', h)
        expect(result.ok).toBe(true)
        expect(cells(h)).toHaveLength(4)
        expect(titles(h)[0]).toBe('A Major, Open')
        // Root marks come from the chord.
        expect(h.querySelector('.mn-root')).not.toBeNull()
    })

    it('draws at most 32 with all', () => {
        const h = host()
        expect(renderBlock('chord', 'chord: Em\nvoicings: all', h).ok).toBe(true)
        expect(cells(h)).toHaveLength(32)
    })

    it('filters by area, root string, strings and inversion', () => {
        const area = host()
        expect(renderBlock('chord', 'A\nvoicings: all\narea: 5-9\nopen: no', area).ok).toBe(true)
        expect(area.querySelectorAll('.mn-open')).toHaveLength(0)
        const root = host()
        expect(renderBlock('chord', 'C\nvoicings: 3\nroot-string: 6', root).ok).toBe(true)
        expect(titles(root)[0]).toBe('C, E-shape barre')
        const triads = host()
        expect(renderBlock('chord', 'G\nvoicings: all\nstrings: 1-3', triads).ok).toBe(true)
        expect(titles(triads)[0]).toBe('G, Triad')
        expect(triads.querySelectorAll('.mn-cell svg').length).toBeGreaterThan(1)
        const inversion = host()
        expect(renderBlock('chord', 'C\nvoicings: 2\ninversion: 1', inversion).ok).toBe(true)
        expect(renderBlock('chord', 'C\nvoicings: 2\nstretch: yes\ngaps: yes', host()).ok).toBe(
            true
        )
    })

    it('shares layout keys and columns across the row', () => {
        const h = host()
        const result = renderBlock(
            'chord',
            'D\nvoicings: 4\ncolumns: 2\norientation: horizontal\nhand: left',
            h
        )
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-grid.mn-cols-2')).not.toBeNull()
        expect(cells(h)).toHaveLength(4)
    })

    it('uses the block tuning', () => {
        const h = host()
        expect(renderBlock('chord', 'C\nvoicings: 3\ntuning: ukulele', h).ok).toBe(true)
        expect(h.querySelectorAll('.mn-cell svg .mn-string').length).toBe(12)
    })

    it('says what to change', () => {
        const error = (source: string) => renderBlock('chord', source, host()).error
        expect(error('voicings: all')).toBe('voicings needs a chord: e.g. A Major')
        expect(error('A Majr\nvoicings: all')).toContain('Didn\'t recognize "A Majr"')
        expect(error('A\nvoicings: 0')).toBe('voicings: use all, or a number from 1 to 32')
        expect(error('A\nvoicings: all\nfrets: x02220')).toContain('remove frets')
        expect(error('A\nvoicings: all\ninstrument: piano')).toContain('fretted instruments')
        expect(error('A\nvoicings: all\narea: 9-5')).toContain('area: use open')
        expect(error('A\nvoicings: all\nroot-string: 7')).toContain('root-string')
        expect(error('A\nvoicings: all\nstrings: 0-3')).toContain('strings:')
        expect(error('A\nvoicings: all\ninversion: 5')).toContain('inversion:')
        expect(error('A\nvoicings: all\nstretch: maybe')).toBe(
            'stretch must be yes or no, got "maybe"'
        )
        expect(error('A\nvoicings: all\ntuning: E A D G B E A D G')).toContain('up to 8 strings')
        expect(error('Am7\nvoicings: all\nstrings: 1-2')).toContain('No playable voicing')
        expect(error('A\n---\nD\nvoicings: all')).toContain('draws its own row')
    })
})
