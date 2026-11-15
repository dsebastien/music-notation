import { describe, expect, it } from 'bun:test'
import type { InstrumentSource } from '../tab/instruments.js'
import type { NoteEvent, NotePlayer } from './player.js'
import { sampledPlayer } from './sampled.js'
import { amount, range, soundfontBytes, type FixtureZone } from './soundfont.fixture.js'

type Call = [string, ...number[]]
interface Param {
    value: number
    calls: Call[]
}
interface FakeSource {
    buffer: { duration: number } | null
    playbackRate: Param
    loop: boolean
    loopStart: number
    loopEnd: number
    started: number
    stopped: number
}

/** An audio context that keeps what was asked of it. `currentTime` is 10. */
function fakeContext(decodes = true) {
    const param = (value: number): Param & Record<string, unknown> => {
        const calls: Call[] = []
        return {
            value,
            calls,
            setValueAtTime: (v: number, t: number) => calls.push(['set', v, t]),
            linearRampToValueAtTime: (v: number, t: number) => calls.push(['linear', v, t]),
            exponentialRampToValueAtTime: (v: number, t: number) => calls.push(['exp', v, t]),
            setTargetAtTime: (v: number, t: number, c: number) => calls.push(['target', v, t, c])
        }
    }
    const log = {
        sources: [] as FakeSource[],
        gains: [] as { gain: Param; disconnected: boolean }[],
        filters: [] as { type: string; frequency: Param; Q: Param; detune: Param }[],
        buffers: [] as { rate: number; data: Float32Array }[],
        decoded: 0
    }
    const ctx = {
        currentTime: 10,
        sampleRate: 48000,
        destination: {},
        outputLatency: 0,
        resume: () => Promise.resolve(),
        createGain() {
            const node = {
                gain: param(1),
                disconnected: false,
                connect() {},
                disconnect() {
                    node.disconnected = true
                }
            }
            log.gains.push(node)
            return node
        },
        createBufferSource() {
            const node: FakeSource & Record<string, unknown> = {
                buffer: null,
                playbackRate: param(1),
                loop: false,
                loopStart: 0,
                loopEnd: 0,
                started: -1,
                stopped: -1,
                connect() {},
                start(t: number) {
                    node.started = t
                },
                stop(t: number) {
                    node.stopped = t
                }
            }
            log.sources.push(node)
            return node
        },
        createBiquadFilter() {
            const node = {
                type: '',
                frequency: param(350),
                Q: param(1),
                detune: param(0),
                connect() {}
            }
            log.filters.push(node)
            return node
        },
        createBuffer(_channels: number, length: number, rate: number) {
            const data = new Float32Array(length)
            log.buffers.push({ rate, data })
            return { duration: length / rate, getChannelData: () => data }
        },
        decodeAudioData() {
            log.decoded++
            // One second of sound, whatever the bytes.
            return decodes ? Promise.resolve({ duration: 1 }) : Promise.reject(new Error('no'))
        }
    }
    return { ctx: ctx as unknown as BaseAudioContext, log }
}

const font = (program: number, zone: FixtureZone, sample: object = {}, bank = 0) =>
    soundfontBytes({
        program,
        bank,
        preset: [[[41, 0]]],
        instruments: [[[...zone, [53, 0]]]],
        samples: [{ name: 's', data: [79, 103, 103, 83], compressed: true, ...sample }]
    })

/**
 * A folder of instrument files. The guitar: a looped sample recorded at key 40 (24,000 points a
 * second, its loop from point 2,400 to 4,800), 6 dB taken off, a decay of 4 s to silence, a release
 * of 1 s.
 */
function folder(lacking: string[] = [], guitar?: FixtureZone) {
    const files: Record<string, Uint8Array> = {
        'index.json': new TextEncoder().encode(
            JSON.stringify({
                programs: {
                    '0': { file: 'p000.sf3' },
                    '25': { file: 'p025.sf3' },
                    '28': { file: 'p028.sf3' }
                },
                click: { file: 'click.sf3' }
            })
        ),
        'p025.sf3': font(
            25,
            guitar ?? [
                [36, 2400],
                [37, 1000],
                [38, 0],
                [48, 60],
                [54, 1]
            ],
            { loop: [2400, 4800], rate: 24000, key: 40 }
        ),
        'p000.sf3': font(0, []),
        // The muted guitar: two points, not compressed.
        'p028.sf3': font(28, [], { data: [16384, amount(-16384)], compressed: false, rate: 22050 }),
        'click.sf3': font(0, [[43, range(33, 33)]], { key: 44 }, 128)
    }
    const asked: string[] = []
    const source: InstrumentSource = (file) => {
        asked.push(file)
        return Promise.resolve(lacking.includes(file) ? null : (files[file] ?? null))
    }
    return { source, asked }
}

