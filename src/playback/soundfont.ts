/**
 * Reading a small soundfont in the browser (#109): what the sample player needs to play one
 * instrument file (`p025.sf3`) without alphaTab. A preset's zones are flattened to regions: a key
 * and velocity range, a sample, its pitch, its level, its loop and its volume envelope.
 *
 * The SoundFont 2 rules kept here: an instrument's global zone (the first one, when it names no
 * sample) gives the defaults of its other zones; a preset zone's values are added to the
 * instrument's; a preset zone's own value replaces its global zone's. Modulators, the LFOs, the
 * pitch part of the modulation envelope and panning are left out: a single instrument still
 * sounds like itself.
 */

/** A sample: where its data is, and how it loops. */
export interface SoundSample {
    name: string
    /** Bytes in the sample data when compressed (an Ogg stream), else 16-bit points. */
    start: number
    end: number
    /** The loop, in points from the sample's start. */
    loopStart: number
    loopEnd: number
    rate: number
    /** The key the sample was recorded at (60 when unpitched). */
    key: number
    /** Cents. */
    correction: number
    compressed: boolean
}

/** One sample on a range of keys and velocities, as it plays. */
export interface Region {
    loKey: number
    hiKey: number
    loVel: number
    hiVel: number
    sample: number
    /** The key that plays the sample at its own pitch. */
    rootKey: number
    /** Cents added to every note. */
    tune: number
    /** Cents a key: 100, or 0 for sounds without a pitch. */
    scale: number
    /** Decibels taken off (below zero: a gain, see `scripts/sounds`). */
    attenuation: number
    loop: boolean
    /** The volume envelope: seconds, and the sustain level as decibels taken off. */
    attack: number
    hold: number
    decay: number
    sustain: number
    release: number
    /** A low-pass filter's cutoff in hertz; null when it is open and nothing moves it. */
    filter: number | null
    /** The filter's resonance, in decibels. */
    filterQ: number
    /**
     * What opens the filter as the note starts and closes it as it rings (the modulation
     * envelope): `amount` cents at its peak, times in seconds, `sustain` the part of the amount
     * that stays (0 to 1).
     */
    filterEnvelope: { amount: number; attack: number; hold: number; decay: number; sustain: number }
}

export interface SoundPreset {
    name: string
    bank: number
    program: number
    regions: Region[]
}

export interface Soundfont {
    presets: SoundPreset[]
    samples: SoundSample[]
    /** The sample data. */
    data: Uint8Array
}

const GEN = {
    filter: 8,
    filterQ: 9,
    filterAmount: 11,
    modAttack: 26,
    modHold: 27,
    modDecay: 28,
    modSustain: 29,
    attack: 34,
    hold: 35,
    decay: 36,
    sustain: 37,
    release: 38,
    instrument: 41,
    keyRange: 43,
    velRange: 44,
    attenuation: 48,
    coarse: 51,
    fine: 52,
    sample: 53,
    modes: 54,
    scale: 56,
    rootKey: 58
} as const

/** What a generator is when no zone gives it (instrument level). */
const DEFAULTS: Record<number, number> = {
    [GEN.filter]: 13500,
    [GEN.filterQ]: 0,
    [GEN.filterAmount]: 0,
    [GEN.modAttack]: -12000,
    [GEN.modHold]: -12000,
    [GEN.modDecay]: -12000,
    [GEN.modSustain]: 0,
    [GEN.attack]: -12000,
    [GEN.hold]: -12000,
    [GEN.decay]: -12000,
    [GEN.sustain]: 0,
    [GEN.release]: -12000,
    [GEN.attenuation]: 0,
    [GEN.coarse]: 0,
    [GEN.fine]: 0,
    [GEN.modes]: 0,
    [GEN.scale]: 100,
    [GEN.rootKey]: -1
}

