import { describe, expect, it } from 'bun:test'
import {
    belowLowIntervalLimit,
    voiceLead,
    voiceLeadVoicings,
    voiceMotion
} from './voice-leading.js'
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
        expect(bad).toBeNull() // A bass that is the chord's third or seventh isn't doubled above (G/B: no B over B2).
        const [, gb] = voiceLead(['C', 'G/B', 'Am'])
        expect(gb!.slice(1).some((p) => p % 12 === 11)).toBe(false)
        expect(gb![0]! % 12).toBe(11)
        const [, c7] = voiceLead(['F', 'C7/Bb'])
        expect(c7!.slice(1).some((p) => p % 12 === 10)).toBe(false)
        // A root or fifth bass stays in the chord above (C/G keeps its G).
        const [, cg] = voiceLead(['F', 'C/G'])
        expect(cg!.slice(1).some((p) => p % 12 === 7)).toBe(true)
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

    it('keeps rootless voicings clear and out of the low end (#68)', () => {
        // A long progression comes back up rather than sitting on C3.
        const cycle = Array.from({ length: 3 }, () => [
            'Cmaj7',
            'C7',
            'Fmaj7',
            'Fm6',
            'Em7',
            'A7',
            'Dm7',
            'G7'
        ]).flat()
        voiceLeadVoicings(cycle, { voicing: 'rootless' }).forEach((v, i) => {
            if (i > 0) expect(v!.pitches[0]!).toBeGreaterThanOrEqual(50)
            expect(belowLowIntervalLimit(v!.pitches)).toBe(false)
        })
        // A sus chord whose A form would blur (C3 D3) takes the other one.
        const sus = voiceLeadVoicings(['G7sus4', 'Cmaj7'], { voicing: 'rootless' })
        expect(names(sus[0]!.pitches)).toBe('F3 A3 C4 D4')
        // With both hands, the right hand stays from F3 up, above the left hand's root.
        voiceLeadVoicings(cycle, { voicing: 'rootless', hands: 'left+right' }).forEach((v) => {
            expect(v!.pitches[1]!).toBeGreaterThanOrEqual(53)
        })
    })

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
            // G7b9 going to Cm6 takes the b13.
            'B F3 Ab3 B3 Eb4',
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

    it('leads the right hand of both-hand shells by step, the root free in the left hand', () => {
        // A minor ii-V-i: the guide tones move by step (D4 A4, D4 G#4, C4 G4), the roots
        // B2, E2, A2 under them. Before, the root's window held E7 at E3 and the right hand
        // jumped to G#4 D5.
        expect(forms(['Bm7b5', 'E7', 'Am7'], { voicing: 'shell', hands: 'left+right' })).toEqual([
            'R-3 B2 D4 A4',
            'R-7 E2 D4 Ab4',
            'R-3 A2 C4 G4'
        ])
        // The same in D minor already moved by step: unchanged.
        expect(forms(['Em7b5', 'A7', 'Dm7'], { voicing: 'shell', hands: 'left+right' })).toEqual([
            'R-3 E3 G4 D5',
            'R-7 A2 G4 Db5',
            'R-3 D3 F4 C5'
        ])
        // The right hand stays between G3 and C5 at its lowest over a long progression.
        const cycle = Array.from({ length: 4 }, () => ['Bm7b5', 'E7', 'Am7', 'Dm7', 'G7', 'Cmaj7'])
        for (const v of voiceLeadVoicings(cycle.flat(), {
            voicing: 'shell',
            hands: 'left+right'
        })) {
            const right = v!.pitches.slice(1)
            expect(right[0]!).toBeGreaterThanOrEqual(55)
            expect(right[0]!).toBeLessThanOrEqual(72)
            expect(v!.pitches[0]!).toBeGreaterThanOrEqual(36)
        }
    })

    it('takes R-7 for a chord whose R-3 third would sit below the low interval limit', () => {
        // A2 C3 (a minor third under C3) and Ab2 B2 sound muddy: R-7 instead, then the
        // alternation goes on.
        expect(forms(['Am7', 'D7', 'Gmaj7'], { voicing: 'shell' })).toEqual([
            'R-7 A2 G3 C4',
            'R-3 D3 Gb3 C4',
            'R-7 G2 Gb3 B3'
        ])
        expect(forms(['Abm7', 'Db7', 'Gbmaj7'], { voicing: 'shell' })).toEqual([
            'R-7 Ab2 Gb3 B3',
            'R-3 Db3 F3 B3',
            'R-7 Gb2 F3 Bb3'
        ])
        // The written form too: shell R-3 on Am7 is still A2 G3 C4.
        expect(forms(['Am7'], { voicing: 'shell', form: 'R-3' })[0]).toBe('R-7 A2 G3 C4')
        // Clear thirds stay R-3: D3 F3, C3 E3, Bb2 D3 (a major third from Bb2 is fine).
        expect(forms(['Dm7', 'G7', 'Cmaj7'], { voicing: 'shell' })).toEqual([
            'R-3 D3 F3 C4',
            'R-7 G2 F3 B3',
            'R-3 C3 E3 B3'
        ])
        expect(forms(['Bbmaj7'], { voicing: 'shell' })[0]).toBe('R-3 Bb2 D3 A3')
        // Both hands: the third sounds a tenth above the root (A2 + C4), so R-3 stays. The
        // right hand then moves by step (C4 G4, C4 F#4, B3 F#4), D7's root in the left hand at D2.
        expect(forms(['Am7', 'D7', 'Gmaj7'], { voicing: 'shell', hands: 'left+right' })).toEqual([
            'R-3 A2 C4 G4',
            'R-7 D2 C4 Gb4',
            'R-3 G2 B3 Gb4'
        ])
        expect(forms(['Abm7', 'Db7', 'Gbmaj7'], { voicing: 'shell', hands: 'left+right' })[0]).toBe(
            'R-3 Ab2 B3 Gb4'
        )
        expect(forms(['Dm7', 'G7', 'Cmaj7'], { voicing: 'shell', hands: 'left+right' })).toEqual([
            'R-3 D3 F4 C5',
            'R-7 G2 F4 B4',
            'R-3 C3 E4 B4'
        ])
    })

    it('starts a shell progression in the same range whatever its root', () => {
        // Every root fits the first chord's window (the root from F2 to G3), R-3 or R-7.
        for (const root of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
            for (const form of ['R-3', 'R-7'] as const) {
                const [first] = voiceLeadVoicings([`${root}m7`], { voicing: 'shell', form })
                const [low, high] = first!.options.shell === 'R-3' ? [44, 55] : [41, 52]
                expect(first!.pitches[0]!).toBeGreaterThanOrEqual(low)
                expect(first!.pitches[0]!).toBeLessThanOrEqual(high)
                expect(belowLowIntervalLimit(first!.pitches)).toBe(false)
            }
        }
    })

    it('knows the low interval limits', () => {
        // The lowest note of each interval that still sounds clear (C3 = 48).
        expect(belowLowIntervalLimit([48, 51])).toBe(false) // C3 Eb3
        expect(belowLowIntervalLimit([47, 50])).toBe(true) // B2 D3
        expect(belowLowIntervalLimit([46, 50])).toBe(false) // Bb2 D3
        expect(belowLowIntervalLimit([45, 49])).toBe(true) // A2 C#3
        expect(belowLowIntervalLimit([41, 51])).toBe(false) // F2 Eb3
        expect(belowLowIntervalLimit([40, 50])).toBe(true) // E2 D3
        expect(belowLowIntervalLimit([36, 48])).toBe(false) // an octave
        expect(belowLowIntervalLimit([45, 57, 60])).toBe(false) // A2 A3 C4
        expect(belowLowIntervalLimit([45, 55, 57, 60])).toBe(false) // A2 G3 A3 C4
        expect(belowLowIntervalLimit([45, 55, 57, 59])).toBe(false) // G3 A3: a second above E3
        expect(belowLowIntervalLimit([45, 50, 51])).toBe(true) // D3 Eb3
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