/** A fallback player that keeps what it was asked to play. */
function fallback(reportsStart = false) {
    const plays: { events: NoteEvent[]; sound: string; volume: number }[] = []
    const player: NotePlayer = {
        reportsStart,
        play(events, options) {
            plays.push({ events, sound: options.sound, volume: options.volume })
            return { stop() {} }
        }
    }
    return { player, plays }
}

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const note: NoteEvent[] = [{ midi: 52, time: 0, duration: 0.5 }]
/** Velocity 100, 6 dB taken off, a note's share of the middle of the stereo field. */
const PEAK = (100 / 127) * Math.pow(10, -6 / 20) * Math.SQRT1_2

describe('the sample player (#109)', () => {
    it("plays a note with its instrument's file: its pitch, its loop, its envelope", async () => {
        const { ctx, log } = fakeContext()
        const { source, asked } = folder()
        const light = fallback()
        const player = sampledPlayer(window, source, light.player, { context: () => ctx })
        let started = 0
        player.play(note, { sound: 'guitar', volume: 0.8, onStart: () => started++ })
        await wait()
        // Only the guitar is read: no piano, no click.
        expect(asked).toEqual(['index.json', 'p025.sf3'])
        expect(log.decoded).toBe(1)
        expect(log.sources.length).toBe(1)
        const s = log.sources[0]!
        // An octave above the key the sample was recorded at.
        expect(s.playbackRate.value).toBe(2)
        // The loop, in seconds of the sample.
        expect([s.loop, s.loopStart, s.loopEnd]).toEqual([true, 0.1, 0.2])
        // A little after now; it stops when its release (1 s) is over.
        expect(s.started).toBeCloseTo(10.05)
        expect(s.stopped).toBeCloseTo(11.55)
        // The master (the volume), then the note's own envelope.
        expect(log.gains[0]!.gain.value).toBe(0.8)
        const env = log.gains[1]!.gain.calls
        expect(env.map((c) => c[0])).toEqual(['set', 'set', 'exp', 'target'])
        expect(env[0]![1]).toBeCloseTo(PEAK)
        // 100 dB in 4 s: 12.5 dB down at the note's end, half a second in.
        expect(env[2]![1]).toBeCloseTo(PEAK * Math.pow(10, -12.5 / 20))
        expect(env[2]![2]).toBeCloseTo(10.55)
        // Then the release.
        expect(env[3]!.slice(1, 3)).toEqual([0, 10.55])
        expect(light.plays).toEqual([])
        // The notes start 50 ms after the play.
        expect(started).toBe(0)
        await wait(90)
        expect(started).toBe(1)
    })

    it('reads a sound once, and each sound at its first use', async () => {
        const { ctx, log } = fakeContext()
        const { source, asked } = folder()
        const player = sampledPlayer(window, source, fallback().player, { context: () => ctx })
        player.play(note, { sound: 'guitar', volume: 0.8 })
        await wait()
        player.play(note, { sound: 'guitar', volume: 0.8 })
        await wait()
        expect(asked).toEqual(['index.json', 'p025.sf3'])
        expect(log.sources.length).toBe(2)
        player.play(note, { sound: 'piano', volume: 0.8 })
        await wait()
        expect(asked).toEqual(['index.json', 'p025.sf3', 'p000.sf3'])
        // A piano note without a loop: the sample plays once.
        expect(log.sources[2]!.loop).toBe(false)
    })

    it('a softer note is quieter; the volume is the master, changed while it plays', async () => {
        const { ctx, log } = fakeContext()
        const { source } = folder()
        const player = sampledPlayer(window, source, fallback().player, { context: () => ctx })
        const handle = player.play([{ midi: 40, time: 0.25, duration: 1, velocity: 50 }], {
            sound: 'guitar',
            volume: 3
        })
        await wait()
        // Never above 1.
        expect(log.gains[0]!.gain.value).toBe(1)
        expect(log.gains[1]!.gain.calls[0]![1]).toBeCloseTo((PEAK * 50) / 100)
        // At its own pitch, a quarter of a second in.
        expect(log.sources[0]!.playbackRate.value).toBe(1)
        expect(log.sources[0]!.started).toBeCloseTo(10.3)
        handle.setVolume?.(0.2)
        expect(log.gains[0]!.gain.calls.at(-1)!.slice(0, 3)).toEqual(['target', 0.2, 10])
    })

    it('a filter opens at the attack and closes as the note rings', async () => {
        const { ctx, log } = fakeContext()
        const { source } = folder(
            [],
            [
                [8, 9000],
                [9, 60],
                [11, 900],
                [28, 2400],
                [29, 800]
            ]
        )
        const player = sampledPlayer(window, source, fallback().player, { context: () => ctx })
        player.play(note, { sound: 'guitar', volume: 0.8 })
        await wait()
        const filter = log.filters[0]!
        expect(filter.type).toBe('lowpass')
        expect(Math.round(filter.frequency.value)).toBe(1480)
        expect(filter.Q.value).toBe(6)
        // 900 cents up at once, then down to a fifth of it over 4/5 of the 4 s decay.
        expect(filter.detune.calls[0]).toEqual(['set', 900, 10.05])
        const down = filter.detune.calls.at(-1)!
        expect(down[0]).toBe('linear')
        expect(down[1]).toBeCloseTo(180)
        expect(down[2]).toBeCloseTo(13.25)
    })

    it('a muted strum plays the muted guitar, a click the kit click', async () => {
        const { ctx, log } = fakeContext()
        const { source, asked } = folder()
        const player = sampledPlayer(window, source, fallback().player, { context: () => ctx })
        player.play(
            [
                { midi: 52, time: 0, duration: 0.04, kind: 'muted' },
                { midi: 88, time: 0, duration: 0.05, kind: 'click' }
            ],
            { sound: 'guitar', volume: 0.8 }
        )
        await wait()
        expect(asked.sort()).toEqual(['click.sf3', 'index.json', 'p028.sf3'])
        // The muted guitar's sample is not compressed: its points become the buffer.
        expect(log.buffers).toEqual([{ rate: 22050, data: new Float32Array([0.5, -0.5]) }])
        expect(log.sources.length).toBe(2)
        // The click is the kit's key 33, whatever the note written (recorded at key 44 here).
        expect(log.sources[1]!.playbackRate.value).toBeCloseTo(Math.pow(2, -11 / 12))
    })

    it('plays through the fallback when a file is missing', async () => {
        const { ctx, log } = fakeContext()
        const { source } = folder(['p025.sf3'])
        const light = fallback()
        const player = sampledPlayer(window, source, light.player, { context: () => ctx })
        let started = 0
        player.play(note, { sound: 'guitar', volume: 0.6, onStart: () => started++ })
        await wait()
        expect(log.sources).toEqual([])
        expect(light.plays).toEqual([{ events: note, sound: 'guitar', volume: 0.6 }])
        // A fallback that doesn't say when it starts starts now.
        expect(started).toBe(1)
        // The file is tried again at the next play.
        player.play(note, { sound: 'guitar', volume: 0.6 })
        await wait()
        expect(light.plays.length).toBe(2)
    })

    it("plays through the fallback when the browser can't decode a sample", async () => {
        const { ctx } = fakeContext(false)
        const { source } = folder()
        const light = fallback(true)
        const player = sampledPlayer(window, source, light.player, { context: () => ctx })
        let started = 0
        player.play(note, { sound: 'guitar', volume: 0.8, onStart: () => started++ })
        await wait()
        expect(light.plays.length).toBe(1)
        // This fallback says when it starts itself.
        expect(started).toBe(0)
    })

    it('one sound missing sends the whole play to the fallback, so it sounds like one', async () => {
        const { ctx, log } = fakeContext()
        const { source } = folder(['click.sf3'])
        const light = fallback()
        const player = sampledPlayer(window, source, light.player, { context: () => ctx })
        const events: NoteEvent[] = [...note, { midi: 88, time: 0, duration: 0.05, kind: 'click' }]
        player.play(events, { sound: 'guitar', volume: 0.8 })
        await wait()
        expect(log.sources).toEqual([])
        expect(light.plays[0]!.events).toBe(events)
    })

    it('stopped before its file is read, it plays nothing; stopped after, it fades out', async () => {
        const { ctx, log } = fakeContext()
        const { source } = folder()
        const light = fallback()
        const player = sampledPlayer(window, source, light.player, { context: () => ctx })
        player.play(note, { sound: 'guitar', volume: 0.8 }).stop()
        await wait()
        expect(log.sources).toEqual([])
        expect(light.plays).toEqual([])
        let ended = 0
        const handle = player.play(note, { sound: 'guitar', volume: 0.8, onEnd: () => ended++ })
        await wait()
        handle.stop()
        expect(log.sources[0]!.stopped).toBeCloseTo(10.05)
        expect(log.gains[0]!.gain.calls.at(-1)!.slice(0, 3)).toEqual(['target', 0, 10])
        // No end after a stop.
        await wait(700)
        expect(ended).toBe(0)
    })

    it('says when the notes are over', async () => {
        const { ctx } = fakeContext()
        const { source } = folder()
        const player = sampledPlayer(window, source, fallback().player, { context: () => ctx })
        let ended = 0
        player.play([{ midi: 52, time: 0, duration: 0.1 }], {
            sound: 'guitar',
            volume: 0.8,
            onEnd: () => ended++
        })
        await wait(200)
        expect(ended).toBe(0)
        await wait(150)
        expect(ended).toBe(1)
    })
})
