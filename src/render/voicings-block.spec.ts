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
        expect(error('A\nvoicings: all\nfrets: x02220')).toContain('remove "frets"')
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

    it('refuses keys that would fight the generated frets, and says which filter to change', () => {
        const error = (source: string) => renderBlock('chord', source, host()).error
        expect(error('A\nvoicings: 3\nposition: 3')).toBe(
            'voicings finds the frets itself: remove "position"'
        )
        expect(error('A\nvoicings: 3\nnotes: A C# E')).toBe(
            'voicings are for guitar and other fretted instruments'
        )
        expect(error('A Major x02220\nvoicings: 3')).toBe(
            'voicings finds the frets itself: remove "x02220"'
        )
        expect(error('A\nvoicings: 3\ninstrument: ukulele')).toBe(
            'Unknown instrument "ukulele": use guitar, or give a tuning'
        )
        expect(error('C\nvoicings: all\nstrings: 1 2 4')).toBe(
            "strings 1 2 4 aren't next to each other: add gaps: yes"
        )
        expect(error('C\nvoicings: all\nstrings: 1-3\nroot-string: 6')).toBe(
            "root-string 6 isn't among strings 1 2 3"
        )
        expect(error('C\nvoicings: all\ninversion: 3')).toBe(
            'C has 3 notes: inversion goes up to 2'
        )
        expect(error('C\nvoicings: all\nroot-string: 1')).toContain('try another root-string')
        expect(
            error('C\nvoicings: all\ntuning: B1 E2 A2 D3 G3 B3 E4 A4\ninversion: any')
        ).toContain('six strings or fewer')
        expect(
            error('C\nvoicings: all\ntuning: B1 E2 A2 D3 G3 B3 E4 A4\ngaps: yes\nstretch: yes')
        ).toBe('On 8 strings, use one of gaps, stretch at a time')
    })

    it('titles the row with the block title, and reads area 0 as the nut', () => {
        const h = host()
        expect(renderBlock('chord', 'A\nvoicings: 2\ntitle: My A', h).ok).toBe(true)
        expect(titles(h)[0]).toBe('My A, Open')
        expect(renderBlock('chord', 'A\nvoicings: 2\narea: 0-3', host()).ok).toBe(true)
    })

    it('plays ukulele chords from the tuning', () => {
        const h = host()
        expect(renderBlock('chord', 'F\nvoicings: 1\ntuning: ukulele', h).ok).toBe(true)
        expect(h.querySelectorAll('.mn-dot')).toHaveLength(2)
    })
})
