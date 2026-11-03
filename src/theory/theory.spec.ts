import { describe, expect, it } from 'bun:test'
import { chromaOf, midiOf, nameOf, noteOf } from './pitch.js'
import { keyMove, keyPrefersFlats, transposeChord, transposeKey } from './transpose.js'
import { keyChords, readKey } from './keys.js'
import {
    chordNoteSet,
    intervalFrom,
    intervalLabel,
    labelOf,
    listNoteSet,
    memberOf,
    rootNameOf,
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
        // A sharp tonic is a sharp key: "F#" isn't F followed by something.
        expect(keyPrefersFlats('F#')).toBe(false)
        expect(keyPrefersFlats('C#')).toBe(false)
        expect(keyPrefersFlats('F#m')).toBe(false)
        expect(keyPrefersFlats('F# major')).toBe(false)
        expect(keyPrefersFlats('F major')).toBe(true)
        expect(keyPrefersFlats('Fmaj')).toBe(true)
        expect(keyPrefersFlats('Gm')).toBe(true)
        expect(keyPrefersFlats('G minor')).toBe(true)
    })

    it('moves chords between keys by letters', () => {
        expect(keyMove('G', -1)).toEqual({ from: 'G', to: 'F#' })
        const g = keyMove('G', -1)!
        expect(['G', 'C', 'D', 'F#dim', 'D/F#'].map((c) => transposeChord(c, -1, g))).toEqual([
            'F#',
            'B',
            'C#',
            'E#dim',
            'C#/E#'
        ])
        const em = keyMove('Em', -1)!
        expect(['Em', 'Am', 'B7', 'C', 'D'].map((c) => transposeChord(c, -1, em))).toEqual([
            'Ebm',
            'Abm',
            'Bb7',
            'Cb',
            'Db'
        ])
        // A move that doesn't match the semitones falls back to the new key's sharps or flats.
        expect(transposeChord('C', 2, { from: 'C', to: 'Eb' })).toBe('D')
    })

    it('keeps the chords of every key in its key, whatever the move', () => {
        const majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']
        const minors = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']
        for (const key of [...majors, ...minors]) {
            const from = readKey(key)!
            for (let steps = -11; steps <= 11; steps++) {
                const moved = transposeKey(key, steps)
                const move = keyMove(key, steps)!
                const to = readKey(moved)!
                const chords = keyChords(from, true).map((c) =>
                    transposeChord(c.symbol, steps, move)
                )
                expect([key, steps, chords]).toEqual([
                    key,
                    steps,
                    keyChords(to, true).map((c) => c.symbol)
                ])
            }
        }
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

    it('reads lists with a root: intervals, degrees and the root (#33)', () => {
        const set = listNoteSet('C Eb G Bb', 'C')!
        expect(set.root).toBe(0)
        expect(set.list).toBe(true)
        expect(set.members.map((m) => m.interval)).toEqual(['1P', '3m', '5P', '7m'])
        expect(set.members.map((m) => labelOf(m, 'intervals'))).toEqual(['R', 'b3', '5', 'b7'])
        expect(set.members.map((m) => labelOf(m, 'degrees'))).toEqual(['1', '3', '5', '7'])
        expect(set.members.map((m) => labelOf(m, 'notes'))).toEqual(['C', 'Eb', 'G', 'Bb'])
        // The root doesn't have to be in the list.
        const map = listNoteSet('Eb F# A', 'C')!
        expect(map.root).toBe(0)
        expect(map.members.map((m) => labelOf(m, 'intervals'))).toEqual(['b3', '#4', '6'])
        // Exact pitches keep their keys; the root may be written in any case or with an octave.
        const exact = listNoteSet('A3 C4 E4', 'a')!
        expect(exact.pitches).toEqual([57, 60, 64])
        expect(exact.members.map((m) => m.interval)).toEqual(['1P', '3m', '5P'])
        expect(listNoteSet('C E', 'C4')!.root).toBe(0)
        expect(listNoteSet('C E', 'H')).toBeNull()
        expect(listNoteSet('A C E')!.members[0]!.interval).toBeNull()
    })

    it('spells intervals by their letters and keeps the names as written', () => {
        expect(intervalFrom('C', 'D#')).toBe('2A')
        expect(intervalFrom('C', 'Gb')).toBe('5d')
        expect(intervalFrom('E♭', 'g')).toBe('3M')
        // Unisons and octaves that aren't perfect take the usual name; the root's chroma is R.
        expect(intervalFrom('C', 'C#')).toBe('2m')
        expect(intervalFrom('C', 'Cb')).toBe('7M')
        expect(intervalFrom('C', 'B#')).toBe('1P')
        expect(intervalFrom('C', 'X')).toBeNull()
        expect(listNoteSet('D♭ F', 'Db')!.members.map((m) => m.name)).toEqual(['D♭', 'F'])
        expect(rootNameOf('f♯')).toBe('F#')
        expect(rootNameOf('Bb3')).toBe('Bb')
        expect(rootNameOf('')).toBeNull()
    })
})