const text = (bytes: Uint8Array, start: number, length: number): string => {
    let end = start
    while (end < start + length && bytes[end] !== 0) end++
    return new TextDecoder('latin1').decode(bytes.subarray(start, end))
}
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const signed = (n: number) => (n > 0x7fff ? n - 0x10000 : n)
/** Timecents to seconds; the standard's shortest time is no time. */
const seconds = (timecents: number) => (timecents <= -11950 ? 0 : Math.pow(2, timecents / 1200))

function chunks(bytes: Uint8Array): [string, Uint8Array][] {
    const out: [string, Uint8Array][] = []
    const v = view(bytes)
    let at = 0
    while (at + 8 <= bytes.length) {
        const size = v.getUint32(at + 4, true)
        out.push([text(bytes, at, 4), bytes.subarray(at + 8, at + 8 + size)])
        at += 8 + size + (size % 2)
    }
    return out
}

/** A zone's generators, by number (amounts as written, unsigned). */
type Zone = Map<number, number>

/** The zones `[from, to)` of a bag table. */
function zones(bags: Uint8Array, gens: Uint8Array, from: number, to: number): Zone[] {
    const b = view(bags)
    const g = view(gens)
    const out: Zone[] = []
    for (let z = from; z < to; z++) {
        const zone: Zone = new Map()
        const end = b.getUint16((z + 1) * 4, true)
        for (let i = b.getUint16(z * 4, true); i < end; i++)
            zone.set(g.getUint16(i * 4, true), g.getUint16(i * 4 + 2, true))
        out.push(zone)
    }
    return out
}

