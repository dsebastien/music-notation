import { describe, expect, it } from 'bun:test'
import * as lib from '../index.js'
import { fingerVoicing, generateVoicings, voicingShape } from './generate.js'
import { barreKind, isBarreVoicing } from './guitar.js'

describe('barre API (0.8.0 callers)', () => {
    it('exports the barre helpers', () => {
        expect(lib.isBarreVoicing).toBe(isBarreVoicing)
        expect(lib.barreKind).toBe(barreKind)
    })

    it('still takes fingers as voicingShape’s 4th argument', () => {
        const frets = [1, 3, 3, 2, 1, 1]
        const fingers = fingerVoicing(frets)
        expect(voicingShape(frets, 'F', lib.STANDARD_TUNING, fingers)).toBe('E shape')
        expect(voicingShape(frets, 'F', lib.STANDARD_TUNING, null)).toBe('E shape')
    })

    it('tells the E-shape barre from a CAGED E without a barre', () => {
        const barre = { frets: [1, 3, 3, 2, 1, 1], fingers: fingerVoicing([1, 3, 3, 2, 1, 1]) }
        const plain = {
            frets: [1, 3, 3, 2, null, null],
            fingers: fingerVoicing([1, 3, 3, 2, null, null])
        }
        expect(voicingShape(barre.frets, 'F')).toBe('E shape')
        expect(voicingShape(plain.frets, 'F')).toBe('E shape')
        expect(isBarreVoicing({ frets: barre.frets, fingers: barre.fingers! })).toBe(true)
        expect(isBarreVoicing({ frets: plain.frets, fingers: plain.fingers! })).toBe(false)
    })

    it('agrees with the generator’s barre reason', () => {
        for (const symbol of ['F', 'Bm7', 'C', 'G7', 'Bb', 'Am']) {
            for (const v of generateVoicings(symbol).slice(0, 20)) {
                expect(isBarreVoicing(v)).toBe(v.reasons.includes('barre'))
            }
        }
    })
})
