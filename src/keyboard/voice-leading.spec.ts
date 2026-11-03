import { describe, expect, it } from 'bun:test'
import { voiceLead, voiceLeadVoicings, voiceMotion } from './voice-leading.js'
import { noteOf } from '../theory/pitch.js'

const names = (pitches: number[] | null | undefined) =>
    pitches?.map((p) => noteOf(p, true)).join(' ')

describe('voiceMotion', () => {
    it('moves each voice to its own note', () => {
        // D F A C to D F G B: two common tones, A to G and C to B.
        expect(voiceMotion([62, 65, 69, 72], [62, 65, 67, 71])).toBe(3)
        // Not "nearest note both ways": E G B C from D F G B moves 9 semitones, C E G B 3.
        expect(voiceMotion([62, 65, 67, 71], [64, 67, 71, 72])).toBe(9)
        expect(voiceMotion([62, 65, 67, 71], [60, 64, 67, 71])).toBe(3)
        // A triad to a seventh chord: the extra note counts its distance to the nearest one.
        expect(voiceMotion([57, 62, 65], [56, 59, 62, 64])).toBe(4)
        expect(voiceMotion([], [60])).toBe(0)
    })
})

describe('voiceLead', () => {
    it('starts in root position and moves as little as it can', () => {
        // C E G, then G as B D G (first inversion), Am as C E A, F as C F A.
        expect(voiceLead(['C', 'G', 'Am', 'F'])).toEqual([
            [60, 64, 67],
            [59, 62, 67],
            [60, 64, 69],
            [60, 65, 69]
        ])
    })

    it('keeps a long progression in the middle of the keyboard', () => {
        const chords = Array.from({ length: 12 }, () => [
            'C',
            'F',
            'Bb',
            'Eb',
            'Ab',
            'Db',
            'Gb',
            'B',
            'E',
            'A',
            'D',
            'G'
        ]).flat()
        for (const pitches of voiceLead(chords)) {
            expect(pitches![0]!).toBeGreaterThanOrEqual(53)
            expect(pitches![0]!).toBeLessThanOrEqual(67)
        }
    })

    it('puts a slash chord’s bass below, and leaves out chords that do not read', () => {
        const [c, ce, bad] = voiceLead(['C', 'C/Bb', 'Hm'])
        expect(c).toEqual([60, 64, 67])
        expect(ce![0]).toBe(46)
        expect(ce!.slice(1)).toEqual([60, 64, 67])
        expect(bad).toBeNull()
    })

    it('voices a ii-V-I as the textbook does (#63)', () => {
        expect(voiceLead(['Dm7', 'G7', 'Cmaj7']).map(names)).toEqual([
            'D4 F4 A4 C5',
            'D4 F4 G4 B4',
            'C4 E4 G4 B4'
        ])
        // i iv V7 i in A minor: A stays, C goes to D, E to F.
        expect(voiceLead(['Am', 'Dm', 'E7', 'Am']).map(names)).toEqual([
            'A3 C4 E4',
            'A3 D4 F4',
            'Ab3 B3 D4 E4',
            'A3 C4 E4'
        ])
    })
})

describe('voiceLeadVoicings', () => {
    const forms = (symbols: string[], options: Parameters<typeof voiceLeadVoicings>[1]) =>
        voiceLeadVoicings(symbols, options).map((v) =>
            v ? `${v.options.rootless ?? v.options.shell} ${names(v.pitches)}` : null
        )

    it('alternates rootless A and B around middle C', () => {
        expect(forms(['Dm7', 'G7', 'Cmaj7'], { voicing: 'rootless' })).toEqual([
            'A F3 A3 C4 E4',
            'B F3 A3 B3 E4',
            'A E3 G3 B3 D4'
        ])
        expect(forms(['Cm7', 'F7', 'Bbmaj7'], { voicing: 'rootless' })).toEqual([
            'A Eb3 G3 Bb3 D4',
            'B Eb3 G3 A3 D4',
            'A D3 F3 A3 C4'
        ])
        // A minor ii-V-i, with the half-diminished voicing.
        expect(forms(['Dm7b5', 'G7b9', 'Cm6'], { voicing: 'rootless' })).toEqual([
            'A F3 Ab3 C4 E4',
            'B F3 Ab3 B3 E4',
            'A Eb3 G3 A3 D4'
        ])
        // The first chord takes the form asked for.
        expect(forms(['Dm7', 'G7'], { voicing: 'rootless', form: 'B' })[0]).toBe('B C3 E3 F3 A3')
    })

    it('keeps a long rootless progression between C3 and C5', () => {
        const chords = ['Cm7', 'F7', 'Bbmaj7', 'Ebmaj7', 'Am7b5', 'D7', 'Gm7', 'G7', 'C6']
        for (const v of voiceLeadVoicings([...chords, ...chords, ...chords], {
            voicing: 'rootless'
        })) {
            expect(v!.pitches[0]!).toBeGreaterThanOrEqual(48)
            expect(v!.pitches[v!.pitches.length - 1]!).toBeLessThanOrEqual(72)
        }
    })

    it('alternates R-3 and R-7 shells, the third and seventh moving least', () => {
        expect(forms(['Cm7', 'F7', 'Bbmaj7'], { voicing: 'shell' })).toEqual([
            'R-3 C3 Eb3 Bb3',
            'R-7 F2 Eb3 A3',
            'R-3 Bb2 D3 A3'
        ])
        // Both hands: the root in the left hand, the third and seventh an octave up.
        expect(forms(['Dm7', 'G7', 'Cmaj7'], { voicing: 'shell', hands: 'left+right' })).toEqual([
            'R-3 D3 F4 C5',
            'R-7 G2 F4 B4',
            'R-3 C3 E4 B4'
        ])
    })

    it('starts a shell progression on A or Ab in the same range as the others', () => {
        expect(forms(['Am7', 'D7', 'Gmaj7'], { voicing: 'shell' })).toEqual([
            'R-3 A2 C3 G3',
            'R-3 D3 Gb3 C4',
            'R-7 G2 Gb3 B3'
        ])
        expect(forms(['Abm7', 'Db7', 'Gbmaj7'], { voicing: 'shell' })[0]).toBe('R-3 Ab2 B2 Gb3')
        expect(forms(['Am7', 'D7'], { voicing: 'shell', hands: 'left+right' })[0]).toBe(
            'R-3 A2 C4 G4'
        )
        // Every root fits the first chord's window, R-3 or R-7.
        for (const root of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
            for (const form of ['R-3', 'R-7'] as const) {
                const [first] = voiceLeadVoicings([`${root}m7`], { voicing: 'shell', form })
                expect(first!.pitches[0]!).toBeGreaterThanOrEqual(form === 'R-3' ? 44 : 41)
                expect(first!.pitches[0]!).toBeLessThanOrEqual(form === 'R-3' ? 55 : 52)
            }
        }
    })

    it('moves the range with octave, and leaves out chords it cannot voice', () => {
        expect(forms(['Dm7', 'G7'], { voicing: 'rootless', octave: 4 })[0]).toBe('A F4 A4 C5 E5')
        expect(forms(['Dm7', 'C', 'Hm7'], { voicing: 'shell' })).toEqual([
            'R-3 D3 F3 C4',
            null,
            null
        ])
    })
})
