/**
 * What comes after the instruments (#103): a small room and a limiter on the way to the speakers,
 * and for the electric guitars an optional amplifier (a drive and a speaker cabinet). Built from
 * Web Audio nodes and a generated impulse response: no file, a few KB of code.
 *
 * One chain per audio context: every play of that context goes through the same room, so a page
 * sounds like one place. A host that adds its own effects asks for `dry` and gets the output as
 * it was.
 */

/** The effects of a play: the app's or the page's choice (`PlayOptions`), given to the players. */
export interface PlayEffects {
    /** The room's level, 0 (none) to 1; the light room by default. */
    reverb?: number
    /** No room and no limiter: the notes go straight to the output, for hosts with their own. */
    dry?: boolean
    /** An amplifier for the electric guitars (clean, overdrive); none by default. */
    amp?: AmpOptions
}

/** The amplifier of an electric guitar. */
export interface AmpOptions {
    /** How hard the amplifier is driven, 0 (clean) to 1. */
    drive?: number
    /** A speaker cabinet's sound: less deep bass and less fizz, more mids. */
    cabinet?: boolean
}

/** The room's level when nothing says another: a light room. */
export const DEFAULT_REVERB = 0.16

/** How long the room rings (seconds to fall by 60 dB): a small, damped room. */
export const ROOM_SECONDS = 0.7

/** A room level from an option: 0 to 1, the default when it isn't a number. */
export function reverbLevel(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : DEFAULT_REVERB
}

/**
 * A page's effects (`play: { reverb, dry, amp }` in `window.musicNotationOptions`): `reverb` a
 * number from 0 to 1, `dry: true`, `amp: { drive, cabinet }`. A function in place of `reverb` or
 * `amp` is called. Null when the page names none.
 */
export function pageEffects(options: unknown): PlayEffects | null {
    if (!options || typeof options !== 'object' || !('play' in options)) return null
    const play: unknown = options.play
    if (!play || typeof play !== 'object') return null
    const read = (key: string): unknown => {
        const value: unknown = (play as Record<string, unknown>)[key]
        if (typeof value !== 'function') return value
        try {
            return (value as () => unknown)()
        } catch {
            return undefined
        }
    }
    const reverb = read('reverb')
    const amp = read('amp')
    const drive = amp && typeof amp === 'object' ? (amp as Record<string, unknown>)['drive'] : null
    const cabinet = amp && typeof amp === 'object' && (amp as Record<string, unknown>)['cabinet']
    const effects: PlayEffects = {
        ...(typeof reverb === 'number' && Number.isFinite(reverb)
            ? { reverb: Math.min(1, Math.max(0, reverb)) }
            : {}),
        ...(read('dry') === true ? { dry: true } : {}),
        ...(cabinet === true || (typeof drive === 'number' && Number.isFinite(drive))
            ? {
                  amp: {
                      ...(typeof drive === 'number' && Number.isFinite(drive)
                          ? { drive: Math.min(1, Math.max(0, drive)) }
                          : {}),
                      ...(cabinet === true ? { cabinet: true } : {})
                  }
              }
            : {})
    }
    return Object.keys(effects).length ? effects : null
}

/** A small random generator with a seed, so the room is the same on every page and in every test. */
function seeded(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Early reflections: when (ms) and how strong, for the left and the right side. */
const REFLECTIONS: readonly (readonly [number, number, number])[] = [
    [11, 0.5, 0.32],
    [17, 0.28, 0.46],
    [23, 0.38, 0.22],
    [31, 0.18, 0.3],
    [43, 0.22, 0.14]
]

/**
 * The impulse response of a small room, left and right: a few early reflections, then a diffuse
 * tail that falls by 60 dB in `seconds` and gets darker as it falls (walls take the highs first).
 * The two sides differ, so the room has width. Each side has an energy of 1: a sound through it
 * comes out about as loud as it went in, and the wet level is the gain after it.
 */
export function roomImpulse(
    sampleRate: number,
    seconds = ROOM_SECONDS
): [Float32Array, Float32Array] {
    const length = Math.max(1, Math.round(sampleRate * seconds))
    const make = (side: 0 | 1): Float32Array => {
        const random = seeded(side ? 0x51ed270b : 0x2545f491)
        const data = new Float32Array(length)
        const start = Math.round(sampleRate * 0.008)
        let low = 0
        for (let i = start; i < length; i++) {
            const t = i / sampleRate
            // A one-pole low-pass that closes with time: from bright to dull.
            const keep = 0.25 + 0.6 * (t / seconds)
            low = keep * low + (1 - keep) * (random() * 2 - 1)
            data[i] = low * Math.pow(10, (-3 * t) / seconds)
        }
        for (const [ms, left, right] of REFLECTIONS) {
            const at = Math.round((sampleRate * ms) / 1000)
            if (at < length) data[at] = data[at]! + (side ? right : left)
        }
        let energy = 0
        for (let i = 0; i < length; i++) energy += data[i]! * data[i]!
        const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0
        for (let i = 0; i < length; i++) data[i] = data[i]! * scale
        return data
    }
    return [make(0), make(1)]
}

/** The limiter: nothing below the threshold, a hard ratio above it, fast enough for a strum. */
export const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1 } as const

