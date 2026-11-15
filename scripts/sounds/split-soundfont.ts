/**
 * Cuts a SoundFont 2 bank into one small soundfont per General MIDI program (#108), so a page
 * loads only the instruments it plays, and measures each one's loudness for its gain (#119).
 *
 *   bun scripts/sounds/split-soundfont.ts <bank.sf2> <out folder>
 *       [--name n] [--version v] [--format sf3|sf2] [--quality 4] [--target -20]
 *
 * Writes `p000.sf3` to `p127.sf3` (bank 0), `drums.sf3` (the standard kit, bank 128 program 0)
 * and `index.json`: for each program its file, name, bytes, loudness and the gain that brings the
 * test phrase to the target loudness without clipping. `sf3` (the default) compresses each sample
 * to Ogg Vorbis with ffmpeg (it must be on the PATH); `sf2` keeps the samples as they are. The
 * files are not part of this repository: the bank has its own license.
 */
import { mkdir } from 'node:fs/promises'
import { brotliCompressSync, constants } from 'node:zlib'
import { cutPreset, oneSampleBank, readBank, type Preset } from './sf2.js'
import { loudness, noteOf } from './measure.js'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? (args[i + 1] ?? fallback) : fallback
}
const [source, out] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!source || !out) {
    console.error(
        'Usage: split-soundfont.ts <bank.sf2> <out folder> [--name n] [--version v] [--format sf3|sf2] [--quality q] [--target dB]'
    )
    process.exit(1)
}
const name = flag('name', 'bank')
const version = flag('version', '')
const format = flag('format', 'sf3') === 'sf2' ? 'sf2' : 'sf3'
const quality = flag('quality', '4')
const target = Number(flag('target', '-20'))
/** The loudest peak a gain may give, in dBFS. */
const HEADROOM = -1

const whole = new Uint8Array(await Bun.file(source).arrayBuffer())
const bank = readBank(whole)
await mkdir(out, { recursive: true })

const ffmpeg = (points: Uint8Array, rate: number, q: string, index: number): Uint8Array => {
    const run = Bun.spawnSync(
        [
            'ffmpeg',
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            's16le',
            '-ar',
            String(rate),
            '-ac',
            '1',
            '-i',
            'pipe:0',
            '-c:a',
            'libvorbis',
            '-q:a',
            q,
            '-f',
            'ogg',
            'pipe:1'
        ],
        { stdin: points }
    )
    if (run.exitCode !== 0 || !run.stdout.length)
        throw new Error(`ffmpeg failed on sample ${index}: ${run.stderr.toString().slice(0, 300)}`)
    return new Uint8Array(run.stdout)
}

/** The loudness of one sample alone, as alphaTab plays it: from a soundfont that holds only it. */
const alone = (index: number, ogg?: Uint8Array): number => {
    const one = oneSampleBank(bank, index)
    const texts = { name: 'sample', comment: 'check' }
    try {
        const cut = cutPreset(one.bank, one.preset, texts, ogg ? () => ogg : undefined)
        return loudness(cut.bytes, 0, noteOf(one.key)).rms
    } catch {
        // alphaTab refused the stream.
        return NaN
    }
}

/**
 * The qualities tried for a sample, lowest first. alphaTab 1.9.0's own Vorbis decoder plays some
 * streams as silence or refuses them (seen: 44.1 kHz samples at qualities 0 to 5), so each
 * compressed sample is played by alphaTab, alone, and compared with its uncompressed form; the
 * first quality that sounds the same (within 1.5 dB) is kept.
 */
const QUALITIES = [...new Set([quality, '6', '7', '8', '9', '10'])]
const raised = new Map<string, number>()
/** Samples kept uncompressed: no quality sounded right, or the sample is silent alone. */
const kept = { wrong: 0, unchecked: 0, bytes: 0 }

/**
 * Each sample of the bank is compressed once, whatever the number of programs that use it. Null:
 * the sample stays uncompressed in the file (alphaTab reads both kinds in one soundfont).
 */
const encoded = new Map<number, Uint8Array | null>()
const encode = (points: Uint8Array, rate: number, index: number): Uint8Array | null => {
    const known = encoded.get(index)
    if (known !== undefined) return known
    const reference = alone(index)
    let ogg: Uint8Array | null = null
    // A sample that is silent on its own can't be checked: it stays as it is.
    if (Number.isFinite(reference)) {
        for (const q of QUALITIES) {
            const candidate = ffmpeg(points, rate, q, index)
            const heard = alone(index, candidate)
            if (Number.isFinite(heard) && Math.abs(heard - reference) <= 1.5) {
                ogg = candidate
                if (q !== quality) raised.set(q, (raised.get(q) ?? 0) + 1)
                break
            }
        }
        if (!ogg) kept.wrong++
    } else kept.unchecked++
    if (!ogg) kept.bytes += points.length
    encoded.set(index, ogg)
    return ogg
}

const kb = (n: number) => Math.round(n / 1024)
const brotli = (bytes: Uint8Array) =>
    brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length
const round = (n: number) => Math.round(n * 10) / 10

interface Entry {
    file: string
    name: string
    bytes: number
    /** As a web server sends it (brotli): SF3 hardly shrinks, SF2 a little. */
    brotli: number
    samples: number
    seconds: number
    /** Samples alphaTab 1.9 doesn't play (halves of stereo pairs). */
    notMono: number
    rms: number | null
    peak: number | null
    /** dB to add so every program is as loud as the others. */
    gain: number
}
const programs: Record<string, Entry> = {}
const label = `${name}${version ? ` ${version}` : ''}`

