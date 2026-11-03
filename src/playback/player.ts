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
    /**
     * Scales: the pitch classes of a chord drawn over the scale; its other notes are passing
     * notes, played a little softer.
     */
    tones?: readonly number[]
    /** The instrument, for the touch of a chord: guitar (the default) or piano. */
    sound?: Sound
}

export const DEFAULT_SEQUENCE: SequenceOptions = { bpm: 90, strum: 12 }

/**
 * Milliseconds between two notes of a chord, by instrument: a guitar strum (about 12 ms a
 * string, a 6-string chord in 60 ms), a piano chord struck as a block.
 */
export const DEFAULT_STRUM: Readonly<Record<Sound, number>> = { guitar: 12, piano: 0 }

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
 * (see `scaleRun`), each note one beat long, legato.
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
        const last = pitches.length - 1
        return pitches.map((midi, i) => ({
            midi,
            time: i * gap,
            duration: RING + (last - i) * gap,
            velocity: chordVelocity(i, last, options.sound ?? 'guitar')
        }))
    }
    const bpm = Number.isFinite(options.bpm) ? options.bpm : DEFAULT_SEQUENCE.bpm
    const beat = 60 / Math.min(240, Math.max(20, bpm))
    const root =
        options.root === undefined || options.root === null || !Number.isFinite(options.root)
            ? null
            : chromaOf(options.root)
    const tones = options.tones?.length ? new Set(options.tones.map(chromaOf)) : null
    return scaleRun(pitches, root).map((midi, i) => ({
        midi,
        time: i * beat,
        // Legato: each note lasts until the next; players add a short release after it.
        duration: beat,
        velocity: runVelocity(i, chromaOf(midi), root, tones)
    }))
}

/**
 * A chord's touch, note by note (low to high): a guitar's pick hits the low strings a little
 * harder (100 down to 90); a pianist brings out the top note (100) over the bass (92) and the
 * inner notes (84).
 */
function chordVelocity(i: number, last: number, sound: Sound): number {
    if (last === 0) return 100
    if (sound === 'piano') return i === last ? 100 : i === 0 ? 92 : 84
    return Math.round(100 - (10 * i) / last)
}

/**
 * A scale note's touch: the first note accented (100), the tonics leaning (94), chord tones over
 * a scale 90 and passing notes 80, other notes 86.
 */
function runVelocity(
    i: number,
    chroma: number,
    root: number | null,
    tones: ReadonlySet<number> | null
): number {
    if (i === 0) return 100
    if (chroma === root) return 94
    if (tones) return tones.has(chroma) ? 90 : 80
    return 86
}

/** The end of a sequence, in seconds. */
export const lengthOf = (events: readonly NoteEvent[]): number =>
    events.reduce((end, e) => Math.max(end, e.time + e.duration), 0)

const frequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** How a string is plucked, for a little variety between notes. */
export interface PluckOptions {
    /** 0 (a soft, dark pluck) to 1 (bright, the default). */
    brightness?: number
    /** Where the pick hits, as a part of the string's length (0 to 0.5; 0, the default: no effect). */
    pick?: number
    /** How fast the string loses its energy, times the usual (1 by default). */
    damping?: number
}

/**
 * A plucked string (Karplus-Strong): a burst of noise through a delay line one period long,
 * averaged as it loops, so the tone softens as it decays, like a string. The burst can be
 * darker (a softer pluck) and shaped by the pick's position.
 */
