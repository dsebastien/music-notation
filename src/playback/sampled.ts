/**
 * A sample player without alphaTab (#109): plays the diagrams' notes with the instrument files of
 * a folder (`p025.sf3`…, see `tab/instruments.ts`), read and decoded by the browser itself. A page
 * of chord diagrams then sounds like the tabs' guitar after a download of about 150 KB, where
 * alphaTab alone is about 1 MB of script.
 *
 * Each note plays the regions of its instrument's preset: the sample at the note's pitch, through
 * the region's filter and volume envelope, at the level alphaTab gives it (velocity as a linear
 * gain, the region's attenuation), so both players sound alike. What it can't read or decode
 * plays through `fallback` (the light synthesizer).
 */
import { instrumentSounds, type InstrumentSource } from '../tab/instruments.js'
import {
    contextFor,
    lengthOf,
    sendOut,
    type NoteEvent,
    type NotePlayer,
    type PlayHandle,
    type Sound
} from './player.js'
import { readSoundfont, regionsFor, type Region, type SoundPreset } from './soundfont.js'
import { DEFAULT_GUITAR_TONE, GUITAR_PROGRAMS, type GuitarTone } from './guitar-tone.js'

/** General MIDI programs of the diagrams' sounds; the muted guitar plays a muted strum's strings. */
const PIANO = 0
const MUTED = 28
/** The metronome click of a kit. */
const CLICK_KEY = 33

/** A sound ready to play: its preset, and each of its samples as an audio buffer. */
interface Voice {
    preset: SoundPreset
    buffers: Map<number, AudioBuffer>
    /** Each sample's loop in seconds (it is written in points of the sample's own rate). */
    loops: Map<number, { start: number; end: number }>
}

/** What a note plays through: a guitar (#103: one of the four), the piano, or a percussive sound. */
type Kind = GuitarTone | 'piano' | 'muted' | 'click'

/** The General MIDI program of a kind; none for the click, which is a key of the kit. */
const programOf = (kind: Exclude<Kind, 'click'>): number =>
    kind === 'muted' ? MUTED : kind === 'piano' ? PIANO : GUITAR_PROGRAMS[kind]

/** Longest release a note keeps after its end, in seconds: a pad's 7 s tail is cut. */
const LONGEST_RELEASE = 2.5
/** The volume envelope's floor: 100 dB down is silence. */
const SILENCE = 1e-5

/**
 * A sample's loop inside its decoded buffer (#128), in seconds. Browsers may decode an Ogg Vorbis
 * sample a little shorter than it was (Chrome drops up to about 230 points at its end), and a loop
 * whose end is past the buffer's end then jumps from the wrong point at each turn: a buzz while
 * the note rings. Such a loop moves back as a whole, so it keeps its length: a held sound repeats
 * about every loop length, so its two ends still meet. Null: no loop (none, or no room for it).
 * The instrument files keep a tail after each compressed sample (`scripts/sounds`), so this only
 * saves older files.
 */
export function loopWithin(
    loop: { start: number; end: number } | undefined,
    duration: number
): { start: number; end: number } | null {
    if (!loop || !(loop.end > loop.start)) return null
    if (loop.end <= duration) return loop
    const back = loop.end - duration
    if (loop.start - back < 0) return null
    return { start: loop.start - back, end: duration }
}

export interface SampledOptions {
    /**
     * The audio context to play in (a function, called at each play); the window's own by
     * default. An offline context renders the notes instead of playing them.
     */
    context?: () => BaseAudioContext | null
}

/**
 * A NotePlayer that plays `source`'s instrument files. The first note of a sound waits for its
 * file (`onStart` says when the notes start); when it can't be had, the notes play through
 * `fallback`.
 */
