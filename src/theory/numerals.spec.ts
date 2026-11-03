import { describe, expect, it } from 'bun:test'
import {
    harmonicFunction,
    isBluesIn,
    numeralOf,
    progressionChords,
    readNumeral
} from './numerals.js'
import { readKey } from './keys.js'

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
        // Figures that don't fit the chord: a triad's 65, a seventh's 6 or 64 as a bass slash.
        expect(readNumeral('Imaj765', 'C')).toBeNull()
        expect(readNumeral('I6/3', 'C')).toBeNull()
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
        expect(numeralOf('Am7', 'G', 'nashville')).toBe('2m⁷')
        expect(numeralOf('Cmaj7', 'G', 'nashville')).toBe('4maj⁷')
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
        expect(harmonicFunction('Dmaj7', 'C')).toBe('chromatic')
        expect(harmonicFunction('D7', 'C')).toBe('secondary dominant')
        expect(harmonicFunction('A', 'Am')).toBe('borrowed')
        expect(harmonicFunction('Hm', 'C')).toBeNull()
    })

    it('calls bII the Neapolitan', () => {
        expect(harmonicFunction('Db', 'C')).toBe('neapolitan')
        expect(harmonicFunction('Db/F', 'C')).toBe('neapolitan')
        expect(harmonicFunction('Dbmaj7', 'C')).toBe('neapolitan')
        expect(harmonicFunction('Bb', 'Am')).toBe('neapolitan')
        expect(progressionChords('bII', 'Cm')![0]!.function).toBe('neapolitan')
        // Not a major chord: chromatic.
        expect(harmonicFunction('Dbm', 'C')).toBe('chromatic')
    })

    it('reads a diminished chord leading to a chord of the key as a secondary dominant', () => {
        const fns = (numerals: string, key: string) =>
            progressionChords(numerals, key)!.map((c) => `${c.numeral} ${c.function}`)
        // #iv° and vii°/V are the same F#dim.
        expect(fns('#iv° vii°/V #iv°7 vii°7/V', 'C')).toEqual([
            '#iv° secondary dominant',
            'vii°/V secondary dominant',
            '#iv°7 secondary dominant',
            'vii°7/V secondary dominant'
        ])
        expect(numeralOf('F#dim7', 'C')).toBe('vii°7/V')
        expect(numeralOf('C#dim7', 'C')).toBe('vii°7/ii')
        expect(numeralOf('G#dim7', 'C')).toBe('vii°7/vi')
        expect(numeralOf('F#m7b5', 'C')).toBe('viiø7/V')
        expect(numeralOf('D#dim', 'Am')).toBe('vii°/V')
        // The tonic's own leading-tone chord is vii°7, borrowed from the minor key.
        expect(numeralOf('Bdim7', 'C')).toBe('vii°7')
        expect(harmonicFunction('Bdim7', 'C')).toBe('borrowed')
    })

    it('reads a blues’s I7 and IV7 as the key’s own chords', () => {
        const chords = progressionChords('A7 D7 E7 A7', 'A')!
        expect(chords.map((c) => `${c.numeral} ${c.function}`)).toEqual([
            'I7 tonic',
            'IV7 subdominant',
            'V7 dominant',
            'I7 tonic'
        ])
        expect(progressionChords('I7 IV7 V7', 'A')!.map((c) => c.function)).toEqual([
            'tonic',
            'subdominant',
            'dominant'
        ])
        // Not a blues: C7 leads to F.
        expect(progressionChords('C C7 F G7', 'C')![1]!.numeral).toBe('V7/IV')
        expect(numeralOf('C7', 'C', 'roman', { blues: true })).toBe('I7')
        expect(isBluesIn(['A7', 'D7', 'E7'], readKey('A')!)).toBe(true)
        expect(isBluesIn(['A7', 'D7', 'E7'], readKey('D')!)).toBe(false)
    })

    it('names the chords of dorian and mixolydian keys from the major scale', () => {
        const dorian = readKey('D dorian')!
        expect(progressionChords('Dm C G Bdim Bb', dorian)!.map((c) => c.numeral)).toEqual([
            'i',
            'bVII',
            'IV',
            'vi°',
            'bVI'
        ])
        expect(harmonicFunction('G', dorian)).toBe('subdominant')
        // Numerals read back in the mode.
        for (const numeral of ['i', 'bVII', 'IV', 'vi°', 'bIII', 'v'])
            expect(numeralOf(readNumeral(numeral, dorian)!, dorian)).toBe(numeral)
        const mixolydian = readKey('G mixolydian')!
        expect(progressionChords('G F C', mixolydian)!.map((c) => c.function)).toEqual([
            'tonic',
            'subdominant',
            'subdominant'
        ])
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

describe('figured bass', () => {
    it('reads 6 and 64 as a triad’s inversions, 65 43 42 as a seventh chord’s', () => {
        const read = (token: string, key = 'C') => readNumeral(token, key)
        expect(read('I6')).toBe('C/E')
        expect(read('I64')).toBe('C/G')
        expect(read('ii6')).toBe('Dm/F')
        expect(read('IV64')).toBe('F/C')
        // The Neapolitan sixth: bII6 (or N6) is Db/F, with the Neapolitan's function.
        expect(read('bII6')).toBe('Db/F')
        expect(read('N6')).toBe('Db/F')
        expect(read('N')).toBe('Db')
        expect(harmonicFunction('Db/F', 'C')).toBe('neapolitan')
        expect(read('V65')).toBe('G7/B')
        expect(read('V43')).toBe('G7/D')
        expect(read('V42')).toBe('G7/F')
        expect(read('viiø65')).toBe('Bm7b5/D')
        expect(read('vii°6', 'A minor')).toBe('G#dim/B')
        expect(read('V65/V')).toBe('D7/F#')
        // An added sixth is written out; I69 stays a 6/9 chord; Nashville is unchanged.
        expect(read('Iadd6')).toBe('C6')
        expect(read('iiadd6')).toBe('Dm6')
        expect(read('I69')).toBe('C6/9')
        expect(read('46')).toBe('F6')
    })
})

describe('withTonicizations', () => {
    const analysis = (chords: string, key: string) =>
        progressionChords(chords, key)!.map((c) => `${c.numeral} ${c.function}`)

    it('reads a ii-V-I to a chord outside the key as a tonicization', () => {
        // Blue Bossa: Ebm7 Ab7 Dbmaj7 is a ii-V-I in Db, not a chromatic run to a Neapolitan.
        expect(analysis('Cm7 Ebm7 Ab7 Dbmaj7 Dm7b5 G7 Cm7', 'C minor')).toEqual([
            'i7 tonic',
            'ii7/bII tonicization',
            'V7/bII secondary dominant',
            'bIImaj7 tonicization',
            'iiø7 subdominant',
            'V7 dominant',
            'i7 tonic'
        ])
    })

    it('reads a dominant of the key going to its chord a fifth below as that chord’s V7', () => {
        // Fly Me to the Moon in A minor: G7 to Cmaj7 is V7/bIII, not bVII7.
        expect(analysis('Am7 Dm7 G7 Cmaj7', 'A minor')).toEqual([
            'i7 tonic',
            'iv7 subdominant',
            'V7/bIII secondary dominant',
            'bIIImaj7 tonic'
        ])
        // G7 not resolving stays bVII7; V7 to the tonic stays V7; E7 A7 in C stays V7/vi.
        expect(analysis('Am G7 Am', 'A minor')[1]).toBe('bVII7 subdominant')
        expect(analysis('Dm7 G7 C', 'C')[1]).toBe('V7 dominant')
        expect(analysis('C E7 A7 Dm7', 'C').slice(1, 3)).toEqual([
            'V7/vi secondary dominant',
            'V7/ii secondary dominant'
        ])
        // Written numerals keep their text; the function follows the move.
        expect(analysis('bVII7 bIII', 'A minor')[0]).toBe('bVII7 secondary dominant')
    })

    it('reads a chord outside the key before a secondary dominant as its ii', () => {
        // The gospel 2-5-1 to IV: Gm7 C7 F in C is ii7/IV V7/IV IV, not a borrowed v7.
        expect(analysis('C Gm7 C7 F', 'C')).toEqual([
            'I tonic',
            'ii7/IV tonicization',
            'V7/IV secondary dominant',
            'IV subdominant'
        ])
        expect(analysis('C Gm7b5 C7 Fm', 'C').slice(1, 3)).toEqual([
            'iiø7/IV tonicization',
            'V7/IV secondary dominant'
        ])
        // A ii of the key keeps its numeral: Em7 A7 Dm in C is iii7 V7/ii ii.
        expect(analysis('Em7 A7 Dm', 'C')).toEqual([
            'iii7 tonic',
            'V7/ii secondary dominant',
            'ii subdominant'
        ])
        expect(analysis('Dm7 G7 C', 'C')[0]).toBe('ii7 subdominant')
        // A slash dominant is left alone, as for new tonicizations.
        expect(analysis('C Gm7 C7/E F', 'C')[1]).toBe('v7 borrowed')
    })
})
