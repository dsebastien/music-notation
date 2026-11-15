/**
 * Cuts a SoundFont 2 bank into one small soundfont per General MIDI program (#108), so a page
 * loads only the instruments it plays, each one at the same loudness (#119).
 *
 *   bun scripts/sounds/split-soundfont.ts <bank.sf2> <out folder>
 *       [--name n] [--version v] [--format sf3|sf2] [--quality 4] [--target -21] [--reference kit.sf3]
 *
 * Writes `p000.sf3` to `p127.sf3` (bank 0), `drums.sf3` (the standard kit, bank 128 program 0),
 * `click.sf3` (the kit's metronome click alone), `index.json` (each program's file, what a player
 * reads) and `report.json`: for each file its name, bytes,
 * loudness and the gain written into it. `sf3` (the default) compresses each sample to Ogg Vorbis
 * with ffmpeg (it must be on the PATH); `sf2` keeps the samples as they are. The files are not
 * part of this repository: the bank has its own license.
 *
 * The gain: each program's test phrase is brought to `--target` dBFS (-21 by default, the median
 * of alphaTab's `sonivox.sf3` on the same phrase), as far as its peak allows, and written into
 * the file (`cutPreset`), so no player has to know it. The drum kit is brought to the loudness of
 * the `--reference` soundfont's kit (sonivox by default, when alphaTab is installed).
 */
import { mkdir } from 'node:fs/promises'
import { brotliCompressSync, constants } from 'node:zlib'
import { cutPreset, oneSampleBank, readBank, TAIL, type CutOptions, type Preset } from './sf2.js'
import {
    chordPattern,
    clickPattern,
    drumPattern,
    loudness,
    loudnessOfMidi,
    noteOf,
    type Loudness
} from './measure.js'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? (args[i + 1] ?? fallback) : fallback
}
const [source, out] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!source || !out) {
    console.error(
        'Usage: split-soundfont.ts <bank.sf2> <out folder> [--name n] [--version v] [--format sf3|sf2] [--quality q] [--target dB] [--reference kit.sf3]'
    )
    process.exit(1)
}
const name = flag('name', 'bank')
const version = flag('version', '')
const format = flag('format', 'sf3') === 'sf2' ? 'sf2' : 'sf3'
const quality = flag('quality', '4')
const target = Number(flag('target', '-21'))
const reference = flag('reference', 'node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf3')
/** The loudest peak a gain may give on the test phrase, in dBFS. */
const HEADROOM = -1
/**
 * The loudest peak a gain may give on a six-note strummed chord at velocity 100 and full volume:
 * full scale. The steel guitar brought to the target loudness peaked at +5.7 dBFS on a G chord,
 * which clips; the phrase alone (single notes, one four-note chord) didn't show it.
 */
const CHORD_HEADROOM = 0
/** The metronome click and bell of a General MIDI kit. */
const CLICK_KEYS: [number, number] = [33, 34]

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
        // The points with the same tail as the compressed form (#128): played alone, without
        // its loop, a sample plays its tail too.
        const cut = cutPreset(
            one.bank,
            one.preset,
            texts,
            ogg ? { encode: () => ogg } : { tail: true }
        )
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
    const heardAlone = alone(index)
    let ogg: Uint8Array | null = null
    // A sample that is silent on its own can't be checked: it stays as it is.
    if (Number.isFinite(heardAlone)) {
        for (const q of QUALITIES) {
            const candidate = ffmpeg(points, rate, q, index)
            const heard = alone(index, candidate)
            if (Number.isFinite(heard) && Math.abs(heard - heardAlone) <= 1.5) {
                ogg = candidate
                if (q !== quality) raised.set(q, (raised.get(q) ?? 0) + 1)
                break
            }
        }
        if (!ogg) kept.wrong++
    } else kept.unchecked++
    // The points without the tail they were given to be compressed (it is not written then).
    if (!ogg) kept.bytes += points.length - TAIL * 2
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
    /** dB written into the file, so every program is as loud as the others. */
    gain: number
    /** Loudness of the test phrase with that gain, dBFS; null when nothing sounded. */
    rms: number | null
    peak: number | null
}
const label = `${name}${version ? ` ${version}` : ''}`
const base: CutOptions = format === 'sf3' ? { encode } : {}
/** Loudness before the gain, to compare with the whole bank. */
const before = new Map<string, Loudness>()

