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

describe('playProgression', () => {
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