/** Reads a SoundFont 2 or 3 file. Throws when it isn't one. */
export function readSoundfont(bytes: Uint8Array): Soundfont {
    if (text(bytes, 0, 4) !== 'RIFF' || text(bytes, 8, 4) !== 'sfbk')
        throw new Error('Not a soundfont')
    const t: Record<string, Uint8Array> = {}
    let data: Uint8Array | null = null
    for (const [id, body] of chunks(bytes.subarray(12))) {
        if (id !== 'LIST') continue
        const kind = text(body, 0, 4)
        for (const [sub, part] of chunks(body.subarray(4))) {
            if (kind === 'sdta' && sub === 'smpl') data = part
            else if (kind === 'pdta') t[sub] = part
        }
    }
    const names = ['phdr', 'pbag', 'pgen', 'inst', 'ibag', 'igen', 'shdr']
    if (!data || names.some((n) => !t[n])) throw new Error('Not a complete soundfont')
    const [phdr, pbag, pgen, inst, ibag, igen, shdr] = names.map((n) => t[n]!) as [
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array
    ]

    const sv = view(shdr)
    const samples: SoundSample[] = []
    for (let i = 0; i < shdr.length / 46 - 1; i++) {
        const at = i * 46
        const start = sv.getUint32(at + 20, true)
        const compressed = (sv.getUint16(at + 44, true) & 0x10) !== 0
        const key = sv.getUint8(at + 40)
        samples.push({
            name: text(shdr, at, 20),
            start,
            end: sv.getUint32(at + 24, true),
            // An uncompressed sample's loop is written from the start of all the data.
            loopStart: sv.getUint32(at + 28, true) - (compressed ? 0 : start),
            loopEnd: sv.getUint32(at + 32, true) - (compressed ? 0 : start),
            rate: sv.getUint32(at + 36, true),
            key: key > 127 ? 60 : key,
            correction: sv.getInt8(at + 41),
            compressed
        })
    }

    const pv = view(phdr)
    const iv = view(inst)
    const presets: SoundPreset[] = []
    for (let p = 0; p < phdr.length / 38 - 1; p++) {
        const regions: Region[] = []
        const presetZones = zones(
            pbag,
            pgen,
            pv.getUint16(p * 38 + 24, true),
            pv.getUint16((p + 1) * 38 + 24, true)
        )
        const presetGlobal =
            presetZones[0] && !presetZones[0].has(GEN.instrument) ? presetZones[0] : null
        for (const presetZone of presetZones) {
            const instrument = presetZone.get(GEN.instrument)
            if (instrument === undefined || instrument >= inst.length / 22 - 1) continue
            const instrumentZones = zones(
                ibag,
                igen,
                iv.getUint16(instrument * 22 + 20, true),
                iv.getUint16((instrument + 1) * 22 + 20, true)
            )
            const global =
                instrumentZones[0] && !instrumentZones[0].has(GEN.sample)
                    ? instrumentZones[0]
                    : null
            /** A preset's value: its zone's, else its global zone's, else nothing to add. */
            const added = (gen: number) =>
                signed(presetZone.get(gen) ?? presetGlobal?.get(gen) ?? 0)
            const range = (zone: Zone, gen: number): [number, number] => {
                const amount = zone.get(gen)
                return amount === undefined ? [0, 127] : [amount & 255, amount >> 8]
            }
            const [pLoKey, pHiKey] = range(presetZone, GEN.keyRange)
            const [pLoVel, pHiVel] = range(presetZone, GEN.velRange)
            for (const zone of instrumentZones) {
                const sample = zone.get(GEN.sample)
                if (sample === undefined || !samples[sample]) continue
                /** An instrument's value: its zone's, else its global zone's, else the default. */
                const own = (gen: number) =>
                    signed(zone.get(gen) ?? global?.get(gen) ?? (DEFAULTS[gen] ?? 0) & 0xffff)
                const value = (gen: number) => own(gen) + added(gen)
                const keys = range(zone.has(GEN.keyRange) ? zone : (global ?? zone), GEN.keyRange)
                const vels = range(zone.has(GEN.velRange) ? zone : (global ?? zone), GEN.velRange)
                const loKey = Math.max(keys[0], pLoKey)
                const hiKey = Math.min(keys[1], pHiKey)
                const loVel = Math.max(vels[0], pLoVel)
                const hiVel = Math.min(vels[1], pHiVel)
                if (loKey > hiKey || loVel > hiVel) continue
                const info = samples[sample]
                const root = own(GEN.rootKey)
                const cutoff = value(GEN.filter)
                const amount = value(GEN.filterAmount)
                regions.push({
                    loKey,
                    hiKey,
                    loVel,
                    hiVel,
                    sample,
                    rootKey: root >= 0 && root <= 127 ? root : info.key,
                    tune: value(GEN.coarse) * 100 + value(GEN.fine) + info.correction,
                    scale: own(GEN.scale),
                    attenuation: value(GEN.attenuation) / 10,
                    loop: (own(GEN.modes) & 1) === 1 && info.loopEnd > info.loopStart,
                    attack: seconds(value(GEN.attack)),
                    hold: seconds(value(GEN.hold)),
                    decay: seconds(value(GEN.decay)),
                    sustain: Math.max(0, value(GEN.sustain)) / 10,
                    release: seconds(value(GEN.release)),
                    // 13,500 cents (about 20 kHz) and above is an open filter.
                    filter:
                        cutoff >= 13500 && amount <= 0 ? null : 8.176 * Math.pow(2, cutoff / 1200),
                    filterQ: Math.max(0, value(GEN.filterQ)) / 10,
                    filterEnvelope: {
                        amount,
                        attack: seconds(value(GEN.modAttack)),
                        hold: seconds(value(GEN.modHold)),
                        decay: seconds(value(GEN.modDecay)),
                        // Written as the part taken off, in thousandths.
                        sustain: 1 - Math.min(1000, Math.max(0, value(GEN.modSustain))) / 1000
                    }
                })
            }
        }
        presets.push({
            name: text(phdr, p * 38, 20),
            program: pv.getUint16(p * 38 + 20, true),
            bank: pv.getUint16(p * 38 + 22, true),
            regions
        })
    }
    return { presets, samples, data }
}

/** The regions a note plays: every one whose keys and velocities hold it. */
export function regionsFor(preset: SoundPreset, key: number, velocity: number): Region[] {
    return preset.regions.filter(
        (r) => key >= r.loKey && key <= r.hiKey && velocity >= r.loVel && velocity <= r.hiVel
    )
}
