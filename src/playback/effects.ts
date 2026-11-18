/**
 * What comes after the instruments (#103): a small room and a ceiling on the way to the speakers,
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
    /** How long the room rings, in seconds (0.2 to 3): a small room to a hall. */
    room?: number
    /** No room and no ceiling: the notes go straight to the output, for hosts with their own. */
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

/**
 * The room's level when nothing says another: a light room, 18 dB under the notes. The level is
 * how loud the room is against what plays in it, where a guitar sounds (`ROOM_BAND`): 0.125 is
 * 18 dB under, 0.35 is 9 dB under, 1 as loud as the notes.
 */
export const DEFAULT_REVERB = 0.125

/**
 * How long the room rings (seconds to fall by 60 dB). A guitar's notes ring for seconds
 * themselves: a room shorter than about a second hides under them and is not heard.
 */
export const ROOM_SECONDS = 1.2

/** The shortest and the longest room (seconds). */
export const ROOM_RANGE = [0.2, 3] as const

/** A room's length from an option: within the range, the default when it isn't a number. */
export function roomSeconds(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(ROOM_RANGE[1], Math.max(ROOM_RANGE[0], value))
        : ROOM_SECONDS
}

/** A room level from an option: 0 to 1, the default when it isn't a number. */
export function reverbLevel(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : DEFAULT_REVERB
}

/**
 * A page's effects (`play: { reverb, room, dry, amp }` in `window.musicNotationOptions`): `reverb`
 * a number from 0 to 1, `room` its length in seconds, `dry: true`, `amp: { drive, cabinet }`. A
 * function in place of a value is called. Null when the page names none.
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
    const room = read('room')
    const amp = read('amp')
    const drive = amp && typeof amp === 'object' ? (amp as Record<string, unknown>)['drive'] : null
    const cabinet = amp && typeof amp === 'object' && (amp as Record<string, unknown>)['cabinet']
    const effects: PlayEffects = {
        ...(typeof reverb === 'number' && Number.isFinite(reverb)
            ? { reverb: Math.min(1, Math.max(0, reverb)) }
            : {}),
        ...(typeof room === 'number' && Number.isFinite(room) ? { room: roomSeconds(room) } : {}),
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

/** What a room sounds like, besides its length. */
export interface RoomShape {
    /** Where the tail's highs end when it starts (Hz). */
    bright: number
    /** Where they end when it has rung out (Hz). */
    dark: number
    /** How long the tail takes to come up (seconds). */
    rise: number
    /** 0: the same on both sides (in the middle, with the notes); 1: nothing in common. */
    width: number
}

/**
 * The library's room.
 *
 * Brightness: a room is darker than what plays in it. As bright as the guitar (9 kHz, a gentle
 * slope), the tail was heard as noise: every attack came back as a hiss until the next strum.
 *
 * Rise: a real room starts with a few echoes and gets dense later; a tail of noise at full level
 * from its first instant put a burst of noise right after each attack. Not long: at 50 ms the
 * tail's loudest moment came 60 ms after the note, a small echo.
 *
 * Width: with nothing in common between the two sides, the room was a cloud of noise around the
 * head, apart from the guitar in the middle (and the hardest sound there is for the codec of
 * wireless headphones). Half in common: the room is around the guitar.
 */
export const ROOM_SHAPE: Readonly<RoomShape> = { bright: 4000, dark: 800, rise: 0.02, width: 0.5 }

/**
 * Where a guitar sounds (Hz): the room is as loud there as what goes into it. With an energy of 1
 * over all frequencies, a dark room had all of it in this band: 11 dB more than its number said
 * (the default was 8.6 dB under a recorded strum, not the 18 dB meant).
 */
export const ROOM_BAND = [300, 3000] as const

/** Under this (Hz) the two sides are the same: lows that differ between the ears feel wrong. */
export const ROOM_WIDE_FROM = 400

/** How steep the tail's highs fall: low-passes in a row (6 dB an octave each). */
const ROOM_SLOPE = 3

/**
 * The impulse response of a room, left and right: after 12 ms (the notes themselves come first),
 * a diffuse tail that comes up, falls by 60 dB in `seconds` and gets darker as it falls (walls
 * take the highs first; the brightness is in Hz, so the room sounds the same at every sample
 * rate). `shape` changes the library's room (`ROOM_SHAPE`), for a host that tunes its own. The
 * two sides differ above `ROOM_WIDE_FROM`, so the room has width. A sound of the guitar's band
 * (`ROOM_BAND`) through it comes out as loud as it went in: the level is the gain after it.
 */