async function write(file: string, preset: Preset, program: number | null): Promise<Entry> {
    const cut = cutPreset(
        bank,
        preset,
        {
            name: `${label}: ${preset.name}`,
            comment: `One preset of ${label}, cut out with its samples. See the license of the bank.`
        },
        format === 'sf3' ? encode : undefined
    )
    await Bun.write(`${out}/${file}`, cut.bytes)
    // Drums are not measured: the phrase is notes, not hits.
    const loud = program === null ? null : loudness(cut.bytes, program)
    const heard = loud !== null && Number.isFinite(loud.rms)
    return {
        file,
        name: preset.name,
        bytes: cut.bytes.length,
        brotli: brotli(cut.bytes),
        samples: cut.samples,
        seconds: round(cut.seconds),
        notMono: cut.notMono,
        rms: heard ? round(loud.rms) : null,
        peak: heard ? round(loud.peak) : null,
        gain: heard ? round(Math.min(target - loud.rms, HEADROOM - loud.peak)) : 0
    }
}

const started = performance.now()
for (let program = 0; program < 128; program++) {
    const preset = bank.presets.find((p) => p.bank === 0 && p.program === program)
    if (!preset) continue
    const file = `p${String(program).padStart(3, '0')}.${format}`
    programs[String(program)] = await write(file, preset, program)
}
const kit = bank.presets.find((p) => p.bank === 128 && p.program === 0)
const drums = kit ? await write(`drums.${format}`, kit, null) : null

await Bun.write(
    `${out}/index.json`,
    JSON.stringify({ bank: name, version, format, target, programs, drums }, null, 2) + '\n'
)

// A check: a few programs sound the same from their own file as from the whole bank (compressed
// samples are a little different: within 1 dB).
const CHECK = [0, 24, 25, 27, 29, 30, 33]
const tolerance = format === 'sf3' ? 1 : 0.1
const off: string[] = []
for (const program of CHECK) {
    const entry = programs[String(program)]
    if (!entry) continue
    const full = loudness(whole, program)
    const rms = entry.rms ?? -Infinity
    const peak = entry.peak ?? -Infinity
    if (Math.abs(full.rms - rms) > tolerance || Math.abs(full.peak - peak) > tolerance + 2)
        off.push(
            `${program}: whole bank ${round(full.rms)}/${round(full.peak)}, own file ${rms}/${peak}`
        )
}

const all = Object.values(programs)
const sum = (pick: (e: Entry) => number) => all.reduce((a, e) => a + pick(e), 0)
console.log(
    `${label}: ${kb(whole.length)} KB whole, ${all.length} programs${drums ? ' and a drum kit' : ''}, as ${format}${format === 'sf3' ? ` (quality ${quality}, ${encoded.size} samples compressed)` : ''}, ${Math.round((performance.now() - started) / 1000)} s`
)
if (format === 'sf3') {
    const up = [...raised].map(([q, n]) => `${n} to ${q}`).join(', ') || 'none'
    console.log(`Quality raised so alphaTab plays the sample: ${up}`)
    console.log(
        `Kept uncompressed: ${kept.wrong} that never sounded right, ${kept.unchecked} that are silent alone (${kb(kept.bytes)} KB in all)`
    )
}
console.log(
    `All program files: ${kb(sum((e) => e.bytes))} KB, ${kb(sum((e) => e.brotli))} KB with brotli`
)
const pad = (n: number) => String(kb(n)).padStart(5)
for (const p of [0, 24, 25, 26, 27, 28, 29, 30, 32, 33, 40, 48, 56, 73]) {
    const e = programs[String(p)]
    if (e)
        console.log(
            `${String(p).padStart(3)} ${e.name.padEnd(20)} ${pad(e.bytes)} KB ${pad(e.brotli)} brotli  ${String(e.samples).padStart(3)} samples ${e.seconds} s  rms ${e.rms} peak ${e.peak} gain ${e.gain}`
        )
}
if (drums)
    console.log(
        `drums ${drums.name.padEnd(18)} ${pad(drums.bytes)} KB ${pad(drums.brotli)} brotli  ${drums.samples} samples`
    )
const sizes = all.map((e) => e.bytes).sort((a, b) => a - b)
console.log(
    `Program file size: median ${kb(sizes[Math.floor(sizes.length / 2)]!)} KB, largest ${kb(sizes.at(-1)!)} KB (${all.find((e) => e.bytes === sizes.at(-1))?.name})`
)
const silent = Object.entries(programs).filter(([, e]) => e.rms === null)
const stereo = Object.entries(programs).filter(([, e]) => e.notMono > 0)
console.log(
    `Silent on the test phrase: ${silent.length ? silent.map(([p, e]) => `${p} ${e.name}`).join(', ') : 'none'}`
)
console.log(
    `With stereo samples (alphaTab plays mono samples only): ${stereo.length ? stereo.map(([p, e]) => `${p} ${e.name} (${e.notMono}/${e.samples})`).join(', ') : 'none'}`
)
console.log(
    off.length
        ? `DIFFERENT from the whole bank:\n${off.join('\n')}`
        : `Same loudness as the whole bank (within ${tolerance} dB) for programs ${CHECK.join(', ')}`
)
if (off.length) process.exit(1)
