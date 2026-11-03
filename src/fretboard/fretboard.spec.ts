import { describe, expect, it } from 'bun:test'
import { renderFretboard } from './fretboard.js'
import { parseTuning } from './tuning.js'
import { listNoteSet, scaleNoteSet } from '../theory/note-set.js'

describe('parseTuning', () => {
    it('knows named tunings', () => {
        expect(parseTuning('standard')).toEqual([40, 45, 50, 55, 59, 64])
        expect(parseTuning('Drop D')).toEqual([38, 45, 50, 55, 59, 64])
    })

    it('knows the drop, open and lowered tunings (#54)', () => {
        expect(parseTuning('Drop C')).toEqual([36, 43, 48, 53, 57, 62]) // C G C F A D
        expect(parseTuning('Drop B')).toEqual([35, 42, 47, 52, 56, 61]) // B F# B E G# C#
        expect(parseTuning('Drop A')).toEqual([33, 40, 45, 50, 54, 59]) // A E A D F# B
        expect(parseTuning('Double Drop D')).toEqual([38, 45, 50, 55, 59, 62]) // D A D G B D
        expect(parseTuning('Open C')).toEqual([36, 43, 48, 55, 60, 64]) // C G C G C E
        expect(parseTuning('Open A')).toEqual([40, 45, 52, 57, 61, 64]) // E A E A C# E
        expect(parseTuning('Whole step down')).toEqual([38, 43, 48, 53, 57, 62]) // D G C F A D
        expect(parseTuning('Modal C6')).toEqual([36, 45, 48, 55, 60, 64]) // C A C G C E
        expect(parseTuning('C6')).toEqual(parseTuning('Modal C6'))
    })

    it('reads explicit pitches and letters', () => {
        expect(parseTuning('E2 A2 D3 G3 B3 E4')).toEqual([40, 45, 50, 55, 59, 64])
        expect(parseTuning('DADGAD')).toEqual([38, 45, 50, 55, 57, 62])
        expect(parseTuning('EADGBE')).toEqual([40, 45, 50, 55, 59, 64])
        expect(parseTuning('EbAbDbGbBbEb')).toEqual([39, 44, 49, 54, 58, 63])
        expect(parseTuning('E A D G')).toEqual([40, 45, 50, 55])
    })

    it('reads lowercase letters as notes, not flats', () => {
        expect(parseTuning('eadgbe')).toEqual([40, 45, 50, 55, 59, 64])
    })

    it('refuses what is not a tuning', () => {
        expect(parseTuning('constructor')).toBeNull()
        expect(parseTuning('__proto__')).toBeNull()
        expect(parseTuning('hello')).toBeNull()
        expect(parseTuning('E')).toBeNull()
        expect(parseTuning('EXDG')).toBeNull()
    })
})

describe('renderFretboard', () => {
    it('places every note of the scale in the range', () => {
        const el = renderFretboard(document, scaleNoteSet('A minor pentatonic')!, { frets: [5, 8] })
        // The box shape: two notes per string.
        expect(el.querySelectorAll('.mn-dot')).toHaveLength(12)
        expect(el.querySelectorAll('.mn-root')).toHaveLength(3)
        expect(el.querySelector('.mn-nut')).toBeNull()
        expect([...el.querySelectorAll('.mn-fret-number')].map((n) => n.textContent)).toEqual([
            '5',
            '6',
            '7',
            '8'
        ])
    })

    it('shows open strings and the nut from fret 0', () => {
        const el = renderFretboard(document, listNoteSet('E')!, { frets: [0, 3] })
        expect(el.querySelector('.mn-nut')).not.toBeNull()
        // Open low and high E, and the D string at the 2nd fret.
        expect(el.querySelectorAll('.mn-dot')).toHaveLength(3)
        expect([...el.querySelectorAll('.mn-string-name')].map((n) => n.textContent)).toEqual([
            'E',
            'B',
            'G',
            'D',
            'A',
            'E'
        ])
    })

    it('draws the double inlay at the 12th fret', () => {
        const el = renderFretboard(document, listNoteSet('C')!, { frets: [11, 13] })
        expect(el.querySelectorAll('.mn-inlay')).toHaveLength(2)
    })
})

describe('inlays', () => {
    const inlayFrets = (el: Element) =>
        [...el.querySelectorAll('.mn-inlay')].map((c) => {
            const x = Number(c.getAttribute('cx'))
            const numbers = [...el.querySelectorAll('.mn-fret-number')]
            return numbers.find((n) => Math.abs(Number(n.getAttribute('x')) - x) < 1)?.textContent
        })

    it('leaves out an inlay that a note dot would cover in part', () => {
        // A minor pentatonic: only at the 3rd fret do the D and G strings (either side of the
        // inlay) have no note; at the 12th, the outer strings have notes.
        const el = renderFretboard(document, scaleNoteSet('A minor pentatonic')!, {
            frets: [0, 12]
        })
        expect(inlayFrets(el)).toEqual(['3'])
        // With no notes there, every inlay shows.
        const empty = renderFretboard(document, listNoteSet('F#')!, { frets: [0, 12] })
        expect(inlayFrets(empty)).toEqual(['3', '5', '7', '9', '12', '12'])
    })
})

describe('renderFretboard orientation', () => {
    const num = (el: Element | null | undefined, name: string) => Number(el?.getAttribute(name))
    const scale = () => scaleNoteSet('A minor pentatonic')!

    it('vertical: the nut on top, the low string on the left, names above the nut', () => {
        const el = renderFretboard(document, scale(), { frets: [0, 5], orientation: 'vertical' })
        const nut = el.querySelector('.mn-nut')!
        expect(num(nut, 'y1')).toBe(num(nut, 'y2'))
        const strings = [...el.querySelectorAll('.mn-string')]
        // Drawn highest string first: the last one is the low E, on the left.
        expect(num(strings[5], 'x1')).toBeLessThan(num(strings[0], 'x1'))
        expect(num(el.querySelector('.mn-string-name'), 'y')).toBeLessThan(num(nut, 'y1'))
        const [, , w, h] = el.getAttribute('viewBox')!.split(' ').map(Number)
        expect(h).toBeGreaterThan(w!)
    })

    it('left-handed: the nut on the right', () => {
        const right = renderFretboard(document, scale(), { frets: [0, 5] })
        const left = renderFretboard(document, scale(), { frets: [0, 5], hand: 'left' })
        const nutX = (el: Element) => num(el.querySelector('.mn-nut'), 'x1')
        expect(nutX(left)).toBeGreaterThan(nutX(right))
        const numbers = (el: Element) =>
            [...el.querySelectorAll('.mn-fret-number')].map((n) => num(n, 'x'))
        // Fret numbers grow towards the left.
        expect(numbers(left)[0]).toBeGreaterThan(numbers(left)[4]!)
    })
})
