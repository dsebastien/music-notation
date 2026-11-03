import { describe, expect, it } from 'bun:test'
import { countOf, formatStrum, parseStrum, parseSubdivision, parseTime } from './pattern.js'

const written = (source: string) => formatStrum(parseStrum(source))
const error = (source: string) => {
    try {
        parseStrum(source)
    } catch (e) {
        return (e as Error).message
    }
    return null
}

describe('parseStrum: the ways patterns are written', () => {
    it('reads one symbol a slot, with rests', () => {
        expect(written('D - D U - U D U')).toBe('D - D U - U D U')
        expect(written('D-DU-UDU')).toBe('D - D U - U D U')
        expect(written('D . D U . U D U')).toBe('D - D U - U D U')
        expect(written('d - d u - u d u')).toBe('D - D U - U D U')
    })

    it('places strums written alone by the hand motion: down on the beat, up between', () => {
        expect(written('D DU UDU')).toBe('D - D U - U D U')
        expect(written('DDUUDU')).toBe('D - D U - U D U')
        expect(written('D D D D')).toBe('D - D - D - D -')
        expect(written('DUDUDUDU')).toBe('D U D U D U D U')
    })

    it('reads dashes written between strums as separators', () => {
        expect(written('D-D-U-U-D-U')).toBe('D - D U - U D U')
        expect(written('D-D-D-D')).toBe('D - D - D - D -')
    })

    it('reads accents, ghost strums and muted strums', () => {
        const p = parseStrum('D> (U) X U >D U X U')
        expect(formatStrum(p)).toBe('D> (U) X U D> U X U')
        expect(p.slots[0]).toEqual({ stroke: 'down', accent: true, ghost: false, chord: null })
        expect(p.slots[1]).toEqual({ stroke: 'up', accent: false, ghost: true, chord: null })
        expect(p.slots[2]!.stroke).toBe('mute')
        expect(written('D (D U) U - U D U')).toBe('D (D) (U) U - U D U')
    })

    it('puts a muted strum written alone on the next down slot, one glued to a strum on the next slot', () => {
        expect(written('D X D X')).toBe('D - X - D - X -')
        expect(written('X X X X')).toBe('X - X - X - X -')
        expect(written('D U X U')).toBe('D U X U - - - -')
        expect(written('D DX UDU')).toBe('D - D X - U D U')
        expect(written('DX DX')).toBe('D X D X - - - -')
        expect(written('D [G]X')).toBe('D - [G]X - - - - -')
        // Triplets (a shuffle): an X alone takes the next beat, one glued the third triplet.
        expect(written('D X X\nsubdivision: triplets')).toBe('D - - X - - X - - - - -')
        expect(written('DX DX\nsubdivision: triplets')).toBe('D - X D - X - - - - - -')
    })

    it('reads arrows as down and up strums', () => {
        expect(written('↓ ↓↑ ↑↓↑')).toBe('D - D U - U D U')
        expect(written('↓ - ↓ ↑ - ↑ ↓ ↑')).toBe('D - D U - U D U')
        expect(written('↓> (↑) X ↑ ↓ ↑ X ↑')).toBe('D> (U) X U D U X U')
    })

    it('skips a line of counts', () => {
        expect(written('1 & 2 & 3 & 4 &\nD - D U - U D U')).toBe('D - D U - U D U')
        expect(written('D-DU-UDU\n1 + 2 + 3 + 4 +')).toBe('D - D U - U D U')
    })

    it('reads bar lines and several lines as bars', () => {
        expect(parseStrum('D-DU-UDU | D-DU-UDU').bars).toBe(2)
        expect(written('D D D D\nD DU UDU')).toBe('D - D - D - D - | D - D U - U D U')
        // A short line is padded to the end of its bar.
        expect(written('D DU | DUDU')).toBe('D - D U - - - - | D U D U - - - -')
        // Each line or part is read on its own: strums alone, then one symbol a slot.
        expect(written('DD DD\nD-DU-UDU')).toBe('D - D - D - D - | D - D U - U D U')
    })
})

describe('parseStrum: chords', () => {
    it('starts a chord written in brackets on the next slot', () => {
        const p = parseStrum('[G]D - D U [C]- U D U')
        expect(p.slots.map((s) => s.chord)).toEqual(['G', null, null, null, 'C', null, null, null])
        expect(parseStrum('[A Minor]D-DU-UDU').slots[0]!.chord).toBe('Am')
    })

    it('starts a chord written on the line above on the slot under it', () => {
        const p = parseStrum('G       C\nD - D U - U D U')
        expect(p.slots[0]!.chord).toBe('G')
        expect(p.slots[4]!.chord).toBe('C')
        // Over the gap a rest fills (D DU UDU): on that rest, beat 3.
        expect(parseStrum('G   C\nD DU UDU').slots[4]!.chord).toBe('C')
        expect(parseStrum('Am      F\nD - D U - U D U').slots[4]!.chord).toBe('F')
    })

    it('reads a line of only D as strums, not chords', () => {
        expect(written('D D D D\nD U D U D U D U')).toBe('D - D - D - D - | D U D U D U D U')
    })

    it('keeps chord: for the whole pattern', () => {
        expect(parseStrum('chord: G7\nD DU UDU').chord).toBe('G7')
    })

    it('says which chord it does not know', () => {
        expect(error('[Hm]D-DU-UDU')).toContain('Didn\'t recognize the chord "Hm"')
        expect(error('chord: Q\nD')).toContain('Didn\'t recognize the chord "Q"')
        expect(error('G       C\nD DU')).toContain('C is past the end')
        expect(error('D - D U [C]')).toContain('ends the pattern')
    })
})

