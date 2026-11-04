import { describe, expect, it } from 'bun:test'
import { parseChordPro } from './chordpro.js'
import { chartChords } from './chart.js'
import { playProgression } from '../playback/progression.js'
import type { NotePlayer } from '../playback/player.js'
import { expectLinear } from '../test-setup.js'

describe('chartChords (#75)', () => {
    it('gives the chords a chart plays, with how long each lasts, its time and tempo', () => {
        const song = parseChordPro(
            '{time: 6/8}\n{tempo: 90}\n[G]One [C]two\n| [D] [Em] | | [N.C.] |'
        )
        expect(chartChords(song)).toEqual({
            chords: [
                { chord: 'G' },
                { chord: 'C' },
                { chord: 'D', beats: 3 },
                // Held through the empty bar; a bar of N.C. is a bar of silence.
                { chord: 'Em', beats: 9 },
                { chord: null, pitches: [], beats: 6 }
            ],
            beatsPerBar: 6,
            beatUnit: 8,
            tempo: 90
        })
    })

    it('keeps a bar of N.C. as a bar of silence, in time', () => {
        const song = parseChordPro('| [G] | [N.C.] | [Em] |')
        expect(chartChords(song).chords).toEqual([
            { chord: 'G', beats: 4 },
            { chord: null, pitches: [], beats: 4 },
            { chord: 'Em', beats: 4 }
        ])
        // A bar that also holds a chord that plays: N.C. takes no time in it.
        expect(chartChords(parseChordPro('| [G] [N.C.] |')).chords).toEqual([
            { chord: 'G', beats: 4 }
        ])
        // Lines without bar lines keep 0.11's reading: N.C. is left out.
        expect(chartChords(parseChordPro('[G]a [N.C.]b [Em]c')).chords).toEqual([
            { chord: 'G' },
            { chord: 'Em' }
        ])
    })

    it('transposes as the chart does, and plays with playProgression', () => {
        const song = parseChordPro('{key: C}\n{transpose: 2}\n[C] [G7] |')
        const read = chartChords(song, { transpose: -1 })
        expect(read.chords.map((c) => c.chord)).toEqual(['Db', 'Ab7'])
        const calls: number[] = []
        const player: NotePlayer = {
            play(events) {
                calls.push(events.length)
                return { stop() {} }
            }
        }
        playProgression(read.chords, { player, click: false }).stop()
        expect(calls).toHaveLength(1)
    })

    it('has no time or tempo when the song has none', () => {
        const read = chartChords(parseChordPro('[G]Hi'))
        expect(read.beatsPerBar).toBe(4)
        expect(read.beatUnit).toBe(4)
        expect(read.tempo).toBeNull()
    })
})

describe('chart bar lines in linear time (#75)', () => {
    it('reads long measured lines in linear time', () => {
        expectLinear((k) => {
            const n = 2_000 * k
            chartChords(parseChordPro(`${'| [G] / [C] '.repeat(n)}|\n${'| '.repeat(n)}[D]`))
            chartChords(parseChordPro(`[G]${' / '.repeat(n)}|${'x'.repeat(n)}`))
        })
    })
})
