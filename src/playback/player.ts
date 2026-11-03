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
    /** How hard the note is played, MIDI style (1–127); 100 when absent. */
    velocity?: number
}

export interface PlayHandle {
    stop(): void
}

export interface NotePlayer {
    /**
     * Plays the notes; `onEnd` runs once they're over (not after stop). `onStart`, when given,
     * runs once when the notes really start sounding (the events' time 0), after any wait for a
     * soundfont; not after stop. The playback bar lights each note from that moment.
     */
    play(
        events: NoteEvent[],
        options: { sound: Sound; volume: number; onEnd?: () => void; onStart?: () => void }
    ): PlayHandle
    /**
     * True when `play` calls `onStart`: the bar then waits for it before it lights notes.
     * Without it, the bar lights notes from the first `onStart`, or shortly after the play call.
     */
    readonly reportsStart?: boolean
}

/** What a diagram plays: a chord strummed then ringing, or notes one after the other. */
export type PlayKind = 'chord' | 'scale'

export interface SequenceOptions {
    /** Scales: notes per minute (one note per beat). */
    bpm: number
    /** Chords: milliseconds between two strings of the strum. */
    strum: number
    /**
     * Scales: the tonic's pitch class (0–11). The run starts on the lowest tonic drawn, goes up to
     * the highest note, down to the lowest, and back up to that tonic. Without it (or when no
     * tonic is drawn), it runs from the lowest note.
     */
    root?: number | null
}

export const DEFAULT_SEQUENCE: SequenceOptions = { bpm: 90, strum: 40 }

/** How long a strummed chord rings, in seconds. */
const RING = 2.5

/** A pitch class (0–11), also of negative numbers. */
const chromaOf = (midi: number) => ((midi % 12) + 12) % 12

/**
 * The order a scale's notes play in, every note drawn at least once: from the lowest tonic up to
 * the highest note, down to the lowest note, and back up to the tonic (the way teachers run a
 * position: root, top, bottom, root). With the tonic at the bottom, that is up and back down;
 * without a tonic, from the lowest note up and back down. The top and bottom notes play once.
 */
export function scaleRun(pitches: readonly number[], root?: number | null): number[] {
    const up = [...new Set(pitches)].sort((a, b) => a - b)
    const down = up.slice(0, -1).reverse()
    const first =
        root === undefined || root === null || !Number.isFinite(root)
            ? -1
            : up.findIndex((midi) => chromaOf(midi) === chromaOf(root))
    if (first < 0) return [...up, ...down]
    return [...up.slice(first), ...down, ...up.slice(1, first + 1)]
}

/**
 * The notes a diagram plays: a chord strums low to high and rings; a scale plays every note drawn
 * (see `scaleRun`), each note one beat long.
 */
export function sequenceOf(
    kind: PlayKind,
    pitches: readonly number[],
    options: SequenceOptions = DEFAULT_SEQUENCE
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
    return scaleRun(pitches, options.root).map((midi, i) => ({
        midi,
        time: i * beat,
        duration: beat * 0.95
    }))
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
        reportsStart: true,
        play(events, { sound, volume, onEnd, onStart }) {
            const ctx = contextFor(win)
            if (!ctx || !events.length) return { stop() {} }
            const resumed = ctx.resume()
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
                // Velocity scales the note's level (100, the default, is the level as computed).
                const level =
                    e.velocity === undefined || !Number.isFinite(e.velocity)
                        ? 1
                        : Math.min(127, Math.max(0, e.velocity)) / 100
                let source: AudioScheduledSourceNode
                if (sound === 'guitar') {
                    const buffer = ctx.createBufferSource()
                    buffer.buffer = stringBuffer(ctx, e.midi)
                    source = buffer
                    env.gain.setValueAtTime(level, at)
                    env.gain.setValueAtTime(level, end)
                } else {
                    // A struck tone: a quick attack, then a decay, as a piano string.
                    const osc = ctx.createOscillator()
                    osc.setPeriodicWave(pianoWave(ctx))
                    osc.frequency.value = frequency(e.midi)
                    source = osc
                    env.gain.setValueAtTime(0, at)
                    env.gain.linearRampToValueAtTime(0.35 * level || 0.0001, at + 0.005)
                    env.gain.exponentialRampToValueAtTime(
                        0.02 * level || 0.0001,
                        Math.max(at + 0.01, end)
                    )
                }
                env.gain.linearRampToValueAtTime(0, end + 0.08)
                source.connect(env)
                source.start(at)
                source.stop(end + 0.1)
                return source
            })
            const finish = () => gain.disconnect()
            let stopped = false
            let heard: ReturnType<typeof win.setTimeout> | undefined
            // The first note sounds at `start` on the audio clock, which only runs once the context
            // has resumed; plus the time the sound takes to reach the speakers.
            const announce = () => {
                if (stopped || !onStart) return
                const latency = Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : 0
                heard = win.setTimeout(
                    () => {
                        if (!stopped) onStart()
                    },
                    Math.max(0, start - ctx.currentTime + latency) * 1000
                )
            }
            if (onStart) void Promise.resolve(resumed).then(announce, announce)
            const timer = win.setTimeout(
                () => {
                    finish()
                    onEnd?.()
                },
                (lengthOf(events) + 0.15) * 1000
            )
            return {
                stop() {
                    stopped = true
                    win.clearTimeout(timer)
                    win.clearTimeout(heard)
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
