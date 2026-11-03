import { describe, expect, it } from 'bun:test'
import { harmonicFunction, numeralOf, progressionChords, readNumeral } from './numerals.js'

const symbols = (numerals: string, key: string) =>
    progressionChords(numerals, key)?.map((c) => c.symbol) ?? null

describe('readNumeral', () => {
    it('reads roman numerals in major keys, spelled by the key', () => {
        expect(symbols('I V vi IV', 'G')).toEqual(['G', 'D', 'Em', 'C'])
        expect(symbols('I IV V vii°', 'F')).toEqual(['F', 'Bb', 'C', 'Edim'])
        expect(symbols('I IV V vii° iii', 'F#')).toEqual(['F#', 'B', 'C#', 'E#dim', 'A#m'])
        expect(symbols('I IV V', 'Gb')).toEqual(['Gb', 'Cb', 'Db'])
    })

    it('reads minor keys: natural notes unmarked or with b, the leading tone for vii°', () => {
        expect(symbols('i iv v V bVI bVII ii°', 'A minor')).toEqual([
            'Am',
            'Dm',
            'Em',
            'E',
            'F',
            'G',
            'Bdim'
        ])
        expect(symbols('VI VII III', 'Am')).toEqual(['F', 'G', 'C'])
        expect(symbols('vii° vii°7 #vi', 'A minor')).toEqual(['G#dim', 'G#dim7', 'F#m'])
        expect(symbols('i iv V7 i', 'C# minor')).toEqual(['C#m', 'F#m', 'G#7', 'C#m'])
        expect(symbols('i bII V', 'Cm')).toEqual(['Cm', 'Db', 'G'])
    })

    it('reads sevenths and other qualities', () => {
        expect(symbols('ii7 V7 Imaj7 IΔ7 viiø7 vii°7 iimaj7', 'C')).toEqual([
            'Dm7',
            'G7',
            'Cmaj7',
            'Cmaj7',
            'Bm7b5',
            'Bdim7',
            'DmMaj7'
        ])
        expect(symbols('I+ Iadd9 IVsus4 V9 viio', 'C')).toEqual([
            'Caug',
            'Cadd9',
            'Fsus4',
            'G9',
            'Bdim'
        ])
    })

    it('reads borrowed chords, secondary dominants and a bass degree', () => {
        expect(symbols('I bVII bVI iv', 'C')).toEqual(['C', 'Bb', 'Ab', 'Fm'])
        expect(symbols('V/V V7/ii vii°/V V7/IV', 'C')).toEqual(['D', 'A7', 'F#dim', 'C7'])
        expect(symbols('I V/V V', 'F')).toEqual(['F', 'G', 'C'])
        expect(symbols('I/3 V/2 IV/b7 V/5', 'C')).toEqual(['C/E', 'G/D', 'F/Bb', 'G/G'])
    })

    it('reads Nashville numbers', () => {
        expect(symbols('1 5 6m 4', 'G')).toEqual(['G', 'D', 'Em', 'C'])
        expect(symbols('2-7 5⁷ 57 1maj7 b7 7°', 'C')).toEqual([
            'Dm7',
            'G7',
            'G7',
            'Cmaj7',
            'Bb',
            'Bdim'
        ])
        expect(symbols('1/3 4/5', 'G')).toEqual(['G/B', 'C/D'])
    })

    it('reads chords whose root needs a double sharp or flat', () => {
        expect(symbols('i iv V vii°', 'G#m')).toEqual(['G#m', 'C#m', 'D#', 'F##dim'])
        expect(symbols('i V vii°7', 'D#m')).toEqual(['D#m', 'A#', 'C##dim7'])
        expect(symbols('V vii°', 'A#m')).toEqual(['E#', 'G##dim'])
        expect(symbols('vii°/vi', 'B')).toEqual(['F##dim'])
        expect(symbols('vii°/vi', 'C#')).toEqual(['G##dim'])
        expect(symbols('I bVI bVII', 'Gb')).toEqual(['Gb', 'Ebb', 'Fb'])
        expect(numeralOf('F##dim', 'G#m')).toBe('vii°')
        expect(numeralOf('Ebb', 'Gb')).toBe('bVI')
        expect(harmonicFunction('C##dim7', 'D#m')).toBe('dominant')
    })

    it('refuses what does not read', () => {
        for (const token of ['VIII', 'IVv', 'Iv', 'x', 'I/', 'V//V', '8', 'V/9', 'I/V/V'])
            expect(readNumeral(token, 'C')).toBeNull()
        // Figured bass isn't read: I6 is a sixth chord, V65 and V64 aren't chords.
        expect(readNumeral('I6', 'C')).toBe('C6')
        expect(readNumeral('V65', 'C')).toBeNull()
        expect(readNumeral('V64', 'C')).toBeNull()
        expect(readNumeral('I', 'H')).toBeNull()
        expect(progressionChords('I VIII', 'C')).toBeNull()
    })
})

