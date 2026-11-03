import { describe, expect, it } from 'bun:test'
import {
    barreKind,
    baseFretOf,
    isBarreVoicing,
    parseFingers,
    parseFrets,
    renderGuitarDiagram
} from './guitar.js'
import { titleWidth } from '../render/layout.js'
import { accessibleName } from '../render/dom.js'

describe('frets and fingers', () => {
    it('reads compact and separated frets', () => {
        expect(parseFrets('x02220')).toEqual([null, 0, 2, 2, 2, 0])
        expect(parseFrets('x-10-12-12-11-10')).toEqual([null, 10, 12, 12, 11, 10])
        expect(parseFrets('3 2 0 0 0 3')).toEqual([3, 2, 0, 0, 0, 3])
        expect(parseFrets('x0222a')).toBeNull()
        expect(parseFrets('5')).toBeNull()
    })

    it('reads fingers, with 0 and x as none', () => {
        expect(parseFingers('x01230')).toEqual([null, null, '1', '2', '3', null])
        expect(parseFingers('x-1-3-4-2-1')).toEqual([null, '1', '3', '4', '2', '1'])
        expect(parseFingers('t 3 4 0 1 x')).toEqual(['T', '3', '4', null, '1', null])
    })

    it('starts at the first fret when the chord fits in four frets', () => {
        expect(baseFretOf([null, 0, 2, 2, 2, 0])).toBe(1)
        expect(baseFretOf([null, 10, 12, 12, 11, 10])).toBe(10)
        expect(baseFretOf([null, null, null, null, null, null])).toBe(1)
    })
})

describe('renderGuitarDiagram', () => {
    it('draws dots, open and muted strings, fingers and the root', () => {
        const el = renderGuitarDiagram(
            document,
            { frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, '1', '2', '3', null] },
            { title: 'A', root: 9 }
        )
        expect(el.querySelectorAll('.mn-dot')).toHaveLength(3)
        expect(el.querySelectorAll('.mn-open')).toHaveLength(2)
        // The muted string: an x drawn as two strokes, like the open circles.
        const muted = el.querySelector('.mn-muted')!
        expect(muted.tagName.toLowerCase()).toBe('path')
        expect(muted.getAttribute('data-mn-string')).toBe('6')
        expect(el.querySelector('.mn-nut')).not.toBeNull()
        expect([...el.querySelectorAll('.mn-dot-text')].map((t) => t.textContent)).toEqual([
            '1',
            '2',
            '3'
        ])
        // The open A string and the G string at the 2nd fret.
        expect(el.querySelectorAll('.mn-root')).toHaveLength(2)
        expect(accessibleName(el)).toBe('A chord diagram')
    })

    it('draws barres and the base fret up the neck', () => {
        const el = renderGuitarDiagram(document, {
            frets: [null, 10, 12, 12, 11, 10],
            fingers: [null, '1', '3', '4', '2', '1']
        })
        expect(el.querySelectorAll('.mn-barre')).toHaveLength(1)
        expect(el.querySelector('.mn-base-fret')?.textContent).toBe('10fr')
        expect(el.querySelector('.mn-nut')).toBeNull()
    })
})

