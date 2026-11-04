import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import { DEFAULT_EXERCISE_TEMPO, exerciseTab, parseDirection, parseRhythm } from './exercise.js'
import { neckPositions } from './positions.js'
import { scaleNoteSet } from '../theory/note-set.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import * as api from '../index.js'

/** The notes of an exercise (fret.string), rests left out, in order. */
const notesOf = (tex: string) =>
    tex
        .split('\n')
        .filter((line) => !line.startsWith('\\') && line !== '.')
        .join(' ')
        .replace(/:\d+|\{tu 3\}|\|/g, ' ')
        .split(/\s+/)
        .filter((t) => t && t !== 'r')

/** The pitch of a fret.string token on a tuning given lowest string first. */
const pitchOf = (token: string, tuning = STANDARD_TUNING) => {
    const [fret, string] = token.split('.').map(Number)
    return tuning[tuning.length - string!]! + fret!
}

describe('exerciseTab', () => {
    it('plays A minor pentatonic box 1 up and down in eighths', () => {
        expect(exerciseTab({ scale: 'A minor pentatonic' }, { position: 1 })).toBe(
            [
                `\\tempo ${DEFAULT_EXERCISE_TEMPO}`,
                '.',
                '\\ts 4 4',
                ':8 5.6 8.6 5.5 7.5 5.4 7.4 5.3 7.3 |',
                '5.2 8.2 5.1 8.1 5.1 8.2 5.2 7.3 |',
                '5.3 7.4 5.4 7.5 5.5 8.6 5.6 r'
            ].join('\n')
        )
    })

    it('goes up or down only, in sixteenths or triplets', () => {
        expect(
            exerciseTab(
                { scale: 'A minor pentatonic' },
                { position: 1, direction: 'up', rhythm: '16ths', tempo: 92 }
            )
        ).toBe(
            [
                '\\tempo 92',
                '.',
                '\\ts 4 4',
                ':16 5.6 8.6 5.5 7.5 5.4 7.4 5.3 7.3 5.2 8.2 5.1 8.1 r r r r'
            ].join('\n')
        )
        // Triplets: three eighths a beat in 4/4, so the metronome clicks the quarters.
        expect(
            exerciseTab(
                { scale: 'A minor pentatonic' },
                { position: 1, direction: 'down', rhythm: 'triplets' }
            )
        ).toBe(
            [
                `\\tempo ${DEFAULT_EXERCISE_TEMPO}`,
                '.',
                '\\ts 4 4',
                ':8 {tu 3} 8.1 5.1 8.2 5.2 7.3 5.3 7.4 5.4 7.5 5.5 8.6 5.6'
            ].join('\n')
        )
    })

    it('starts and ends on the lowest root when notes lie below it', () => {
        // G major, E shape: F# lies under the root G on the low E string.
        const tex = exerciseTab({ scale: 'G major' }, { shape: 'E' })
        const notes = notesOf(tex)
        const pitches = notes.map((n) => pitchOf(n))
        const lowestRoot = Math.min(...pitches.filter((p) => p % 12 === 7))
        expect(pitches[0]).toBe(lowestRoot)
        expect(pitches[pitches.length - 1]).toBe(lowestRoot)
        expect(Math.min(...pitches)).toBeLessThan(lowestRoot)
        // The top and the bottom note once each.
        const top = Math.max(...pitches)
        const bottom = Math.min(...pitches)
        expect(pitches.filter((p) => p === top)).toHaveLength(1)
        expect(pitches.filter((p) => p === bottom)).toHaveLength(1)
    })

    it('plays every note of the position once going up', () => {
        const set = scaleNoteSet('C major')!
        const neck = neckPositions(set, STANDARD_TUNING, 'caged')
        neck.forEach((cells, i) => {
            const notes = notesOf(
                exerciseTab({ scale: 'C major' }, { position: i + 1, direction: 'up' })
            )
            const pitches = notes.map((n) => pitchOf(n))
            expect(new Set(pitches).size).toBe(cells!.length)
            expect([...pitches].sort((a, b) => a - b)).toEqual(pitches)
        })
    })

    it('plays an arpeggio from its CAGED shape', () => {
        const notes = notesOf(exerciseTab({ arpeggio: 'Am7' }, { position: 1, direction: 'up' }))
        const pitches = notes.map((n) => pitchOf(n))
        expect(pitches.every((p) => [9, 0, 4, 7].includes(p % 12))).toBe(true)
        expect(pitches.length).toBeGreaterThanOrEqual(8)
    })

    it('writes the tuning when it is not standard', () => {
        const tex = exerciseTab(
            { scale: 'D major pentatonic' },
            { position: 1, tuning: 'drop d', direction: 'up' }
        )
        expect(tex).toContain('\\tuning (E4 B3 G3 D3 A2 D2)')
        const notes = notesOf(tex)
        const drop = [38, 45, 50, 55, 59, 64]
        expect(pitchOf(notes[0]!, drop) % 12).toBe(2)
    })

    it('keeps the tempo within 20-240 and adds a title', () => {
        expect(exerciseTab({ scale: 'A minor pentatonic' }, { tempo: 300 })).toContain(
            '\\tempo 240'
        )
        expect(exerciseTab({ scale: 'A minor pentatonic' }, { tempo: 89.6 })).toContain(
            '\\tempo 90'
        )
        expect(
            exerciseTab({ scale: 'A minor pentatonic' }, { title: 'Box "1"' }).split('\n')[0]
        ).toBe('\\title "Box \\"1\\""')
    })

    it('is part of the main entry, for apps (Music Practice #70)', () => {
        expect(api.exerciseTab).toBe(exerciseTab)
    })

    it('takes a note set', () => {
        expect(exerciseTab(scaleNoteSet('A minor pentatonic')!, { position: 1 })).toBe(
            exerciseTab({ scale: 'A minor pentatonic' }, { position: 1 })
        )
    })

    it('says what to write instead', () => {
        expect(() => exerciseTab({ scale: 'H minor' })).toThrow('Unknown scale "H minor"')
        expect(() => exerciseTab({ arpeggio: 'Hm7' })).toThrow('Unknown chord "Hm7"')
        expect(() => exerciseTab({ scale: 'A minor pentatonic' }, { position: 6 })).toThrow(
            'A minor pentatonic has 5 box positions: use position 1 to 5'
        )
        expect(() => exerciseTab({ arpeggio: 'Am7' }, { shape: '3nps' })).toThrow(
            'Arpeggios use CAGED shapes'
        )
        expect(() => exerciseTab({ scale: 'A minor pentatonic' }, { tuning: 'nonsense' })).toThrow(
            'Unknown tuning "nonsense"'
        )
    })

    it('makes alphaTex that alphaTab reads, bar by bar', () => {
        for (const rhythm of ['8ths', 'triplets', '16ths'] as const) {
            const tex = exerciseTab({ scale: 'C major' }, { position: 2, rhythm })
            const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex)
            const bars = score.tracks[0]!.staves[0]!.bars
            const perBar = { '8ths': 8, 'triplets': 12, '16ths': 16 }[rhythm]
            for (const bar of bars) expect(bar.voices[0]!.beats).toHaveLength(perBar)
            expect(score.tempo).toBe(DEFAULT_EXERCISE_TEMPO)
            if (rhythm === 'triplets') {
                expect(bars[1]!.voices[0]!.beats.every((b) => b.tupletNumerator === 3)).toBe(true)
            }
        }
    })
})