describe('numeralOf', () => {
    it('names chords in a key', () => {
        expect(numeralOf('Em', 'G')).toBe('vi')
        expect(numeralOf('F', 'G')).toBe('bVII')
        expect(numeralOf('Ebmaj7', 'Cm')).toBe('bIIImaj7')
        expect(numeralOf('G#dim7', 'Am')).toBe('vii°7')
        expect(numeralOf('F#m', 'Am')).toBe('#vi')
        expect(numeralOf('C/E', 'C')).toBe('I/3')
        expect(numeralOf('Bbm', 'Db')).toBe('vi')
        expect(numeralOf('Bm7b5', 'C')).toBe('viiø7')
    })

    it('names secondary dominants after the chord they lead to', () => {
        expect(numeralOf('D7', 'C')).toBe('V7/V')
        expect(numeralOf('E7', 'C')).toBe('V7/vi')
        expect(numeralOf('B7', 'Am')).toBe('V7/V')
    })

    it('writes Nashville numbers', () => {
        expect(numeralOf('Em', 'G', 'nashville')).toBe('6m')
        expect(numeralOf('D7', 'G', 'nashville')).toBe('5⁷')
        expect(numeralOf('Am7', 'G', 'nashville')).toBe('2m7')
        expect(numeralOf('F', 'G', 'nashville')).toBe('b7')
        expect(numeralOf('C/E', 'C', 'nashville')).toBe('1/3')
    })

    it('reads back what it writes', () => {
        const numerals = {
            major: 'I ii iii IV V vi vii° bVII i iv v bVI bIII',
            minor: 'i ii° bIII III iv v V bVI VI bVII vii° vii°7 #vi I IV'
        }
        for (const key of ['C', 'E', 'F#', 'A minor', 'Eb minor', 'C# minor']) {
            const list = key.includes('minor') ? numerals.minor : numerals.major
            for (const symbol of progressionChords(list, key)!) {
                const numeral = numeralOf(symbol.symbol, key)!
                if (!numeral.includes('/')) expect(readNumeral(numeral, key)).toBe(symbol.symbol)
            }
        }
    })
})

describe('chords spelled another way than the key', () => {
    it('take the key’s spelling of a pitch it has', () => {
        expect(numeralOf('Fdim', 'F#')).toBe('vii°')
        expect(harmonicFunction('Fdim', 'F#')).toBe('dominant')
        expect(numeralOf('Gb/Bb', 'F#')).toBe('I/3')
        expect(numeralOf('C#/F', 'F#')).toBe('V/7')
        expect(numeralOf('Abdim7', 'Am')).toBe('vii°7')
        expect(harmonicFunction('Abdim7', 'Am')).toBe('dominant')
        expect(numeralOf('C#m', 'Db')).toBe('i')
        expect(harmonicFunction('C#m', 'Db')).toBe('borrowed')
        expect(
            progressionChords('F# B C# Fdim', 'F#')?.map((c) => `${c.numeral} ${c.function}`)
        ).toEqual(['I tonic', 'IV subdominant', 'V dominant', 'vii° dominant'])
    })
})

describe('harmonicFunction', () => {
    it('gives each chord its function', () => {
        const fns = (numerals: string, key: string) =>
            progressionChords(numerals, key)!.map((c) => c.function)
        expect(fns('I ii iii IV V vi vii°', 'C')).toEqual([
            'tonic',
            'subdominant',
            'tonic',
            'subdominant',
            'dominant',
            'tonic',
            'dominant'
        ])
        expect(fns('i iv V bVI bVII vii°', 'A minor')).toEqual([
            'tonic',
            'subdominant',
            'dominant',
            'subdominant',
            'subdominant',
            'dominant'
        ])
        expect(fns('bVII iv V/V V/IV vii°/V', 'C')).toEqual([
            'borrowed',
            'borrowed',
            'secondary dominant',
            'secondary dominant',
            'secondary dominant'
        ])
        expect(harmonicFunction('Db', 'C')).toBe('chromatic')
        expect(harmonicFunction('Dmaj7', 'C')).toBe('chromatic')
        expect(harmonicFunction('D7', 'C')).toBe('secondary dominant')
        expect(harmonicFunction('Db', 'Cm')).toBe('chromatic')
        expect(harmonicFunction('A', 'Am')).toBe('borrowed')
        expect(harmonicFunction('Hm', 'C')).toBeNull()
    })
})

describe('progressionChords', () => {
    it('analyzes chord names in a key', () => {
        const chords = progressionChords('G D Em C B7 Bb', 'G')!
        expect(chords.map((c) => c.numeral)).toEqual(['I', 'V', 'vi', 'IV', 'V7/vi', 'bIII'])
        expect(chords.map((c) => c.nashville)).toEqual(['1', '5', '6m', '4', '3⁷', 'b3'])
        expect(chords[4]!.function).toBe('secondary dominant')
    })

    it('keeps numerals as written and takes commas and bars', () => {
        const chords = progressionChords('ii7, V7 | Imaj7', 'Bb')!
        expect(chords.map((c) => `${c.numeral} ${c.symbol}`)).toEqual([
            'ii7 Cm7',
            'V7 F7',
            'Imaj7 Bbmaj7'
        ])
    })
})
