/** The room, the limiter and the amplifier after the notes (#103). */
import { describe, expect, it } from 'bun:test'
import {
    DEFAULT_REVERB,
    LIMITER,
    ROOM_SECONDS,
    ampFor,
    driveCurve,
    limiterTrim,
    outputFor,
    pageEffects,
    reverbLevel,
    roomImpulse
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
    let made = 0
    const node = (kind: string, extra: object = {}) => {
        const name = `${kind}${++made}`
        return {
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
    return { ctx: ctx as unknown as BaseAudioContext, links }
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
        // Nothing in the first 8 ms: the notes themselves come first.
        expect(energy(left, 0, Math.round(rate * 0.008))).toBe(0)
        const half = left.length / 2
        expect(energy(left, 0, half)).toBeGreaterThan(20 * energy(left, half))
        // The last tenth is about 55 dB under the whole.
        expect(energy(left, Math.round(left.length * 0.9))).toBeLessThan(1e-4)
    })

    it('is the same on every page and at every sample rate in length of time', () => {
        expect(roomImpulse(44100)[0]).toEqual(roomImpulse(44100)[0])
        expect(roomImpulse(44100, 0.5)[0]).toHaveLength(22050)
        expect(roomImpulse(8000, 0)[0]).toHaveLength(1)
    })
})

describe('the limiter (#103)', () => {
    it('leaves a level under its threshold alone and takes back its make-up gain', () => {
        expect(LIMITER.threshold).toBe(-3)
        expect(LIMITER.knee).toBe(0)
        // A full-scale input comes out at -2.85 dB; the compressor adds 0.6 of that back.
        expect(20 * Math.log10(limiterTrim())).toBeCloseTo(-1.71, 2)
        expect(limiterTrim(0, 20)).toBe(1)
    })
})

describe('the chain of a context (#103)', () => {
    it('is built once: the notes and the room both go to the limiter, then out', () => {
        const { ctx, links } = fakeContext()
        const first = outputFor(ctx) as unknown as { name: string }
        expect(first.name).toBe('gain1')
        expect(links).toEqual([
            ['gain1', 'limiter4'],
            ['gain1', 'convolver3'],
            ['convolver3', 'gain2'],
            ['gain2', 'limiter4'],
            ['limiter4', 'gain5'],
            ['gain5', 'destination']
        ])
        expect(outputFor(ctx)).toBe(first as unknown as AudioNode)
        expect(links).toHaveLength(6)
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
        expect(links.map(([from, to]) => `${from}>${to}`)).toEqual([
            'gain1>shaper2',
            'shaper2>gain3',
            'gain3>filter4',
            'filter4>filter5',
            'filter5>filter6',
            'filter6>filter7'
        ])
        expect((amp.input as unknown as { name: string }).name).toBe('gain1')
        expect((amp.output as unknown as { name: string }).name).toBe('filter7')
        const cabinet = ampFor(fakeContext().ctx, { cabinet: true })!
        expect((cabinet.output as unknown as { name: string }).name).toBe('filter5')
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
