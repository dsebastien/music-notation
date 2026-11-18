/** The room, the limiter and the amplifier after the notes (#103). */
import { describe, expect, it } from 'bun:test'
import {
    CABINET_TRIM_DB,
    CEILING,
    DEFAULT_REVERB,
    DRIVE_REFERENCE,
    LIMITER,
    LIMITER_WAKE,
    ROOM_SECONDS,
    ROOM_SHAPE,
    ampFor,
    ceilingCurve,
    driveAmount,
    driveCurve,
    driveLevel,
    limiterTrim,
    outputFor,
    pageEffects,
    reverbLevel,
    roomImpulse,
    roomSeconds
} from './effects.js'
import { effectsOf, playerFor, toned } from './controls.js'
import type { NoteEvent, NotePlayer } from './player.js'
import { renderBlock } from '../render/render-block.js'

const energy = (data: Float32Array, from = 0, to = data.length) => {
    let sum = 0
    for (let i = from; i < to; i++) sum += data[i]! * data[i]!
    return sum
}

/** A context that records what is made and what is connected to what. */
function fakeContext(without: string[] = []) {
    const links: [string, string][] = []
    const made: { name: string; gain: { value: number } }[] = []
    const node = (kind: string, extra: object = {}) => {
        const name = `${kind}${made.length + 1}`
        const it = {
            name,
            connect(to: { name: string }) {
                links.push([name, to.name])
                return to
            },
            disconnect() {},
            gain: {
                value: 1,
                setTargetAtTime(v: number) {
                    this.value = v
                }
            },
            threshold: { value: 0 },
            knee: { value: 0 },
            ratio: { value: 0 },
            attack: { value: 0 },
            release: { value: 0 },
            frequency: { value: 0 },
            Q: { value: 0 },
            ...extra
        }
        made.push(it)
        return it
    }
    const ctx: Record<string, unknown> = {
        sampleRate: 8000,
        currentTime: 0,
        destination: { name: 'destination' },
        createGain: () => node('gain'),
        createConvolver: () => node('convolver', { normalize: true, buffer: null }),
        createDynamicsCompressor: () => node('limiter'),
        createWaveShaper: () => node('shaper', { curve: null, oversample: 'none' }),
        createBiquadFilter: () => node('filter', { type: 'lowpass' }),
        createBuffer: (channels: number, length: number) => ({
            channels,
            length,
            getChannelData: () => new Float32Array(length)
        })
    }
    for (const name of without) delete ctx[name]
    return { ctx: ctx as unknown as BaseAudioContext, links, made }
}