export function sampledPlayer(
    win: Window,
    source: InstrumentSource,
    fallback: NotePlayer,
    options: SampledOptions = {}
): NotePlayer {
    const voices = new Map<Kind, Promise<Voice | null>>()
    const contextOf = (): BaseAudioContext | null => options.context?.() ?? contextFor(win)

    const load = async (kind: Kind, ctx: BaseAudioContext): Promise<Voice | null> => {
        const sounds =
            kind === 'click'
                ? { programs: [], drums: false }
                : {
                      programs: [programOf(kind)],
                      drums: false,
                      click: false
                  }
        const files = await instrumentSounds(source, sounds, win)
        const bytes = files?.[0]
        if (!bytes) return null
        try {
            const font = readSoundfont(bytes)
            const preset = font.presets[0]
            if (!preset?.regions.length) return null
            const buffers = new Map<number, AudioBuffer>()
            const loops = new Map<number, { start: number; end: number }>()
            await Promise.all(
                [...new Set(preset.regions.map((r) => r.sample))].map(async (index) => {
                    const sample = font.samples[index]!
                    loops.set(index, {
                        start: sample.loopStart / sample.rate,
                        end: sample.loopEnd / sample.rate
                    })
                    if (sample.compressed) {
                        // A copy: decoding takes the buffer it is given.
                        const ogg = font.data.slice(sample.start, sample.end)
                        buffers.set(index, await ctx.decodeAudioData(ogg.buffer))
                        return
                    }
                    const points = sample.end - sample.start
                    const buffer = ctx.createBuffer(1, Math.max(1, points), sample.rate)
                    const out = buffer.getChannelData(0)
                    const data = new DataView(
                        font.data.buffer,
                        font.data.byteOffset + sample.start * 2,
                        points * 2
                    )
                    for (let i = 0; i < points; i++) out[i] = data.getInt16(i * 2, true) / 32768
                    buffers.set(index, buffer)
                })
            )
            return { preset, buffers, loops }
        } catch {
            // Not a soundfont, or a sample the browser can't decode (Ogg Vorbis in old Safari).
            return null
        }
    }
    const voiceOf = (kind: Kind, ctx: BaseAudioContext): Promise<Voice | null> => {
        let voice = voices.get(kind)
        if (!voice) {
            voice = load(kind, ctx)
            voices.set(kind, voice)
            // A sound that couldn't be had is tried again at the next play.
            void voice.then((v) => {
                if (!v) voices.delete(kind)
            })
        }
        return voice
    }
    const kindOf = (e: NoteEvent, sound: Sound, guitar: GuitarTone): Kind =>
        e.kind === 'click'
            ? 'click'
            : sound === 'piano'
              ? 'piano'
              : e.kind === 'muted'
                ? 'muted'
                : guitar

    /** Plays one region of a note; returns its source and when it is silent. */
    const sound = (
        ctx: BaseAudioContext,
        out: AudioNode,
        voice: Voice,
        region: Region,
        key: number,
        level: number,
        at: number,
        end: number
    ): { source: AudioBufferSourceNode; over: number } | null => {
        const buffer = voice.buffers.get(region.sample)
        if (!buffer) return null
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = Math.pow(
            2,
            ((key - region.rootKey) * region.scale + region.tune) / 1200
        )
        const loop = region.loop
            ? loopWithin(voice.loops.get(region.sample), buffer.duration)
            : null
        if (loop) {
            source.loop = true
            source.loopStart = loop.start
            source.loopEnd = loop.end
        }
        // The level alphaTab gives a note: velocity as a linear gain, the attenuation taken off,
        // and its share of a note in the middle of the stereo field (each side gets 0.707).
        const peak = level * Math.pow(10, -region.attenuation / 20) * Math.SQRT1_2
        const env = ctx.createGain()
        const gain = env.gain
        // Attack (a straight rise), hold, then a decay of 100 dB over `decay` seconds, down to the
        // sustain level; the release falls at the same pace over `release` seconds.
        const held = at + region.attack + region.hold
        if (region.attack > 0.002) {
            gain.setValueAtTime(0, at)
            gain.linearRampToValueAtTime(peak, at + region.attack)
        } else gain.setValueAtTime(peak, at)
        gain.setValueAtTime(peak, held)
        const release = Math.min(Math.max(region.release, 0.02), LONGEST_RELEASE)
        const off = Math.max(end, at + 0.006)
        if (region.decay > 0 && region.sustain > 0 && off > held) {
            // The decay stops at the sustain level, or at the note's end when that comes first:
            // nothing is scheduled past the note's end, where the release takes over.
            const floor = Math.min(region.sustain, 100)
            const reached = held + (region.decay * floor) / 100
            const down = reached <= off ? floor : (100 * (off - held)) / region.decay
            gain.exponentialRampToValueAtTime(
                Math.max(peak * Math.pow(10, -down / 20), peak * SILENCE),
                Math.min(reached, off)
            )
        }
        // About 100 dB down at the release's end.
        gain.setTargetAtTime(0, off, release / 11.5)
        let node: AudioNode = source
        if (region.filter !== null) {
            const filter = ctx.createBiquadFilter()
            filter.type = 'lowpass'
            filter.frequency.value = Math.min(region.filter, ctx.sampleRate / 2 - 1)
            // A low-pass filter's Q is its resonance in decibels.
            filter.Q.value = region.filterQ
            const { amount, attack, hold, decay, sustain: stays } = region.filterEnvelope
            if (amount) {
                // The envelope moves the cutoff by cents: up at the attack, then down as it decays.
                const start = at + attack
                if (attack > 0.002) {
                    filter.detune.setValueAtTime(0, at)
                    filter.detune.linearRampToValueAtTime(amount, start)
                } else filter.detune.setValueAtTime(amount, at)
                filter.detune.setValueAtTime(amount, start + hold)
                if (decay > 0 && stays < 1)
                    filter.detune.linearRampToValueAtTime(
                        amount * stays,
                        start + hold + decay * (1 - stays)
                    )
            }
            source.connect(filter)
            node = filter
        }
        node.connect(env)
        env.connect(out)
        source.start(at)
        const over = off + release
        source.stop(over)
        return { source, over }
    }
    return {
        reportsStart: true,
        play(events, { sound: instrument, volume, onEnd, onStart, guitar, effects }) {
            const ctx = contextOf()
            const tone = guitar ?? DEFAULT_GUITAR_TONE
            // The fallback plays the same guitar, in the same room.
            const same = { ...(guitar ? { guitar } : {}), ...(effects ? { effects } : {}) }
            if (!ctx)
                return fallback.play(events, {
                    sound: instrument,
                    volume,
                    ...(onEnd ? { onEnd } : {}),
                    ...(onStart ? { onStart } : {}),
                    ...same
                })
            let stopped = false
            let handle: PlayHandle | null = null
            let level = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8
            const resumed = 'resume' in ctx ? (ctx as AudioContext).resume() : Promise.resolve()
            const kinds = [...new Set(events.map((e) => kindOf(e, instrument, tone)))]
            void Promise.all(kinds.map((kind) => voiceOf(kind, ctx))).then((loaded) => {
                if (stopped) return
                // One sound missing: the whole play through the fallback, so it sounds like one.
                if (loaded.some((v) => !v)) {
                    handle = fallback.play(events, {
                        sound: instrument,
                        volume: level,
                        ...(onEnd ? { onEnd } : {}),
                        ...(onStart ? { onStart } : {}),
                        ...same
                    })
                    if (!fallback.reportsStart) onStart?.()
                    return
                }
                const byKind = new Map(kinds.map((kind, i) => [kind, loaded[i]!]))
                const master = ctx.createGain()
                master.gain.value = level
                const letGo = sendOut(ctx, master, instrument === 'guitar' ? tone : null, effects)
                const start = ctx.currentTime + 0.05
                const sources: AudioBufferSourceNode[] = []
                let tail = 0
                for (const e of events) {
                    const kind = kindOf(e, instrument, tone)
                    const voice = byKind.get(kind)!
                    const velocity =
                        e.velocity === undefined || !Number.isFinite(e.velocity)
                            ? 100
                            : Math.round(Math.min(127, Math.max(1, e.velocity)))
                    const key = kind === 'click' ? CLICK_KEY : e.midi
                    const at = start + e.time
                    for (const region of regionsFor(voice.preset, key, velocity)) {
                        const made = sound(
                            ctx,
                            master,
                            voice,
                            region,
                            key,
                            velocity / 127,
                            at,
                            at + e.duration
                        )
                        if (!made) continue
                        sources.push(made.source)
                        tail = Math.max(tail, made.over - start)
                    }
                }
                const finish = () => letGo()
                let heard: ReturnType<typeof win.setTimeout> | undefined
                const announce = () => {
                    if (stopped || !onStart) return
                    const latency =
                        'outputLatency' in ctx && Number.isFinite(ctx.outputLatency)
                            ? (ctx.outputLatency as number)
                            : 0
                    heard = win.setTimeout(
                        () => {
                            if (!stopped) onStart()
                        },
                        Math.max(0, start - ctx.currentTime + latency) * 1000
                    )
                }
                if (onStart) void Promise.resolve(resumed).then(announce, announce)
                const timer = win.setTimeout(() => onEnd?.(), (lengthOf(events) + 0.15) * 1000)
                let cleanup = win.setTimeout(finish, (tail + 0.15) * 1000)
                handle = {
                    stop() {
                        win.clearTimeout(timer)
                        win.clearTimeout(heard)
                        win.clearTimeout(cleanup)
                        const now = ctx.currentTime
                        master.gain.setTargetAtTime(0, now, 0.01)
                        for (const s of sources) {
                            try {
                                s.stop(now + 0.05)
                            } catch {
                                // Already stopped.
                            }
                        }
                        cleanup = win.setTimeout(finish, 80)
                    },
                    setVolume(next) {
                        master.gain.setTargetAtTime(next, ctx.currentTime, 0.015)
                    }
                }
            })
            return {
                stop() {
                    if (stopped) return
                    stopped = true
                    handle?.stop()
                },
                setVolume(next) {
                    if (stopped || !Number.isFinite(next)) return
                    level = Math.min(1, Math.max(0, next))
                    handle?.setVolume?.(level)
                }
            }
        }
    }
}
