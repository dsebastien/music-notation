import { describe, expect, it } from 'bun:test'
import { bluesTonic, chordsInScale, findKey, findScales, inKey, scalesForChord } from './find.js'
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
        const [major] = findScales(['C', 'D', 'E', 'G', 'A', 'B'])
        expect(major!.name).toBe('C major')
        expect(major!.missing).toEqual(['F'])
    })

    it('puts a usual scale with exactly the notes played first', () => {
        expect(names(findScales('C D E G A'), 2)).toEqual([
            'C major pentatonic',
            'A minor pentatonic'
        ])
        expect(findScales('A C D E G')[0]!.name).toBe('A minor pentatonic')
        expect(findScales('F# A B C# E')[0]!.name).toBe('F# minor pentatonic')
        expect(findScales('A C D Eb E G')[0]!.name).toBe('A minor blues')
        // Seven notes: still major first.
        expect(findScales('C D E F G A B')[0]!.name).toBe('C major')
    })

    it('takes the tonic from the first chord, the last one and V → I moves', () => {
        expect(findScales('Dm C G')[0]!.name).toBe('D dorian')
        expect(findScales('Dm7 G7 Cmaj7')[0]!.name).toBe('C major')
        expect(findScales('C Bb F C', { as: 'chords' })[0]!.name).toBe('C mixolydian')
        expect(findScales('Am F C G')[0]!.name).toBe('A minor')
    })

    it('suggests the blues scale, the minor pentatonic and the mixolydian over a blues', () => {
        expect(names(findScales('A7 D7 E7 A7', { as: 'chords' }), 3)).toEqual([
            'A minor blues',
            'A minor pentatonic',
            'A mixolydian'
        ])
        expect(findScales('A7 D7 E7 A7', { as: 'chords' })[0]!.outside).toEqual([
            'C#',
            'F#',
            'G#',
            'B'
        ])
        // Not a blues: C7 leads to F, a plain chord.
        expect(findScales('C C7 F Fm C')[0]!.name).not.toBe('C minor blues')
        // Seventh chords, not notes in octave 7.
        expect(findScales('A7 D7 E7 A7')[0]!.name).toBe('A minor blues')
    })

    it('reads notes or chords', () => {
        // Three notes by default; three major chords when asked.
        expect(findScales('G C D')[0]!.missing.length).toBe(4)
        expect(findScales('G C D', { as: 'chords' })[0]!.name).toBe('G major')
        expect(findScales('C# E G#')[0]!.name).toBe('C# minor')
        // Notes with octaves when asked (A3 C4 E4 is A C E); else A5 D5 E5 are power chords.
        expect(findScales('A3 C4 E4', { as: 'notes' })[0]!.name).toBe('A minor')
        expect(findScales('A5 D5 E5')[0]!.missing).not.toContain('B')
        // Notes with octaves that aren't all power chords are notes.
        expect(findScales('C4 E4 G4')[0]!.name).toBe('C major')
        expect(findScales('A3 C4 E5')[0]!.name).toBe('A minor')
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

describe('scalesForChord', () => {
    it('lists the scales on the chord root that hold its tones', () => {
        expect(names(scalesForChord('Cmaj7'), 2)).toEqual(['C major', 'C lydian'])
        expect(names(scalesForChord('Dm7'), 3)).toEqual(['D minor', 'D dorian', 'D phrygian'])
        expect(names(scalesForChord('C7'), 2)).toEqual(['C mixolydian', 'C lydian dominant'])
        expect(names(scalesForChord('Am'))).toContain('A minor pentatonic')
        expect(scalesForChord('Cmaj7').every((m) => m.tonic === 'C' && !m.outside.length)).toBe(
            true
        )
        expect(scalesForChord('nope')).toEqual([])
    })
})

describe('chordsInScale', () => {
    it('harmonizes seven-note scales', () => {
        const chords = chordsInScale('G major')!
        expect(chords.map((c) => c.triad)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'])
        expect(chords.map((c) => c.seventh)).toEqual([
            'Gmaj7',
            'Am7',
            'Bm7',
            'Cmaj7',
            'D7',
            'Em7',
            'F#m7b5'
        ])
        expect(chords[6]!.numeral).toBe('vii°')
        expect(chordsInScale('A harmonic minor')!.map((c) => c.triad)).toEqual([
            'Am',
            'Bdim',
            'Caug',
            'Dm',
            'E',
            'F',
            'G#dim'
        ])
    })

    it('lists the common chords that fit other scales', () => {
        const chords = chordsInScale('A minor pentatonic')!
        expect(chords[0]!.triad).toBeNull()
        expect(chords[0]!.chords).toEqual(['Am', 'Am7', 'Asus4'])
        expect(chords[1]!.chords).toContain('C')
        expect(chordsInScale('C nothing')).toBeNull()
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

    it('lists the keys that hold every chord first among the others', () => {
        const names = (chords: string) => findKey(chords)!.candidates.map((c) => c.name)
        expect(names('Am F C G').slice(0, 3)).toEqual(['A minor', 'C major', 'G major'])
        expect(names('Em C G D').slice(0, 3)).toEqual(['E minor', 'G major', 'D major'])
        // The best key is still the best score: a borrowed bVII doesn't move C Bb F C to F major.
        expect(names('C Bb F C').slice(0, 2)).toEqual(['C major', 'F major'])
    })

    it('reads a dominant-seventh blues in the major key of its tonic', () => {
        const found = findKey('A7 D7 E7 A7')!
        expect(found.name).toBe('A major')
        expect(found.blues).toBe(true)
        expect(found.clear).toBe(true)
        expect(key('A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7')).toBe('A major')
        expect(key('G7 C7 G7 D7 C7 G7')).toBe('G major')
        expect(findKey('C C7 F G7 C')!.blues).toBeUndefined()
        expect(bluesTonic('F7 Bb7 F7 Cm7 F7 Bb7 Bdim7 F7 D7 Gm7 C7 F7')).toBe('F')
        expect(bluesTonic('D7 G7 C')).toBeNull()
        expect(bluesTonic('C C7 F')).toBeNull()
    })

    it('weighs the first chord, the last one and V7 → I cadences', () => {
        expect(key('Dm C G')).toBe('D minor')
        expect(findKey('Dm G7 C')!.clear).toBe(true)
        expect(key('C E7 Am')).toBe('A minor')
        // A major seventh chord isn't a dominant: Cmaj7 → Fmaj7 is I → IV, not V → I.
        expect(key('Cmaj7 Fmaj7')).toBe('C major')
        expect(findScales('Cmaj7 Fmaj7')[0]!.name).toBe('C major')
    })

    it('names the mode a minor or major key plays in', () => {
        expect(findKey('Dm C G')!.modal?.name).toBe('D dorian')
        expect(findKey('Am D Am D')!.modal?.name).toBe('A dorian')
        expect(findKey('C Bb F C')!.modal?.name).toBe('C mixolydian')
        expect(findKey('D C G D')!.modal?.name).toBe('D mixolydian')
        expect(findKey('Am F C G')!.modal).toBeUndefined()
        expect(findKey('Dm G A7 Dm')!.modal).toBeUndefined()
        expect(findKey('C F G C')!.modal).toBeUndefined()
        expect(findKey('A7 D7 E7 A7')!.modal).toBeUndefined() // Every chord inside the mode: Fm's Ab isn't in C mixolydian.
        expect(findKey('C C7 F Fm C')!.modal).toBeUndefined()
        // A I7 going to IV is a V7/IV, not a mixolydian b7.
        expect(findKey('C C7 F C')!.modal).toBeUndefined()
        expect(findKey('G G7 C G D7 G')!.modal).toBeUndefined()
        expect(findKey('C7 F C')!.modal).toBeUndefined()
        // A I7 that doesn't go to IV still reads as the mode's.
        expect(findKey('C C7 Dm C')!.modal?.name).toBe('C mixolydian')
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