describe('the room (#103)', () => {
    it('is light by default, and its level is a number from 0 to 1', () => {
        expect(DEFAULT_REVERB).toBeGreaterThan(0.05)
        expect(DEFAULT_REVERB).toBeLessThan(0.3)
        expect(reverbLevel(undefined)).toBe(DEFAULT_REVERB)
        expect(reverbLevel('loud')).toBe(DEFAULT_REVERB)
        expect(reverbLevel(Number.NaN)).toBe(DEFAULT_REVERB)
        expect(reverbLevel(0)).toBe(0)
        expect(reverbLevel(0.4)).toBe(0.4)
        expect(reverbLevel(3)).toBe(1)
        expect(reverbLevel(-1)).toBe(0)
    })

    it('rings for more than a second by default, and for 0.2 to 3 seconds when asked', () => {
        // A guitar's notes ring for seconds: a shorter room hides under them.
        expect(ROOM_SECONDS).toBeGreaterThanOrEqual(1)
        expect(roomSeconds(undefined)).toBe(ROOM_SECONDS)
        expect(roomSeconds('long')).toBe(ROOM_SECONDS)
        expect(roomSeconds(Number.NaN)).toBe(ROOM_SECONDS)
        expect(roomSeconds(2)).toBe(2)
        expect(roomSeconds(0)).toBe(0.2)
        expect(roomSeconds(60)).toBe(3)
    })

    it('has a generated impulse: two sides that differ, each with an energy of 1', () => {
        const [left, right] = roomImpulse(48000)
        expect(left).toHaveLength(Math.round(48000 * ROOM_SECONDS))
        expect(right).toHaveLength(left.length)
        expect(energy(left)).toBeCloseTo(1, 5)
        expect(energy(right)).toBeCloseTo(1, 5)
        let same = 0
        for (let i = 0; i < left.length; i++) if (left[i] === right[i]) same++
        expect(same / left.length).toBeLessThan(0.05)
    })

    it('starts after a short gap and falls away: most of its energy comes early', () => {
        const rate = 48000
        const [left] = roomImpulse(rate)
        // Nothing in the first 12 ms: the notes themselves come first.
        expect(energy(left, 0, Math.round(rate * 0.012))).toBe(0)
        expect(energy(left, 0, Math.round(rate * 0.02))).toBeGreaterThan(0)
        const half = left.length / 2
        expect(energy(left, 0, half)).toBeGreaterThan(20 * energy(left, half))
        // The last tenth is about 55 dB under the whole, and it ends on nothing: no step.
        expect(energy(left, Math.round(left.length * 0.9))).toBeLessThan(1e-4)
        expect(Math.abs(left[left.length - 1]!)).toBeLessThan(1e-6)
    })

    it('is darker than a guitar, comes up softly, and has half of its sound in the middle', () => {
        const rate = 48000
        const highs = (data: Float32Array) => {
            let jumps = 0
            for (let i = 1; i < data.length; i++) jumps += (data[i]! - data[i - 1]!) ** 2
            return jumps / energy(data)
        }
        const alike = (a: Float32Array, b: Float32Array) => {
            let sum = 0
            for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!
            return sum / Math.sqrt(energy(a) * energy(b))
        }
        // Heard as noise by Sébastien: as bright as the guitar, at full level from its first
        // instant, nothing in common between the two sides.
        expect(ROOM_SHAPE.bright).toBeLessThanOrEqual(5000)
        expect(ROOM_SHAPE.rise).toBeGreaterThanOrEqual(0.03)
        expect(ROOM_SHAPE.width).toBeLessThanOrEqual(0.6)
        const [left, right] = roomImpulse(rate)
        const [bright] = roomImpulse(rate, ROOM_SECONDS, { bright: 9000, dark: 1800 })
        expect(highs(bright)).toBeGreaterThan(3 * highs(left))
        // The first 20 ms of the tail hold little: it comes up.
        const early = (data: Float32Array) =>
            energy(data, Math.round(rate * 0.012), Math.round(rate * 0.032))
        const [sudden] = roomImpulse(rate, ROOM_SECONDS, { rise: 0 })
        expect(early(sudden)).toBeGreaterThan(5 * early(left))
        // Width: 0.5 is half in common, 0 the same on both sides, 1 nothing in common.
        expect(alike(left, right)).toBeCloseTo(Math.cos(Math.PI / 4), 1)
        const [same, too] = roomImpulse(rate, ROOM_SECONDS, { width: 0 })
        expect(alike(same, too)).toBeCloseTo(1, 5)
        const [one, other] = roomImpulse(rate, ROOM_SECONDS, { width: 1 })
        expect(Math.abs(alike(one, other))).toBeLessThan(0.05)
        for (const side of [left, right, bright, sudden, same, one, other])
            expect(energy(side)).toBeCloseTo(1, 5)
    })

    it('gets darker as it falls, the same at every sample rate', () => {
        // The share of the energy in the jumps from one point to the next: the highs.
        const highs = (data: Float32Array, from: number, to: number) => {
            let jumps = 0
            for (let i = from + 1; i < to; i++) jumps += (data[i]! - data[i - 1]!) ** 2
            return jumps / energy(data, from, to)
        }
        for (const rate of [44100, 48000]) {
            const [left] = roomImpulse(rate)
            const early = highs(left, Math.round(rate * 0.02), Math.round(rate * 0.12))
            const late = highs(left, Math.round(rate * 0.7), Math.round(rate * 0.9))
            expect(early).toBeGreaterThan(1.5 * late)
        }
    })

    it('is the same on every page and at every sample rate in length of time', () => {
        expect(roomImpulse(44100)[0]).toEqual(roomImpulse(44100)[0])
        expect(roomImpulse(44100, 0.5)[0]).toHaveLength(22050)
        expect(roomImpulse(8000, 0)[0]).toHaveLength(1)
    })
})