describe('parseStrum: time and subdivision', () => {
    it('follows the time signature and the subdivision', () => {
        const waltz = parseStrum('D DU DU\ntime: 3/4')
        expect(waltz.slotsPerBar).toBe(6)
        expect(formatStrum(waltz)).toBe('D - D U D U')
        const six = parseStrum('D - D U - U\ntime: 6/8')
        expect([six.slotsPerBeat, six.slotsPerBar]).toEqual([1, 6])
        const sixteen = parseStrum('D-DU-UDU-DUDUDU-\nsubdivision: 16ths')
        expect([sixteen.slotsPerBar, sixteen.bars]).toEqual([16, 1])
        // Triplets written in full: one symbol a slot.
        expect(written('DUD DUD DUD DUD\nsubdivision: triplets')).toBe('D U D D U D D U D D U D')
    })

    it('says how many slots a bar has, and which subdivision would fit', () => {
        expect(error('D - D U - U')).toBe(
            '4/4 in 8ths has 8 slots a bar, but "D - D U - U" has 6: fill each bar with - (no strum) or write time: 3/4'
        )
        expect(error('D - D U - U D U\ntime: 3/4')).toBe(
            '3/4 in 8ths has 6 slots a bar, but "D - D U - U D U" has 8: fill each bar with - (no strum) or write time: 4/4'
        )
        expect(error('D-DU-UDU-DU')).toContain('has 11')
        expect(error('D - D U - U D U D - D U - U D U')).toBeNull()
        expect(error('D-D-U-D-U-D-U-D-U-D-U-D')).toBeNull()
        expect(error('D-DU-UDUD-DU\ntime: 4/4')).toContain('subdivision: triplets')
    })

    it('reads time signatures and subdivisions in common spellings', () => {
        expect(parseTime('C')).toEqual({ beatsPerBar: 4, beatUnit: 4 })
        expect(parseTime(' 12 / 8 ')).toEqual({ beatsPerBar: 12, beatUnit: 8 })
        expect(() => parseTime('4/5')).toThrow('Invalid time "4/5"')
        expect(parseSubdivision('Eighths')).toBe('8ths')
        expect(parseSubdivision('16th notes')).toBe('16ths')
        expect(parseSubdivision('triplet')).toBe('triplets')
        expect(() => parseSubdivision('quarters')).toThrow('use 8ths, 16ths or triplets')
        expect(error('D\ntime: 6/8\nsubdivision: triplets')).toContain('6/8 with 8ths')
    })

    it('reads tempo, tuning and title', () => {
        const p = parseStrum('D DU UDU\ntempo: 100 bpm\ntuning: ukulele\ntitle: Island')
        expect([p.tempo, p.tuning, p.title]).toEqual([100, 'ukulele', 'Island'])
        expect(parseStrum('bpm: 72\nD').tempo).toBe(72)
        expect(error('tempo: fast\nD')).toContain('Invalid tempo "fast"')
        expect(error('tempo: 300\nD')).toContain('from 20 to 240')
    })
})

describe('parseStrum: shuffle and swing (#65)', () => {
    it('places strums in triplets as a shuffle: down on the beat, up on the third triplet', () => {
        expect(written('D U D U D U D U\nsubdivision: triplets')).toBe('D - U D - U D - U D - U')
        expect(written('D DU UDU\nsubdivision: triplets')).toBe('D - - D - U - - U D - U')
        expect(written('↓ ↓↑ ↓↑\ntime: 3/4\nsubdivision: triplets')).toBe('D - - D - U D - U')
    })

    it('reads swing: yes, no and percentages', () => {
        expect(parseStrum('D U D U D U D U\nswing: yes').swing).toBeCloseTo(2 / 3)
        expect(parseStrum('DUDU\nswing: Shuffle').swing).toBeCloseTo(2 / 3)
        expect(parseStrum('DUDU\nswing: 60%').swing).toBeCloseTo(0.6)
        expect(parseStrum('DUDU\nswing: 58').swing).toBeCloseTo(0.58)
        expect(parseStrum('DUDU\nswing: no').swing).toBeNull()
        expect(parseStrum('DUDU\nswing: 50%').swing).toBeNull()
        expect(parseStrum('DUDU').swing).toBeNull()
        // 16ths swing in pairs of 16ths; cut time's 8ths too.
        expect(parseStrum('DUDUDUDU\nsubdivision: 16ths\nswing: yes').swing).toBeCloseTo(2 / 3)
        expect(parseStrum('DUDU\ntime: cut\nswing: yes').swing).toBeCloseTo(2 / 3)
    })

    it('says when swing does not apply', () => {
        expect(error('DUDU\nswing: lots')).toContain('Invalid swing "lots"')
        expect(error('DUDU\nswing: 90%')).toContain('from 50 (straight) to 75')
        expect(error('DUDU\nsubdivision: triplets\nswing: yes')).toContain(
            'keep subdivision: triplets'
        )
        expect(error('D - D U - U\ntime: 6/8\nswing: yes')).toContain(
            '6/8 already has three 8ths a beat'
        )
        expect(error('D U D\ntime: 3/8\nswing: yes')).toContain('write subdivision: 16ths')
        expect(error('D U D\ntime: 3/8\nsubdivision: 16ths\nswing: yes')).toBeNull()
    })
})