describe('exercises with a capo (#76)', () => {
    /** The pitch of a fret.string token with the capo on (alphaTab adds it to every string). */
    const sounding = (token: string, capo: number) => pitchOf(token) + capo

    it('counts frets from the capo and writes \\capo for alphaTab', () => {
        const open = exerciseTab({ scale: 'A minor pentatonic' }, { position: 1 })
        const tex = exerciseTab({ scale: 'A minor pentatonic' }, { position: 1, capo: 2 })
        expect(tex).toContain('\\capo 2')
        // The same notes, two frets lower: the box sits on frets 3 to 6 from the capo.
        expect(notesOf(tex)).toEqual(
            notesOf(open).map((t) => {
                const [fret, string] = t.split('.')
                return `${Number(fret) - 2}.${string}`
            })
        )
        expect(notesOf(tex).map((t) => sounding(t, 2))).toEqual(
            notesOf(open).map((t) => pitchOf(t))
        )
        // alphaTab reads the capo and sounds each note a capo higher.
        const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex)
        const staff = score.tracks[0]!.staves[0]!
        expect(staff.capo).toBe(2)
        const heard = staff.bars.flatMap((b) =>
            b.voices[0]!.beats.flatMap((beat) => beat.notes.map((n) => n.realValue))
        )
        expect(heard).toEqual(notesOf(open).map((t) => pitchOf(t)))
    })

    it('plays a high capo from its own frets, the scale as it sounds', () => {
        const tex = exerciseTab({ scale: 'A minor pentatonic' }, { position: 1, capo: 7 })
        expect(tex).toContain('\\capo 7')
        const notes = notesOf(tex)
        expect(notes.every((t) => Number(t.split('.')[0]) >= 0)).toBe(true)
        // The run starts on the lowest A it finds above the capo, and every note is in the scale.
        expect(sounding(notes[0]!, 7) % 12).toBe(9)
        const scale = scaleNoteSet('A minor pentatonic')!.members.map((m) => m.chroma)
        expect(notes.every((t) => scale.includes(sounding(t, 7) % 12))).toBe(true)
    })

    it('takes a CAGED shape, a 3NPS position and an arpeggio with a capo', () => {
        for (const [notes, options] of [
            [{ scale: 'G major' }, { shape: 'E', capo: 3 }],
            [{ scale: 'G major' }, { shape: '3nps', position: 2, capo: 2 }],
            [{ arpeggio: 'Am7' }, { shape: 'A', capo: 5 }]
        ] as const) {
            const tex = exerciseTab(notes, options)
            expect(tex).toContain(`\\capo ${options.capo}`)
            expect(notesOf(tex).length).toBeGreaterThan(4)
        }
    })

    it('reads no capo as 0 and refuses one off the neck', () => {
        expect(exerciseTab({ scale: 'A minor pentatonic' }, { position: 1, capo: 0 })).toBe(
            exerciseTab({ scale: 'A minor pentatonic' }, { position: 1 })
        )
        expect(() => exerciseTab({ scale: 'A minor pentatonic' }, { capo: 13 })).toThrow(
            'capo: use a fret from 1 to 12 (0 for none), got 13'
        )
        expect(() => exerciseTab({ scale: 'A minor pentatonic' }, { capo: 1.5 })).toThrow(
            'capo: use a fret from 1 to 12 (0 for none), got 1.5'
        )
    })
})

describe('exercise settings', () => {
    it('reads directions and rhythms', () => {
        expect(parseDirection('Up')).toBe('up')
        expect(parseDirection('down')).toBe('down')
        expect(parseDirection('up-down')).toBe('both')
        expect(parseDirection('up and down')).toBe('both')
        expect(parseDirection('both')).toBe('both')
        expect(() => parseDirection('sideways')).toThrow(
            'exercise: use up, down or up-down, got "sideways"'
        )
        expect(parseRhythm('8ths')).toBe('8ths')
        expect(parseRhythm('eighths')).toBe('8ths')
        expect(parseRhythm('Triplets')).toBe('triplets')
        expect(parseRhythm('16th')).toBe('16ths')
        expect(parseRhythm('sixteenths')).toBe('16ths')
        expect(() => parseRhythm('quarters')).toThrow(
            'rhythm: use 8ths, triplets or 16ths, got "quarters"'
        )
    })
})