describe('barres', () => {
    const texts = (el: Element) =>
        [...el.querySelectorAll('.mn-dot-text')].map((t) => t.textContent)

    it('draws one bar with one finger number, on its lowest string', () => {
        const f = renderGuitarDiagram(document, {
            frets: [1, 3, 3, 2, 1, 1],
            fingers: ['1', '3', '4', '2', '1', '1']
        })
        expect(f.querySelectorAll('.mn-barre')).toHaveLength(1)
        expect(f.querySelectorAll('.mn-dot')).toHaveLength(6)
        expect(texts(f)).toEqual(['1', '3', '4', '2'])
        const bm7 = renderGuitarDiagram(document, {
            frets: [null, 2, 4, 2, 3, 2],
            fingers: [null, '1', '3', '1', '2', '1']
        })
        expect(texts(bm7)).toEqual(['1', '3', '2'])
        // The label sits in the A string's dot.
        const label = bm7.querySelector('.mn-dot-text')!
        const dot = bm7.querySelector('[data-mn-string="5"]')!
        expect(label.getAttribute('x')).toBe(dot.getAttribute('cx'))
    })

    it('draws no bar joining dots labelled differently', () => {
        // A triad's 5 and R under one finger.
        const triad = renderGuitarDiagram(
            document,
            { frets: [null, null, null, 5, 5, 3], fingers: [null, null, null, '3', '3', '1'] },
            { labels: [null, null, null, '5', 'R', '3'] }
        )
        expect(triad.querySelectorAll('.mn-barre')).toHaveLength(0)
        expect(texts(triad)).toEqual(['5', 'R', '3'])
    })

    it('keeps a full barre with labels that differ, each dot labelled on the bar', () => {
        // F 133211 with notes: the index holds F, F, C, F.
        const f = renderGuitarDiagram(
            document,
            { frets: [1, 3, 3, 2, 1, 1], fingers: ['1', '3', '4', '2', '1', '1'] },
            { labels: ['F', 'C', 'F', 'A', 'C', 'F'] }
        )
        expect(f.querySelectorAll('.mn-barre')).toHaveLength(1)
        expect(texts(f)).toEqual(['F', 'C', 'F', 'A', 'C', 'F'])
        // The bar is drawn first, so the dots and their labels sit on it.
        const kids = [...f.children]
        const bar = kids.indexOf(f.querySelector('.mn-barre')!)
        const firstDot = kids.findIndex((k) => k.querySelector('.mn-dot'))
        expect(bar).toBeLessThan(firstDot)
        // Bm7 x24232 with intervals: the index lies over strings fretted higher.
        const bm7 = renderGuitarDiagram(
            document,
            { frets: [null, 2, 4, 2, 3, 2], fingers: [null, '1', '3', '1', '2', '1'] },
            { labels: [null, 'R', '5', 'b7', 'b3', '5'] }
        )
        expect(bm7.querySelectorAll('.mn-barre')).toHaveLength(1)
        expect(texts(bm7)).toEqual(['R', '5', 'b7', 'b3', '5'])
        // A small barre over the top strings (F xx3211) labelled differently stays two dots.
        const small = renderGuitarDiagram(
            document,
            { frets: [null, null, 3, 2, 1, 1], fingers: [null, null, '3', '2', '1', '1'] },
            { labels: [null, null, 'F', 'A', 'C', 'F'] }
        )
        expect(small.querySelectorAll('.mn-barre')).toHaveLength(0)
    })

    it('tells a full barre from a partial one', () => {
        const kind = (frets: (number | null)[], fingers: (string | null)[]) =>
            barreKind({ frets, fingers })
        expect(kind([1, 3, 3, 2, 1, 1], ['1', '3', '4', '2', '1', '1'])).toBe('full')
        expect(kind([null, 2, 4, 2, 3, 2], [null, '1', '3', '1', '2', '1'])).toBe('full')
        expect(kind([null, null, 3, 2, 1, 1], [null, null, '3', '2', '1', '1'])).toBe('partial')
        expect(kind([null, 3, 5, 5, 5, null], [null, '1', '3', '3', '3', null])).toBe('partial')
        expect(kind([null, null, null, 5, 5, 3], [null, null, null, '3', '3', '1'])).toBe('partial')
        expect(kind([null, 3, 2, 0, 1, 0], [null, '3', '2', null, '1', null])).toBeNull()
        expect(
            isBarreVoicing({
                frets: [1, 3, 3, 2, null, null],
                fingers: ['1', '3', '4', '2', null, null]
            })
        ).toBe(false)
        expect(
            isBarreVoicing({
                frets: [null, 3, 5, 5, 5, null],
                fingers: [null, '1', '3', '3', '3', null]
            })
        ).toBe(true)
    })

    it('keeps the bar when dots show nothing', () => {
        const el = renderGuitarDiagram(
            document,
            { frets: [1, 3, 3, 2, 1, 1], fingers: ['1', '3', '4', '2', '1', '1'] },
            { labels: [null, null, null, null, null, null] }
        )
        expect(el.querySelectorAll('.mn-barre')).toHaveLength(1)
        expect(texts(el)).toEqual([])
    })
})

describe('renderGuitarDiagram orientation', () => {
    const num = (el: Element | null | undefined, name: string) => Number(el?.getAttribute(name))
    const a = { frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, '1', '2', '3', null] }

    it('horizontal: strings across with the high string on top, the nut on the left', () => {
        const el = renderGuitarDiagram(document, a, { orientation: 'horizontal' })
        const nut = el.querySelector('.mn-nut')!
        expect(num(nut, 'x1')).toBe(num(nut, 'x2'))
        const strings = [...el.querySelectorAll('.mn-string')]
        expect(num(strings[0], 'y1')).toBe(num(strings[0], 'y2'))
        // The low string (first) is at the bottom.
        expect(num(strings[0], 'y1')).toBeGreaterThan(num(strings[5], 'y1'))
        // The muted mark sits left of the nut.
        const mutedX = Number(
            /^M([\d.]+)/.exec(el.querySelector('.mn-muted')!.getAttribute('d')!)![1]
        )
        expect(mutedX).toBeLessThan(num(nut, 'x1'))
    })

    it('horizontal: the base fret goes under the first fret', () => {
        const el = renderGuitarDiagram(
            document,
            { frets: [null, 10, 12, 12, 11, 10], fingers: [null, '1', '3', '4', '2', '1'] },
            { orientation: 'horizontal' }
        )
        const strings = [...el.querySelectorAll('.mn-string')]
        expect(num(el.querySelector('.mn-base-fret'), 'y')).toBeGreaterThan(num(strings[0], 'y1'))
        // The barre spans the strings vertically.
        const barre = el.querySelector('.mn-barre')!
        expect(num(barre, 'height')).toBeGreaterThan(num(barre, 'width'))
    })

    it('left-handed: the low string on the right, the base fret too', () => {
        const el = renderGuitarDiagram(
            document,
            { frets: [null, 10, 12, 12, 11, 10], fingers: [null, '1', '3', '4', '2', '1'] },
            { hand: 'left' }
        )
        const strings = [...el.querySelectorAll('.mn-string')]
        expect(num(strings[0], 'x1')).toBeGreaterThan(num(strings[5], 'x1'))
        expect(num(el.querySelector('.mn-base-fret'), 'x')).toBeGreaterThan(num(strings[0], 'x1'))
    })

    it('makes room for a long title', () => {
        const el = renderGuitarDiagram(document, a, { title: 'A major, open position' })
        expect(num(el, 'width')).toBe(titleWidth('A major, open position'))
    })
})