export function roomImpulse(
    sampleRate: number,
    seconds = ROOM_SECONDS,
    shape: Partial<RoomShape> = {}
): [Float32Array, Float32Array] {
    const { bright, dark, rise: riseSeconds, width } = { ...ROOM_SHAPE, ...shape }
    const length = Math.max(1, Math.round(sampleRate * seconds))
    const start = Math.min(length, Math.round(sampleRate * 0.012))
    // The last tenth fades to nothing: an impulse cut at -60 dB ends on a small step.
    const fade = Math.max(1, Math.round(length * 0.1))
    // The level and the brightness fall by the same share at each point: two products, no
    // power per point (a room of 1.2 s is 115,000 points, made while a play waits).
    const fall = Math.pow(10, -3 / (sampleRate * seconds))
    const darker = Math.pow(dark / bright, 1 / (sampleRate * seconds))
    const rise = Math.max(1, Math.round(sampleRate * Math.max(0, riseSeconds)))
    const keepAt = (cutoff: number) =>
        Math.exp((-2 * Math.PI * Math.min(cutoff, sampleRate * 0.45)) / sampleRate)
    const shapeAt = (i: number) =>
        (i - start < rise ? (i - start) / rise : 1) * (i > length - fade ? (length - i) / fade : 1)
    const make = (seed: number): Float32Array => {
        const random = seeded(seed)
        const data = new Float32Array(length)
        let level = Math.pow(fall, start)
        let cutoff = bright * Math.pow(darker, start)
        let keep = 0
        const lows = new Float64Array(ROOM_SLOPE)
        for (let i = start; i < length; i++) {
            // Low-passes that close with time: from bright to dull.
            if ((i - start) % 64 === 0) keep = keepAt(cutoff)
            let value = random() * 2 - 1
            for (let pole = 0; pole < ROOM_SLOPE; pole++) {
                value = keep * lows[pole]! + (1 - keep) * value
                lows[pole] = value
            }
            data[i] = value * level * shapeAt(i)
            level *= fall
            cutoff *= darker
        }
        return data
    }
    // How loud the tail is where a guitar sounds, from how it is made (no measure of the noise
    // itself, which would differ a little with each seed): the power of the noise (a third)
    // through the low-passes of each moment, at a few pitches of the band.
    let power = 0
    const pitches = 8
    for (let p = 0; p < pitches; p++) {
        const hz = ROOM_BAND[0] * Math.pow(ROOM_BAND[1] / ROOM_BAND[0], (p + 0.5) / pitches)
        const cos = Math.cos((2 * Math.PI * hz) / sampleRate)
        let level = Math.pow(fall, start)
        let cutoff = bright * Math.pow(darker, start)
        const step = Math.pow(fall, 64)
        const darkerStep = Math.pow(darker, 64)
        for (let i = start; i < length; i += 64) {
            const keep = keepAt(cutoff)
            const pole = ((1 - keep) * (1 - keep)) / (1 - 2 * keep * cos + keep * keep)
            const size = Math.min(64, length - i)
            const here = level * shapeAt(i + (size >> 1))
            power += (size * here * here * Math.pow(pole, ROOM_SLOPE)) / 3
            level *= step
            cutoff *= darkerStep
        }
    }
    const scale = power > 0 ? 1 / Math.sqrt(power / pitches) : 0
    // What the two sides share, and what sets them apart: left is the sum, right the difference.
    const middle = make(0x2545f491)
    const apart = make(0x51ed270b)
    // The lows of what sets them apart are left out (a high-pass, twice): the same in both ears.
    const pass = Math.exp((-2 * Math.PI * ROOM_WIDE_FROM) / sampleRate)
    for (let turn = 0; turn < 2; turn++) {
        let low = 0
        for (let i = 0; i < length; i++) {
            low = pass * low + (1 - pass) * apart[i]!
            apart[i] = apart[i]! - low
        }
    }
    const angle = (Math.min(1, Math.max(0, width)) * Math.PI) / 4
    const left = new Float32Array(length)
    const right = new Float32Array(length)
    for (let i = 0; i < length; i++) {
        const m = middle[i]! * Math.cos(angle) * scale
        const a = apart[i]! * Math.sin(angle) * scale
        left[i] = m + a
        right[i] = m - a
    }
    return [left, right]
}