/**
 * The gain that takes back the limiter's make-up gain. A Web Audio compressor raises its output
 * by a gain that depends only on its threshold, knee and ratio (the level a full-scale input
 * comes out at, to the power 0.6): without this, every sound got louder.
 */
export function limiterTrim(
    threshold: number = LIMITER.threshold,
    ratio: number = LIMITER.ratio
): number {
    const fullScaleDb = threshold * (1 - 1 / ratio)
    return Math.pow(10, (fullScaleDb * 0.6) / 20)
}

interface Chain {
    input: GainNode
    wet: GainNode
}

const chains = new WeakMap<BaseAudioContext, Chain>()

/** Whether a context can build the chain (a test double or an old browser may not). */
const canBuild = (ctx: BaseAudioContext): boolean =>
    typeof ctx.createConvolver === 'function' &&
    typeof ctx.createDynamicsCompressor === 'function' &&
    typeof ctx.createBuffer === 'function'

function build(ctx: BaseAudioContext): Chain {
    const input = ctx.createGain()
    const wet = ctx.createGain()
    const room = ctx.createConvolver()
    const [left, right] = roomImpulse(ctx.sampleRate)
    const impulse = ctx.createBuffer(2, left.length, ctx.sampleRate)
    impulse.getChannelData(0).set(left)
    impulse.getChannelData(1).set(right)
    // Our impulse has its own level: the browser's normalization would change it.
    room.normalize = false
    room.buffer = impulse
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = LIMITER.threshold
    limiter.knee.value = LIMITER.knee
    limiter.ratio.value = LIMITER.ratio
    limiter.attack.value = LIMITER.attack
    limiter.release.value = LIMITER.release
    const trim = ctx.createGain()
    trim.gain.value = limiterTrim()
    input.connect(limiter)
    input.connect(room)
    room.connect(wet)
    wet.connect(limiter)
    limiter.connect(trim)
    trim.connect(ctx.destination)
    return { input, wet }
}

/**
 * Where a player sends its notes: the context's chain (the room at the level asked, then the
 * limiter), or the output itself for `dry` and for a context that can't build the chain. The
 * room's level is the context's: the last play that names one sets it for what sounds.
 */
export function outputFor(ctx: BaseAudioContext, effects?: PlayEffects): AudioNode {
    if (effects?.dry || !canBuild(ctx)) return ctx.destination
    let chain = chains.get(ctx)
    if (!chain) {
        try {
            chain = build(ctx)
        } catch {
            return ctx.destination
        }
        chains.set(ctx, chain)
    }
    const level = reverbLevel(effects?.reverb)
    // A short glide: a level that jumps while notes ring clicks.
    if (typeof chain.wet.gain.setTargetAtTime === 'function')
        chain.wet.gain.setTargetAtTime(level, ctx.currentTime, 0.02)
    else chain.wet.gain.value = level
    return chain.input
}

/** The curve of a driven amplifier: a soft ceiling, steeper with more drive. */
export function driveCurve(drive: number, points = 1024): Float32Array {
    const amount = 1 + 24 * Math.min(1, Math.max(0, drive))
    const curve = new Float32Array(points)
    const ceiling = Math.tanh(amount)
    for (let i = 0; i < points; i++) {
        const x = (i / (points - 1)) * 2 - 1
        curve[i] = Math.tanh(amount * x) / ceiling
    }
    return curve
}

/**
 * An electric guitar's amplifier between a play and the chain: a drive (a wave shaper, level
 * matched so more drive is not simply louder) and a cabinet (no deep bass, a peak in the mids, no
 * fizz). Null when the options ask for neither, or the context can't build it.
 */
export function ampFor(
    ctx: BaseAudioContext,
    amp: AmpOptions | undefined
): { input: AudioNode; output: AudioNode } | null {
    const drive = typeof amp?.drive === 'number' ? Math.min(1, Math.max(0, amp.drive)) : 0
    const cabinet = amp?.cabinet === true
    if (!drive && !cabinet) return null
    if (typeof ctx.createWaveShaper !== 'function' || typeof ctx.createBiquadFilter !== 'function')
        return null
    const input = ctx.createGain()
    let last: AudioNode = input
    if (drive) {
        const shaper = ctx.createWaveShaper()
        shaper.curve = driveCurve(drive) as Float32Array<ArrayBuffer>
        shaper.oversample = '4x'
        const level = ctx.createGain()
        // A driven signal is denser: taken down so the drive changes the tone, not the level.
        level.gain.value = 1 / (1 + 1.5 * drive)
        last.connect(shaper)
        shaper.connect(level)
        last = level
    }
    if (cabinet) {
        const filter = (type: BiquadFilterType, frequency: number, q: number, gain = 0) => {
            const node = ctx.createBiquadFilter()
            node.type = type
            node.frequency.value = frequency
            node.Q.value = q
            node.gain.value = gain
            last.connect(node)
            last = node
        }
        filter('highpass', 90, 0.7)
        filter('peaking', 2200, 1, 4)
        filter('lowpass', 4800, 0.7)
        filter('lowpass', 6500, 0.7)
    }
    return { input, output: last }
}
