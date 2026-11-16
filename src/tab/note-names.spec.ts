import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import { nameNotes, namesOf, namesOfBeat, type NamedBeat, type NamedScore } from './note-names.js'

const note = (realValue: number, more: Partial<NamedBeat['notes'][number]> = {}) => ({
    realValue,
    isDead: false,
    isTieDestination: false,
    ...more
})
const beat = (notes: NamedBeat['notes'], more: Partial<NamedBeat> = {}): NamedBeat => ({
    isRest: false,
    notes,
    lyrics: null,
    text: null,
    ...more
})

describe('namesOfBeat', () => {
    it('names the notes, the highest first, without octaves', () => {
        // An open C chord: C3 E3 G3 C4 E4.
        expect(
            namesOfBeat(beat([48, 52, 55, 60, 64].map((n) => note(n))), 'letters', false)
        ).toEqual(['E', 'C', 'G', 'E', 'C'])
    })
    it('writes sharps, or flats in a key with flats', () => {
        expect(namesOfBeat(beat([note(61), note(70)]), 'letters', false)).toEqual(['A#', 'C#'])
        expect(namesOfBeat(beat([note(61), note(70)]), 'letters', true)).toEqual(['Bb', 'Db'])
    })
    it('follows the naming: solfège and German', () => {
        expect(namesOfBeat(beat([note(60), note(71), note(70)]), 'solfege', true)).toEqual([
            'Si',
            'Si♭',
            'Do'
        ])
        expect(namesOfBeat(beat([note(71), note(70)]), 'german', true)).toEqual(['H', 'B'])
    })
    it('a rest, a dead note and a tied note have no name', () => {
        expect(namesOfBeat(beat([note(60)], { isRest: true }), 'letters', false)).toEqual([])
        expect(
            namesOfBeat(
                beat([note(60, { isDead: true }), note(64, { isTieDestination: true }), note(67)]),
                'letters',
                false
            )
        ).toEqual(['G'])
    })
})

describe('nameNotes', () => {
    const scoreOf = (beats: NamedBeat[], more: { isPercussion?: boolean; key?: number } = {}) =>
        ({
            tracks: [
                {
                    staves: [
                        {
                            isPercussion: more.isPercussion ?? false,
                            bars: [{ keySignature: more.key ?? 0, voices: [{ beats }] }]
                        }
                    ]
                }
            ]
        }) satisfies NamedScore

    it('gives each beat its names as lyrics, and takes them away again', () => {
        const beats = [beat([note(64)]), beat([note(48), note(52)]), beat([], { isRest: true })]
        const undo = nameNotes(scoreOf(beats))
        expect(beats.map((b) => b.lyrics)).toEqual([['E'], ['E', 'C'], null])
        undo()
        expect(beats.map((b) => b.lyrics)).toEqual([null, null, null])
    })

    it('reads the key of each bar for flats', () => {
        const beats = [beat([note(70)])]
        nameNotes(scoreOf(beats, { key: -2 }))
        expect(beats[0]!.lyrics).toEqual(['Bb'])
    })

    it('leaves drum staves alone', () => {
        const beats = [beat([note(38)])]
        nameNotes(scoreOf(beats, { isPercussion: true }))
        expect(beats[0]!.lyrics).toBeNull()
    })

    it("a staff with lyrics of its own keeps them: the names go in the beats' text", () => {
        const beats = [beat([note(60)], { lyrics: ['Hel-'] }), beat([note(48), note(64)])]
        const undo = nameNotes(scoreOf(beats), 'solfege')
        expect(beats.map((b) => b.lyrics)).toEqual([['Hel-'], null])
        expect(beats.map((b) => b.text)).toEqual(['Do', 'Mi Do'])
        undo()
        expect(beats.map((b) => b.text)).toEqual([null, null])
    })

    it("names the notes of a score alphaTab read, from its own model's fields", () => {
        const score = alphaTab.importer.ScoreLoader.loadAlphaTex(':4 0.6 3.6 (0.1 1.2 0.3).2')
        nameNotes(score)
        const beats = score.tracks[0]!.staves[0]!.bars[0]!.voices[0]!.beats
        expect(beats.map((b) => b.lyrics)).toEqual([['E'], ['G'], ['E', 'C', 'G']])
    })
})

describe('namesOf', () => {
    it('reads on and off', () => {
        expect(namesOf('on')).toBe(true)
        expect(namesOf(' Yes ')).toBe(true)
        expect(namesOf('off')).toBe(false)
        expect(namesOf('no')).toBe(false)
        expect(namesOf('maybe')).toBeNull()
        expect(namesOf('')).toBeNull()
    })
})
