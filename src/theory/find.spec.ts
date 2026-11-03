import { describe, expect, it } from 'bun:test'
import { findKey, findScales, inKey } from './find.js'
import { degreeOf, keyChords, keySignature, parentMajor, readKey, signatureText } from './keys.js'

const names = (list: { name: string }[], n = list.length) => list.slice(0, n).map((m) => m.name)

describe('readKey', () => {
    it('reads keys as people write them', () => {
        const read = (t: string) => readKey(t)?.name ?? null
        expect(read('G')).toBe('G major')
        expect(read('Em')).toBe('E minor')
        expect(read('F# minor')).toBe('F# minor')
        expect(read('f♯m')).toBe('F# minor')
        expect(read('Bb major')).toBe('Bb major')
        expect(read('bb')).toBe('Bb major')
        expect(read('bbm')).toBe('Bb minor')
        expect(read('b')).toBe('B major')
        expect(read('Bm')).toBe('B minor')
        expect(read('D dorian')).toBe('D dorian')
        expect(read('E♭')).toBe('Eb major')
        expect(read('H')).toBeNull()
        expect(read('C blues')).toBeNull()
    })
})

describe('keys', () => {
    it('spell their notes and signatures by letter', () => {
        expect(keySignature(readKey('F')!)).toEqual({ count: -1, accidentals: ['Bb'] })
        expect(keySignature(readKey('F#')!)).toEqual({
            count: 6,
            accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#']
        })
        expect(keySignature(readKey('Gb')!).accidentals).toEqual([
            'Bb',
            'Eb',
            'Ab',
            'Db',
            'Gb',
            'Cb'
        ])
        expect(keySignature(readKey('Eb minor')!).count).toBe(-6)
        expect(keySignature(readKey('D dorian')!).count).toBe(0)
        expect(keySignature(readKey('C# major')!).count).toBe(7)
        expect(parentMajor(readKey('A minor')!)).toBe('C')
        expect(parentMajor(readKey('E phrygian')!)).toBe('C')
        expect(signatureText(0)).toBe('no ♯ or ♭')
        expect(signatureText(-3)).toBe('3♭')
    })

    it('have their diatonic chords with numerals', () => {
        const chords = (key: string, sevenths = false) =>
            keyChords(readKey(key)!, sevenths).map((c) => `${c.numeral} ${c.symbol}`)
        expect(chords('F')).toEqual([
            'I F',
            'ii Gm',
            'iii Am',
            'IV Bb',
            'V C',
            'vi Dm',
            'vii° Edim'
        ])
        expect(chords('F#')[6]).toBe('vii° E#dim')
        expect(chords('A minor')).toEqual([
            'i Am',
            'ii° Bdim',
            'bIII C',
            'iv Dm',
            'v Em',
            'bVI F',
            'bVII G'
        ])
        expect(chords('C', true)).toEqual([
            'Imaj7 Cmaj7',
            'ii7 Dm7',
            'iii7 Em7',
            'IVmaj7 Fmaj7',
            'V7 G7',
            'vi7 Am7',
            'viiø7 Bm7b5'
        ])
        expect(keyChords(readKey('D dorian')!).map((c) => c.numeral)).toEqual([
            'i',
            'ii',
            'bIII',
            'IV',
            'v',
            'vi°',
            'bVII'
        ])
    })

    it('give degrees by letter', () => {
        expect(degreeOf('G', 'F')).toEqual({ number: 7, accidental: 'b' })
        expect(degreeOf('G', 'F#')).toEqual({ number: 7, accidental: '' })
        expect(degreeOf('C', 'Fb')).toEqual({ number: 4, accidental: 'b' })
        // A minor key marks its raised notes.
        expect(degreeOf('A', 'F#', true)).toEqual({ number: 6, accidental: '#' })
        expect(degreeOf('A', 'F', true)).toEqual({ number: 6, accidental: 'b' })
    })
})

describe('findScales', () => {
    it('ranks the scales of a progression: major and minor first, the first chord as tonic', () => {
        const found = findScales('G D Em C')
        expect(names(found, 3)).toEqual(['G major', 'E minor', 'C lydian'])
        expect(found[0]!.outside).toEqual([])
        expect(found[0]!.missing).toEqual([])
    })

    it('reports outside and missing notes', () => {
        const [best] = findScales('G D Em C B7')
        expect(best!.name).toBe('G major')
        expect(best!.outside).toEqual(['D#'])
        const [pentatonic] = findScales(['C', 'D', 'E', 'G', 'A'])
        expect(pentatonic!.name).toBe('C major')
        expect(pentatonic!.missing).toEqual(['F', 'B'])
    })

    it('reads notes or chords', () => {
        // Three notes by default; three major chords when asked.
        expect(findScales('G C D')[0]!.missing.length).toBe(4)
        expect(findScales('G C D', { as: 'chords' })[0]!.name).toBe('G major')
        expect(findScales('C# E G#')[0]!.name).toBe('C# minor')
    })

    it('spells scales the way the input does, without double accidentals', () => {
        expect(findScales('Bb F Gm Eb')[0]!.name).toBe('Bb major')
        expect(findScales('Gb Db Ebm Cb')[0]!.name).toBe('Gb major')
        expect(findScales('F# C# D#m B')[0]!.name).toBe('F# major')
        expect(findScales('F# C# D#m B')[0]!.notes).toContain('E#')
        for (const m of findScales('Db Ab Bbm Gb')) expect(m.notes.join(' ')).not.toMatch(/bb|##/)
    })

    it('leaves out scales with too many outside notes, and items that do not read', () => {
        expect(findScales('C E G', { maxOutside: 0 }).every((m) => !m.outside.length)).toBe(true)
        expect(findScales('C E G', { limit: 3 })).toHaveLength(3)
        expect(findScales('G Xyz')).toEqual([])
        expect(findScales('')).toEqual([])
        expect(names(findScales('C E G'))).not.toContain('C chromatic')
    })
})

describe('findKey', () => {
    const key = (chords: string) => findKey(chords)?.name ?? null

    it('finds the key of common progressions', () => {
        expect(key('G D Em C')).toBe('G major')
        expect(key('C Am F G')).toBe('C major')
        expect(key('Dm G7 C')).toBe('C major')
        expect(key('Am Dm E7 Am')).toBe('A minor')
        expect(key('E A B7 E')).toBe('E major')
        expect(key('C D7 G7 C')).toBe('C major')
        expect(key('Bb F Gm Eb')).toBe('Bb major')
    })

    it('spells the tonic as the chords do', () => {
        expect(key('F# C# D#m B')).toBe('F# major')
        expect(key('Gb Db Ebm Cb')).toBe('Gb major')
    })

    it('gives the candidates when it is not clear', () => {
        const found = findKey('Am F C G')!
        expect(found.name).toBe('A minor')
        expect(found.clear).toBe(false)
        expect(found.candidates.map((c) => c.name)).toContain('C major')
        expect(findKey('Dm G7 C')!.clear).toBe(true)
        expect(findKey('C A7 Dm G7 C')!.outside).toEqual(['A7'])
        expect(findKey('C E7 Am')!.name).toBe('A minor')
    })

    it('needs chords that read', () => {
        expect(findKey('C Xyz')).toBeNull()
        expect(findKey('')).toBeNull()
    })

    it('counts a minor key’s V and vii° in it', () => {
        expect(inKey('E7', readKey('A minor')!)).toBe(true)
        expect(inKey('G#dim', readKey('A minor')!)).toBe(true)
        expect(inKey('E7', readKey('C major')!)).toBe(false)
    })
})
