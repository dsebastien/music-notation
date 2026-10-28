import { describe, expect, it } from 'bun:test'
import { baseFretOf, parseFingers, parseFrets, renderGuitarDiagram } from './guitar'

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
        expect(el.querySelector('.mn-muted')?.textContent).toBe('×')
        expect(el.querySelector('.mn-nut')).not.toBeNull()
        expect([...el.querySelectorAll('.mn-dot-text')].map((t) => t.textContent)).toEqual([
            '1',
            '2',
            '3'
        ])
        // The open A string and the G string at the 2nd fret.
        expect(el.querySelectorAll('.mn-root')).toHaveLength(2)
        expect(el.getAttribute('aria-label')).toBe('A chord diagram')
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
