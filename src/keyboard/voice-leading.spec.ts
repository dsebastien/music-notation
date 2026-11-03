import { describe, expect, it } from 'bun:test'
import { voiceLead } from './voice-leading.js'

describe('voiceLead', () => {
    it('starts in root position and moves as little as it can', () => {
        // C E G, then G as B D G (first inversion), Am as C E A, F as C F A.
        expect(voiceLead(['C', 'G', 'Am', 'F'])).toEqual([
            [60, 64, 67],
            [59, 62, 67],
            [60, 64, 69],
            [60, 65, 69]
        ])
    })

    it('keeps a long progression in the middle of the keyboard', () => {
        const chords = Array.from({ length: 12 }, () => [
            'C',
            'F',
            'Bb',
            'Eb',
            'Ab',
            'Db',
            'Gb',
            'B',
            'E',
            'A',
            'D',
            'G'
        ]).flat()
        for (const pitches of voiceLead(chords)) {
            expect(pitches![0]!).toBeGreaterThanOrEqual(53)
            expect(pitches![0]!).toBeLessThanOrEqual(67)
        }
    })

    it('puts a slash chord’s bass below, and leaves out chords that do not read', () => {
        const [c, ce, bad] = voiceLead(['C', 'C/Bb', 'Hm'])
        expect(c).toEqual([60, 64, 67])
        expect(ce![0]).toBe(46)
        expect(ce!.slice(1)).toEqual([60, 64, 67])
        expect(bad).toBeNull()
    })
})