/** Where the ceiling starts to bend, and the highest level its curve is drawn for. */
export const CEILING = { knee: 0.9, range: 2 } as const

/**
 * The ceiling, the last thing before the speakers: a level under the knee comes out as it is, a
 * higher one bends toward 1 and never passes it. An accented six-string strum of the recorded
 * guitars peaks at 1.115 and was cut flat by the speakers; plays that add up go higher. It is
 * not late and has no memory: nothing to pump. (A browser's compressor was here first, as a
 * limiter. It is 6 ms late, starts turned down, cannot give up its make-up gain, and its gain
 * moved by 1 to 5 dB for a quarter to half of the time when a loud room pushed it: it is gone.)
 * The curve is for an input divided by `CEILING.range` (a wave shaper reads -1 to 1).
 */
export function ceilingCurve(points = 4097): Float32Array {
    const { knee, range } = CEILING
    const curve = new Float32Array(points)
    for (let i = 0; i < points; i++) {
        const level = ((i / (points - 1)) * 2 - 1) * range
        const size = Math.abs(level)
        curve[i] =
            Math.sign(level) *
            (size <= knee ? size : knee + (1 - knee) * Math.tanh((size - knee) / (1 - knee)))
    }
    return curve
}

/** The room's sound below this (Hz) is left out: a room's low end is mud under a guitar. */
export const ROOM_LOW_CUT = 180

interface Chain {
    input: GainNode
    wet: GainNode
    room: ConvolverNode
    /** The length of the room in the convolver now. */
    seconds: number
}

const chains = new WeakMap<BaseAudioContext, Chain>()

/** Whether a context can build the chain (a test double or an old browser may not). */
const canBuild = (ctx: BaseAudioContext): boolean =>
    typeof ctx.createConvolver === 'function' && typeof ctx.createBuffer === 'function'

/** The last rooms made, by sample rate and length: a page's players share them. */
const rooms = new Map<string, [Float32Array, Float32Array]>()

function roomBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
    const key = `${ctx.sampleRate}:${seconds}`
    let sides = rooms.get(key)
    if (!sides) {
        sides = roomImpulse(ctx.sampleRate, seconds)
        if (rooms.size >= 3) rooms.delete(rooms.keys().next().value as string)
        rooms.set(key, sides)
    }
    const [left, right] = sides
    const impulse = ctx.createBuffer(2, left.length, ctx.sampleRate)
    impulse.getChannelData(0).set(left)
    impulse.getChannelData(1).set(right)
    return impulse
}

function build(ctx: BaseAudioContext, speakers: AudioNode, seconds: number): Chain {
    const input = ctx.createGain()
    const wet = ctx.createGain()
    // Silent until a play names its level: the first one glides up, it doesn't jump.
    wet.gain.value = 0
    const room = ctx.createConvolver()
    // Our impulse has its own level: the browser's normalization would change it.
    room.normalize = false
    room.buffer = roomBuffer(ctx, seconds)
    // Where the notes and the room meet.
    const sum = ctx.createGain()
    input.connect(sum)
    input.connect(room)
    if (typeof ctx.createBiquadFilter === 'function') {
        const lowCut = ctx.createBiquadFilter()
        lowCut.type = 'highpass'
        lowCut.frequency.value = ROOM_LOW_CUT
        lowCut.Q.value = 0.7
        room.connect(lowCut)
        lowCut.connect(wet)
    } else room.connect(wet)
    wet.connect(sum)
    if (typeof ctx.createWaveShaper === 'function') {
        const ceiling = ctx.createWaveShaper()
        ceiling.curve = ceilingCurve() as Float32Array<ArrayBuffer>
        // The curve's input is the level divided by its range.
        sum.gain.value = 1 / CEILING.range
        sum.connect(ceiling)
        ceiling.connect(speakers)
    } else sum.connect(speakers)
    return { input, wet, room, seconds }
}

