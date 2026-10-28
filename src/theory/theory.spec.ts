import { describe, expect, it } from 'bun:test'
import { chromaOf, midiOf, nameOf, noteOf } from './pitch.js'
import { keyPrefersFlats, transposeChord, transposeKey } from './transpose.js'
import {
    chordNoteSet,
    intervalLabel,
    labelOf,
    listNoteSet,
    memberOf,
    scaleNoteSet
} from './note-set.js'

describe('pitch', () => {
    it('reads note names in ASCII and Unicode', () => {
        expect(chromaOf('C')).toBe(0)
        expect(chromaOf('F#')).toBe(6)
        expect(chromaOf('B♭')).toBe(10)
        expect(chromaOf('Cb')).toBe(11)
        expect(chromaOf('H')).toBeNull()
    })

    it('reads and writes scientific pitch notation', () => {
        expect(midiOf('C4')).toBe(60)
        expect(midiOf('A4')).toBe(69)
        expect(midiOf('B#3')).toBe(60)
        expect(midiOf('Cb4')).toBe(59)
        expect(midiOf('C')).toBeNull()
        expect(noteOf(61)).toBe('C#4')
        expect(noteOf(61, true)).toBe('Db4')
        expect(nameOf(-1)).toBe('B')
    })
})

describe('transpose', () => {
    it('transposes chord symbols with their bass', () => {
        expect(transposeChord('F#m7/C#', 2)).toBe('G#m7/D#')
        expect(transposeChord('Bb', 2)).toBe('C')
        expect(transposeChord('Bb', 1)).toBe('B')
        expect(transposeChord('A', 1)).toBe('A#')
        expect(transposeChord('A', 1, true)).toBe('Bb')
        expect(transposeChord('C', -1)).toBe('B')
        expect(transposeChord('N.C.', 3)).toBe('N.C.')
        expect(transposeChord('G', 12)).toBe('G')
        expect(transposeChord('C6/9', 2)).toBe('D6/9')
        expect(transposeChord('B♭', 2)).toBe('C')
        expect(transposeChord('A', 1.4)).toBe('A#')
        expect(transposeChord('A', 0.4)).toBe('A')
        expect(transposeChord('A', NaN)).toBe('A')
        expect(nameOf(NaN)).toBe('C')
    })

    it('knows which keys use flats', () => {
        expect(keyPrefersFlats('F')).toBe(true)
        expect(keyPrefersFlats('Dm')).toBe(true)
        expect(keyPrefersFlats('G')).toBe(false)
        expect(keyPrefersFlats('Em')).toBe(false)
    })

    it('transposes keys with their usual spelling', () => {
        expect(transposeKey('C', 1)).toBe('Db')
        expect(transposeKey('Am', 3)).toBe('Cm')
        expect(transposeKey('Am', 1)).toBe('Bbm')
        expect(transposeKey('E', 2)).toBe('F#')
    })
})

describe('note sets', () => {
    it('spells chords with degrees and intervals', () => {
        const set = chordNoteSet('Cmaj7')!
        expect(set.members.map((m) => m.name)).toEqual(['C', 'E', 'G', 'B'])
        expect(set.root).toBe(0)
        expect(labelOf(set.members[1]!, 'intervals')).toBe('3')
        expect(labelOf(set.members[0]!, 'intervals')).toBe('R')
        expect(labelOf(set.members[2]!, 'degrees')).toBe('5')
    })

    it('labels chord degrees by interval, not position', () => {
        expect(chordNoteSet('C7')!.members.map((m) => labelOf(m, 'degrees'))).toEqual([
            '1',
            '3',
            '5',
            '7'
        ])
    })

    it('reads every common spelling of a chord', () => {
        const notes = (s: string) =>
            chordNoteSet(s)
                ?.members.map((m) => m.name)
                .join(' ')
        expect(notes('CΔ7')).toBe(notes('Cmaj7'))
        expect(notes('Cmin6')).toBe(notes('Cm6'))
        expect(notes('CM9')).toBe(notes('Cmaj9'))
        expect(notes('Cø7')).toBe(notes('Cm7b5'))
        expect(notes('Cm(maj7)')).toBe('C Eb G B')
    })

    it('reads ♯ and ♭ and 6/9 chords', () => {
        expect(chordNoteSet('F♯m')!.root).toBe(6)
        expect(chordNoteSet('C6/9')!.members.map((m) => m.name)).toEqual(['C', 'E', 'G', 'A', 'D'])
    })

    it('adds a slash chord bass that is not in the chord', () => {
        const set = chordNoteSet('C/Bb')!
        expect(set.members.map((m) => m.name)).toEqual(['C', 'E', 'G', 'Bb'])
        expect(set.members[3]!.degree).toBeNull()
        expect(chordNoteSet('C/G')!.members).toHaveLength(3)
    })

    it('writes intervals the way musicians do', () => {
        expect(
            ['1P', '3m', '3M', '5d', '5P', '5A', '7m', '7d', '9m', '11A', '13M'].map(intervalLabel)
        ).toEqual(['R', 'b3', '3', 'b5', '5', '#5', 'b7', 'bb7', 'b9', '#11', '13'])
    })

    it('reads scales', () => {
        const set = scaleNoteSet('A minor pentatonic')!
        expect(set.members.map((m) => m.name)).toEqual(['A', 'C', 'D', 'E', 'G'])
        expect(set.root).toBe(9)
        expect(scaleNoteSet('F major')!.preferFlats).toBe(true)
        expect(scaleNoteSet('nonsense')).toBeNull()
    })

    it('reads plain lists, with or without octaves', () => {
        expect(listNoteSet('A C E')!.root).toBeNull()
        const exact = listNoteSet('A3 C#4 E4')!
        expect(exact.pitches).toEqual([57, 61, 64])
        expect(memberOf(exact, 61)?.name).toBe('C#')
        expect(memberOf(exact, 73)).toBeUndefined()
        expect(listNoteSet('A X E')).toBeNull()
    })
})
