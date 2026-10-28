import { describe, expect, it } from 'bun:test'
import { layoutDefaults, neckFrame, parseHand, parseOrientation, titleWidth } from './layout.js'

describe('orientation and hand', () => {
    it('reads both words, in any case', () => {
        expect(parseOrientation(' Vertical ')).toBe('vertical')
        expect(parseOrientation('horizontal')).toBe('horizontal')
        expect(parseHand('LEFT')).toBe('left')
        expect(parseHand('right')).toBe('right')
    })

    it('says what to write instead', () => {
        expect(() => parseOrientation('sideways')).toThrow(
            'Unknown orientation "sideways": use vertical or horizontal'
        )
        expect(() => parseHand('lefty')).toThrow('Unknown hand "lefty": use left or right')
    })

    it('keeps only valid defaults from a page', () => {
        expect(layoutDefaults(undefined)).toEqual({})
        expect(layoutDefaults('left')).toEqual({})
        expect(
            layoutDefaults({
                hand: 'left',
                orientation: { chord: 'horizontal', keyboard: 'diagonal', fretboard: 'vertical' },
                transpose: 3
            })
        ).toEqual({ hand: 'left', orientation: { chord: 'horizontal', fretboard: 'vertical' } })
        expect(layoutDefaults({ hand: 'up', orientation: 'vertical' })).toEqual({})
    })
})

describe('neckFrame', () => {
    const neck = {
        across: 100,
        along: 200,
        before: 10,
        after: 5,
        low: 30,
        high: 14,
        top: 20
    }

    it('vertical: nut on top, low string on the left', () => {
        const frame = neckFrame({ ...neck, orientation: 'vertical', hand: 'right' })
        expect(frame.width).toBe(144)
        expect(frame.height).toBe(235)
        expect(frame.at(0, 0)).toEqual([30, 30])
        expect(frame.at(100, 200)).toEqual([130, 230])
    })

    it('vertical, left-handed: low string on the right', () => {
        const frame = neckFrame({ ...neck, orientation: 'vertical', hand: 'left' })
        expect(frame.at(0, 0)).toEqual([114, 30])
        expect(frame.at(100, 0)).toEqual([14, 30])
    })

    it('horizontal: high string on top, nut on the left', () => {
        const frame = neckFrame({ ...neck, orientation: 'horizontal', hand: 'right' })
        expect(frame.width).toBe(215)
        expect(frame.height).toBe(164)
        expect(frame.at(100, 0)).toEqual([10, 34])
        expect(frame.at(0, 200)).toEqual([210, 134])
    })

    it('horizontal, left-handed: nut on the right', () => {
        const frame = neckFrame({ ...neck, orientation: 'horizontal', hand: 'left' })
        expect(frame.at(0, 0)).toEqual([205, 134])
        expect(frame.at(0, 200)).toEqual([5, 134])
    })

    it('boxes are the same in every frame, whatever the corners', () => {
        const frame = neckFrame({ ...neck, orientation: 'horizontal', hand: 'left' })
        expect(frame.box(10, 20, 30, 50)).toEqual({ x: 155, y: 104, width: 30, height: 20 })
        expect(frame.box(30, 50, 10, 20)).toEqual(frame.box(10, 20, 30, 50))
    })

    it('widens and centers a diagram for its title', () => {
        const frame = neckFrame({
            ...neck,
            orientation: 'vertical',
            hand: 'right',
            minWidth: titleWidth('A very long chord name')
        })
        expect(frame.width).toBe(184)
        expect(frame.at(0, 0)).toEqual([50, 30])
    })
})
