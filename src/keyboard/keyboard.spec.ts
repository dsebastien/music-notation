import { describe, expect, it } from 'bun:test'
import {
    keyRangeOf,
    parseKeyRange,
    renderKeyboard,
    scaleKeysFrom,
    scaleTonicOf
} from './keyboard.js'
import { chordNoteSet, listNoteSet, scaleNoteSet } from '../theory/note-set.js'

describe('keyboard ranges', () => {
    it('reads note ranges', () => {
        expect(parseKeyRange('C3-B4')).toEqual([48, 71])
        expect(parseKeyRange('C#3 - Bb4')).toEqual([49, 70])
        expect(parseKeyRange('B4-C3')).toBeNull()
        expect(parseKeyRange('C3')).toBeNull()
        expect(parseKeyRange('C3-B4-C6')).toBeNull()
    })

    it('covers whole octaves around exact pitches, two octaves otherwise', () => {
        expect(keyRangeOf(listNoteSet('A3 C#4 E4')!)).toEqual([48, 71])
        expect(keyRangeOf(chordNoteSet('Cmaj7')!)).toEqual([60, 83])
        expect(keyRangeOf(listNoteSet('C E G')!)).toEqual([60, 83])
    })

    it('draws a scale over two octaves, tonic to tonic, nearest middle C', () => {
        expect(keyRangeOf(scaleNoteSet('C major')!)).toEqual([60, 84])
        expect(keyRangeOf(scaleNoteSet('D dorian')!)).toEqual([62, 86])
        expect(keyRangeOf(scaleNoteSet('F# major')!)).toEqual([66, 90])
        // From G, the tonic below middle C.
        expect(keyRangeOf(scaleNoteSet('G major')!)).toEqual([55, 79])
        expect(keyRangeOf(scaleNoteSet('A minor pentatonic')!)).toEqual([57, 81])
        expect(scaleTonicOf(scaleNoteSet('C major')!, -1)).toBe(48)
        expect(scaleTonicOf(chordNoteSet('C')!)).toBeNull()
        expect(scaleKeysFrom(scaleNoteSet('C major pentatonic')!, 60)).toEqual([
            60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84
        ])
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

    it('lights a scale without a range from its tonic to the tonic two octaves up', () => {
        const el = renderKeyboard(document, scaleNoteSet('F# major')!)
        const whites = [...el.querySelectorAll('.mn-key-white')].map((k) =>
            k.getAttribute('data-midi')
        )
        // From the white key below F#4 to the white key above F#6.
        expect([whites[0], whites.at(-1)]).toEqual(['65', '91'])
        // F4 is the scale's E#, but it lies below the tonic: unlit, unplayed.
        expect(el.querySelector('[data-midi="65"]')?.getAttribute('class')).not.toContain('mn-on')
        const played = el.getAttribute('data-mn-pitches')!.split(' ').map(Number)
        expect([played[0], played.at(-1), played.length]).toEqual([66, 90, 15])
        // With a range, every octave stays lit.
        const ranged = renderKeyboard(document, scaleNoteSet('F# major')!, { range: [65, 77] })
        expect(ranged.querySelector('[data-midi="65"]')?.getAttribute('class')).toContain('mn-on')
    })

    it('draws faint notes only between the tonics of a scale drawn tonic to tonic', () => {
        // F# dorian against F# major: E# is faint, but not on the F4 key below the tonic.
        const el = renderKeyboard(document, scaleNoteSet('F# dorian')!, {
            marks: { ghosts: new Set([5]) }
        })
        expect(el.querySelector('[data-midi="65"]')?.getAttribute('class')).not.toContain(
            'mn-ghost'
        )
        expect(el.querySelector('[data-midi="77"]')?.getAttribute('class')).toContain('mn-ghost')
    })

    it('extends a range that starts or ends on a black key to the next white key', () => {
        // C#4-A#4 becomes C4-B4.
        const el = renderKeyboard(document, listNoteSet('C4')!, { range: [61, 70] })
        expect(el.querySelectorAll('.mn-key-white')).toHaveLength(7)
    })
})

describe('renderKeyboard orientation', () => {
    const num = (el: Element | null | undefined, name: string) => Number(el?.getAttribute(name))

    it('vertical: low notes at the bottom, black keys on the left', () => {
        const el = renderKeyboard(document, scaleNoteSet('C major')!, {
            range: [60, 71],
            orientation: 'vertical'
        })
        const whites = [...el.querySelectorAll('.mn-key-white')]
        // C (the lowest) is below B (the highest).
        expect(num(whites[0], 'y')).toBeGreaterThan(num(whites[6], 'y'))
        const black = el.querySelector('.mn-key-black')!
        expect(num(black, 'x')).toBe(num(whites[0], 'x'))
        expect(num(black, 'width')).toBeLessThan(num(whites[0], 'width'))
        expect(num(whites[0], 'height')).toBe(22)
    })
})
