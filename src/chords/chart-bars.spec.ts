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
                // Held through the empty bar; N.C. plays nothing.
                { chord: 'Em', beats: 9 }
            ],
            beatsPerBar: 6,
            beatUnit: 8,
            tempo: 90
        })
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
