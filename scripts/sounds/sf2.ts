/**
 * A small SoundFont 2 reader and writer (#108): enough to cut one preset out of a bank, with only
 * the instruments and samples it uses, into a soundfont of its own that plays the same.
 *
 * The format (SoundFont 2.04): a RIFF file of three lists. `INFO` (texts), `sdta` (`smpl`: every
 * sample's 16-bit points, one after the other, 46 silent points after each), `pdta` (nine tables:
 * presets `phdr`, their zones `pbag` with modulators `pmod` and generators `pgen`; instruments
 * `inst`, their zones `ibag`, `imod`, `igen`; sample headers `shdr`). Each table ends with one
 * terminal record. A zone's generators run to the next zone's first one; a preset zone's last
 * generator names an instrument (41), an instrument zone's last one a sample (53).
 */

const GEN_INSTRUMENT = 41
const GEN_KEY_RANGE = 43
const GEN_ATTENUATION = 48
const GEN_SAMPLE = 53
/** Silent points after each sample (the format asks for at least 46). */
const PAD = 46

const SIZE = { phdr: 38, bag: 4, mod: 10, gen: 4, inst: 22, shdr: 46 } as const

export interface Preset {
    name: string
    program: number
    bank: number
    /** Its place in the bank's preset table. */
    index: number
}

export interface Bank {
    info: Map<string, Uint8Array>
    /** The sample points (16-bit, little-endian). */
    smpl: Uint8Array
    tables: Record<string, Uint8Array>
    presets: Preset[]
    /** A SoundFont 3: its samples are Ogg streams, not points. It can be read, not cut. */
    compressed: boolean
}

