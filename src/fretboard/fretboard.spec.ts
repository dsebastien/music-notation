import { describe, expect, it } from 'bun:test'
import { renderFretboard } from './fretboard.js'
import { parseTuning } from './tuning.js'
import { listNoteSet, scaleNoteSet } from '../theory/note-set.js'

describe('parseTuning', () => {
    it('knows named tunings', () => {
        expect(parseTuning('standard')).toEqual([40, 45, 50, 55, 59, 64])
        expect(parseTuning('Drop D')).toEqual([38, 45, 50, 55, 59, 64])
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
