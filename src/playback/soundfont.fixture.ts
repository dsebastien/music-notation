/**
 * Builds small soundfonts for the specs: one preset, its zones, its instruments and their samples,
 * as the bytes of a SoundFont 2 (or 3, when a sample is compressed) file.
 */
const enc = new TextEncoder()

const join = (...parts: (Uint8Array | number[])[]): Uint8Array => {
    const all = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)))
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const p of all) {
        out.set(p, at)
        at += p.length
    }
    return out
}
const u16 = (n: number) => [n & 255, (n >> 8) & 255]
const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]
const name = (s: string, length = 20) => {
    const b = new Uint8Array(length)
    b.set(enc.encode(s))
    return b
}
const chunk = (id: string, data: Uint8Array) =>
    join(enc.encode(id), u32(data.length), data, data.length % 2 ? [0] : [])
const list = (kind: string, ...parts: Uint8Array[]) =>
    chunk('LIST', join(enc.encode(kind), ...parts))

/** A zone: its generators as `[number, amount]`, in order (the instrument or the sample last). */
export type FixtureZone = [number, number][]

export interface FixtureSample {
    name: string
    /** Its 16-bit points, or the bytes of its Ogg stream when `compressed`. */
    data: number[]
    /** The loop, in points from the sample's start. */
    loop?: [number, number]
    rate?: number
    key?: number
    correction?: number
    compressed?: boolean
}

export interface Fixture {
    name?: string
    bank?: number
    program?: number
    /** The preset's zones; a zone names an instrument with generator 41. */
    preset: FixtureZone[]
    /** Each instrument's zones; a zone names a sample with generator 53. */
    instruments: FixtureZone[][]
    samples: FixtureSample[]
}

/** A signed amount (an attenuation of -166, a time of -12000) as a generator's 16 bits. */
export const amount = (n: number) => n & 0xffff
/** A key or velocity range as a generator's amount. */
export const range = (lo: number, hi: number) => (hi << 8) | lo

function bags(groups: FixtureZone[][]): { bag: Uint8Array; gen: Uint8Array; first: number[] } {
    const bag: number[] = []
    const gen: number[] = []
    const first: number[] = []
    let zones = 0
    let gens = 0
    for (const group of groups) {
        first.push(zones)
        for (const zone of group) {
            bag.push(...u16(gens), ...u16(0))
            zones++
            for (const [oper, value] of zone) {
                gen.push(...u16(oper), ...u16(value))
                gens++
            }
        }
    }
    first.push(zones)
    bag.push(...u16(gens), ...u16(0))
    gen.push(0, 0, 0, 0)
    return { bag: Uint8Array.from(bag), gen: Uint8Array.from(gen), first }
}

export function soundfontBytes(fixture: Fixture): Uint8Array {
    const p = bags([fixture.preset])
    const i = bags(fixture.instruments)
    // The sample data: points with 46 silent points after each, or Ogg bytes one after the other.
    const data: number[] = []
    const headers: Uint8Array[] = []
    for (const s of fixture.samples) {
        const [loop0, loop1] = s.loop ?? [0, 0]
        let start: number
        let end: number
        if (s.compressed) {
            start = data.length
            data.push(...s.data)
            end = data.length
        } else {
            if (data.length % 2) data.push(0)
            start = data.length / 2
            for (const point of s.data) data.push(...u16(point))
            end = data.length / 2
            data.push(...new Array<number>(92).fill(0))
        }
        headers.push(
            join(
                name(s.name),
                u32(start),
                u32(end),
                // An uncompressed sample's loop is written from the start of all the data.
                u32(loop0 + (s.compressed ? 0 : start)),
                u32(loop1 + (s.compressed ? 0 : start)),
                u32(s.rate ?? 44100),
                [s.key ?? 60, (s.correction ?? 0) & 255],
                u16(0),
                u16(s.compressed ? 17 : 1)
            )
        )
    }
    const compressed = fixture.samples.some((s) => s.compressed)
    const pdta = list(
        'pdta',
        chunk(
            'phdr',
            join(
                name(fixture.name ?? 'Preset'),
                u16(fixture.program ?? 0),
                u16(fixture.bank ?? 0),
                u16(0),
                new Uint8Array(12),
                name('EOP'),
                u16(0),
                u16(0),
                u16(p.first[1]!),
                new Uint8Array(12)
            )
        ),
        chunk('pbag', p.bag),
        chunk('pmod', new Uint8Array(10)),
        chunk('pgen', p.gen),
        chunk(
            'inst',
            join(
                ...fixture.instruments.map((_, n) =>
                    join(name(`Instrument ${n}`), u16(i.first[n]!))
                ),
                name('EOI'),
                u16(i.first[fixture.instruments.length]!)
            )
        ),
        chunk('ibag', i.bag),
        chunk('imod', new Uint8Array(10)),
        chunk('igen', i.gen),
        chunk('shdr', join(...headers, name('EOS'), new Uint8Array(26)))
    )
    const info = list(
        'INFO',
        chunk('ifil', Uint8Array.from(compressed ? [3, 0, 1, 0] : [2, 0, 1, 0])),
        chunk('INAM', enc.encode('Fixture\0'))
    )
    return chunk(
        'RIFF',
        join(enc.encode('sfbk'), info, list('sdta', chunk('smpl', Uint8Array.from(data))), pdta)
    )
}