const text = (bytes: Uint8Array, start: number, length: number): string => {
    let end = start
    while (end < start + length && bytes[end] !== 0) end++
    return new TextDecoder('latin1').decode(bytes.subarray(start, end))
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

/** The chunks of a RIFF list's body: id, data. */
function chunks(bytes: Uint8Array): [string, Uint8Array][] {
    const out: [string, Uint8Array][] = []
    const v = view(bytes)
    let at = 0
    while (at + 8 <= bytes.length) {
        const id = text(bytes, at, 4)
        const size = v.getUint32(at + 4, true)
        out.push([id, bytes.subarray(at + 8, at + 8 + size)])
        at += 8 + size + (size % 2)
    }
    return out
}

/** Reads a SoundFont 2 or 3 file. Throws when it isn't one. */
export function readBank(bytes: Uint8Array): Bank {
    if (text(bytes, 0, 4) !== 'RIFF' || text(bytes, 8, 4) !== 'sfbk')
        throw new Error('Not a SoundFont 2 file')
    const info = new Map<string, Uint8Array>()
    const tables: Record<string, Uint8Array> = {}
    let smpl: Uint8Array | null = null
    for (const [id, data] of chunks(bytes.subarray(12))) {
        if (id !== 'LIST') continue
        const kind = text(data, 0, 4)
        for (const [sub, body] of chunks(data.subarray(4))) {
            if (kind === 'INFO') info.set(sub, body)
            else if (kind === 'sdta' && sub === 'smpl') smpl = body
            else if (kind === 'pdta') tables[sub] = body
        }
    }
    if (!smpl) throw new Error('No sample data')
    for (const name of ['phdr', 'pbag', 'pmod', 'pgen', 'inst', 'ibag', 'imod', 'igen', 'shdr'])
        if (!tables[name]) throw new Error(`No ${name} table`)
    const phdr = tables['phdr']!
    const v = view(phdr)
    const presets: Preset[] = []
    // The last record is the terminal one.
    for (let i = 0; i < phdr.length / SIZE.phdr - 1; i++) {
        const at = i * SIZE.phdr
        presets.push({
            name: text(phdr, at, 20),
            program: v.getUint16(at + 20, true),
            bank: v.getUint16(at + 22, true),
            index: i
        })
    }
    const version = info.get('ifil')
    const compressed = Boolean(version && view(version).getUint16(0, true) >= 3)
    return { info, smpl, tables, presets, compressed }
}

/** Zones `[from, to)` of a preset or an instrument: the bag index is the record's last field. */
function zonesOf(table: Uint8Array, size: number, bagAt: number, index: number): [number, number] {
    const v = view(table)
    return [v.getUint16(index * size + bagAt, true), v.getUint16((index + 1) * size + bagAt, true)]
}

interface Zone {
    gens: [number, number][]
    mods: Uint8Array[]
}

/** The zones `[from, to)` of a bag table, with their generators and modulators. */
function readZones(
    bags: Uint8Array,
    gens: Uint8Array,
    mods: Uint8Array,
    from: number,
    to: number
): Zone[] {
    const b = view(bags)
    const g = view(gens)
    const out: Zone[] = []
    for (let z = from; z < to; z++) {
        const zone: Zone = { gens: [], mods: [] }
        const [g0, g1] = [b.getUint16(z * 4, true), b.getUint16((z + 1) * 4, true)]
        const [m0, m1] = [b.getUint16(z * 4 + 2, true), b.getUint16((z + 1) * 4 + 2, true)]
        for (let i = g0; i < g1; i++)
            zone.gens.push([g.getUint16(i * 4, true), g.getUint16(i * 4 + 2, true)])
        for (let i = m0; i < m1; i++) zone.mods.push(mods.subarray(i * 10, (i + 1) * 10))
        out.push(zone)
    }
    return out
}

class Writer {
    private parts: Uint8Array[] = []
    length = 0
    bytes(data: Uint8Array) {
        this.parts.push(data)
        this.length += data.length
    }
    u16(n: number) {
        const b = new Uint8Array(2)
        view(b).setUint16(0, n, true)
        this.bytes(b)
    }
    u32(n: number) {
        const b = new Uint8Array(4)
        view(b).setUint32(0, n, true)
        this.bytes(b)
    }
    /** A name in a field of `length` bytes, cut and padded with zeros. */
    name(value: string, length: number) {
        const b = new Uint8Array(length)
        b.set(new TextEncoder().encode(value).subarray(0, length - 1))
        this.bytes(b)
    }
    done(): Uint8Array {
        const out = new Uint8Array(this.length)
        let at = 0
        for (const p of this.parts) {
            out.set(p, at)
            at += p.length
        }
        return out
    }
}

const chunk = (id: string, data: Uint8Array): Uint8Array => {
    const w = new Writer()
    w.bytes(new TextEncoder().encode(id))
    w.u32(data.length)
    w.bytes(data)
    if (data.length % 2) w.bytes(new Uint8Array(1))
    return w.done()
}

const list = (kind: string, parts: Uint8Array[]): Uint8Array => {
    const w = new Writer()
    w.bytes(new TextEncoder().encode(kind))
    for (const p of parts) w.bytes(p)
    return chunk('LIST', w.done())
}

/** A text chunk: ends with a zero, even length. */
const textChunk = (id: string, value: string): Uint8Array => {
    const bytes = new TextEncoder().encode(value)
    const data = new Uint8Array(bytes.length + (bytes.length % 2 ? 1 : 2))
    data.set(bytes)
    return chunk(id, data)
}

/** Writes the zones of presets or instruments; returns the bag, modulator and generator tables. */
function writeZones(groups: Zone[][]): {
    bags: Uint8Array
    mods: Uint8Array
    gens: Uint8Array
    firstBag: number[]
} {
    const bags = new Writer()
    const mods = new Writer()
    const gens = new Writer()
    const firstBag: number[] = []
    let bag = 0
    let gen = 0
    let mod = 0
    for (const zones of groups) {
        firstBag.push(bag)
        for (const zone of zones) {
            bags.u16(gen)
            bags.u16(mod)
            bag++
            for (const [oper, amount] of zone.gens) {
                gens.u16(oper)
                gens.u16(amount)
                gen++
            }
            for (const m of zone.mods) {
                mods.bytes(m)
                mod++
            }
        }
    }
    firstBag.push(bag)
    // The terminal records.
    bags.u16(gen)
    bags.u16(mod)
    gens.u32(0)
    mods.bytes(new Uint8Array(10))
    return { bags: bags.done(), mods: mods.done(), gens: gens.done(), firstBag }
}

export interface Cut {
    bytes: Uint8Array
    instruments: number
    samples: number
    /** Seconds of sample data. */
    seconds: number
    /** Samples that are half of a stereo pair: alphaTab 1.9 plays mono samples only. */
    notMono: number
}

export interface CutOptions {
    /**
     * Compresses a sample (its 16-bit points, mono, at `rate`) to Ogg Vorbis; `index` is the
     * sample's place in the bank, for a cache. With it, the file is a SoundFont 3: samples are
     * Ogg streams, found by their bytes, and loops count from each sample's start. Null keeps
     * that sample uncompressed.
     */
    encode?: (points: Uint8Array, rate: number, index: number) => Uint8Array | null
    /** Decibels added to everything the preset plays (in alphaTab; see `cutPreset`). */
    gain?: number
    /** Keeps only what plays these keys (lowest, highest): a drum kit's click alone. */
    keys?: [number, number]
}

/**
 * One preset of a bank as a soundfont of its own: the same preset (name, bank, program), its
 * instruments and their samples, renumbered; nothing else. `texts` are the new file's name and
 * comment.
 */
export function cutPreset(
    bank: Bank,
    preset: Preset,
    texts: { name: string; comment: string },
    options: CutOptions = {}
): Cut {
    if (bank.compressed) throw new Error('A SoundFont 3 file: its samples are compressed')
    const { encode, gain, keys } = options
    const t = bank.tables
    const [p0, p1] = zonesOf(t['phdr']!, SIZE.phdr, 24, preset.index)
    const has = (zone: Zone, oper: number) => zone.gens.some(([o]) => o === oper)
    /** Whether a zone plays one of the keys kept (a zone without a key range plays them all). */
    const inKeys = (zone: Zone): boolean => {
        const range = zone.gens.find(([o]) => o === GEN_KEY_RANGE)
        if (!keys || !range) return true
        return (range[1] & 255) <= keys[1] && range[1] >> 8 >= keys[0]
    }
    let presetZones = readZones(t['pbag']!, t['pgen']!, t['pmod']!, p0, p1).filter(inKeys)

    // The instruments it uses, in the order it names them, with the zones that play the keys kept
    // (their global zone, which names no sample, stays).
    const zonesOfInstrument = new Map<number, Zone[]>()
    for (const zone of presetZones)
        for (const [oper, amount] of zone.gens) {
            if (oper !== GEN_INSTRUMENT || zonesOfInstrument.has(amount)) continue
            const [i0, i1] = zonesOf(t['inst']!, SIZE.inst, 20, amount)
            const zones = readZones(t['ibag']!, t['igen']!, t['imod']!, i0, i1).filter(
                (z) => !has(z, GEN_SAMPLE) || inKeys(z)
            )
            // An instrument left without a sample is left out, with the preset zones that name it.
            if (zones.some((z) => has(z, GEN_SAMPLE))) zonesOfInstrument.set(amount, zones)
        }
    presetZones = presetZones.filter((zone) =>
        zone.gens.every(([o, a]) => o !== GEN_INSTRUMENT || zonesOfInstrument.has(a))
    )
    const instruments = [...zonesOfInstrument.keys()]
    const instrumentZones = [...zonesOfInstrument.values()]

    // The gain: an attenuation below zero, in the preset's global zone (the one that names no
    // instrument), and in each zone that has an attenuation of its own (it replaces the global
    // one). The SoundFont standard stops at zero; alphaTab adds it as it is, so it is a gain
    // there, and nothing in other players.
    if (gain) {
        const amount = -Math.round(gain * 10)
        const signed = (n: number) => (n > 0x7fff ? n - 0x10000 : n)
        const add = (zone: Zone): boolean => {
            const own = zone.gens.find(([o]) => o === GEN_ATTENUATION)
            if (own) own[1] = (signed(own[1]) + amount) & 0xffff
            return Boolean(own)
        }
        const first = presetZones[0]
        if (first && !has(first, GEN_INSTRUMENT)) {
            if (!add(first)) first.gens.push([GEN_ATTENUATION, amount & 0xffff])
        } else presetZones.unshift({ gens: [[GEN_ATTENUATION, amount & 0xffff]], mods: [] })
        for (const zone of presetZones.slice(1)) add(zone)
    }

    // The samples they use, and the other half of each stereo pair.
    const shdr = t['shdr']!
    const sv = view(shdr)
    const count = shdr.length / SIZE.shdr - 1
    const used = new Set<number>()
    for (const zones of instrumentZones)
        for (const zone of zones)
            for (const [oper, amount] of zone.gens) if (oper === GEN_SAMPLE) used.add(amount)
    for (const s of [...used]) {
        const type = sv.getUint16(s * SIZE.shdr + 44, true)
        const link = sv.getUint16(s * SIZE.shdr + 42, true)
        // Right (2), left (4) and linked (8) samples name their pair.
        if ((type === 2 || type === 4 || type === 8) && link < count) used.add(link)
    }
    const samples = [...used].sort((a, b) => a - b)
    const newSample = new Map(samples.map((s, i) => [s, i]))
    const newInstrument = new Map(instruments.map((s, i) => [s, i]))

    // The sample points, one sample after the other, and their headers at the new places.
    const points = new Writer()
    const headers = new Writer()
    let total = 0
    let notMono = 0
    for (const s of samples) {
        const at = s * SIZE.shdr
        const start = sv.getUint32(at + 20, true)
        const end = sv.getUint32(at + 24, true)
        const rate = sv.getUint32(at + 36, true)
        const type = sv.getUint16(at + 44, true)
        const link = sv.getUint16(at + 42, true)
        const pcm = bank.smpl.subarray(start * 2, end * 2)
        total += (end - start) / rate
        if ((type & 1) === 0) notMono++
        headers.bytes(shdr.subarray(at, at + 20))
        const ogg = encode ? encode(pcm, rate, s) : null
        if (ogg) {
            headers.u32(points.length)
            headers.u32(points.length + ogg.length)
            // Loops count from the sample's own start.
            headers.u32(sv.getUint32(at + 28, true) - start)
            headers.u32(sv.getUint32(at + 32, true) - start)
            points.bytes(ogg)
        } else {
            // Uncompressed points are found by their number: they start on an even byte.
            if (points.length % 2) points.bytes(new Uint8Array(1))
            const shift = points.length / 2 - start
            headers.u32(start + shift)
            headers.u32(end + shift)
            headers.u32(sv.getUint32(at + 28, true) + shift)
            headers.u32(sv.getUint32(at + 32, true) + shift)
            points.bytes(pcm)
            points.bytes(new Uint8Array(PAD * 2))
        }
        headers.bytes(shdr.subarray(at + 36, at + 42))
        headers.u16(type === 2 || type === 4 || type === 8 ? (newSample.get(link) ?? 0) : 0)
        // 0x10: the sample is compressed (SoundFont 3).
        headers.u16(ogg ? type | 0x10 : type)
    }
    headers.name('EOS', 20)
    headers.bytes(new Uint8Array(SIZE.shdr - 20))

    const renumber = (zones: Zone[], oper: number, map: Map<number, number>): Zone[] =>
        zones.map((zone) => ({
            mods: zone.mods,
            gens: zone.gens.map(([o, a]) => [o, o === oper ? map.get(a)! : a] as [number, number])
        }))
    const pz = writeZones([renumber(presetZones, GEN_INSTRUMENT, newInstrument)])
    const iz = writeZones(instrumentZones.map((z) => renumber(z, GEN_SAMPLE, newSample)))

    const phdr = new Writer()
    const old = t['phdr']!.subarray(preset.index * SIZE.phdr, (preset.index + 1) * SIZE.phdr)
    phdr.bytes(old.subarray(0, 24))
    phdr.u16(pz.firstBag[0]!)
    phdr.bytes(old.subarray(26))
    phdr.name('EOP', 20)
    phdr.u16(0)
    phdr.u16(0)
    phdr.u16(pz.firstBag[1]!)
    phdr.bytes(new Uint8Array(12))

    const inst = new Writer()
    instruments.forEach((i, n) => {
        inst.bytes(t['inst']!.subarray(i * SIZE.inst, i * SIZE.inst + 20))
        inst.u16(iz.firstBag[n]!)
    })
    inst.name('EOI', 20)
    inst.u16(iz.firstBag[instruments.length]!)

    const info = [
        // Version 3.01 says the samples are compressed.
        chunk(
            'ifil',
            encode
                ? new Uint8Array([3, 0, 1, 0])
                : (bank.info.get('ifil') ?? new Uint8Array([2, 0, 1, 0]))
        ),
        chunk('isng', bank.info.get('isng') ?? new TextEncoder().encode('EMU8000\0')),
        textChunk('INAM', texts.name)
    ]
    const copyright = bank.info.get('ICOP')
    if (copyright) info.push(chunk('ICOP', copyright))
    info.push(textChunk('ICMT', texts.comment))

    const body = new Writer()
    body.bytes(new TextEncoder().encode('sfbk'))
    body.bytes(list('INFO', info))
    body.bytes(list('sdta', [chunk('smpl', points.done())]))
    body.bytes(
        list('pdta', [
            chunk('phdr', phdr.done()),
            chunk('pbag', pz.bags),
            chunk('pmod', pz.mods),
            chunk('pgen', pz.gens),
            chunk('inst', inst.done()),
            chunk('ibag', iz.bags),
            chunk('imod', iz.mods),
            chunk('igen', iz.gens),
            chunk('shdr', headers.done())
        ])
    )
    return {
        bytes: chunk('RIFF', body.done()),
        instruments: instruments.length,
        samples: samples.length,
        seconds: total,
        notMono
    }
}

/**
 * A bank of one preset (bank 0, program 0) that plays one sample of `bank` on every key: to hear
 * a sample alone, for example to check that its compressed form still sounds. `key` is the key
 * the sample was recorded at.
 */
export function oneSampleBank(
    bank: Bank,
    sample: number
): { bank: Bank; preset: Preset; key: number } {
    const phdr = new Writer()
    phdr.name('sample', 20)
    phdr.u16(0)
    phdr.u16(0)
    phdr.u16(0)
    phdr.bytes(new Uint8Array(12))
    phdr.name('EOP', 20)
    phdr.u16(0)
    phdr.u16(0)
    phdr.u16(1)
    phdr.bytes(new Uint8Array(12))
    const inst = new Writer()
    inst.name('sample', 20)
    inst.u16(0)
    inst.name('EOI', 20)
    inst.u16(1)
    // One zone, then the terminal record: generator and modulator indexes.
    const bags = new Writer()
    for (const n of [0, 0, 1, 0]) bags.u16(n)
    const gens = (oper: number, amount: number) => {
        const w = new Writer()
        w.u16(oper)
        w.u16(amount)
        w.u32(0)
        return w.done()
    }
    const key = view(bank.tables['shdr']!).getUint8(sample * SIZE.shdr + 40)
    return {
        bank: {
            info: bank.info,
            smpl: bank.smpl,
            tables: {
                phdr: phdr.done(),
                pbag: bags.done(),
                pmod: new Uint8Array(10),
                pgen: gens(GEN_INSTRUMENT, 0),
                inst: inst.done(),
                ibag: bags.done(),
                imod: new Uint8Array(10),
                igen: gens(GEN_SAMPLE, sample),
                shdr: bank.tables['shdr']!
            },
            presets: [],
            compressed: false
        },
        preset: { name: 'sample', program: 0, bank: 0, index: 0 },
        // 255 is an unpitched sample.
        key: key > 127 ? 60 : key
    }
}
