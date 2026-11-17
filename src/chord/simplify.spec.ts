import { describe, expect, it } from 'bun:test'
import { bestCapo, capoChoices, easierChord, simplifyChord } from './simplify.js'
import { generateVoicings } from './generate.js'

const easier = (symbol: string) => simplifyChord(symbol).map((c) => c.symbol)

describe('simplifyChord (#45)', () => {
    it("gives the plainer chords of a chord's family that are easier, the easiest first", () => {
        expect(easier('Cmaj9')).toEqual(['Cmaj7'])
        expect(easier('G5')).toEqual(['G'])
        expect(easier('Bm7b5')).toEqual(['Bm7'])
        expect(easier('E9')).toEqual(['E7', 'E'])
        expect(easier('Am9')).toEqual(['Am7', 'Am'])
        expect(easier('F#m7b5')).toEqual(['F#m7'])
        expect(easier('Caug')).toEqual(['C'])
        expect(easier('C6')).toEqual(['C'])
    })

    it('gives nothing when no plainer chord is easier', () => {
        // Already easy, or no easier chord in the family: the capo helps there.
        for (const chord of ['Am7', 'Em', 'G', 'F#', 'F', 'Eb5', 'Dsus4', 'Cadd9', 'Bdim'])
            expect(easier(chord)).toEqual([])
    })

    it('drops a bass only when the chord gets easier without it', () => {
        expect(easier('D/F#')).toEqual(['D'])
        expect(easier('Am/C')).toEqual(['Am'])
        expect(easier('C/G')).toEqual([])
        expect(easier('G/B')).toEqual([])
    })

    it('never gives a harder chord, and says how hard each one is', () => {
        for (const chord of ['Cmaj9', 'E9', 'C13', 'C7b9', 'G7sus4', 'Bm7b5', 'D/F#']) {
            const own = generateVoicings(chord)[0]!.difficulty
            const found = simplifyChord(chord)
            expect(found.length).toBeGreaterThan(0)
            for (const c of found) {
                expect(c.difficulty).toBeLessThan(own)
                expect(c.difficulty).toBe(generateVoicings(c.symbol)[0]!.difficulty)
                expect(c.frets).toEqual(generateVoicings(c.symbol)[0]!.frets)
            }
            expect(found.map((c) => c.difficulty)).toEqual(
                [...found.map((c) => c.difficulty)].sort((a, b) => a - b)
            )
        }
    })

    it("keeps the root as written, in the chord's other spellings too", () => {
        expect(easier('Ebmaj9')).toEqual(['Ebmaj7', 'Eb'])
        expect(easier('F#m7b5')).toEqual(['F#m7'])
        expect(easier('Bbm9')).toEqual(['Bbm7'])
        expect(easier('CM9')).toEqual(easier('Cmaj9'))
        expect(easier(' Cmaj9 ')).toEqual(['Cmaj7'])
    })

    it('reads no chord in other text', () => {
        for (const text of ['', 'Hello', 'N.C.', '%', 'x02220']) {
            expect(simplifyChord(text)).toEqual([])
            expect(easierChord(text)).toBe(text.trim())
        }
    })

    it('easierChord is the easiest one, else the chord itself', () => {
        expect(easierChord('Cmaj9')).toBe('Cmaj7')
        expect(easierChord('E9')).toBe('E7')
        expect(easierChord('Am7')).toBe('Am7')
        expect(easierChord('F#')).toBe('F#')
    })

    it('follows the tuning', () => {
        const ukulele = [67, 60, 64, 69]
        for (const c of simplifyChord('Cmaj9', { tuning: ukulele })) expect(c.frets).toHaveLength(4)
    })
})

describe('bestCapo (#45)', () => {
    const shapes = (chords: string[]) => {
        const best = bestCapo(chords)!
        return [best.capo, best.shapes.map((s) => s.shape).join(' '), best.open] as const
    }

    it('finds the capo that makes the most chords open shapes, with the shapes to play', () => {
        expect(shapes(['A', 'D', 'E', 'F#m'])).toEqual([2, 'G C D Em', 4])
        expect(shapes(['Bb', 'Eb', 'F', 'Gm'])).toEqual([3, 'G C D Em', 4])
        expect(shapes(['B', 'E', 'F#', 'G#m'])).toEqual([4, 'G C D Em', 4])
        expect(shapes(['Ab', 'Db', 'Eb', 'Fm'])).toEqual([1, 'G C D Em', 4])
    })

    it('says no capo when the chords are open already', () => {
        expect(shapes(['G', 'C', 'D', 'Em'])).toEqual([0, 'G C D Em', 4])
        expect(shapes(['Em', 'Am', 'D'])).toEqual([0, 'Em Am D', 3])
    })

    it('between frets with as many open shapes, takes the least effort: a low capo counts', () => {
        // Capo 6 has the easiest shapes (A E F#m D), but capo 1 (D A Bm G) is nearer the nut.
        const best = bestCapo(['Eb', 'Bb', 'Cm', 'Ab'])!
        expect([best.capo, best.open]).toEqual([1, 3])
        expect(best.shapes.map((s) => s.shape)).toEqual(['D', 'A', 'Bm', 'G'])
    })

    it('gives each chord once, as it sounds, with its shape, its frets and whether it is open', () => {
        const best = bestCapo(['A', 'D', 'A', 'F#m', ' D '])!
        expect(best.shapes.map((s) => s.chord)).toEqual(['A', 'D', 'F#m'])
        const [a] = best.shapes
        expect(a).toEqual({
            chord: 'A',
            shape: 'G',
            frets: generateVoicings('G')[0]!.frets,
            open: true,
            difficulty: generateVoicings('G')[0]!.difficulty
        })
        expect(best.open).toBe(3)
        expect(best.difficulty).toBeCloseTo(
            best.shapes.reduce((sum, s) => sum + s.difficulty, 0),
            6
        )
    })

    it('ranks every fret from 0 to maxCapo, the best first', () => {
        const all = capoChoices(['A', 'D', 'E', 'F#m'])
        expect(all.map((c) => c.capo).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
        expect(all[0]!.capo).toBe(2)
        for (let i = 1; i < all.length; i++)
            expect(all[i]!.open).toBeLessThanOrEqual(all[i - 1]!.open)
        expect(
            capoChoices(['A', 'D'], { maxCapo: 2 })
                .map((c) => c.capo)
                .sort()
        ).toEqual([0, 1, 2])
        expect(capoChoices(['A'], { maxCapo: 40 })).toHaveLength(13)
    })

    it('names shapes with a natural root when there is one, else as the chord is written', () => {
        expect(bestCapo(['Bb', 'Eb'], { maxCapo: 1 })!.shapes.map((s) => s.shape)).toEqual([
            'A',
            'D'
        ])
        const one = capoChoices(['Eb', 'F#'], { maxCapo: 1 }).find((c) => c.capo === 1)!
        expect(one.shapes.map((s) => s.shape)).toEqual(['D', 'F'])
        const flat = capoChoices(['Ab'], { maxCapo: 2 }).find((c) => c.capo === 2)!
        expect(flat.shapes[0]!.shape).toBe('Gb')
    })

    it('leaves out what is not a chord, and gives null when no chord reads', () => {
        expect(bestCapo(['N.C.', 'A', '%', 'D'])!.shapes.map((s) => s.chord)).toEqual(['A', 'D'])
        expect(bestCapo([])).toBeNull()
        expect(bestCapo(['N.C.', 'Hello'])).toBeNull()
        expect(capoChoices(['Hello'])).toEqual([])
    })
})
