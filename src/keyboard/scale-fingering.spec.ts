import { describe, expect, it } from 'bun:test'
import {
    autoFingeringHand,
    parseFingerList,
    scaleFingers,
    standardScaleFingering
} from './scale-fingering.js'

const MAJOR = [0, 2, 4, 5, 7, 9, 11]

describe('standardScaleFingering', () => {
    it('knows the method-book fingerings of major and harmonic minor scales', () => {
        const f = (tonic: number, type: string, hand: 'left' | 'right') =>
            standardScaleFingering(tonic, type, hand)?.join('')
        expect(f(0, 'major', 'right')).toBe('12312345')
        expect(f(0, 'major', 'left')).toBe('54321321')
        expect(f(11, 'major', 'left')).toBe('43214321')
        expect(f(1, 'major', 'right')).toBe('23123412')
        expect(f(6, 'major', 'right')).toBe('23412312')
        expect(f(6, 'major', 'left')).toBe('43213214')
        expect(f(8, 'major', 'right')).toBe('34123123')
        expect(f(3, 'major', 'right')).toBe('31234123')
        expect(f(10, 'major', 'right')).toBe('41231234')
        expect(f(5, 'major', 'right')).toBe('12341234')
        expect(f(9, 'harmonic minor', 'right')).toBe('12312345')
        expect(f(1, 'harmonic minor', 'right')).toBe('34123123')
        expect(f(3, 'harmonic minor', 'left')).toBe('21432132')
        expect(f(10, 'harmonic minor', 'left')).toBe('21321432')
        expect(f(0, 'dorian', 'right')).toBeUndefined()
    })

    it('has a fingering for every key and hand, thumbs never twice in a row', () => {
        for (const type of ['major', 'harmonic minor']) {
            for (const hand of ['left', 'right'] as const) {
                for (let tonic = 0; tonic < 12; tonic++) {
                    const fingers = standardScaleFingering(tonic, type, hand)!
                    expect(fingers).toHaveLength(8)
                    fingers.forEach((finger, i) => {
                        if (i > 0) expect(finger === '1' && fingers[i - 1] === '1').toBe(false)
                    })
                }
            }
        }
    })
})

describe('scaleFingers', () => {
    const fingers = (pitches: number[], octave: string) =>
        [...scaleFingers(pitches, 0, MAJOR, [...octave]).values()].join('')
    const keys = (from: number, to: number) => {
        const out: number[] = []
        for (let p = from; p <= to; p++) if (MAJOR.includes(p % 12)) out.push(p)
        return out
    }

    it('repeats an octave, the thumb where octaves meet', () => {
        expect(fingers(keys(60, 72), '12312345')).toBe('12312345')
        expect(fingers(keys(48, 72), '12312345')).toBe('123123412312345')
        expect(fingers(keys(48, 72), '54321321')).toBe('543213214321321')
        // Neither end on the thumb: the first finger where octaves meet.
        expect(fingers(keys(48, 72), '23412312')).toBe('234123123412312')
        expect(fingers(keys(48, 72), '32143213')).toBe('321432132143213')
    })

    it('fingers a range that starts or ends between roots', () => {
        // E3 to B4: degrees 3 to 7, then a root between two octaves.
        expect(fingers(keys(52, 71), '12312345')).toBe('312341231234')
    })
})

describe('parseFingerList and autoFingeringHand', () => {
    it('reads fingers 1 to 5 only', () => {
        expect(parseFingerList('5-3-1')).toEqual(['5', '3', '1'])
        expect(parseFingerList('1, 2 3')).toEqual(['1', '2', '3'])
        expect(() => parseFingerList('1 2 6')).toThrow('got "6"')
        expect(() => parseFingerList('T 1')).toThrow('got "T"')
    })

    it('reads auto and its hands', () => {
        expect(autoFingeringHand('auto')).toBe('right')
        expect(autoFingeringHand('Auto left')).toBe('left')
        expect(autoFingeringHand('auto (left hand)')).toBe('left')
        expect(autoFingeringHand('right hand')).toBe('right')
        expect(autoFingeringHand('left')).toBe('left')
        expect(autoFingeringHand('1 2 3')).toBeNull()
        expect(autoFingeringHand('')).toBeNull()
    })
})