/**
 * Writes one file: cut without a gain and measured, then cut again with the gain that brings it
 * to `wanted` dBFS (as far as its peak allows) and measured again. `fixed` gives the gain
 * instead (the click takes the kit's).
 */
async function write(
    file: string,
    preset: Preset,
    measure: ((bytes: Uint8Array) => Loudness) | null,
    wanted: number,
    options: CutOptions = {},
    fixed?: number,
    /** The loudest thing it plays, when that is more than the measured phrase: its peak caps the gain. */
    loudest?: (bytes: Uint8Array) => Loudness
): Promise<Entry> {
    const texts = {
        name: `${label}: ${preset.name}`,
        comment: `One preset of ${label}, cut out with its samples. See the license of the bank.`
    }
    let cut = cutPreset(bank, preset, texts, { ...base, ...options })
    let loud = measure ? measure(cut.bytes) : null
    const heard = loud !== null && Number.isFinite(loud.rms)
    if (loud) before.set(file, loud)
    const most = heard && loudest ? loudest(cut.bytes).peak : -Infinity
    const gain =
        fixed ??
        (heard && loud
            ? round(Math.min(wanted - loud.rms, HEADROOM - loud.peak, CHORD_HEADROOM - most))
            : 0)
    if (gain) {
        cut = cutPreset(bank, preset, texts, { ...base, ...options, gain })
        if (measure) loud = measure(cut.bytes)
    }
    await Bun.write(`${out}/${file}`, cut.bytes)
    return {
        file,
        name: preset.name,
        bytes: cut.bytes.length,
        brotli: brotli(cut.bytes),
        samples: cut.samples,
        seconds: round(cut.seconds),
        notMono: cut.notMono,
        gain,
        rms: heard && loud ? round(loud.rms) : null,
        peak: heard && loud ? round(loud.peak) : null
    }
}

const started = performance.now()
const programs: Record<string, Entry> = {}
/** `--programs 0,25,30`: only these, to try something (the index then holds only them). */
const only = flag('programs', '').split(',').filter(Boolean).map(Number)
for (let program = 0; program < 128; program++) {
    const preset = bank.presets.find((p) => p.bank === 0 && p.program === program)
    if (!preset || (only.length && !only.includes(program))) continue
    const file = `p${String(program).padStart(3, '0')}.${format}`
    programs[String(program)] = await write(
        file,
        preset,
        (b) => loudness(b, program),
        target,
        {},
        undefined,
        (b) => loudnessOfMidi(b, chordPattern(program))
    )
}

// The drum kit, as loud as the reference soundfont's; and its click alone, for the metronome and
// the count-in of a score without drums.
const kit = bank.presets.find((p) => p.bank === 128 && p.program === 0)
const referenceFile = Bun.file(reference)
const referenceBytes = (await referenceFile.exists())
    ? new Uint8Array(await referenceFile.arrayBuffer())
    : null
const kitTarget = referenceBytes ? loudnessOfMidi(referenceBytes, drumPattern()).rms : target
const clickTarget = referenceBytes ? loudnessOfMidi(referenceBytes, clickPattern()).rms : target
const hits = (bytes: Uint8Array) => loudnessOfMidi(bytes, drumPattern())
const drums = kit ? await write(`drums.${format}`, kit, hits, kitTarget) : null
// The click alone is as loud as the reference's click (in the kit it keeps the kit's gain).
const clicks = (bytes: Uint8Array) => loudnessOfMidi(bytes, clickPattern())
const click = kit
    ? await write(`click.${format}`, kit, clicks, clickTarget, { keys: CLICK_KEYS })
    : null