export function pluckedString(
    midi: number,
    sampleRate: number,
    seconds: number,
    random: () => number = Math.random,
    options: PluckOptions = {}
): Float32Array {
    const out = new Float32Array(Math.round(sampleRate * seconds))
    const period = Math.max(2, Math.round(sampleRate / frequency(midi)))
    const line = new Float32Array(period)
    for (let i = 0; i < period; i++) line[i] = random() * 2 - 1
    const bright = Math.min(1, Math.max(0, options.brightness ?? 1))
    if (bright < 1) {
        // A softer pluck: the burst through a low-pass filter.
        const a = 0.2 + 0.8 * bright
        let y = line[period - 1]!
        for (let i = 0; i < period; i++) line[i] = y += a * (line[i]! - y)
    }
    const pick = Math.min(0.5, Math.max(0, options.pick ?? 0))
    const gap = Math.round(pick * period)
    if (gap > 0) {
        // The pick's position: harmonics with a node there are left out (a comb filter).
        const burst = Float32Array.from(line)
        for (let i = 0; i < period; i++) line[i] = burst[i]! - burst[(i - gap + period) % period]!
    }
    if (bright < 1 || gap > 0) {
        // Back to the burst's usual level, without an offset (it would hum as the note fades).
        const mean = line.reduce((sum, v) => sum + v, 0) / period
        const peak = line.reduce((max, v) => Math.max(max, Math.abs(v - mean)), 0) || 1
        for (let i = 0; i < period; i++) line[i] = (line[i]! - mean) / peak
    }
    // Lower notes ring longer, as on a guitar.
    const damping =
        options.damping !== undefined && Number.isFinite(options.damping) ? options.damping : 1
    const loss = (0.004 - Math.min(0.0035, 0.00004 * (90 - midi))) * damping
    const decay = 1 - Math.min(0.02, Math.max(0.0001, loss))
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

/** How long a guitar note's buffer lasts; each note is cut to its own length when it plays. */
const STRING_SECONDS = 4

/** The partials of the simple piano tone (fundamental first). */
const PIANO_PARTIALS = [0, 1, 0.5, 0.3, 0.15, 0.08, 0.04]

/** Recordings made per string pitch: each note takes one at random, so repeats differ. */
const PLUCKS = 4

/**
 * Seconds a note takes to fade after its end (a finger lifting off a string, a piano's damper),
 * at most half the note (a muted strum stays short).
 */
export const RELEASE: Readonly<Record<Sound, number>> = { guitar: 0.15, piano: 0.3 }

/** The release of a note of `duration` seconds. */
export const releaseOf = (sound: Sound, duration: number): number =>
    Math.min(RELEASE[sound], Math.max(0.03, duration / 2))

/**
 * How long (s) a light piano note takes to fall to about a third: lower notes ring longer, as on
 * a piano.
 */
const pianoDecay = (midi: number) => Math.min(2.5, Math.max(0.35, Math.pow(2, (60 - midi) / 24)))

/**
 * The light synthesizer: computed sound, a few KB, no download. No two notes sound quite the
 * same: each guitar note takes one of a few plucks of its string (brightness, pick position,
 * decay), and every note varies a little in pitch (a few cents) and level. `random` (0–1) is
 * for tests.
 */
export function lightPlayer(win: Window, random: () => number = Math.random): NotePlayer {
    // A few buffers per string pitch: notes of any length reuse them.
    const strings = new Map<number, AudioBuffer>()
    const waves = new WeakMap<AudioContext, PeriodicWave>()
    /** A number between `lo` and `hi`, at random. */
    const between = (lo: number, hi: number) => lo + (hi - lo) * random()
    const stringBuffer = (ctx: AudioContext, midi: number, pluck: number) => {
        const key = midi * PLUCKS + pluck
        let buffer = strings.get(key)
        if (!buffer) {
            const data = pluckedString(midi, ctx.sampleRate, STRING_SECONDS, random, {
                brightness: between(0.55, 0.95),
                pick: between(0.08, 0.2),
                damping: between(0.85, 1.15)
            })
            buffer = ctx.createBuffer(1, data.length, ctx.sampleRate)
            buffer.getChannelData(0).set(data)
            strings.set(key, buffer)
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
            // Each note's pluck and variations, chosen (and buffers made) before the start time is
            // read, so the first notes aren't late.
            const touches = events.map(() => ({
                pluck: Math.min(PLUCKS - 1, Math.floor(random() * PLUCKS)),
                cents: between(-4, 4),
                level: between(0.93, 1.07),
                decay: between(0.9, 1.1)
            }))
            if (sound === 'guitar')
                events.forEach((e, i) => stringBuffer(ctx, e.midi, touches[i]!.pluck))
            const gain = ctx.createGain()
            gain.gain.value = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8
            gain.connect(ctx.destination)
            const start = ctx.currentTime + 0.05
            const sources = events.map((e, i) => {
                const touch = touches[i]!
                const at = start + e.time
                const end = at + e.duration
                const release = releaseOf(sound, e.duration)
                // Each note fades out after its end, so it doesn't stop dead (or click).
                const env = ctx.createGain()
                env.connect(gain)
                // Velocity scales the note's level (100, the default, is the level as computed).
                const level =
                    (e.velocity === undefined || !Number.isFinite(e.velocity)
                        ? 1
                        : Math.min(127, Math.max(0, e.velocity)) / 100) * touch.level
                let source: AudioScheduledSourceNode
                if (sound === 'guitar') {
                    const buffer = ctx.createBufferSource()
                    buffer.buffer = stringBuffer(ctx, e.midi, touch.pluck)
                    buffer.playbackRate.value = Math.pow(2, touch.cents / 1200)
                    source = buffer
                    env.gain.setValueAtTime(level, at)
                    env.gain.setValueAtTime(level, end)
                } else {
                    // A struck tone: a quick attack, then a decay, as a piano string.
                    const osc = ctx.createOscillator()
                    osc.setPeriodicWave(pianoWave(ctx))
                    osc.frequency.value = frequency(e.midi)
                    osc.detune.value = touch.cents
                    source = osc
                    env.gain.setValueAtTime(0, at)
                    env.gain.linearRampToValueAtTime(0.35 * level, at + 0.005)
                    // The string decays at its own pace, whatever the note's length.
                    env.gain.setTargetAtTime(0, at + 0.005, pianoDecay(e.midi) * touch.decay)
                }
                // The release: about 98% gone at its end.
                env.gain.setTargetAtTime(0, Math.max(at + 0.006, end), release / 4)
                source.connect(env)
                source.start(at)
                source.stop(Math.max(at + 0.006, end) + release)
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
            // The notes are over at their end (a loop starts again then); their releases still
            // ring a little while, then the sound is let go.
            const timer = win.setTimeout(() => onEnd?.(), (lengthOf(events) + 0.15) * 1000)
            const tails = events.reduce(
                (end, e) => Math.max(end, e.time + e.duration + releaseOf(sound, e.duration)),
                0
            )
            let cleanup = win.setTimeout(finish, (tails + 0.15) * 1000)
            return {
                stop() {
                    if (stopped) return
                    stopped = true
                    win.clearTimeout(timer)
                    win.clearTimeout(heard)
                    win.clearTimeout(cleanup)
                    // A quick fade, not a click.
                    const now = ctx.currentTime
                    gain.gain.setTargetAtTime(0, now, 0.01)
                    for (const s of sources) {
                        try {
                            s.stop(now + 0.05)
                        } catch {
                            // Already stopped.
                        }
                    }
                    cleanup = win.setTimeout(finish, 80)
                }
            }
        }
    }
}
