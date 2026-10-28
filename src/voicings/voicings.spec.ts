import { describe, expect, it } from 'bun:test'
import { lookupGuitarVoicing, voicingCount } from './index.js'

describe('lookupGuitarVoicing', () => {
    it('finds open chords with absolute frets', () => {
        expect(lookupGuitarVoicing('A', 0)).toEqual({
            frets: [null, 0, 2, 2, 2, 0],
            fingers: [null, null, '1', '2', '3', null],
            baseFret: 1
        })
        expect(lookupGuitarVoicing('Em', 0)?.frets).toEqual([0, 2, 2, 0, 0, 0])
    })

    it('converts relative frets up the neck', () => {
        const c = lookupGuitarVoicing('C', 2)!
        expect(c.baseFret).toBe(5)
        expect(c.frets).toEqual([null, null, 5, 5, 5, 8])
    })

    it('understands sharps, flats, aliases and slash chords', () => {
        expect(lookupGuitarVoicing('F#m', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('Gbm', 0)).toEqual(lookupGuitarVoicing('F#m', 0))
        expect(lookupGuitarVoicing('Bbmaj7', 0)).toEqual(lookupGuitarVoicing('BbM7', 0))
        expect(lookupGuitarVoicing('C/E', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('Am/G', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('D/F#', 0)).toEqual(lookupGuitarVoicing('D/Gb', 0))
        expect(lookupGuitarVoicing('Cmin6', 0)).toEqual(lookupGuitarVoicing('Cm6', 0))
        expect(lookupGuitarVoicing('CM9', 0)).toEqual(lookupGuitarVoicing('Cmaj9', 0))
        expect(lookupGuitarVoicing('C6/9', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('C7b9', 0)).not.toBeNull()
    })

    it('returns null for what it does not know', () => {
        expect(lookupGuitarVoicing('H7', 0)).toBeNull()
        expect(lookupGuitarVoicing('Cxyz', 0)).toBeNull()
        expect(lookupGuitarVoicing('A', 99)).toBeNull()
        expect(voicingCount('A')).toBeGreaterThan(2)
    })
})
