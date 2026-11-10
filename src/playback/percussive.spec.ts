import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import { clickFrequency, lightPlayer, type NoteEvent } from './player.js'
import { soundfontPlayer } from '../tab/index.js'

/** An audio context that records the nodes made and each envelope's levels and times. */
function fakeWindow() {
    const made: { type: string; frequency?: number; buffer?: boolean }[] = []
    const envelopes: { values: number[]; times: number[] }[] = []
    const oscillators: { frequency: { value: number } }[] = []
    class Param {
        value = 1
        readonly values: number[] = []
        readonly times: number[] = []
        setValueAtTime(v: number, t: number) {
            this.values.push(v)
            this.times.push(t)
        }
        linearRampToValueAtTime(v: number, t: number) {
            this.values.push(v)
            this.times.push(t)
        }
        exponentialRampToValueAtTime(v: number, t: number) {
            this.values.push(v)
            this.times.push(t)
        }
    }
    const node = () => ({ connect() {}, disconnect() {} })
    // What the context was asked, in order: buffers made, the clock read.
    const calls: string[] = []
    class FakeContext {
        get currentTime() {
            calls.push('time')
            return 0
        }
        sampleRate = 8000
        destination = node()
        resume = () => Promise.resolve()
        createGain() {
            const gain = new Param()
            envelopes.push(gain)
            return { ...node(), gain }
        }
        createBuffer(_c: number, length: number) {
            calls.push('buffer')
            return { getChannelData: () => new Float32Array(length) }
        }
        createBufferSource() {
            made.push({ type: 'buffer', buffer: true })
            return { ...node(), buffer: null, start() {}, stop() {} }
        }
        createOscillator() {
            const osc = {
                ...node(),
                type: 'sine',
                frequency: new Param(),
                setPeriodicWave() {},
                start() {},
                stop() {}
            }
            made.push({ type: 'oscillator' })
            oscillators.push(osc)
            return osc
        }
        createPeriodicWave() {
            return {}
        }
        createBiquadFilter() {
            made.push({ type: 'filter' })
            return { ...node(), type: 'lowpass', frequency: new Param() }
        }
    }
    const win = {
        AudioContext: FakeContext,
        setTimeout: () => 0,
        clearTimeout() {}
    } as unknown as Window
    return { win, made, envelopes, oscillators, calls }
}

describe('percussive notes (NoteEvent.kind)', () => {
    it('light synthesizer: a muted note is a damped, dulled string, gone within 0.07 s', () => {
        const { win, made, envelopes } = fakeWindow()
        lightPlayer(win).play([{ midi: 40, time: 0, duration: 1, kind: 'muted', velocity: 100 }], {
            sound: 'guitar',
            volume: 1
        })
        expect(made.map((m) => m.type)).toEqual(['filter', 'buffer'])
        // Master volume, then the note's envelope: down to silence 0.07 s after its start.
        const env = envelopes[1]!
        expect(env.values[env.values.length - 1]).toBeLessThan(0.001)
        expect(env.times[env.times.length - 1]! - env.times[0]!).toBeCloseTo(0.07)
    })

    it('light synthesizer: a click is a short tick, not a string, on either sound', () => {
        for (const sound of ['guitar', 'piano'] as const) {
            const { win, made, envelopes } = fakeWindow()
            lightPlayer(win).play([{ midi: 88, time: 0, duration: 0.05, kind: 'click' }], {
                sound,
                volume: 1
            })
            expect(made.map((m) => m.type)).toEqual(['oscillator'])
            const env = envelopes[1]!
            expect(env.times[env.times.length - 1]! - env.times[0]!).toBeCloseTo(0.03)
        }
    })

    it('light synthesizer: the downbeat, a beat and the other beats click at three pitches', () => {
        // The count-in in simple time: 88 on 1, 84 on the other beats; 81 between counted beats.
        expect([88, 84, 81].map(clickFrequency)).toEqual([2800, 2100, 1400])
        const { win, oscillators } = fakeWindow()
        lightPlayer(win).play(
            [88, 84, 84, 84].map((midi, i) => ({ midi, time: i, duration: 0.05, kind: 'click' })),
            { sound: 'guitar', volume: 1 }
        )
        expect(oscillators.map((o) => o.frequency.value)).toEqual([2800, 2100, 2100, 2100])
    })

    it('light synthesizer: strings for strings only, made before the start time is read', () => {
        // Clicks make no string buffer.
        const clicks = fakeWindow()
        lightPlayer(clicks.win).play(
            [0, 1, 2, 3].map((time) => ({ midi: 84 + time, time, duration: 0.05, kind: 'click' })),
            { sound: 'guitar', volume: 1 }
        )
        expect(clicks.calls.filter((c) => c === 'buffer')).toEqual([])
        // A muted strum's strings: made up front, one each.
        const muted = fakeWindow()
        lightPlayer(muted.win).play(
            [40, 47, 52].map((midi) => ({ midi, time: 0, duration: 0.06, kind: 'muted' })),
            { sound: 'guitar', volume: 1 }
        )
        expect(muted.calls.slice(0, 4)).toEqual(['buffer', 'buffer', 'buffer', 'time'])
        expect(muted.calls.filter((c) => c === 'buffer')).toHaveLength(3)
    })

    it('soundfont: muted notes on the muted guitar (program 28), clicks on the metronome click', () => {
        let played: {
            tracks: {
                events: { channel?: number; noteKey?: number; program?: number; type?: number }[]
            }[]
        } | null = null
        const api = {
            masterVolume: 1,
            playbackSpeed: 1,
            player: { playOneTimeMidiFile: (midi: typeof played) => (played = midi), stop() {} }
        }
        const player = soundfontPlayer(alphaTab, () => api as never)
        const events: NoteEvent[] = [
            { midi: 88, time: 0, duration: 0.05, kind: 'click' },
            { midi: 40, time: 1, duration: 0.06, kind: 'muted' },
            { midi: 40, time: 2, duration: 1 }
        ]
        player.play(events, { sound: 'guitar', volume: 1 }).stop()
        const all = played!.tracks.flatMap((t) => t.events)
        const notes = all.filter((e) => e.constructor.name === 'NoteOnEvent')
        expect(notes.map((e) => [e.channel, e.noteKey])).toEqual([
            [9, 33],
            [1, 40],
            [0, 40]
        ])
        const programs = all.filter((e) => e.constructor.name === 'ProgramChangeEvent')
        expect(programs.map((e) => [e.channel, e.program])).toEqual([
            [0, 25],
            [1, 28],
            [9, 0]
        ])
        // The song ends half a second after the last note (3 s), on a pedal-up, so it rings.
        const division = (played as unknown as { division: number }).division
        const last = all.reduce((a, b) =>
            (b as { tick?: number }).tick! >= (a as { tick?: number }).tick! ? b : a
        ) as { tick: number; controller?: number; value?: number }
        expect(last.constructor.name).toBe('ControlChangeEvent')
        expect(last.controller).toBe(alphaTab.midi.ControllerType.HoldPedal)
        expect(last.value).toBe(0)
        expect(last.tick).toBe(Math.round(3.5 * division))
        // On piano, a muted note is a short piano note.
        player.play([events[1]!], { sound: 'piano', volume: 1 }).stop()
        const piano = played!.tracks
            .flatMap((t) => t.events)
            .filter((e) => e.constructor.name === 'NoteOnEvent')
        expect(piano.map((e) => e.channel)).toEqual([0])
    })
})
