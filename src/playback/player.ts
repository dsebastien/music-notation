/**
 * Hearing the diagrams (#23): what a chord, keyboard or fretboard plays, as timed notes, and a
 * light synthesizer to play them (a plucked string for guitar, a simple piano), with no download.
 * Apps can pass another NotePlayer (a soundfont one) for realistic sound.
 */

export type Sound = 'guitar' | 'piano'

export interface NoteEvent {
    midi: number
    /** Seconds from the start. */
    time: number
    /** Seconds. */
    duration: number
}

export interface PlayHandle {
    stop(): void
}

export interface NotePlayer {
    /** Plays the notes; `onEnd` runs once they're over (not after stop). */
    play(
        events: NoteEvent[],
        options: { sound: Sound; volume: number; onEnd?: () => void }
    ): PlayHandle
}

/** What a diagram plays: a chord strummed then ringing, or notes one after the other. */
export type PlayKind = 'chord' | 'scale'

export interface SequenceOptions {
    /** Scales: notes per minute (one note per beat). */
    bpm: number
    /** Chords: milliseconds between two strings of the strum. */
    strum: number
}

export const DEFAULT_SEQUENCE: SequenceOptions = { bpm: 90, strum: 40 }

/** How long a strummed chord rings, in seconds. */
const RING = 2.5

/**
 * The notes a diagram plays: a chord strums low to high and rings; a scale goes up and back down
 * (the top note once), each note one beat long.
 */
export function sequenceOf(
    kind: PlayKind,
    pitches: readonly number[],
    options: SequenceOptions = DEFAULT_SEQUENCE
): NoteEvent[] {
    if (!pitches.length) return []
    if (kind === 'chord') {
        const gap = Math.max(0, options.strum) / 1000
        return pitches.map((midi, i) => ({
            midi,
            time: i * gap,
            duration: RING + (pitches.length - 1 - i) * gap
        }))
    }
    const beat = 60 / Math.min(400, Math.max(20, options.bpm))
    const up = [...pitches].sort((a, b) => a - b)
    const order = [...up, ...up.slice(0, -1).reverse()]
    return order.map((midi, i) => ({ midi, time: i * beat, duration: beat * 0.95 }))
}

/** The end of a sequence, in seconds. */
export const lengthOf = (events: readonly NoteEvent[]): number =>
    events.reduce((end, e) => Math.max(end, e.time + e.duration), 0)

const frequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/**
 * A plucked string (Karplus-Strong): a burst of noise through a delay line one period long,
 * averaged as it loops, so the tone softens as it decays, like a string.
 */
export function pluckedString(
    midi: number,
    sampleRate: number,
    seconds: number,
    random: () => number = Math.random
): Float32Array {
    const out = new Float32Array(Math.round(sampleRate * seconds))
    const period = Math.max(2, Math.round(sampleRate / frequency(midi)))
    const line = new Float32Array(period)
    for (let i = 0; i < period; i++) line[i] = random() * 2 - 1
    // Lower notes ring longer, as on a guitar.
    const decay = 0.996 + Math.min(0.0035, 0.00004 * (90 - midi))
    let at = 0
    for (let i = 0; i < out.length; i++) {
        const next = (at + 1) % period
        const value = line[at]!
        line[at] = decay * 0.5 * (value + line[next]!)
        out[i] = value * 0.5
        at = next
    }
    return out
}

/** A simple piano tone: a few harmonics with a struck attack, the higher ones fading first. */
export function pianoTone(midi: number, sampleRate: number, seconds: number): Float32Array {
    const out = new Float32Array(Math.round(sampleRate * seconds))
    const f = frequency(midi)
    const harmonics = [1, 0.5, 0.3, 0.15, 0.08, 0.04]
    for (let i = 0; i < out.length; i++) {
        const t = i / sampleRate
        const attack = Math.min(1, t / 0.005)
        let value = 0
        harmonics.forEach((amp, k) => {
            const n = k + 1
            if (f * n > sampleRate / 2) return
            value += amp * Math.exp(-t * (1.2 + n * 0.8)) * Math.sin(2 * Math.PI * f * n * t)
        })
        out[i] = 0.3 * attack * value
    }
    return out
}

type AudioContextClass = typeof AudioContext

/** One audio context per window, made on the first play (browsers need a user gesture). */
const contexts = new WeakMap<object, AudioContext>()

function contextFor(win: Window & { AudioContext?: AudioContextClass }): AudioContext | null {
    const existing = contexts.get(win)
    if (existing) return existing
    const Ctor = win.AudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    contexts.set(win, ctx)
    return ctx
}

/** The light synthesizer: computed sound, a few KB, no download. */
export function lightPlayer(win: Window): NotePlayer {
    const cache = new Map<string, AudioBuffer>()
    return {
        play(events, { sound, volume, onEnd }) {
            const ctx = contextFor(win)
            if (!ctx) return { stop() {} }
            void ctx.resume()
            const gain = ctx.createGain()
            gain.gain.value = Math.min(1, Math.max(0, volume))
            gain.connect(ctx.destination)
            const start = ctx.currentTime + 0.05
            const sources = events.map((e) => {
                const seconds = Math.min(4, e.duration + (sound === 'guitar' ? 0.5 : 0.3))
                const key = `${sound}:${e.midi}:${seconds.toFixed(2)}`
                let buffer = cache.get(key)
                if (!buffer) {
                    const data =
                        sound === 'guitar'
                            ? pluckedString(e.midi, ctx.sampleRate, seconds)
                            : pianoTone(e.midi, ctx.sampleRate, seconds)
                    buffer = ctx.createBuffer(1, data.length, ctx.sampleRate)
                    buffer.getChannelData(0).set(data)
                    cache.set(key, buffer)
                }
                const source = ctx.createBufferSource()
                source.buffer = buffer
                // Each note stops at its end, with a short fade so it doesn't click.
                const env = ctx.createGain()
                env.gain.setValueAtTime(1, start + e.time + e.duration)
                env.gain.linearRampToValueAtTime(0, start + e.time + e.duration + 0.08)
                source.connect(env).connect(gain)
                source.start(start + e.time)
                source.stop(start + e.time + e.duration + 0.1)
                return source
            })
            const timer = win.setTimeout(() => onEnd?.(), (lengthOf(events) + 0.15) * 1000)
            return {
                stop() {
                    win.clearTimeout(timer)
                    for (const s of sources) {
                        try {
                            s.stop()
                        } catch {
                            // Already stopped.
                        }
                    }
                    gain.disconnect()
                }
            }
        }
    }
}