describe('the limiter (#103)', () => {
    it('leaves a level under its threshold alone and takes back its make-up gain', () => {
        expect(LIMITER.threshold).toBe(-1.5)
        expect(LIMITER.knee).toBe(0)
        // A full-scale input comes out at -1.425 dB; the compressor adds 0.6 of that back.
        expect(20 * Math.log10(limiterTrim())).toBeCloseTo(-0.855, 2)
        expect(limiterTrim(0, 20)).toBe(1)
    })

    it('is above an ordinary strum, so only accents and plays that add up are turned down', () => {
        // A six-string strum of the recorded steel guitar peaks at 0.83 (-1.6 dB).
        expect(Math.pow(10, LIMITER.threshold / 20)).toBeGreaterThan(0.83)
        expect(LIMITER.threshold).toBeLessThan(0)
    })

    it('is slow, and lets go fast in its first moments so the first notes are not turned down', () => {
        expect(LIMITER.attack).toBeGreaterThanOrEqual(0.005)
        expect(LIMITER.release).toBeGreaterThanOrEqual(0.3)
        // A context without schedules: the limiter's own release at once.
        const plain = fakeContext()
        outputFor(plain.ctx)
        const release = (made: { name: string }[]) =>
            (made.find((n) => n.name.startsWith('limiter')) as unknown as { release: Schedule })
                .release
        interface Schedule {
            value: number
            setValueAtTime?: (value: number, at: number) => void
        }
        expect(release(plain.made).value).toBe(LIMITER.release)
        // With schedules: fast first, the limiter's release after its first moments.
        const asked: [number, number][] = []
        const timed = fakeContext()
        const make = (timed.ctx as unknown as { createDynamicsCompressor: () => object })
            .createDynamicsCompressor
        ;(
            timed.ctx as unknown as { createDynamicsCompressor: () => object }
        ).createDynamicsCompressor = () => {
            const node = make() as { release: Schedule }
            node.release.setValueAtTime = (value, at) => asked.push([value, at])
            return node
        }
        outputFor(timed.ctx)
        expect(release(timed.made).value).toBe(LIMITER_WAKE.release)
        expect(asked).toEqual([[LIMITER.release, LIMITER_WAKE.seconds]])
        expect(LIMITER_WAKE.release).toBeLessThan(0.1)
    })

    it('has a ceiling after it: as it is under the knee, never above 1', () => {
        const curve = ceilingCurve()
        const at = (level: number) =>
            curve[Math.round(((level / CEILING.range + 1) / 2) * (curve.length - 1))]!
        for (const level of [0, 0.25, 0.5, CEILING.knee]) {
            expect(at(level)).toBeCloseTo(level, 3)
            expect(at(-level)).toBeCloseTo(-level, 3)
        }
        expect(at(1)).toBeGreaterThan(CEILING.knee)
        expect(at(1)).toBeLessThan(1)
        expect(at(CEILING.range)).toBeLessThanOrEqual(1)
        for (let i = 1; i < curve.length; i++) {
            expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!)
            expect(Math.abs(curve[i]!)).toBeLessThanOrEqual(1)
        }
    })
})

