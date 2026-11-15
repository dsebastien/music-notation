import { describe, expect, it } from 'bun:test'
import { cutPreset, oneSampleBank, readBank } from './sf2.js'

const enc = new TextEncoder()

/** Bytes from numbers and byte arrays: `u16(n)`, `u32(n)`, `name(s, length)` make the parts. */
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
const u16 = (n: number) => [n & 255, n >> 8]
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
const points = (...values: number[]) => values.flatMap(u16)
const silence = new Array<number>(46 * 2).fill(0)

/** A sample header: name, start, end, loop start, loop end, rate, key, link, type. */
const shdr = (
    n: string,
    start: number,
    end: number,
    loop0: number,
    loop1: number,
    rate: number,
    key: number,
    link = 0,
    type = 1
) =>
    join(
        name(n),
        u32(start),
        u32(end),
        u32(loop0),
        u32(loop1),
        u32(rate),
        [key, 0],
        u16(link),
        u16(type)
    )

/**
 * A bank of two presets. "One" (program 5) plays instrument A, which plays sample s0. "Two"
 * (program 9) has a global zone and a modulator, and plays instrument B, which plays s2 then s1.
 */
function bankBytes(): Uint8Array {
    const smpl = join(
        points(1, 2, 3, 4),
        silence,
        points(10, 20, 30),
        silence,
        points(7, 8),
        silence
    )
    const pdta = list(
        'pdta',
        chunk(
            'phdr',
            join(
                name('One'),
                u16(5),
                u16(0),
                u16(0),
                new Uint8Array(12),
                name('Two'),
                u16(9),
                u16(0),
                u16(1),
                new Uint8Array(12),
                name('EOP'),
                u16(0),
                u16(0),
                u16(3),
                new Uint8Array(12)
            )
        ),
        // One: zone 0 (generator 0). Two: zone 1 (the global one, generator 1), zone 2 (generator
        // 2, modulator 0). Then the terminal record.
        chunk('pbag', join(u16(0), u16(0), u16(1), u16(0), u16(2), u16(0), u16(3), u16(1))),
        chunk('pmod', join([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], new Uint8Array(10))),
        chunk('pgen', join(u16(41), u16(0), u16(8), u16(100), u16(41), u16(1), u32(0))),
        chunk('inst', join(name('A'), u16(0), name('B'), u16(1), name('EOI'), u16(3))),
        chunk('ibag', join(u16(0), u16(0), u16(2), u16(0), u16(3), u16(0), u16(4), u16(0))),
        chunk('imod', new Uint8Array(10)),
        chunk(
            'igen',
            join(u16(43), u16(0x7f00), u16(53), u16(0), u16(53), u16(2), u16(53), u16(1), u32(0))
        ),
        chunk(
            'shdr',
            join(
                shdr('s0', 0, 4, 1, 3, 44100, 60),
                shdr('s1', 50, 53, 50, 52, 22050, 64),
                shdr('s2', 99, 101, 99, 100, 32000, 67),
                name('EOS'),
                new Uint8Array(26)
            )
        )
    )
    const info = list(
        'INFO',
        chunk('ifil', Uint8Array.from([2, 0, 1, 0])),
        chunk('isng', enc.encode('EMU8000\0')),
        chunk('INAM', enc.encode('Test\0\0')),
        chunk('ICOP', enc.encode('Somebody\0\0'))
    )
    return chunk('RIFF', join(enc.encode('sfbk'), info, list('sdta', chunk('smpl', smpl)), pdta))
}

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)
const u16s = (b: Uint8Array) =>
    Array.from({ length: b.length / 2 }, (_, i) => view(b).getUint16(i * 2, true))
/** The sample headers of a bank: name, start, end, loops, rate, key, link, type. */
const headers = (table: Uint8Array) =>
    Array.from({ length: table.length / 46 - 1 }, (_, i) => {
        const at = i * 46
        const v = view(table)
        return {
            name: new TextDecoder().decode(table.subarray(at, at + 20)).replace(/\0.*$/, ''),
            start: v.getUint32(at + 20, true),
            end: v.getUint32(at + 24, true),
            loop: [v.getUint32(at + 28, true), v.getUint32(at + 32, true)],
            rate: v.getUint32(at + 36, true),
            key: v.getUint8(at + 40),
            type: v.getUint16(at + 44, true)
        }
    })
const texts = { name: 'Cut', comment: 'A comment' }

describe('reading a soundfont (#108)', () => {
    it('lists the presets of a bank', () => {
        const bank = readBank(bankBytes())
        expect(bank.presets).toEqual([
            { name: 'One', program: 5, bank: 0, index: 0 },
            { name: 'Two', program: 9, bank: 0, index: 1 }
        ])
        expect(bank.compressed).toBe(false)
        expect(bank.smpl.length).toBe((4 + 3 + 2 + 3 * 46) * 2)
    })

    it("refuses what isn't a soundfont", () => {
        expect(() => readBank(new Uint8Array(40))).toThrow('Not a SoundFont 2 file')
    })
})

