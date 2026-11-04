import { describe, expect, it } from 'bun:test'
import type { NoteEvent, NotePlayer } from './player.js'
import { parseStrum } from '../strum/pattern.js'
import { strumVoicing } from '../strum/voicing.js'
import {
    playProgression,
    progressionEvents,
    progressionPitches,
    type ProgressionBar
} from './progression.js'

const G = [43, 47, 50, 55, 59, 67]
const C = strumVoicing('C')
const bars: ProgressionBar[] = [
    { chord: 'G', pitches: G },
    { chord: 'C', pitches: strumVoicing('C') }
]
const notes = (events: NoteEvent[]) => events.filter((e) => e.kind !== 'click')
const clicks = (events: NoteEvent[]) => events.filter((e) => e.kind === 'click')

function setup() {
    const calls: { events: NoteEvent[]; onEnd?: () => void; onStart?: () => void }[] = []
    const player: NotePlayer = {
        play(events, options) {
            calls.push({ events, onEnd: options.onEnd, onStart: options.onStart })
            return { stop() {} }
        }
    }
    const pending: { fn: () => void; ms: number }[] = []
    const timers = {
        setTimeout: (fn: () => void, ms: number) => pending.push({ fn, ms }),
        clearTimeout: () => {}
    } as unknown as Window
    return { calls, player, pending, timers }
}

