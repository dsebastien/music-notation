import { describe, expect, it } from 'bun:test'
import { parseChord } from './chord-symbol.js'

describe('parseChord', () => {
    it('spells chord symbols out in ASCII', () => {
        expect(parseChord('F#m7')).toMatchObject({
            root: 'F#',
            quality: 'Minor 7',
            name: 'F Sharp Minor 7'
        })
        expect(parseChord('A')?.name).toBe('A Major')
        expect(parseChord('Bb7')?.name).toBe('B Flat 7')
        expect(parseChord('C/G')).toMatchObject({ bass: 'G', name: 'C Major over G' })
        expect(parseChord('E5')?.name).toBe('E 5')
        expect(parseChord('Bm7b5')?.quality).toBe('Minor 7 flat 5')
        expect(parseChord('F♯m')?.name).toBe('F Sharp Minor')
        expect(parseChord('C6/9')).toMatchObject({ quality: '6/9', bass: null })
        expect(parseChord('Cm(maj7)')?.quality).toBe('Minor major 7')
        expect(parseChord('C7b9')).toMatchObject({ quality: '7b9', name: 'C 7b9' })
        expect(parseChord('Cm11')?.quality).toBe('m11')
    })

    it('reads double sharps and double flats', () => {
        expect(parseChord('F##dim')).toMatchObject({
            root: 'F##',
            quality: 'Diminished',
            name: 'F Double Sharp Diminished'
        })
        expect(parseChord('Fxdim')?.root).toBe('F##')
        expect(parseChord('C##dim7')?.quality).toBe('Diminished 7')
        expect(parseChord('Ebbm7/Bbb')).toMatchObject({ root: 'Ebb', bass: 'Bbb' })
        expect(parseChord('Bbb')?.name).toBe('B Double Flat Major')
        // The longest accidental is the root's, as a single flat is (Cb5 is a C♭ power chord).
        expect(parseChord('Cbb5')?.name).toBe('C Double Flat 5')
        expect(parseChord('C(#5)')?.root).toBe('C')
    })

    it('rejects what is not a chord symbol', () => {
        expect(parseChord('Hello')).toBeNull()
        expect(parseChord('Cxyz')).toBeNull()
    })
})
