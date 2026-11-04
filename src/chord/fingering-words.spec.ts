import { describe, expect, it } from 'bun:test'
import { fingeringInWords } from './fingering-words.js'
import { parseFingers, parseFrets } from './guitar.js'
import { parseTuning } from '../fretboard/tuning.js'

const guitar = (frets: string, fingers?: string, more: Record<string, unknown> = {}) =>
    fingeringInWords({
        frets: parseFrets(frets)!,
        ...(fingers ? { fingers: parseFingers(fingers) } : {}),
        ...more
    })

describe('fingeringInWords: guitar (#53)', () => {
    it('says the strings to strum, each finger and the open strings', () => {
        expect(guitar('x02220', 'x01230')).toEqual([
            'Strum from the 5th string (A).',
            'Index on the D string, 2nd fret.',
            'Middle on the G string, 2nd fret.',
            'Ring on the B string, 2nd fret.',
            'The A and high E strings ring open.'
        ])
    })

    it('calls one finger on two strings a barre only when no string between rings open', () => {
        expect(guitar('x20200', 'x10100')).toEqual([
            'Strum from the 5th string (A).',
            'Index on the A and G strings, 2nd fret.',
            'The D, B and high E strings ring open.'
        ])
        // A string between at a higher fret, or muted, keeps the barre.
        expect(guitar('x24442', 'x13331')).toContain('Index bars the 2nd fret, strings 1 to 5.')
        expect(guitar('3x0003', '1x0001')).toContain(
            'Index on the low E and high E strings, 3rd fret.'
        )
    })

    it('says a barre once, with its strings', () => {
        expect(guitar('133211', '134211')).toEqual([
            'Strum all six strings.',
            'Index bars the 1st fret, strings 1 to 6.',
            'Ring on the A string, 3rd fret.',
            'Pinky on the D string, 3rd fret.',
            'Middle on the G string, 2nd fret.'
        ])
    })

    it('works out the fingers of frets written alone', () => {
        expect(guitar('133211')).toEqual(guitar('133211', '134211'))
        expect(guitar('xx0232')).toEqual([
            'Strum from the 4th string (D).',
            'Index on the G string, 2nd fret.',
            'Ring on the B string, 3rd fret.',
            'Middle on the high E string, 2nd fret.',
            'The D string rings open.'
        ])
    })

    it('counts frets from the capo, as the diagram draws them', () => {
        expect(guitar('x32010', 'x32010', { capo: 2 })).toEqual([
            'Capo on the 2nd fret: frets count from the capo.',
            'Strum from the 5th string (A).',
            'Ring on the A string, 3rd fret.',
            'Middle on the D string, 2nd fret.',
            'Index on the B string, 1st fret.',
            'The G and high E strings ring at the capo.'
        ])
    })

    it('with frets-from: nut, says the real frets and rings strings at the capo', () => {
        expect(guitar('x54232', undefined, { capo: 2, fretsFrom: 'nut' })).toEqual([
            'Capo on the 2nd fret.',
            'Strum from the 5th string (A).',
            'Ring on the A string, 5th fret.',
            'Middle on the D string, 4th fret.',
            'Index on the B string, 3rd fret.',
            'The G and high E strings ring at the capo.'
        ])
    })

    it('names the strings of other tunings by their notes', () => {
        // DADGAD: two strings share a name, so every string goes by its number and note.
        expect(guitar('x00230', 'x00120', { tuning: parseTuning('DADGAD')! })).toEqual([
            'Strum from the 5th string (A).',
            'Index on the 3rd string (G), 2nd fret.',
            'Middle on the 2nd string (A), 3rd fret.',
            'The 5th string (A), the 4th string (D) and the 1st string (D) ring open.'
        ])
        // Drop D: the 6th and 4th strings are both D, so numbers too.
        expect(guitar('000232', undefined, { tuning: parseTuning('Drop D')! })).toContain(
            'The 6th string (D), the 5th string (A) and the 4th string (D) ring open.'
        )
        // Standard tuning keeps the names: only the outer strings share one (low E, high E).
        expect(guitar('022000', '023000')).toContain(
            'The low E, G, B and high E strings ring open.'
        )
    })

    it('mutes strings inside the strummed range, and stops at the highest string that sounds', () => {
        expect(guitar('x3x55x', 'x1x34x')).toEqual([
            'Strum from the 5th string (A) to the 2nd string (B).',
            'Index on the A string, 3rd fret.',
            'Ring on the G string, 5th fret.',
            'Pinky on the B string, 5th fret.',
            'Mute the D string: let a fretting finger touch it lightly.'
        ])
    })

    it('names the thumb over the neck', () => {
        expect(guitar('2x0232', 'Tx0132')[1]).toBe('Thumb on the low E string, 2nd fret.')
    })

    it('numbers the strings of an unknown tuning', () => {
        expect(guitar('0232', '0132')).toEqual([
            'Strum every string.',
            'Index on the 3rd string, 2nd fret.',
            'Ring on the 2nd string, 3rd fret.',
            'Middle on the 1st string, 2nd fret.',
            'The 4th string rings open.'
        ])
    })

    it('says when nothing sounds', () => {
        expect(guitar('xxxxxx')).toEqual(['Every string is muted: no note sounds.'])
    })
})

describe('fingeringInWords: piano (#53)', () => {
    it('says each finger on its key', () => {
        expect(
            fingeringInWords({
                keys: [60, 64, 67],
                fingers: new Map([
                    [60, '1'],
                    [64, '3'],
                    [67, '5']
                ])
            })
        ).toEqual(['Thumb on C, middle finger on E, little finger on G.'])
    })

    it('says each hand, left first, with every octave when a name comes twice', () => {
        expect(
            fingeringInWords({
                keys: [52, 60, 64, 67],
                fingers: new Map([
                    [52, '5'],
                    [60, '1'],
                    [64, '3'],
                    [67, '5']
                ]),
                hands: new Map([
                    [52, 'left'],
                    [60, 'right'],
                    [64, 'right'],
                    [67, 'right']
                ])
            })
        ).toEqual([
            'Left hand: little finger on E3.',
            'Right hand: thumb on C4, middle finger on E4, little finger on G4.'
        ])
    })

    it('lists the keys when no fingers are given, spelled as the chord spells them', () => {
        expect(
            fingeringInWords({
                keys: [61, 65, 68],
                names: new Map([
                    [1, 'Db'],
                    [5, 'F'],
                    [8, 'Ab']
                ])
            })
        ).toEqual(['Play Db, F and Ab.'])
    })
})

describe('fingeringInWords: spelled octaves (#53)', () => {
    it('gives a spelled name its own octave (B#3 is MIDI 60, Cb5 is MIDI 71)', () => {
        expect(fingeringInWords({ keys: [60, 64, 67, 72], names: new Map([[0, 'B#']]) })).toEqual([
            'Play B#3, E4, G4 and B#4.'
        ])
        expect(
            fingeringInWords({
                keys: [52, 64, 68, 71],
                names: new Map([
                    [4, 'Fb'],
                    [8, 'Ab'],
                    [11, 'Cb']
                ]),
                hands: new Map([
                    [52, 'left'],
                    [64, 'right'],
                    [68, 'right'],
                    [71, 'right']
                ])
            })
        ).toEqual(['Left hand: Fb3.', 'Right hand: Fb4, Ab4 and Cb5.'])
    })
})
