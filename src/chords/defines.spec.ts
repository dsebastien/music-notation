import { describe, expect, it } from 'bun:test'
import { absoluteFrets, chordKey, findDefinition, parseDefinition } from './defines.js'

describe('parseDefinition', () => {
    it('reads base-fret, frets and fingers (ChordPro 6)', () => {
        const { definition, problems } = parseDefinition(
            'As base-fret 4 frets 1 3 3 2 1 1 fingers 1 3 4 2 1 1'
        )
        expect(problems).toEqual([])
        expect(definition).toMatchObject({
            name: 'As',
            baseFret: 4,
            frets: [1, 3, 3, 2, 1, 1],
            fingers: ['1', '3', '4', '2', '1', '1'],
            diagram: true,
            transposable: false
        })
        expect(absoluteFrets(definition!)).toEqual([4, 6, 6, 5, 4, 4])
    })

    it('reads muted strings as x, X, N or -1, and fingers 1-9 or A-Z', () => {
        const { definition } = parseDefinition('D frets x N -1 X 3 2 fingers - 0 x 1 T 2')
        expect(definition!.frets).toEqual([null, null, null, null, 3, 2])
        expect(definition!.fingers).toEqual([null, null, null, '1', 'T', '2'])
    })

    it('reads keyboard keys, display names, diagram off and an older colon after the name', () => {
        expect(parseDefinition('Am keys 0 3 7').definition!.keys).toEqual([0, 3, 7])
        expect(parseDefinition('Ab display "A flat" frets 4 6 6 5 4 4').definition!.display).toBe(
            'A flat'
        )
        expect(parseDefinition('Am diagram off').definition!.diagram).toBe(false)
        expect(parseDefinition('Am: frets x 0 2 2 1 0').definition!.name).toBe('Am')
        expect(parseDefinition('[Am]').definition).toMatchObject({ name: 'Am', transposable: true })
    })

    it('a name alone defines no shape', () => {
        expect(parseDefinition('Am7').definition).toMatchObject({ frets: null, keys: null })
    })

    it('copies an earlier definition, its own keys winning; else remembers the chord to copy', () => {
        const am = parseDefinition('Am frets x 0 2 2 1 0 fingers 0 0 2 3 1 0').definition!
        const copy = parseDefinition('Am7 copy Am frets x 0 2 0 1 0', [am]).definition!
        expect(copy.frets).toEqual([null, 0, 2, 0, 1, 0])
        expect(copy.fingers).toEqual([null, null, '2', '3', '1', null])
        expect(copy.copy).toBeNull()
        expect(parseDefinition('Am7 copy Am7', [am]).definition!.copy).toBe('Am7')
        const shown = parseDefinition('X display Mine frets 0 0 0 0 0 0').definition!
        expect(parseDefinition('Y copyall X', [shown]).definition!.display).toBe('Mine')
        expect(parseDefinition('Y copy X', [shown]).definition!.display).toBeNull()
    })

    it('says what to write for mistakes, keeping the rest', () => {
        expect(parseDefinition('').problems[0]).toContain('needs a chord name')
        expect(parseDefinition('Am base-fret 0 frets x 0 2 2 1 0').problems[0]).toContain(
            'base-fret takes one whole number'
        )
        expect(parseDefinition('Am frets x 0 2 a 1 0').problems[0]).toContain(
            'one value per string'
        )
        const fingers = parseDefinition('Am frets x 0 2 2 1 0 fingers 1 2')
        expect(fingers.problems[0]).toContain('fingers has 2 values for 6 strings')
        expect(fingers.definition!.frets).toEqual([null, 0, 2, 2, 1, 0])
        expect(fingers.definition!.fingers).toBeNull()
        expect(parseDefinition('Am fret x 0 2 2 1 0').problems[0]).toContain('unknown "fret"')
        expect(parseDefinition('Am keys 0 4 30').problems[0]).toContain('keys takes semitones')
        expect(parseDefinition('Am frets 1 2 3', [], 'chord').problems).toEqual([])
        expect(parseDefinition('X base-fret 24 frets 20 1').problems[0]).toContain(
            'reaches fret 43'
        )
        // Copied fingers that don't fit the new frets are dropped without a message.
        const four = parseDefinition('A frets 2 2 2 0 fingers 1 2 3 0').definition!
        const copied = parseDefinition('B copy A frets x 0 2 2 2 0', [four])
        expect(copied.problems).toEqual([])
        expect(copied.definition!.fingers).toBeNull()
    })

    it('parses long malformed values in linear time', () => {
        const start = performance.now()
        parseDefinition(`A ${'"'.repeat(1)}${' x'.repeat(20000)}`)
        parseDefinition(`A frets ${'1 '.repeat(20000)}`)
        expect(performance.now() - start).toBeLessThan(200)
    })
})

describe('findDefinition', () => {
    it('finds the last definition of a name, else of another spelling of the chord', () => {
        const first = parseDefinition('Bb frets x 1 3 3 3 1').definition!
        const second = parseDefinition('Bb frets 6 8 8 7 6 6').definition!
        expect(findDefinition([first, second], 'Bb')).toBe(second)
        expect(findDefinition([first], 'A#')).toBe(first)
        expect(findDefinition([first], 'Bbm')).toBeUndefined()
        expect(chordKey('CM7')).toBe(chordKey('Cmaj7'))
        expect(chordKey('N.C.')).toBe('=N.C.')
    })
})