// Two files. `report.json`: everything measured, for people. `index.json`: what a player reads
// before its first note, as small as it can be (each program's file).
// With `--programs`, the programs written before stay in both.
const reportFile = Bun.file(`${out}/report.json`)
const earlier: Record<string, Entry> =
    only.length && (await reportFile.exists())
        ? ((await reportFile.json()) as { programs: Record<string, Entry> }).programs
        : {}
const allPrograms = { ...earlier, ...programs }
await Bun.write(
    reportFile,
    JSON.stringify(
        { bank: name, version, format, target, programs: allPrograms, drums, click },
        null,
        2
    ) + '\n'
)
const fileOf = (entry: Entry | null) => (entry ? { file: entry.file } : null)
await Bun.write(
    `${out}/index.json`,
    JSON.stringify({
        bank: name,
        version,
        programs: Object.fromEntries(
            Object.entries(allPrograms).map(([program, entry]) => [program, fileOf(entry)])
        ),
        drums: fileOf(drums),
        click: fileOf(click)
    }) + '\n'
)

// A check: before its gain, a program sounds the same from its own file as from the whole bank
// (compressed samples are a little different: within 1 dB).
const CHECK = [0, 24, 25, 27, 29, 30, 33]
const tolerance = format === 'sf3' ? 1 : 0.1
const off: string[] = []
for (const program of CHECK) {
    const entry = programs[String(program)]
    const own = entry && before.get(entry.file)
    if (!own) continue
    const full = loudness(whole, program)
    if (Math.abs(full.rms - own.rms) > tolerance || Math.abs(full.peak - own.peak) > tolerance + 2)
        off.push(
            `${program}: whole bank ${round(full.rms)}/${round(full.peak)}, own file ${round(own.rms)}/${round(own.peak)}`
        )
}

const all = Object.values(programs)
const sum = (pick: (e: Entry) => number) => all.reduce((a, e) => a + pick(e), 0)
console.log(
    `${label}: ${kb(whole.length)} KB whole, ${all.length} programs${drums ? ', a drum kit and its click' : ''}, as ${format}${format === 'sf3' ? ` (quality ${quality}, ${encoded.size} samples)` : ''}, ${Math.round((performance.now() - started) / 1000)} s`
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
const line = (id: string, e: Entry) =>
    `${id.padStart(5)} ${e.name.padEnd(20)} ${pad(e.bytes)} KB ${pad(e.brotli)} brotli ${String(e.samples).padStart(3)} samples  gain ${String(e.gain).padStart(5)} dB -> rms ${e.rms} peak ${e.peak}`
for (const p of [0, 24, 25, 26, 27, 28, 29, 30, 32, 33, 40, 48, 56, 73]) {
    const e = programs[String(p)]
    if (e) console.log(line(String(p), e))
}
if (drums) console.log(line('drums', drums) + ` (reference ${round(kitTarget)})`)
if (click) console.log(line('click', click))
const sizes = all.map((e) => e.bytes).sort((a, b) => a - b)
console.log(
    `Program file size: median ${kb(sizes[Math.floor(sizes.length / 2)]!)} KB, largest ${kb(sizes.at(-1)!)} KB (${all.find((e) => e.bytes === sizes.at(-1))?.name})`
)
const levels = all.flatMap((e) => (e.rms === null ? [] : [e.rms])).sort((a, b) => a - b)
console.log(
    `Loudness after the gains: median ${levels[Math.floor(levels.length / 2)]} dBFS, from ${levels[0]} to ${levels.at(-1)}; ${all.filter((e) => e.rms !== null && e.rms < target - 1).length} programs stay more than 1 dB under the target (their peak is the limit)`
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
        : `Before the gains, same loudness as the whole bank (within ${tolerance} dB) for programs ${CHECK.join(', ')}`
)
if (off.length) process.exit(1)