describe('parseStrum: compound time (#65)', () => {
    it('counts 6/8, 9/8 and 12/8 in dotted beats of three 8ths', () => {
        const six = parseStrum('D - D U - U\ntime: 6/8')
        expect([six.compound, six.slotsPerPulse]).toEqual([true, 3])
        expect(parseStrum('D\ntime: 12/8').slotsPerPulse).toBe(3)
        expect(parseStrum('D\ntime: 9/8\nsubdivision: 16ths').slotsPerPulse).toBe(6)
        // 3/8 and 4/4 count each beat.
        expect(parseStrum('D\ntime: 3/8').compound).toBe(false)
        expect(parseStrum('D\ntime: 3/4').slotsPerPulse).toBe(2)
        expect(parseStrum('D\ntime: 6/4').compound).toBe(false)
    })
})

describe('parseStrum: patterns that do not fit the bar (#65)', () => {
    it('says how many slots a bar has when strums run past it and stop early in the next', () => {
        expect(error('D DU UDU\ntime: 3/4')).toBe(
            '3/4 in 8ths has 6 slots a bar, but "D DU UDU" takes 8 (1 bar and 2 slots): put a | where each bar ends, or write time: 4/4'
        )
        expect(error('D D D D\ntime: 3/4')).toContain('takes 7 (1 bar and 1 slot)')
        expect(error('D DU UDU D')).toContain('put a | where each bar ends')
        // With a bar line, or a second bar at least half full, it reads.
        expect(written('D DU UDU | D')).toBe('D - D U - U D U | D - - - - - - -')
        expect(written('D-D-U-D-U-D-U-D-U-D-U-D')).toBe('D - D U D U D U | D U D U D - - -')
        // A pattern of two bars of 2/4 fills them.
        expect(written('D DU UDU\ntime: 2/4')).toBe('D - D U | - U D U')
    })
})

describe('parseStrum: mistakes', () => {
    it('says what to write instead', () => {
        expect(error('D Q U')).toContain('Didn\'t understand "Q"')
        expect(error('D Q U')).toContain('X (muted)')
        expect(error('foo: bar\nD')).toContain('Unknown key "foo"')
        expect(error('time: 4/4')).toContain('Write a strumming pattern')
        expect(error('D (U')).toContain('Missing ")"')
        expect(error('D U)')).toContain('")" without "("')
        expect(error('D ((U))')).toContain("can't be nested")
        expect(error('(D>)')).toContain('either accented')
        expect(error('D U >')).toContain('An accent needs a strum')
        expect(error('> - D')).toContain('An accent needs a strum')
        expect(error('[G')).toContain('Missing "]"')
        expect(error('[]D')).toContain('Empty chord')
        expect(error('G C')).toContain('Didn\'t understand "G"')
    })

    it('keeps patterns to 16 bars', () => {
        expect(error(Array(17).fill('D-DU-UDU').join(' | '))).toContain('At most 16 bars')
        expect(error(Array(16).fill('D-DU-UDU').join(' | '))).toBeNull()
    })

    it('reads a pattern: key like a pattern line', () => {
        expect(written('pattern: D DU UDU')).toBe('D - D U - U D U')
    })
})

describe('countOf', () => {
    it('counts 8ths, 16ths, triplets and eighths of 6/8', () => {
        const counts = (perBeat: number, perBar: number) =>
            Array.from({ length: perBar }, (_, i) => countOf(i, perBeat, perBar)).join(' ')
        expect(counts(2, 8)).toBe('1 & 2 & 3 & 4 &')
        expect(counts(4, 8)).toBe('1 e & a 2 e & a')
        expect(counts(3, 6)).toBe('1 & a 2 & a')
        expect(counts(1, 6)).toBe('1 2 3 4 5 6')
        expect(countOf(9, 2, 8)).toBe('&')
    })
})