/**
 * Where a player sends its notes: the context's chain (the room at the level asked, then the
 * ceiling), or the output itself for `dry` and for a context that can't build the chain. The
 * room's level and length are the context's: the last play that names them sets them for what
 * sounds. `speakers` is the context's output, for a caller that keeps it under another name
 * (alphaTab's context, see `src/tab/room.ts`).
 */
export function outputFor(
    ctx: BaseAudioContext,
    effects?: PlayEffects,
    speakers: AudioNode = ctx.destination
): AudioNode {
    if (effects?.dry || !canBuild(ctx)) return speakers
    const seconds = roomSeconds(effects?.room)
    let chain = chains.get(ctx)
    if (!chain) {
        try {
            chain = build(ctx, speakers, seconds)
        } catch {
            return speakers
        }
        chains.set(ctx, chain)
    } else if (chain.seconds !== seconds) {
        try {
            chain.room.buffer = roomBuffer(ctx, seconds)
            chain.seconds = seconds
        } catch {
            // The room stays as long as it was.
        }
    }
    const level = reverbLevel(effects?.reverb)
    // A short glide: a level that jumps while notes ring clicks.
    if (typeof chain.wet.gain.setTargetAtTime === 'function')
        chain.wet.gain.setTargetAtTime(level, ctx.currentTime, 0.02)
    else chain.wet.gain.value = level
    return chain.input
}

/** How hard the amplifier's curve bends at a drive of 0 to 1. */
export const driveAmount = (drive: number): number => 1 + 14 * Math.min(1, Math.max(0, drive))

/** The curve of a driven amplifier: a soft ceiling, steeper with more drive. */
export function driveCurve(drive: number, points = 2048): Float32Array {
    const amount = driveAmount(drive)
    const curve = new Float32Array(points)
    const ceiling = Math.tanh(amount)
    for (let i = 0; i < points; i++) {
        const x = (i / (points - 1)) * 2 - 1
        curve[i] = Math.tanh(amount * x) / ceiling
    }
    return curve
}

/** The level of a strummed guitar the drive is matched for (a wave's peak). */
export const DRIVE_REFERENCE = 0.2

/**
 * The gain after the drive that keeps a strum as loud as it went in: a wave at the reference
 * level through the curve, its level in over its level out. The curve raises quiet sound by its
 * slope (up to 15 times): a fixed gain made a driven strum 10 to 12 dB louder.
 */
export function driveLevel(drive: number, reference = DRIVE_REFERENCE): number {
    const amount = driveAmount(drive)
    const ceiling = Math.tanh(amount)
    let before = 0
    let after = 0
    for (let i = 0; i < 256; i++) {
        const x = reference * Math.sin((2 * Math.PI * i) / 256)
        const y = Math.tanh(amount * x) / ceiling
        before += x * x
        after += y * y
    }
    return after > 0 ? Math.sqrt(before / after) : 1
}

/** The cabinet's filters raise a guitar's level by about this (dB): taken back after them. */
export const CABINET_TRIM_DB = -2

/**
 * An electric guitar's amplifier between a play and the chain: a drive (the deep bass left out,
 * then a wave shaper, level matched so more drive is not simply louder) and a cabinet (no deep
 * bass, a peak in the mids, no fizz, level matched too). Null when the options ask for neither,
 * or the context can't build it.
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
    const filter = (type: BiquadFilterType, frequency: number, q: number, gain = 0) => {
        const node = ctx.createBiquadFilter()
        node.type = type
        node.frequency.value = frequency
        node.Q.value = q
        node.gain.value = gain
        last.connect(node)
        last = node
    }
    if (drive) {
        // A driven low string turns to mud: amplifiers cut the deep bass before the drive.
        filter('highpass', 120, 0.7)
        const shaper = ctx.createWaveShaper()
        shaper.curve = driveCurve(drive) as Float32Array<ArrayBuffer>
        shaper.oversample = '4x'
        const level = ctx.createGain()
        level.gain.value = driveLevel(drive)
        last.connect(shaper)
        shaper.connect(level)
        last = level
    }
    if (cabinet) {
        filter('highpass', 90, 0.7)
        filter('peaking', 2200, 1, 4)
        filter('lowpass', 4800, 0.7)
        filter('lowpass', 6500, 0.7)
        const level = ctx.createGain()
        level.gain.value = Math.pow(10, CABINET_TRIM_DB / 20)
        last.connect(level)
        last = level
    }
    return { input, output: last }
}
