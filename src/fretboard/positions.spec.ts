import { describe, expect, it } from 'bun:test'
import { positionOf, scalePosition, type Cell } from './positions.js'
import { scaleNoteSet } from '../theory/note-set.js'

const STANDARD = [40, 45, 50, 55, 59, 64]

/** Frets per string, low E first, as charts show them. */
const byString = (cells: Cell[] | null) => {
    const strings: number[][] = [[], [], [], [], [], []]
    for (const c of cells ?? []) strings[c.string]!.push(c.fret)
    return strings.map((frets) => frets.sort((a, b) => a - b).join(','))
}

describe('scale positions, checked against standard charts', () => {
    it('draws the five minor pentatonic boxes', () => {
        const set = scaleNoteSet('A minor pentatonic')!
        expect(byString(scalePosition(set, STANDARD, 'box', 1))).toEqual([
            '5,8',
            '5,7',
            '5,7',
            '5,7',
            '5,8',
            '5,8'
        ])
        expect(byString(scalePosition(set, STANDARD, 'box', 2))).toEqual([
            '8,10',
            '7,10',
            '7,10',
            '7,9',
            '8,10',
            '8,10'
        ])
        expect(byString(scalePosition(set, STANDARD, 'box', 5))).toEqual([
            '15,17',
            '15,17',
            '14,17',
            '14,17',
            '15,17',
            '15,17'
        ])
    })

    it('draws the CAGED E shape of C major and the first position of A minor', () => {
        expect(byString(scalePosition(scaleNoteSet('C major')!, STANDARD, 'caged', 1))).toEqual([
            '8,10',
            '7,8,10',
            '7,9,10',
            '7,9,10',
            '8,10',
            '7,8,10'
        ])
        expect(byString(scalePosition(scaleNoteSet('A minor')!, STANDARD, 'caged', 1))).toEqual([
            '5,7,8',
            '5,7,8',
            '5,7,9',
            '5,7',
            '5,6,8',
            '5,7,8'
        ])
    })

    it('draws three notes per string', () => {
        expect(byString(scalePosition(scaleNoteSet('G major')!, STANDARD, '3nps', 1))).toEqual([
            '3,5,7',
            '3,5,7',
            '4,5,7',
            '4,5,7',
            '5,7,8',
            '5,7,8'
        ])
    })

    it('uses three notes per string for scales with no pentatonic inside', () => {
        const locrian = scaleNoteSet('B locrian')!
        expect(scalePosition(locrian, STANDARD, 'caged', 1)).toEqual(
            scalePosition(locrian, STANDARD, '3nps', 1)
        )
    })

    it('refuses positions a scale does not have', () => {
        expect(scalePosition(scaleNoteSet('C major')!, STANDARD, 'caged', 6)).toBeNull()
        expect(scalePosition(scaleNoteSet('C major')!, STANDARD, '3nps', 8)).toBeNull()
        expect(scalePosition(scaleNoteSet('C major')!, STANDARD, '3nps', 7)).not.toBeNull()
    })
})

describe('positionOf', () => {
    it('reads positions and shapes', () => {
        expect(positionOf('2', undefined)).toEqual({ system: 'box', n: 2 })
        expect(positionOf(undefined, 'E')).toEqual({ system: 'caged', n: 1 })
        expect(positionOf(undefined, 'CAGED G')).toEqual({ system: 'caged', n: 5 })
        expect(positionOf('3', '3NPS')).toEqual({ system: '3nps', n: 3 })
        expect(positionOf(undefined, undefined)).toBeNull()
        expect(() => positionOf('0', undefined)).toThrow('position must be a whole number')
        expect(() => positionOf(undefined, 'F')).toThrow('Unknown shape "F"')
    })
})