describe('progressionEvents', () => {
    it('plays one chord a bar, a down strum on each beat, with a click on every beat', () => {
        const { events, length, strums } = progressionEvents(bars, { bpm: 60, tail: 0 })
        // Two bars of 4/4 at 60: 8 s.
        expect(length).toBe(8)
        expect(strums).toEqual([
            { slot: 0, time: 0, duration: 4 },
            { slot: 1, time: 4, duration: 4 }
        ])
        const strummed = notes(events)
        // Each beat a strum of all six strings, low to high.
        expect(strummed.filter((e) => e.time < 1).map((e) => e.midi)).toEqual(G)
        const starts = [...new Set(strummed.map((e) => Math.floor(e.time)))]
        expect(starts).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
        // The second bar plays C.
        expect(strummed.filter((e) => e.time >= 4 && e.time < 5).map((e) => e.midi)).toEqual(
            strumVoicing('C')
        )
        // The metronome: a click on each beat, the bar's first higher and louder.
        const tick = clicks(events)
        expect(tick.map((e) => e.time)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
        expect(tick[0]!.midi).toBeGreaterThan(tick[1]!.midi)
        expect(tick[0]!.velocity!).toBeGreaterThan(tick[1]!.velocity!)
        // The beat 1 strum is stressed.
        expect(strummed[0]!.velocity!).toBeGreaterThan(strummed[6]!.velocity!)
    })

    it('counts in one bar first, and the click can be off', () => {
        const { events, length, strums } = progressionEvents(bars, {
            bpm: 120,
            beatsPerBar: 3,
            countIn: true,
            click: false,
            tail: 0
        })
        // 3/4 at 120: a bar is 1.5 s; the count-in one more bar.
        expect(length).toBe(4.5)
        expect(clicks(events).map((e) => e.time)).toEqual([0, 0.5, 1])
        expect(strums[0]!.time).toBe(1.5)
        expect(notes(events)[0]!.time).toBe(1.5)
    })

    it('strums once a bar, or arpeggiates in eighths', () => {
        const once = notes(progressionEvents(bars, { bpm: 60, strum: 'bar', tail: 0 }).events)
        expect([...new Set(once.map((e) => e.time.toFixed(0)))]).toEqual(['0', '4'])
        // The bar's strum rings through the bar.
        expect(once[0]!.duration).toBeCloseTo(4)
        const picked = notes(progressionEvents(bars, { bpm: 60, strum: 'arpeggio' }).events)
        // Eighths: 8 notes a bar, the bass first, up the strings and back down.
        expect(picked.filter((e) => e.time < 4).map((e) => e.midi)).toEqual([
            43, 47, 50, 55, 59, 67, 59, 55
        ])
        expect(picked[1]!.time).toBe(0.5)
    })

    it('plays a strumming pattern in each bar, its own time signature', () => {
        const pattern = parseStrum('time: 3/4\nD - D U D U')
        const { events, length } = progressionEvents(bars, {
            bpm: 60,
            pattern,
            click: false,
            tail: 0
        })
        expect(length).toBe(6)
        // Each strum's first string (the others a few milliseconds later).
        const starts = [...new Set(notes(events).map((e) => Math.floor(e.time * 2) / 2))]
        expect(starts).toEqual([0, 1, 1.5, 2, 2.5, 3, 4, 4.5, 5, 5.5])
    })

    it('counts dotted quarters in 6/8: strums and clicks on 1 and 4, arpeggios in eighths', () => {
        const six = { bpm: 60, beatsPerBar: 6, beatUnit: 8, tail: 0 }
        const { events, length } = progressionEvents(bars, six)
        // Two dotted quarters a bar at 60: 2 s a bar.
        expect(length).toBe(4)
        expect(clicks(events).map((e) => e.time)).toEqual([0, 1, 2, 3])
        expect([...new Set(notes(events).map((e) => Math.floor(e.time * 10) / 10))]).toEqual([
            0, 1, 2, 3
        ])
        const picked = notes(progressionEvents(bars, { ...six, strum: 'arpeggio' }).events)
        // Six eighths a bar, a third of a second each.
        expect(picked.filter((e) => e.time < 2)).toHaveLength(6)
        expect(picked[1]!.time).toBeCloseTo(1 / 3)
    })

    it('plays a piano chord as a block', () => {
        const piano = progressionPitches('C', 'piano')
        const { events } = progressionEvents([{ chord: 'C', pitches: piano }], {
            bpm: 60,
            spread: 0,
            click: false
        })
        const first = notes(events).filter((e) => e.time < 0.5)
        expect(first.length).toBe(piano.length)
        expect(new Set(first.map((e) => e.time)).size).toBe(1)
    })
})

describe('progressionEvents, chords that last more or less than a bar (#75)', () => {
    const D = strumVoicing('D')
    const timed: ProgressionBar[] = [
        { chord: 'G', pitches: G, beats: 8 },
        { chord: 'C', pitches: C, beats: 2 },
        { chord: 'D', pitches: D, beats: 2 }
    ]

    it('holds a chord for its beats, and puts two chords in one bar', () => {
        const {
            events,
            length,
            strums,
            bars: barTimes
        } = progressionEvents(timed, {
            bpm: 60,
            tail: 0
        })
        // G two bars, C and D half a bar each: three bars of 4/4 at 60.
        expect(length).toBe(12)
        expect(strums).toEqual([
            { slot: 0, time: 0, duration: 8 },
            { slot: 1, time: 8, duration: 2 },
            { slot: 2, time: 10, duration: 2 }
        ])
        expect(barTimes!.map((b) => [b.slot, b.time])).toEqual([
            [0, 0],
            [1, 4],
            [2, 8]
        ])
        const at = (t: number) =>
            notes(events)
                .filter((e) => e.time >= t && e.time < t + 0.5)
                .map((e) => e.midi)
        expect(at(4)).toEqual(G)
        expect(at(8)).toEqual(C)
        expect(at(10)).toEqual(D)
        expect(clicks(events)).toHaveLength(12)
    })

    it('strums once a bar and at each chord change', () => {
        const once = notes(
            progressionEvents(
                [
                    { chord: 'G', pitches: G, beats: 2 },
                    { chord: 'C', pitches: C, beats: 2 }
                ],
                { bpm: 60, strum: 'bar', tail: 0 }
            ).events
        )
        expect([...new Set(once.map((e) => e.time.toFixed(0)))]).toEqual(['0', '2'])
        expect(once[0]!.duration).toBeCloseTo(2)
    })

    it('starts the arpeggio again on a new chord', () => {
        const picked = notes(
            progressionEvents(
                [
                    { chord: 'G', pitches: G, beats: 2 },
                    { chord: 'C', pitches: C, beats: 2 }
                ],
                { bpm: 60, strum: 'arpeggio', tail: 0 }
            ).events
        )
        expect(picked.find((e) => e.time === 2)!.midi).toBe(C[0]!)
        expect(picked.find((e) => e.time === 0.5)!.duration).toBeCloseTo(1.5)
    })

    it('plays the chord of each slot of a pattern', () => {
        const pattern = parseStrum('D - D U - U D U')
        const { events } = progressionEvents(
            [
                { chord: 'G', pitches: G, beats: 2 },
                { chord: 'C', pitches: C, beats: 2 }
            ],
            { bpm: 60, pattern, click: false, tail: 0 }
        )
        const third = notes(events).filter((e) => e.time >= 2.5 && e.time < 2.6)
        expect(third.map((e) => e.midi).sort()).toEqual([...C].slice(-4).sort())
    })

    it('fills the last bar with the last chord', () => {
        const { length, strums } = progressionEvents([{ chord: 'G', pitches: G, beats: 3 }], {
            bpm: 60,
            tail: 0
        })
        expect(length).toBe(4)
        expect(strums[0]!.duration).toBe(4)
    })

    it('counts beats as written in 6/8 (eighths)', () => {
        const { length, strums } = progressionEvents(
            [
                { chord: 'G', pitches: G, beats: 3 },
                { chord: 'C', pitches: C, beats: 3 }
            ],
            { bpm: 60, beatsPerBar: 6, beatUnit: 8, tail: 0 }
        )
        // One bar of 6/8 at 60 dotted quarters: 2 s, C from 1 s.
        expect(length).toBe(2)
        expect(strums.map((s) => s.time)).toEqual([0, 1])
    })
})

describe('playProgression', () => {
    it('takes how long each chord lasts, and calls back on each bar and each chord (#75)', () => {
        const { player, pending, timers, calls } = setup()
        const barsHeard: [number, string | null][] = []
        const chordsHeard: [number, string | null][] = []
        playProgression(
            [
                { chord: 'G', beats: 8 },
                { chord: 'C', beats: 2 },
                { chord: 'D', beats: 2 }
            ],
            {
                player,
                window: timers,
                bpm: 60,
                click: false,
                onBar: (bar, chord) => barsHeard.push([bar, chord]),
                onChord: (index, chord) => chordsHeard.push([index, chord])
            }
        )
        expect(notes(calls[0]!.events).find((e) => e.time >= 8)!.midi).toBe(C[0]!)
        calls[0]!.onStart?.()
        for (const p of [...pending].sort((a, b) => a.ms - b.ms)) p.fn()
        expect(barsHeard).toEqual([
            [0, 'G'],
            [1, 'G'],
            [2, 'C']
        ])
        expect(chordsHeard).toEqual([
            [0, 'G'],
            [1, 'C'],
            [2, 'D']
        ])
    })

    it('plays chord symbols or given notes, and calls back on each bar as it sounds', () => {
        const { calls, player, pending, timers } = setup()
        const heard: [number, string | null, number][] = []
        playProgression(['G', { chord: 'D5', pitches: [50, 57] }], {
            player,
            window: timers,
            bpm: 60,
            click: false,
            onBar: (bar, chord, pass) => heard.push([bar, chord, pass])
        })
        const events = calls[0]!.events
        expect(events.filter((e) => e.time < 1).map((e) => e.midi)).toEqual(G)
        expect(events.filter((e) => e.time >= 4 && e.time < 5).map((e) => e.midi)).toEqual([50, 57])
        // The bars are called once the notes sound (the player says so).
        calls[0]!.onStart?.()
        const bars = pending.filter((p) => p.ms === 0 || p.ms === 4000)
        for (const p of bars) p.fn()
        expect(heard).toEqual([
            [0, 'G', 1],
            [1, 'D5', 1]
        ])
    })

    it('loops, and a new tempo applies from the next pass', () => {
        const { calls, player, pending, timers } = setup()
        const handle = playProgression(['G', 'C'], { player, window: timers, bpm: 60, loop: true })
        handle.update({ bpm: 120 })
        // The next pass is asked for at the end of the first (8 s).
        const next = pending.find((p) => p.ms > 7000)!
        next.fn()
        expect(calls).toHaveLength(2)
        const second = notes(calls[1]!.events)
        // At 120 the second chord starts after 2 s.
        expect(second.find((e) => e.midi === strumVoicing('C')[0] && e.time > 0)!.time).toBe(2)
        handle.stop()
    })

    it('throws on what it cannot play', () => {
        const { player } = setup()
        expect(() => playProgression(['Hm'], { player })).toThrow(
            'Didn\'t recognize the chord "Hm"'
        )
        expect(() => playProgression([], { player })).toThrow('at least one chord')
        expect(() => playProgression(['G'], { player, tuning: 'nope' })).toThrow('Unknown tuning')
    })
})
