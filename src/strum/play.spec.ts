import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { startsReported } from '../playback/follow.js'
import type { NoteEvent, NotePlayer } from '../playback/player.js'
import { parseStrum } from './pattern.js'
import {
    playStrum,
    runStrum,
    scoreOf,
    strumEvents,
    STRUM_VELOCITY,
    tempoOf,
    type StrumSettings
} from './play.js'
import { strumVoicing } from './voicing.js'

const E_MINOR = [40, 47, 52, 55, 59, 64]
const G = [43, 47, 50, 55, 59, 67]

/** Any fixed moment: the tests set the clock. */
const T0 = Date.UTC(2026, 10, 3)

afterEach(() => {
    setSystemTime()
})

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

    it('swings: the second 8th of each beat comes later (2/3 of the beat in a triplet swing)', () => {
        const { events, strums } = strumEvents(scoreFor('D U D U D U D U\nswing: yes'), { bpm: 60 })
        expect(strums.map((s) => s.time)).toEqual(
            [0, 2 / 3, 1, 1 + 2 / 3, 2, 2 + 2 / 3, 3, 3 + 2 / 3].map(
                (t) => expect.closeTo(t, 6) as unknown as number
            )
        )
        expect(strums[0]!.duration).toBeCloseTo(2 / 3)
        expect(strums[1]!.duration).toBeCloseTo(1 / 3)
        // The down strum rings until the up strum.
        expect(events[0]!.time + events[0]!.duration).toBeCloseTo(2 / 3)
        expect(strumEvents(scoreFor('DUDU\nswing: 60%'), { bpm: 60 }).strums[1]!.time).toBeCloseTo(
            0.6
        )
        // 16ths swing in pairs of 16ths.
        const sixteenths = strumEvents(
            scoreFor('DUDUDUDUDUDUDUDU\nsubdivision: 16ths\nswing: yes'),
            {
                bpm: 60
            }
        ).strums
        expect(sixteenths[1]!.time).toBeCloseTo(1 / 3)
        expect(sixteenths[2]!.time).toBeCloseTo(0.5)
    })

    it('plays the triplet shuffle down on the beat and up on the third triplet', () => {
        const { strums } = strumEvents(scoreFor('D U D U\nsubdivision: triplets'), { bpm: 60 })
        expect(strums.map((s) => s.time)).toEqual(
            [0, 2 / 3, 1, 1 + 2 / 3].map((t) => expect.closeTo(t, 6) as unknown as number)
        )
        // A muted strum on the third triplet is an up stroke: the higher strings.
        const { events } = strumEvents(scoreFor('D - X - - - - - - - - -\nsubdivision: triplets'), {
            bpm: 60
        })
        expect(events.filter((e) => e.duration === 0.04).map((e) => e.midi)).toEqual([
            64, 59, 55, 52
        ])
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

    it('times 6/8, 9/8 and 12/8 by the dotted quarter, 3/8 by the eighth, 16ths by a quarter of the beat', () => {
        // 6/8 at 60: two dotted quarters, a second each.
        expect(strumEvents(scoreFor('D U D U D U\ntime: 6/8'), { bpm: 60 }).length).toBe(2)
        expect(strumEvents(scoreFor('D\ntime: 12/8'), { bpm: 60 }).length).toBe(4)
        expect(strumEvents(scoreFor('D\ntime: 9/8\nsubdivision: 16ths'), { bpm: 60 }).length).toBe(
            3
        )
        expect(strumEvents(scoreFor('D U D\ntime: 3/8'), { bpm: 60 }).length).toBe(3)
        // Without a tempo: 60 dotted quarters (8ths at 180), else 90.
        expect(tempoOf(undefined, true)).toBe(60)
        expect(tempoOf(undefined)).toBe(90)
        expect(strumEvents(scoreFor('D U D U D U\ntime: 6/8')).length).toBe(2)
        // The count-in clicks each 8th of the bar, 1 the strongest, then 4.
        const clicks = strumEvents(scoreFor('D U D U D U\ntime: 6/8'), {
            bpm: 60,
            countIn: true
        }).events.slice(0, 6)
        expect(clicks.map((e) => e.time)).toEqual(
            [0, 1, 2, 3, 4, 5].map((t) => expect.closeTo(t / 3, 6) as unknown as number)
        )
        const loud = clicks.map((e) => e.velocity!)
        expect(loud[0]!).toBeGreaterThan(loud[3]!)
        expect(loud[3]!).toBeGreaterThan(loud[1]!)
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
        setSystemTime(new Date(T0))
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
        setSystemTime(new Date(T0 + 40))
        starts[0]!()
        expect(heard).toBe(1)
        expect(pending).toHaveLength(1)
        // The player's own 40 ms lead is kept: the second pass is asked for 40 ms before the
        // first one's end, and sounds right at it.
        expect(pending[0]!.ms).toBe(2000 - 40)
    })

    /** A clock and timers the test moves, and a soundfont-like player. */
    function slowLoad(over: Partial<NotePlayer> = {}, firstLoad = 1500, lead = 0) {
        let clock = T0
        let id = 0
        const timers = new Map<number, { at: number; fn: () => void }>()
        const timer = {
            setTimeout: (fn: () => void, ms = 0) => {
                timers.set(++id, { at: clock + ms, fn })
                return id
            },
            clearTimeout: (t?: number) => {
                if (t !== undefined) timers.delete(t)
            }
        } as unknown as Pick<Window, 'setTimeout' | 'clearTimeout'>
        const advance = (ms: number) => {
            const end = clock + ms
            for (;;) {
                const due = [...timers.entries()]
                    .filter(([, t]) => t.at <= end)
                    .sort((a, b) => a[1].at - b[1].at)[0]
                if (!due) break
                timers.delete(due[0])
                clock = due[1].at
                setSystemTime(new Date(clock))
                due[1].fn()
            }
            clock = end
            setSystemTime(new Date(clock))
        }
        // When each pass was asked for and when it really sounds.
        const passes: { called: number; sounds: number }[] = []
        let loaded = false
        let load = firstLoad
        // The next play loads again, for `ms` (a soundfont in another window).
        const reload = (ms: number) => {
            loaded = false
            load = ms
        }
        const player: NotePlayer = {
            ...over,
            play(_events, options) {
                const called = clock - T0
                const wait = loaded ? lead : load
                loaded = true
                const pass = { called, sounds: NaN }
                passes.push(pass)
                timer.setTimeout(() => {
                    pass.sounds = clock - T0
                    options.onStart?.()
                }, wait)
                return { stop() {} }
            }
        }
        return { timer, advance, passes, player, reload }
    }

    it('starts the second pass at the end of the first after a slow soundfont load', () => {
        setSystemTime(new Date(T0))
        const { timer, advance, passes, player } = slowLoad({ reportsStart: true })
        const handle = runStrum(
            scoreFor('D-DU-UDU'),
            () => player,
            () => settings({ loop: true }),
            timer
        )
        advance(6000)
        handle.stop()
        // 4/4 at 120: a pass lasts 2 s. Loaded, the player sounds at once: no seam is early.
        expect(passes.map((p) => p.sounds)).toEqual([1500, 3500, 5500])
    })

    it('keeps the own lead of a reporting player after a slow load', () => {
        setSystemTime(new Date(T0))
        const { timer, advance, passes, player } = slowLoad({ reportsStart: true }, 1500, 30)
        const handle = runStrum(
            scoreFor('D-DU-UDU'),
            () => player,
            () => settings({ loop: true }),
            timer
        )
        advance(6000)
        handle.stop()
        // The first seam is 30 ms late (the lead can't be known before a pass plays), the next
        // ones exact.
        expect(passes.map((p) => p.sounds)).toEqual([1500, 3530, 5530])
    })

    it('waits for a player that reports its start without declaring it', () => {
        setSystemTime(new Date(T0))
        const { timer, advance, passes, player, reload } = slowLoad({}, 1200)
        const run = () =>
            runStrum(
                scoreFor('D-DU-UDU'),
                () => player,
                () => settings({ loop: true }),
                timer
            )
        let handle = run()
        advance(6000)
        handle.stop()
        // Its start came before the second pass was due: the passes are counted from it.
        expect(passes.map((p) => p.sounds)).toEqual([1200, 3200, 5200])
        // Seen reporting once, it's waited for from the first pass the next time, however long
        // its start takes (here a load longer than a pass).
        expect(startsReported(player)).toBe(true)
        passes.length = 0
        reload(2500)
        handle = run()
        advance(7000)
        handle.stop()
        expect(passes.map((p) => p.sounds - passes[0]!.called)).toEqual([2500, 4500, 6500])
    })

    it('asks for one next pass when a player reports its start during the play call', () => {
        setSystemTime(new Date(T0))
        const { pending, timers } = setup()
        const player: NotePlayer = {
            play(_events, options) {
                options.onStart?.()
                return { stop() {} }
            }
        }
        runStrum(
            scoreFor('D-DU-UDU'),
            () => player,
            () => settings({ loop: true }),
            timers
        )
        expect(pending.map((p) => p.ms)).toEqual([2000])
    })

    it('times passes from the play call for a player that never reports', () => {
        setSystemTime(new Date(T0))
        const calls: number[] = []
        const { timer, advance } = slowLoad()
        const silent: NotePlayer = {
            play() {
                calls.push(Date.now() - T0)
                return { stop() {} }
            }
        }
        const handle = runStrum(
            scoreFor('D-DU-UDU'),
            () => silent,
            () => settings({ loop: true }),
            timer
        )
        advance(4500)
        handle.stop()
        expect(calls).toEqual([0, 2000, 4000])
        expect(startsReported(silent)).toBe(false)
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
