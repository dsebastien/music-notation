/**
 * Finds a sample of a bank that alphaTab plays as silence once compressed (#108), and writes the
 * smallest pair of soundfonts that shows it: the sample alone, uncompressed and compressed.
 *
 *   bun scripts/sounds/repro-vorbis.ts <bank.sf2> <out folder> [--quality 4]
 *
 * For a bug report to alphaTab: both files hold one preset (bank 0, program 0) with one sample on
 * every key. The first plays; the second, the same points as Ogg Vorbis from ffmpeg's libvorbis,
 * plays as silence in alphaTab 1.9.0.
 */
import { mkdir } from 'node:fs/promises'
import { cutPreset, oneSampleBank, readBank } from './sf2.js'
import { loudness, noteOf } from './measure.js'

const args = process.argv.slice(2)
const [source, out] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
const at = args.indexOf('--quality')
const quality = at >= 0 ? (args[at + 1] ?? '4') : '4'
if (!source || !out) {
    console.error('Usage: repro-vorbis.ts <bank.sf2> <out folder> [--quality q]')
    process.exit(1)
}
const bank = readBank(new Uint8Array(await Bun.file(source).arrayBuffer()))
const shdr = bank.tables['shdr']!
const view = new DataView(shdr.buffer, shdr.byteOffset, shdr.byteLength)
const texts = { name: 'One sample', comment: 'A sample alone, to show a decoding difference.' }

/** Samples by length, shortest first: the report's files stay small. */
const samples = Array.from({ length: shdr.length / 46 - 1 }, (_, i) => ({
    index: i,
    name: new TextDecoder().decode(shdr.subarray(i * 46, i * 46 + 20)).replace(/\0.*$/, ''),
    start: view.getUint32(i * 46 + 20, true),
    end: view.getUint32(i * 46 + 24, true),
    rate: view.getUint32(i * 46 + 36, true)
}))
    .filter((s) => s.end - s.start > 2000)
    .sort((a, b) => a.end - a.start - (b.end - b.start))

for (const sample of samples) {
    const one = oneSampleBank(bank, sample.index)
    const plain = cutPreset(one.bank, one.preset, texts)
    const heard = loudness(plain.bytes, 0, noteOf(one.key)).rms
    if (!Number.isFinite(heard)) continue
    const run = Bun.spawnSync(
        [
            'ffmpeg',
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            's16le',
            '-ar',
            String(sample.rate),
            '-ac',
            '1',
            '-i',
            'pipe:0',
            '-c:a',
            'libvorbis',
            '-q:a',
            quality,
            '-f',
            'ogg',
            'pipe:1'
        ],
        { stdin: bank.smpl.subarray(sample.start * 2, sample.end * 2) }
    )
    if (run.exitCode !== 0) continue
    const ogg = new Uint8Array(run.stdout)
    let compressed: number
    let thrown = ''
    const packed = cutPreset(one.bank, one.preset, texts, { encode: () => ogg })
    try {
        compressed = loudness(packed.bytes, 0, noteOf(one.key)).rms
    } catch (e) {
        compressed = NaN
        thrown = String(e)
    }
    if (Number.isFinite(compressed) && Math.abs(compressed - heard) <= 1.5) continue
    await mkdir(out, { recursive: true })
    await Bun.write(`${out}/sample.sf2`, plain.bytes)
    await Bun.write(`${out}/sample.sf3`, packed.bytes)
    await Bun.write(`${out}/sample.ogg`, ogg)
    console.log(
        `Sample ${sample.index} "${sample.name}": ${sample.end - sample.start} points at ${sample.rate} Hz, key ${one.key}`
    )
    console.log(
        `  uncompressed (sample.sf2, ${plain.bytes.length} bytes): RMS ${heard.toFixed(1)} dBFS`
    )
    console.log(
        `  compressed at quality ${quality} (sample.sf3, ${packed.bytes.length} bytes): ${thrown || `RMS ${compressed} dBFS`}`
    )
    process.exit(0)
}
console.log('Every sample sounds the same compressed.')
