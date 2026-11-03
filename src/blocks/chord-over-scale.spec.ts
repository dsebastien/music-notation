import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { describeBlock } from '../cli/describe.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

const classesOf = (h: HTMLElement, note: string) =>
    [...h.querySelectorAll(`[data-mn-note="${note}"][data-midi]`)].map((el) =>
        el.getAttribute('class')
    )

describe('a chord over a scale', () => {
    it('keeps the scale and marks the chord tones on a fretboard', () => {
        const h = host()
        const result = renderBlock('fretboard', 'scale: A minor pentatonic\nchord: Am7', h)
        expect(result.error).toBeNull()
        const svg = h.querySelector('svg')!
        expect(svg.getAttribute('data-mn-set')).toBe('A minor pentatonic')
        // Every scale note is still drawn: A C D E G.
        expect(
            new Set(
                [...h.querySelectorAll('[data-mn-note]')].map((e) => e.getAttribute('data-mn-note'))
            )
        ).toEqual(new Set(['A', 'C', 'D', 'E', 'G']))
        expect(classesOf(h, 'C')[0]).toBe('mn-dot mn-tone')
        expect(classesOf(h, 'D')[0]).toBe('mn-dot mn-passing')
        expect(classesOf(h, 'A')[0]).toBe('mn-dot mn-root mn-tone')
        expect(svg.getAttribute('aria-label')).toContain('chord tones: A C E G')
    })

    it('marks the chord tones on a keyboard; the scale root keeps its color', () => {
        const h = host()
        renderBlock('keyboard', 'scale: C major\nchord: G7', h)
        expect(classesOf(h, 'C')[0]).toBe('mn-key-white mn-on mn-root mn-passing')
        expect(classesOf(h, 'F')[0]).toBe('mn-key-white mn-on mn-tone')
        expect(classesOf(h, 'E')[0]).toBe('mn-key-white mn-on mn-passing')
    })

    it('draws chord tones outside the scale faint', () => {
        const h = host()
        renderBlock('fretboard', 'scale: A minor pentatonic\nchord: A7', h)
        const ghosts = [...h.querySelectorAll('.mn-ghost')].map((e) =>
            e.getAttribute('data-mn-note')
        )
        expect(new Set(ghosts)).toEqual(new Set(['C#']))
        // The scale's C is a passing note under A7.
        expect(classesOf(h, 'C')[0]).toBe('mn-dot mn-passing')
    })

    it('names chord tones and passing notes for the check command', () => {
        const { el } = renderBlock('keyboard', 'scale: C major\nchord: C\nrange: C4-B4', host())
        const [keyboard] = describeBlock(el)
        expect(keyboard!.type === 'keyboard' && keyboard!.keys.map((k) => k.marks.join())).toEqual([
            'chord tone',
            'passing',
            'chord tone',
            'passing',
            'chord tone',
            'passing',
            'passing'
        ])
    })

    it('marks the chord tones inside a scale position, and in every position of a row', () => {
        const h = host()
        const one = renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nchord: Am7\nposition: 1',
            h
        )
        expect(one.error).toBeNull()
        expect(h.querySelector('svg')!.getAttribute('data-mn-frets')).toBe('5-8')
        expect(h.querySelectorAll('.mn-tone').length).toBeGreaterThan(0)
        expect(h.querySelectorAll('.mn-passing').length).toBeGreaterThan(0)
        const row = host()
        const result = renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nchord: Am7\npositions: all',
            row
        )
        expect(result.error).toBeNull()
        const diagrams = [...row.querySelectorAll('svg')]
        expect(diagrams).toHaveLength(5)
        for (const d of diagrams) {
            expect(d.getAttribute('data-mn-set')).toBe('A minor pentatonic')
            expect(d.querySelector('.mn-dot.mn-passing')).not.toBeNull()
        }
    })

    it('leaves chord and arpeggio positions without a scale alone (#20)', () => {
        const h = host()
        const result = renderBlock('fretboard', 'chord: Am7\nposition: 1', h)
        expect(result.error).toBeNull()
        expect(h.querySelector('.mn-tone, .mn-passing')).toBeNull()
        const row = host()
        renderBlock('fretboard', 'arpeggio: Am7\npositions: all', row)
        expect(row.querySelectorAll('svg')).toHaveLength(5)
        expect(row.querySelector('.mn-tone, .mn-passing')).toBeNull()
        expect(row.querySelector('.mn-title')?.textContent).toContain('arpeggio')
    })

    it('reads arpeggio: with scale: as the chord over the scale', () => {
        const h = host()
        renderBlock('fretboard', 'scale: C major\narpeggio: G7\nfrets: 0-5', h)
        expect(h.querySelector('svg')!.getAttribute('data-mn-set')).toBe('C major')
        expect(classesOf(h, 'F')[0]).toContain('mn-tone')
        expect(classesOf(h, 'E')[0]).toContain('mn-passing')
    })

    it('says when the chord does not read', () => {
        expect(renderBlock('keyboard', 'scale: C major\nchord: Hm', host()).error).toBe(
            'Unknown chord "Hm": use e.g. chord: Am7'
        )
    })

    it('leaves a chord alone without a scale', () => {
        const h = host()
        renderBlock('keyboard', 'chord: G7', h)
        expect(h.querySelector('.mn-tone, .mn-passing')).toBeNull()
    })
})
