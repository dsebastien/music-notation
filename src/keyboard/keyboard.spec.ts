import { describe, expect, it } from 'bun:test'
import { keyRangeOf, parseKeyRange, renderKeyboard } from './keyboard'
import { chordNoteSet, listNoteSet, scaleNoteSet } from '../theory/note-set'

describe('keyboard ranges', () => {
    it('reads note ranges', () => {
        expect(parseKeyRange('C3-B4')).toEqual([48, 71])
        expect(parseKeyRange('C#3 - Bb4')).toEqual([49, 70])
        expect(parseKeyRange('B4-C3')).toBeNull()
        expect(parseKeyRange('C3')).toBeNull()
    })

    it('covers whole octaves around exact pitches, two octaves otherwise', () => {
        expect(keyRangeOf(listNoteSet('A3 C#4 E4')!)).toEqual([48, 71])
        expect(keyRangeOf(scaleNoteSet('C major')!)).toEqual([60, 83])
    })
})

describe('renderKeyboard', () => {
    it('highlights exact pitches only', () => {
        const el = renderKeyboard(document, listNoteSet('C4 E4 G4')!, { range: [60, 71] })
        expect(el.querySelectorAll('.mn-key-white')).toHaveLength(7)
        expect(el.querySelectorAll('.mn-key-black')).toHaveLength(5)
        expect(el.querySelectorAll('.mn-on')).toHaveLength(3)
        expect([...el.querySelectorAll('.mn-key-label')].map((l) => l.textContent)).toEqual([
            'C',
            'E',
            'G'
        ])
    })

    it('highlights pitch classes in every octave and marks the root', () => {
        const el = renderKeyboard(document, chordNoteSet('Cmaj7')!, { label: 'degrees' })
        expect(el.querySelectorAll('.mn-on')).toHaveLength(8)
        expect(el.querySelectorAll('.mn-root')).toHaveLength(2)
    })

    it('labels black keys and fingers', () => {
        const set = listNoteSet('A3 C#4 E4')!
        const el = renderKeyboard(document, set, {
            label: 'fingers',
            fingers: new Map([
                [57, '1'],
                [61, '3'],
                [64, '5']
            ])
        })
        expect(el.querySelectorAll('.mn-key-label-black')).toHaveLength(1)
        expect([...el.querySelectorAll('.mn-key-label')].map((l) => l.textContent).sort()).toEqual([
            '1',
            '3',
            '5'
        ])
    })

    it('extends a range that starts or ends on a black key to the next white key', () => {
        // C#4-A#4 becomes C4-B4.
        const el = renderKeyboard(document, listNoteSet('C4')!, { range: [61, 70] })
        expect(el.querySelectorAll('.mn-key-white')).toHaveLength(7)
    })
})