describe('the chain of a context (#103)', () => {
    it('is built once: the notes and the room both go to the limiter, then out', () => {
        const { ctx, links } = fakeContext()
        const first = outputFor(ctx) as unknown as { name: string }
        expect(first.name).toBe('gain1')
        // The room goes through its low cut; after the limiter, the ceiling.
        expect(links).toEqual([
            ['gain1', 'limiter4'],
            ['gain1', 'convolver3'],
            ['convolver3', 'filter6'],
            ['filter6', 'gain2'],
            ['gain2', 'limiter4'],
            ['limiter4', 'gain5'],
            ['gain5', 'shaper7'],
            ['shaper7', 'destination']
        ])
        expect(outputFor(ctx)).toBe(first as unknown as AudioNode)
        expect(links).toHaveLength(8)
    })

    it('ends where the caller says, for a context that keeps its speakers elsewhere', () => {
        const { ctx, links } = fakeContext()
        const speakers = { name: 'speakers' } as unknown as AudioNode
        outputFor(ctx, undefined, speakers)
        expect(links[links.length - 1]).toEqual(['shaper7', 'speakers'])
        expect(outputFor(fakeContext().ctx, { dry: true }, speakers)).toBe(speakers)
        expect(outputFor(fakeContext(['createConvolver']).ctx, undefined, speakers)).toBe(speakers)
    })

    it('still works without filters or a wave shaper: the room and the limiter alone', () => {
        const { ctx, links } = fakeContext(['createBiquadFilter', 'createWaveShaper'])
        outputFor(ctx)
        expect(links).toEqual([
            ['gain1', 'limiter4'],
            ['gain1', 'convolver3'],
            ['convolver3', 'gain2'],
            ['gain2', 'limiter4'],
            ['limiter4', 'gain5'],
            ['gain5', 'destination']
        ])
    })

    it("takes the last play's level and length of room, a new room only when it changes", () => {
        const { ctx, made } = fakeContext()
        outputFor(ctx, { reverb: 0.4 })
        const wet = made.find((n) => n.name === 'gain2')!
        const room = made.find((n) => n.name === 'convolver3')! as unknown as {
            buffer: { length: number }
        }
        expect(wet.gain.value).toBe(0.4)
        expect(room.buffer.length).toBe(Math.round(8000 * ROOM_SECONDS))
        const first = room.buffer
        outputFor(ctx, { reverb: 0.1 })
        expect(wet.gain.value).toBe(0.1)
        expect(room.buffer).toBe(first)
        outputFor(ctx, { room: 2 })
        expect(wet.gain.value).toBe(DEFAULT_REVERB)
        expect(room.buffer.length).toBe(16000)
    })

    it("goes straight to the output for dry, and in a context that can't build it", () => {
        const { ctx, links } = fakeContext()
        expect(outputFor(ctx, { dry: true })).toBe(ctx.destination)
        expect(links).toEqual([])
        const old = fakeContext(['createConvolver'])
        expect(outputFor(old.ctx)).toBe(old.ctx.destination)
        const older = fakeContext(['createDynamicsCompressor'])
        expect(outputFor(older.ctx)).toBe(older.ctx.destination)
    })
})

describe("an electric guitar's amplifier (#103)", () => {
    it('is nothing unless a drive or a cabinet is asked for', () => {
        const { ctx } = fakeContext()
        expect(ampFor(ctx, undefined)).toBeNull()
        expect(ampFor(ctx, {})).toBeNull()
        expect(ampFor(ctx, { drive: 0 })).toBeNull()
        expect(ampFor(fakeContext(['createWaveShaper']).ctx, { drive: 0.5 })).toBeNull()
    })

    it('drives, then goes through the cabinet: no deep bass, a mid peak, no fizz', () => {
        const { ctx, links } = fakeContext()
        const amp = ampFor(ctx, { drive: 0.4, cabinet: true })!
        // The drive: its bass cut, the curve, its level. The cabinet: four filters, its level.
        expect(links.map(([from, to]) => `${from}>${to}`)).toEqual([
            'gain1>filter2',
            'filter2>shaper3',
            'shaper3>gain4',
            'gain4>filter5',
            'filter5>filter6',
            'filter6>filter7',
            'filter7>filter8',
            'filter8>gain9'
        ])
        expect((amp.input as unknown as { name: string }).name).toBe('gain1')
        expect((amp.output as unknown as { name: string }).name).toBe('gain9')
        const cabinet = fakeContext()
        const only = ampFor(cabinet.ctx, { cabinet: true })!
        expect((only.output as unknown as { name: string }).name).toBe('gain6')
        expect(cabinet.made.find((n) => n.name === 'gain6')!.gain.value).toBeCloseTo(
            Math.pow(10, CABINET_TRIM_DB / 20),
            6
        )
    })

    it('keeps a strum as loud with more drive: the level after the curve is matched', () => {
        const level = (drive: number, peak: number) => {
            const amount = driveAmount(drive)
            let before = 0
            let after = 0
            for (let i = 0; i < 512; i++) {
                const x = peak * Math.sin((2 * Math.PI * i) / 512)
                before += x * x
                after += (driveLevel(drive) * Math.tanh(amount * x)) ** 2 / Math.tanh(amount) ** 2
            }
            return 10 * Math.log10(after / before)
        }
        for (const drive of [0.1, 0.25, 0.5, 1]) {
            // The same level at the reference, and within 6 dB an octave of level around it
            // (a fixed gain gave 10 to 12 dB more on a recorded strum).
            expect(level(drive, DRIVE_REFERENCE)).toBeCloseTo(0, 1)
            expect(Math.abs(level(drive, DRIVE_REFERENCE / 2))).toBeLessThan(6)
            expect(Math.abs(level(drive, DRIVE_REFERENCE * 2))).toBeLessThan(6)
            expect(driveLevel(drive)).toBeLessThan(1)
        }
        expect(driveLevel(1)).toBeLessThan(driveLevel(0.25))
        expect(driveAmount(0)).toBe(1)
        expect(driveAmount(7)).toBe(driveAmount(1))
    })

    it('has a curve with a soft ceiling: odd, within -1 and 1, steeper with more drive', () => {
        const soft = driveCurve(0.1)
        const hard = driveCurve(1)
        for (const curve of [soft, hard]) {
            expect(curve[0]).toBeCloseTo(-1, 6)
            expect(curve[curve.length - 1]).toBeCloseTo(1, 6)
            for (let i = 0; i < curve.length; i++) {
                expect(Math.abs(curve[i]!)).toBeLessThanOrEqual(1)
                expect(curve[i]! + curve[curve.length - 1 - i]!).toBeCloseTo(0, 6)
            }
        }
        const middle = Math.round(soft.length * 0.55)
        expect(hard[middle]!).toBeGreaterThan(soft[middle]!)
    })
})

