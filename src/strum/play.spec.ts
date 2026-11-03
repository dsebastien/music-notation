import { describe, expect, it } from 'bun:test'
import type { NoteEvent, NotePlayer } from '../playback/player.js'
import { parseStrum } from './pattern.js'
import {
    playStrum,
    runStrum,
    scoreOf,
    strumEvents,
    STRUM_VELOCITY,
    type StrumSettings
} from './play.js'
import { strumVoicing } from './voicing.js'

const E_MINOR = [40, 47, 52, 55, 59, 64]
const G = [43, 47, 50, 55, 59, 67]

const scoreFor = (source: string) => scoreOf(parseStrum(source), (c) => strumVoicing(c))

describe('strumEvents', () => {
    it('strums down low to high and up high to low (the higher strings), in time', () => {
        const { events, length } = strumEvents(scoreFor('D U - - - - - -'), { bpm: 60, tail: 0 })
        // At 60 BPM in 8ths, a slot lasts half a second.
        expect(length).toBe(4)
        const down = events.filter((e) => e.time < 0.5)
        const up = events.filter((e) => e.time >= 0.5)
        expect(down.map((e) => e.midi)).toEqual(E_MINOR)
        expect(up.map((e) => e.midi)).toEqual([64, 59, 55, 52])
        expect(up[0]!.time).toBe(0.5)
        // Strings of one strum a few milliseconds apart.
        expect(down[1]!.time - down[0]!.time).toBeCloseTo(0.012)
        // A strum rings until the next one; the last one until the end (no tail here).
        expect(down[0]!.time + down[0]!.duration).toBeCloseTo(0.5)
        expect(up[0]!.time + up[0]!.duration).toBeCloseTo(4)
    })

    it('plays accents louder, ghost strums soft and muted strums short', () => {
        const { events } = strumEvents(scoreFor('D> (U) X U D U D U'), { bpm: 90 })
        const at = (slot: number) => events.filter((e) => Math.abs(e.time - slot / 3) < 0.1)
        expect(new Set(at(0).map((e) => e.velocity))).toEqual(new Set([STRUM_VELOCITY.accent]))
        expect(new Set(at(1).map((e) => e.velocity))).toEqual(new Set([STRUM_VELOCITY.ghost]))
        expect(at(2).every((e) => e.duration === 0.04 && e.velocity === STRUM_VELOCITY.mute)).toBe(
            true
        )
        // The muted strum damps the ghost strum before it.
        const ghost = at(1)[0]!
        expect(ghost.time + ghost.duration).toBeCloseTo(2 / 3)
    })

    it('lets a strum ring through the rests after it', () => {
        const { events } = strumEvents(scoreFor('D - - - D - - -'), { bpm: 60, tail: 0 })
        expect(events[0]!.time + events[0]!.duration).toBeCloseTo(2)
    })

    it('counts in one bar of clicks, then plays', () => {
        const { events, length } = strumEvents(scoreFor('D - D - D -\ntime: 3/4'), {
            bpm: 120,
            countIn: true
        })
        const clicks = events.slice(0, 3)
        expect(clicks.map((e) => e.time)).toEqual([0, 0.5, 1])
        expect(clicks[0]!.midi).toBeGreaterThan(clicks[1]!.midi)
        expect(events[3]!.time).toBe(1.5)
        expect(length).toBe(3)
    })

    it('follows the chord changes, and starts on the chord the pattern ends on', () => {
        const score = scoreFor('D - D - [G]D - D -')
        expect(score.slots[0]!.pitches).toEqual(G)
        expect(scoreFor('chord: Em\nD - D - [G]D - D -').slots[0]!.pitches).toEqual(E_MINOR)
        expect(scoreFor('chord: Em\nD - D - [G]D - D -').slots[4]!.pitches).toEqual(G)
    })

    it('times 6/8 by the eighth and 16ths by a quarter of the beat', () => {
        expect(strumEvents(scoreFor('D U D U D U\ntime: 6/8'), { bpm: 120 }).length).toBe(3)
        expect(
            strumEvents(scoreFor('DUDUDUDUDUDUDUDU\nsubdivision: 16ths'), { bpm: 60 }).length
        ).toBe(4)
    })
})

