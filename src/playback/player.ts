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
    options: SequenceOptions = DEFAULT_SEQUENCE,
    /** A scale's root (chroma): the run goes from the lowest root to the highest one. */
    root: number | null = null
): NoteEvent[] {
    if (!pitches.length) return []
    if (kind === 'chord') {
        const strum = Number.isFinite(options.strum) ? options.strum : DEFAULT_SEQUENCE.strum
        const gap = Math.min(200, Math.max(0, strum)) / 1000
        return pitches.map((midi, i) => ({
            midi,
            time: i * gap,
            duration: RING + (pitches.length - 1 - i) * gap
        }))
    }
    const bpm = Number.isFinite(options.bpm) ? options.bpm : DEFAULT_SEQUENCE.bpm
    const beat = 60 / Math.min(240, Math.max(20, bpm))
    let up = [...pitches].sort((a, b) => a - b)
    if (root !== null) {
        const roots = up.filter((p) => ((p % 12) + 12) % 12 === root)
        if (roots.length >= 2)
            up = up.filter((p) => p >= roots[0]! && p <= roots[roots.length - 1]!)
    }
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
/** How long a guitar note's buffer lasts; each note is cut to its own length when it plays. */
const STRING_SECONDS = 4

/** The partials of the simple piano tone (fundamental first). */
const PIANO_PARTIALS = [0, 1, 0.5, 0.3, 0.15, 0.08, 0.04]

export function lightPlayer(win: Window): NotePlayer {
    // One buffer per string pitch: notes of any length reuse it.
    const strings = new Map<number, AudioBuffer>()
    const waves = new WeakMap<AudioContext, PeriodicWave>()
    const stringBuffer = (ctx: AudioContext, midi: number) => {
        let buffer = strings.get(midi)
        if (!buffer) {
            const data = pluckedString(midi, ctx.sampleRate, STRING_SECONDS)
            buffer = ctx.createBuffer(1, data.length, ctx.sampleRate)
            buffer.getChannelData(0).set(data)
            strings.set(midi, buffer)
        }
        return buffer
    }
    const pianoWave = (ctx: AudioContext) => {
        let wave = waves.get(ctx)
        if (!wave) {
            const real = new Float32Array(PIANO_PARTIALS.length)
            wave = ctx.createPeriodicWave(real, Float32Array.from(PIANO_PARTIALS))
            waves.set(ctx, wave)
        }
        return wave
    }
    return {
        play(events, { sound, volume, onEnd }) {
            const ctx = contextFor(win)
            if (!ctx || !events.length) return { stop() {} }
            void ctx.resume()
            // Buffers are made before the start time is read, so the first notes aren't late.
            if (sound === 'guitar') for (const e of events) stringBuffer(ctx, e.midi)
            const gain = ctx.createGain()
            gain.gain.value = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8
            gain.connect(ctx.destination)
            const start = ctx.currentTime + 0.05
            const sources = events.map((e) => {
                const at = start + e.time
                const end = at + e.duration
                // Each note fades out at its end, so it doesn't click.
                const env = ctx.createGain()
                env.connect(gain)
                let source: AudioScheduledSourceNode
                if (sound === 'guitar') {
                    const buffer = ctx.createBufferSource()
                    buffer.buffer = stringBuffer(ctx, e.midi)
                    source = buffer
                    env.gain.setValueAtTime(1, end)
                } else {
                    // A struck tone: a quick attack, then a decay, as a piano string.
                    const osc = ctx.createOscillator()
                    osc.setPeriodicWave(pianoWave(ctx))
                    osc.frequency.value = frequency(e.midi)
                    source = osc
                    env.gain.setValueAtTime(0, at)
                    env.gain.linearRampToValueAtTime(0.35, at + 0.005)
                    env.gain.exponentialRampToValueAtTime(0.02, Math.max(at + 0.01, end))
                }
                env.gain.linearRampToValueAtTime(0, end + 0.08)
                source.connect(env)
                source.start(at)
                source.stop(end + 0.1)
                return source
            })
            const finish = () => gain.disconnect()
            const timer = win.setTimeout(
                () => {
                    finish()
                    onEnd?.()
                },
                (lengthOf(events) + 0.15) * 1000
            )
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
                    finish()
                }
            }
        }
    }
}
