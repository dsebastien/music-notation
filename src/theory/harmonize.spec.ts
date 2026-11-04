import { describe, expect, it } from 'bun:test'
import { harmonize, readHarmonyScale } from './harmonize.js'
import { readNumeral } from './numerals.js'

const symbols = (scale: string, kind?: Parameters<typeof harmonize>[1]) =>
    harmonize(scale, kind)!.chords.map((c) => c.symbol)
const numerals = (scale: string, kind?: Parameters<typeof harmonize>[1]) =>
    harmonize(scale, kind)!.chords.map((c) => c.numeral)

describe('harmonize', () => {
    it('stacks triads on every degree of a major key, with their numerals', () => {
        expect(symbols('G major')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'])
        expect(numerals('G major')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
        expect(harmonize('G major')!.name).toBe('G major')
    })

    it('stacks seventh chords', () => {
        const kind = { kind: 'sevenths' } as const
        expect(symbols('G major', kind)).toEqual([
            'Gmaj7',
            'Am7',
            'Bm7',
            'Cmaj7',
            'D7',
            'Em7',
            'F#m7b5'
        ])
        expect(numerals('G major', kind)).toEqual([
            'Imaj7',
            'ii7',
            'iii7',
            'IVmaj7',
            'V7',
            'vi7',
            'viiø7'
        ])
    })

    it('harmonizes harmonic and melodic minor, numerals marked as a minor key writes them', () => {
        const kind = { kind: 'sevenths' } as const
        expect(symbols('A harmonic minor', kind)).toEqual([
            'AmMaj7',
            'Bm7b5',
            'Cmaj7#5',
            'Dm7',
            'E7',
            'Fmaj7',
            'G#dim7'
        ])
        expect(numerals('A harmonic minor', kind)).toEqual([
            'imaj7',
            'iiø7',
            'bIIImaj7#5',
            'iv7',
            'V7',
            'bVImaj7',
            'vii°7'
        ])
        // Stacked from the scale, not tonal's melodic minor chords (Am6 on the tonic).
        expect(symbols('A melodic minor', kind)).toEqual([
            'AmMaj7',
            'Bm7',
            'Cmaj7#5',
            'D7',
            'E7',
            'F#m7b5',
            'G#m7b5'
        ])
        expect(numerals('A melodic minor', kind)).toEqual([
            'imaj7',
            'ii7',
            'bIIImaj7#5',
            'IV7',
            'V7',
            '#viø7',
            'viiø7'
        ])
        expect(numerals('A melodic minor')).toEqual(['i', 'ii', 'bIII+', 'IV', 'V', '#vi°', 'vii°'])
    })

    it('counts modes from the major scale, as keys do', () => {
        expect(symbols('D dorian')).toEqual(['Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C'])
        expect(numerals('D dorian')).toEqual(['i', 'ii', 'bIII', 'IV', 'v', 'vi°', 'bVII'])
        expect(numerals('A natural minor')).toEqual(['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'])
        expect(harmonize('A natural minor')!.name).toBe('A minor')
        expect(harmonize('Em')!.name).toBe('E minor')
    })

    it('reads the key from the third as the scale spells it', () => {
        // B altered is spelled B C D Eb F G A: its third is D, a minor third.
        const altered = harmonize('B altered')!
        expect(altered.key.name).toBe('B minor')
        const d = altered.chords.find((c) => c.symbol.startsWith('D'))!
        expect(readNumeral(d.numeral, altered.key)).toBe(d.symbol)
    })

    it('reads every numeral back to its chord in the key it names', () => {
        for (const scale of [
            'A harmonic minor',
            'A melodic minor',
            'D dorian',
            'Bb lydian',
            // A doubly flat 7th: bbVII.
            'C ultralocrian',
            'C# ultralocrian'
        ]) {
            for (const kind of ['triads', 'sevenths', 'sus', 'power'] as const) {
                const h = harmonize(scale, { kind })!
                for (const chord of h.chords) {
                    expect(readNumeral(chord.numeral, h.key)).toBe(chord.symbol)
                }
            }
        }
    })

    it('makes sus chords: sus4, or sus2 where the 4th is not perfect; no perfect fifth is left out', () => {
        const h = harmonize('D dorian', { kind: 'sus' })!
        expect(h.chords.map((c) => c.symbol)).toEqual([
            'Dsus4',
            'Esus4',
            'Fsus2',
            'Gsus4',
            'Asus4',
            'Csus4'
        ])
        expect(h.skipped).toEqual([{ degree: 6, note: 'B', reason: 'no perfect fifth' }])
        expect(symbols('C major', { kind: 'sus' })).toEqual([
            'Csus4',
            'Dsus4',
            'Esus4',
            'Fsus2',
            'Gsus4',
            'Asus4'
        ])
    })

    it('makes power chords on the degrees with a perfect fifth', () => {
        const h = harmonize('E phrygian', { kind: 'power' })!
        expect(h.chords.map((c) => c.symbol)).toEqual(['E5', 'F5', 'G5', 'A5', 'C5', 'D5'])
        expect(h.chords.map((c) => c.numeral)).toEqual([
            'I5',
            'bII5',
            'bIII5',
            'IV5',
            'bVI5',
            'bVII5'
        ])
        expect(h.skipped).toEqual([{ degree: 5, note: 'B', reason: 'no perfect fifth' }])
    })

    it('gives each chord its function', () => {
        expect(harmonize('C major')!.chords.map((c) => c.function)).toEqual([
            'tonic',
            'subdominant',
            'tonic',
            'subdominant',
            'dominant',
            'tonic',
            'dominant'
        ])
        // By degree in a minor scale, never a secondary dominant: D7 is IV7, F#m7b5 #viø7.
        expect(
            harmonize('A melodic minor', { kind: 'sevenths' })!.chords.map((c) => c.function)
        ).toEqual([
            'tonic',
            'subdominant',
            'tonic',
            'subdominant',
            'dominant',
            'subdominant',
            'dominant'
        ])
    })

    it('gives Nashville numbers too', () => {
        expect(harmonize('G major', { kind: 'sevenths' })!.chords.map((c) => c.nashville)).toEqual([
            '1maj⁷',
            '2m⁷',
            '3m⁷',
            '4maj⁷',
            '5⁷',
            '6m⁷',
            '7ø⁷'
        ])
    })

    it('refuses what is not a 7-note scale', () => {
        expect(harmonize('A minor pentatonic')).toBeNull()
        expect(harmonize('H major')).toBeNull()
        expect(harmonize('A minor', { kind: 'ninths' as never })).toBeNull()
    })
})

describe('readHarmonyScale', () => {
    it('reads keys, modes and other 7-note scales', () => {
        expect(readHarmonyScale('G')).toMatchObject({ name: 'G major', key: { mode: 'major' } })
        expect(readHarmonyScale('F# minor')).toMatchObject({ name: 'F# minor' })
        expect(readHarmonyScale('A harmonic minor')).toMatchObject({
            name: 'A harmonic minor',
            key: { tonic: 'A', mode: 'minor' }
        })
        expect(readHarmonyScale('C phrygian dominant')).toMatchObject({
            key: { tonic: 'C', mode: 'major' }
        })
    })

    it('says why a scale is refused', () => {
        expect(readHarmonyScale('A minor pentatonic')).toEqual({
            error: 'harmonize needs a scale of 7 notes: A minor pentatonic has 5'
        })
        expect(readHarmonyScale('Q lydian')).toEqual({
            error: 'Unknown scale "Q lydian": use e.g. key: G major, key: A harmonic minor or key: D dorian'
        })
        expect(readHarmonyScale('G# major')).toEqual({
            error: 'G# major needs 8 sharps: write Ab major'
        })
        expect(readHarmonyScale('D# harmonic minor')).not.toHaveProperty('error')
    })
})