/** A player that records what it plays, and timers run by hand. */
function setup() {
    const calls: { events: NoteEvent[]; onEnd?: () => void }[] = []
    let stops = 0
    const player: NotePlayer = {
        play(events, options) {
            calls.push({ events, onEnd: options.onEnd })
            return { stop: () => stops++ }
        }
    }
    const pending: { fn: () => void; ms: number }[] = []
    const timers = {
        setTimeout: (fn: () => void, ms: number) => pending.push({ fn, ms }),
        clearTimeout: () => {}
    } as unknown as Pick<Window, 'setTimeout' | 'clearTimeout'>
    return { calls, player, pending, timers, stops: () => stops }
}

describe('runStrum', () => {
    const settings = (over: Partial<StrumSettings> = {}): StrumSettings => ({
        bpm: 120,
        countIn: false,
        loop: false,
        sound: 'guitar',
        volume: 0.8,
        ...over
    })

    it('loops pass after pass, the count-in only once, with no ring past the pass', () => {
        const { calls, player, pending, timers } = setup()
        const live = settings({ loop: true, countIn: true })
        runStrum(
            scoreFor('D - D U - U D U'),
            () => player,
            () => live,
            timers
        )
        // A pass of 4/4 at 120: 2 s (plus 2 s of count-in on the first).
        expect(pending[0]!.ms).toBeGreaterThan(3900)
        pending.shift()!.fn()
        expect(calls).toHaveLength(2)
        const second = calls[1]!.events
        expect(second[0]!.time).toBe(0)
        expect(Math.max(...second.map((e) => e.time + e.duration))).toBeCloseTo(2)
        // Loop off: the pass that is playing ends it.
        let ended = false
        live.loop = false
        runStrum(
            scoreFor('D-DU-UDU'),
            () => player,
            () => live,
            timers,
            () => (ended = true)
        )
        calls[calls.length - 1]!.onEnd?.()
        expect(ended).toBe(true)
    })

    it('counts the loop from the moment a reporting player starts (a soundfont loading)', () => {
        const starts: (() => void)[] = []
        const player: NotePlayer = {
            reportsStart: true,
            play(_events, options) {
                if (options.onStart) starts.push(options.onStart)
                return { stop() {} }
            }
        }
        const { pending, timers } = setup()
        const lit: number[][] = []
        let heard = 0
        runStrum(
            scoreFor('D-DU-UDU'),
            () => player,
            () => settings({ loop: true }),
            timers,
            undefined,
            (strums) => {
                lit.push(strums.map((s) => s.slot))
                return { heard: () => heard++, stop() {} }
            }
        )
        // Nothing is timed until the notes really start.
        expect(pending).toHaveLength(0)
        expect(lit).toEqual([[0, 2, 3, 5, 6, 7]])
        starts[0]!()
        expect(heard).toBe(1)
        expect(pending).toHaveLength(1)
        expect(pending[0]!.ms).toBeGreaterThan(1900)
        expect(pending[0]!.ms).toBeLessThanOrEqual(2000)
    })

    it('stops what plays', () => {
        const { player, timers, stops } = setup()
        const handle = runStrum(
            scoreFor('D-DU-UDU'),
            () => player,
            () => settings(),
            timers
        )
        handle.stop()
        expect(stops()).toBe(1)
    })
})

describe('playStrum', () => {
    it('plays a pattern text over a chord, at its tempo', () => {
        const { calls, player } = setup()
        playStrum('D - - - - - - -\ntempo: 60', { player, chord: 'G' })
        expect(calls[0]!.events.map((e) => e.midi)).toEqual(G)
        playStrum('D - - - - - - -', { player, chord: [50, 57, 62, 66] })
        expect(calls[1]!.events.map((e) => e.midi)).toEqual([50, 57, 62, 66])
        playStrum('D - - - - - - -', { player, tuning: 'drop d', chord: 'D5' })
        expect(calls[2]!.events[0]!.midi).toBe(38)
    })

    it('throws the block message on a mistake', () => {
        expect(() => playStrum('D Q', { player: setup().player })).toThrow('Didn\'t understand "Q"')
        expect(() => playStrum('D', { player: setup().player, chord: 'Hm' })).toThrow(
            'Didn\'t recognize the chord "Hm"'
        )
        expect(() => playStrum('D', { player: setup().player, tuning: 'nope' })).toThrow(
            'Unknown tuning'
        )
    })
})