describe('cutting one preset out of a bank (#108)', () => {
    it('keeps the preset, its instrument and its samples, renumbered, and nothing else', () => {
        const bank = readBank(bankBytes())
        const cut = cutPreset(bank, bank.presets[1]!, texts)
        expect(cut.instruments).toBe(1)
        expect(cut.samples).toBe(2)
        const own = readBank(cut.bytes)
        // The same preset: its name, bank and program, so a player finds it where it was.
        expect(own.presets).toEqual([{ name: 'Two', program: 9, bank: 0, index: 0 }])
        // Its global zone and its modulator are kept; instrument B is now instrument 0.
        expect(u16s(own.tables['pgen']!)).toEqual([8, 100, 41, 0, 0, 0])
        expect([...own.tables['pmod']!.subarray(0, 10)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        expect(u16s(own.tables['pbag']!)).toEqual([0, 0, 1, 0, 2, 1])
        // Sample s1 is now sample 0 and s2 sample 1; B's zones name them in their own order.
        expect(u16s(own.tables['igen']!)).toEqual([53, 1, 53, 0, 0, 0])
        expect(headers(own.tables['shdr']!)).toEqual([
            { name: 's1', start: 0, end: 3, loop: [0, 2], rate: 22050, key: 64, type: 1 },
            { name: 's2', start: 49, end: 51, loop: [49, 50], rate: 32000, key: 67, type: 1 }
        ])
        // The points themselves, each sample followed by its silence.
        expect(u16s(own.smpl.subarray(0, 6))).toEqual([10, 20, 30])
        expect(u16s(own.smpl.subarray(49 * 2, 51 * 2))).toEqual([7, 8])
        expect(own.smpl.length).toBe((3 + 2 + 2 * 46) * 2)
        expect(new TextDecoder().decode(own.info.get('INAM'))).toContain('Cut')
        expect(new TextDecoder().decode(own.info.get('ICOP'))).toContain('Somebody')
    })

    it('a preset of one instrument and one sample', () => {
        const bank = readBank(bankBytes())
        const own = readBank(cutPreset(bank, bank.presets[0]!, texts).bytes)
        expect(own.presets).toEqual([{ name: 'One', program: 5, bank: 0, index: 0 }])
        // The key range generator stays; the sample is sample 0.
        expect(u16s(own.tables['igen']!)).toEqual([43, 0x7f00, 53, 0, 0, 0])
        expect(headers(own.tables['shdr']!)).toEqual([
            { name: 's0', start: 0, end: 4, loop: [1, 3], rate: 44100, key: 60, type: 1 }
        ])
    })

    it('compressed samples are found by their bytes, their loops count from their start', () => {
        const bank = readBank(bankBytes())
        const ogg = Uint8Array.from([0x4f, 0x67, 0x67])
        const seen: [number, number, number][] = []
        // s1 (sample 1 of the bank) is compressed; s2 stays as it is.
        const cut = cutPreset(bank, bank.presets[1]!, texts, (pcm, rate, index) => {
            seen.push([pcm.length, rate, index])
            return index === 1 ? ogg : null
        })
        expect(seen).toEqual([
            [6, 22050, 1],
            [4, 32000, 2]
        ])
        const own = readBank(cut.bytes)
        expect(own.compressed).toBe(true)
        expect(headers(own.tables['shdr']!)).toEqual([
            // 0x10 marks a compressed sample: bytes 0 to 3 of the sample data.
            { name: 's1', start: 0, end: 3, loop: [0, 2], rate: 22050, key: 64, type: 17 },
            // Uncompressed points start on an even byte (byte 4: point 2).
            { name: 's2', start: 2, end: 4, loop: [2, 3], rate: 32000, key: 67, type: 1 }
        ])
        expect([...own.smpl.subarray(0, 3)]).toEqual([0x4f, 0x67, 0x67])
        expect(u16s(own.smpl.subarray(4, 8))).toEqual([7, 8])
        // A compressed bank can't be cut again.
        expect(() => cutPreset(own, own.presets[0]!, texts)).toThrow('compressed')
    })

    it('one sample alone, on a preset of its own', () => {
        const bank = readBank(bankBytes())
        const one = oneSampleBank(bank, 1)
        expect(one.key).toBe(64)
        const own = readBank(cutPreset(one.bank, one.preset, texts).bytes)
        expect(own.presets).toEqual([{ name: 'sample', program: 0, bank: 0, index: 0 }])
        expect(headers(own.tables['shdr']!).map((s) => s.name)).toEqual(['s1'])
        expect(u16s(own.smpl.subarray(0, 6))).toEqual([10, 20, 30])
    })
})
