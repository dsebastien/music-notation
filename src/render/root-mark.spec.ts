import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'
import { parseRootMark, rootMarkInBlock, rootMarkOf, withRootMark } from './root-mark.js'
import { dataOf, redrawFor } from '../playback/controls.js'
import { renderGuitarDiagram } from '../chord/guitar.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

/** #14: the root as a shape too, so it doesn't rest on color alone. */
const block = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    return renderBlock(language, source, host, options)
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('root-mark values', () => {
    it('reads color (colour) and shape in any case', () => {
        expect(rootMarkOf('Shape')).toBe('shape')
        expect(rootMarkOf(' colour ')).toBe('color')
        expect(rootMarkOf('square')).toBeNull()
        expect(rootMarkOf(3)).toBeNull()
        expect(() => parseRootMark('square')).toThrow(
            'root-mark: write color or shape, got "square"'
        )
    })

    it('takes the line out of the block, the last one winning', () => {
        expect(rootMarkInBlock('chord', 'A x02220\nroot-mark: color\nRoot-Mark: shape')).toEqual({
            text: 'A x02220',
            mark: 'shape'
        })
        expect(rootMarkInBlock('chord', 'A x02220')).toEqual({ text: 'A x02220', mark: null })
        // Charts, patterns and the circle don't read it.
        expect(rootMarkInBlock('strum', 'root-mark: shape').mark).toBeNull()
    })
})

describe('root as a shape in blocks', () => {
    it('changes nothing without the option or the key', () => {
        const r = block('chord', 'A x02220 x01230')
        expect(r.el.hasAttribute('data-mn-root-mark')).toBe(false)
        expect(r.el.querySelector('.mn-root-shape, .mn-root-mark')).toBeNull()
        expect(r.el.querySelectorAll('circle.mn-dot').length).toBe(3)
        expect(r.el.querySelector('circle.mn-open.mn-root')).not.toBeNull()
    })

    it('draws a chord diagram root as a rounded square, its label inside', () => {
        // G 320003: roots on strings 6 (fret 3), 3 (open) and 1 (fret 3).
        const r = block('chord', 'G 320003 210003\nroot-mark: shape')
        expect(r.ok).toBe(true)
        expect(r.el.getAttribute('data-mn-root-mark')).toBe('shape')
        const squares = [...r.el.querySelectorAll('rect.mn-dot.mn-root.mn-root-shape')]
        expect(squares.map((s) => s.getAttribute('data-mn-string'))).toEqual(['6', '1'])
        // Same data as the circle: playback and tools still find the note.
        expect(squares[0]!.getAttribute('data-midi')).toBe('43')
        expect(squares[0]!.getAttribute('data-mn-fret')).toBe('3')
        // The finger label still follows it (the dot's sibling selectors work).
        expect(squares[0]!.nextElementSibling?.classList.contains('mn-dot-text')).toBe(true)
        // The open G string: a square ring.
        expect(r.el.querySelector('rect.mn-open.mn-root.mn-root-shape')).not.toBeNull()
        // Other dots stay circles.
        expect(r.el.querySelectorAll('circle.mn-dot').length).toBe(1)
    })

    it('draws fretboard roots as squares, passing-tone roots too', () => {
        const r = block('fretboard', 'A minor pentatonic\nfrets: 5-8', { rootMark: 'shape' })
        const roots = r.el.querySelectorAll('.mn-dot.mn-root')
        expect(roots.length).toBeGreaterThan(0)
        for (const root of roots) expect(root.tagName.toLowerCase()).toBe('rect')
        expect(r.el.querySelectorAll('circle.mn-dot:not(.mn-root)').length).toBeGreaterThan(0)
        const over = block('fretboard', 'scale: A minor\nchord: Am\nfrets: 5-8', {
            rootMark: 'shape'
        })
        expect(over.ok).toBe(true)
        for (const root of over.el.querySelectorAll('.mn-dot.mn-root'))
            expect(root.tagName.toLowerCase()).toBe('rect')
    })

    it('puts a small square on a keyboard root key, after its label, never taking clicks', () => {
        const r = block('keyboard', 'C major\nrange: C4-B4', { rootMark: 'shape' })
        const marks = [...r.el.querySelectorAll('rect.mn-root-mark')]
        expect(marks.map((m) => m.getAttribute('data-mn-key'))).toEqual(['60'])
        expect(marks[0]!.getAttribute('pointer-events')).toBe('none')
        expect(marks[0]!.previousElementSibling?.classList.contains('mn-key-label')).toBe(true)
        // The key keeps its color class.
        expect(r.el.querySelector('rect.mn-key-white.mn-root[data-midi="60"]')).not.toBeNull()
        // A black key root.
        const black = block('keyboard', 'F# major\nrange: C4-B4', { rootMark: 'shape' })
        expect(
            [...black.el.querySelectorAll('rect.mn-root-mark')].map((m) =>
                m.getAttribute('data-mn-key')
            )
        ).toEqual(['66'])
    })

    it('lets the block key win over the app, for a whole row', () => {
        const off = block('chord', 'A x02220\nroot-mark: color', { rootMark: 'shape' })
        expect(off.el.querySelector('.mn-root-shape')).toBeNull()
        const row = block('chord', 'root-mark: shape\n---\nA x02220\n---\nE 022100')
        expect(row.ok).toBe(true)
        expect(row.el.querySelectorAll('svg.mn-guitar-chord').length).toBe(2)
        for (const svg of row.el.querySelectorAll('svg.mn-guitar-chord'))
            expect(svg.querySelector('.mn-root-shape')).not.toBeNull()
    })

    it('says what to write for another value', () => {
        const r = block('chord', 'A x02220\nroot-mark: square')
        expect(r.ok).toBe(false)
        expect(r.error).toBe('root-mark: write color or shape, got "square"')
    })

    it('reaches progression diagrams', () => {
        const r = block('progression', 'I IV V\nkey: G\nroot-mark: shape')
        expect(r.ok).toBe(true)
        expect(r.el.querySelector('.mn-root-shape')).not.toBeNull()
    })

    it('keeps the shape when a diagram is redrawn for the other instrument', () => {
        const r = block('chord', 'A x02220\nroot-mark: shape')
        const svg = r.el.querySelector('svg.mn-guitar-chord')!
        const redrawn = redrawFor(document, svg, dataOf(svg)!)
        expect(redrawn?.querySelector('rect.mn-root-mark')).not.toBeNull()
    })

    it('draws under withRootMark for apps that call the renderers', () => {
        const shaped = withRootMark('shape', () =>
            renderGuitarDiagram(
                document,
                { frets: [null, 0, 2, 2, 2, 0], fingers: [] },
                { root: 9 }
            )
        )
        expect(shaped.querySelector('rect.mn-open.mn-root')).not.toBeNull()
        const plain = renderGuitarDiagram(
            document,
            { frets: [null, 0, 2, 2, 2, 0], fingers: [] },
            { root: 9 }
        )
        expect(plain.querySelector('.mn-root-shape')).toBeNull()
    })
})