describe("a page's and an app's effects (#103)", () => {
    it('reads reverb, dry and amp from the page options, a function called', () => {
        expect(pageEffects(undefined)).toBeNull()
        expect(pageEffects({ play: true })).toBeNull()
        expect(pageEffects({ play: { volume: 0.5 } })).toBeNull()
        expect(pageEffects({ play: { reverb: 0.3 } })).toEqual({ reverb: 0.3 })
        expect(pageEffects({ play: { room: 2 } })).toEqual({ room: 2 })
        expect(pageEffects({ play: { room: () => 9, reverb: 0 } })).toEqual({ reverb: 0, room: 3 })
        expect(pageEffects({ play: { room: 'big' } })).toBeNull()
        expect(pageEffects({ play: { reverb: 7, dry: true } })).toEqual({ reverb: 1, dry: true })
        expect(
            pageEffects({ play: { reverb: () => 0.2, amp: () => ({ cabinet: true }) } })
        ).toEqual({
            reverb: 0.2,
            amp: { cabinet: true }
        })
        expect(pageEffects({ play: { amp: { drive: 0.5, cabinet: 'yes' } } })).toEqual({
            amp: { drive: 0.5 }
        })
        expect(
            pageEffects({
                play: {
                    reverb: () => {
                        throw new Error('no')
                    }
                }
            })
        ).toBeNull()
    })

    it("gives an app's player its own object when the app names no effect", () => {
        const player: NotePlayer = { play: () => ({ stop() {} }) }
        expect(effectsOf({})).toBeNull()
        expect(playerFor(window, { player })).toBe(player)
        expect(effectsOf({ reverb: 0.333, dry: true })).toEqual({ reverb: 0.33, dry: true })
        expect(effectsOf({ reverb: () => null })).toBeNull()
        expect(effectsOf({ room: 1.777 })).toEqual({ room: 1.78 })
        expect(effectsOf({ room: () => 0 })).toEqual({ room: 0.2 })
        expect(effectsOf({ amp: () => ({ cabinet: true, drive: 2 }) })).toEqual({
            amp: { cabinet: true, drive: 1 }
        })
    })

    it('reaches the player with each play, read again when it is a function', () => {
        const asked: unknown[] = []
        const player: NotePlayer = {
            play(_events: NoteEvent[], options) {
                asked.push(options.effects ?? 'none')
                return { stop() {} }
            }
        }
        let level = 0.4
        const h = document.body.appendChild(document.createElement('div'))
        renderBlock('chord', 'A x02220', h, { play: { player, reverb: () => level } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        toggle.click()
        level = 0
        toggle.click()
        expect(asked).toEqual([{ reverb: 0.4 }, { reverb: 0 }])
        // A play that names its own effects keeps them.
        toned(player, { dry: true }).play([], {
            sound: 'guitar',
            volume: 1,
            effects: { reverb: 1 }
        })
        expect(asked[2]).toEqual({ reverb: 1 })
        // With a guitar too: one twin gives both.
        const both: unknown[] = []
        const other: NotePlayer = {
            play(_events, options) {
                both.push([options.guitar, options.effects])
                return { stop() {} }
            }
        }
        toned(other, { guitar: 'nylon', dry: true }).play([], { sound: 'guitar', volume: 1 })
        expect(both).toEqual([['nylon', { dry: true }]])
    })
})
