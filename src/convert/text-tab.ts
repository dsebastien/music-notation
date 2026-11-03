/**
 * Plain-text tabs (the kind pasted from the web) → alphaTex, so they draw and play as ```tab
 * blocks (#25, #37). Durations come from the spacing between columns (#66): a bar is a bar of the
 * meter the typical bars show (3/4, 6/8, 12/8, else 4/4), and its beats sit on the coarsest grid
 * (whole notes to sixteenths) their columns fit; else every beat is an eighth. A bar split across
 * two rows is joined, and a short first bar is a pickup (#70). Techniques (bends, hammer-ons,
 * pull-offs, slides, vibrato, dead notes, natural harmonics, palm mute lines) become alphaTex
 * effects. Guitar and bass tabs (strings named by letter, by number, or not at all; short
 * excerpts on the strings they show, one string on a six-string guitar) and drum tabs (one line
 * per drum: `HH|x-x-…`, `S |----o---`) are read; text after a line's last bar line
 * (`| let ring`) becomes an annotation.
 */
import { parseTuning } from '../fretboard/tuning.js'
import { chromaOf, noteOf } from '../theory/pitch.js'

/** A string line's start: an optional name (a letter, or a number followed by a bar line). */
const STRING_PREFIX = /^\s*([A-Ga-g][#b]?|[1-8](?=\s*[|:]))?\s*[|:]?/

/** A string line's body: dashes, frets, bar lines and technique marks. */
const STRING_BODY = /^[-0-9xX|:hpbrsvt/\\~^().*<>\s]*$/

/** A drum line: a name, a bar line, then dashes and hits. */
const DRUM_LINE = /^\s*([A-Za-z][A-Za-z0-9. -]{0,14}?)\s*[|:]([-xXoOgfdb#@*+|:\s]*)$/

type Drum =
    | 'hihat'
    | 'hihat-open'
    | 'hihat-foot'
    | 'crash'
    | 'crash2'
    | 'ride'
    | 'splash'
    | 'china'
    | 'cowbell'
    | 'snare'
    | 'tom1'
    | 'tom2'
    | 'tom3'
    | 'floor'
    | 'kick'

/** Drum line names (lowercase, without spaces, dots or dashes) → the drum. */
const DRUM_NAMES = new Map<string, Drum>(
    Object.entries({
        'hihat': 'h hh hat hihat hihats',
        'hihat-open': 'oh openhat openhihat',
        'hihat-foot': 'hf fh hp ph pedal hihatfoot hihatpedal',
        'crash': 'c c1 cc cr cy cym crash crash1 cymbal',
        'crash2': 'c2 cr2 crash2',
        'ride': 'r rd rc ride',
        'splash': 'sp spl splash',
        'china': 'ch cn chi china',
        'cowbell': 'cb cow cowbell',
        'snare': 's sd sn sr snare snaredrum',
        'tom1': 't t1 ht tom1 hightom hitom',
        'tom2': 't2 mt tom2 midtom',
        'tom3': 't3 lt tom3 lowtom',
        'floor': 'f ft fl t4 tom4 floor floortom',
        'kick': 'b bd bs k kd bass kick bassdrum kickdrum'
    } satisfies Record<Drum, string>).flatMap(([drum, list]) =>
        list.split(' ').map((name) => [name, drum as Drum] as const)
    )
)

/** A drum hit → alphaTab's articulation name (with `\articulation defaults`). */
function articulationOf(drum: Drum, hit: string): string {
    const choke = hit === '#'
    switch (drum) {
        case 'hihat':
            return hit === 'o' || hit === 'O' ? 'HiHatOpen' : 'HiHatClosed'
        case 'hihat-open':
            return 'HiHatOpen'
        case 'hihat-foot':
            return 'PedalHiHatHit'
        case 'crash':
            return choke ? 'CrashHighChoke' : 'CrashHighHit'
        case 'crash2':
            return choke ? 'CrashMediumChoke' : 'CrashMediumHit'
        case 'ride':
            return choke ? 'RideChoke' : 'RideMiddle'
        case 'splash':
            return choke ? 'SplashChoke' : 'SplashHit'
        case 'china':
            return choke ? 'ChinaChoke' : 'ChinaHit'
        case 'cowbell':
            return 'CowbellMediumHit'
        case 'snare':
            return 'SnareHit'
        case 'tom1':
            return 'HighTomHit'
        case 'tom2':
            return 'MidTomHit'
        case 'tom3':
            return 'LowTomHit'
        case 'floor':
            return 'VeryLowTomHit'
        case 'kick':
            return 'KickHit'
    }
}

/** A drum hit's effect: capitals are accents, `g` a ghost note. */
const effectOf = (hit: string) => (hit === 'X' || hit === 'O' ? ['ac'] : hit === 'g' ? ['g'] : [])

interface TabLine {
    /**
     * As a string line: its name (letter or number), what follows it, where that starts, and
     * whether a bar line comes before it (`e|`, not `e`).
     */
    string: { name: string | null; body: string; offset: number; barred: boolean } | null
    /** As a drum line: the drum and what follows its name. */
    drum: { drum: Drum; name: string; body: string; lettered: boolean } | null
    /** Text after the last bar line. */
    text: string | null
}

/** A character no string or drum line holds (a word's letters, quotes, an arrow's `<-`). */
const NOT_TAB = /[^-0-9xXoOgfdbhprsvt/\\~^().*<>#@+|:\s]|<(?!\d)/

/** A repeat count: x2, 2x, x 4. */
const COUNT = /^\s*(?:[xX]\s*\d{1,3}|\d{1,3}\s*[xX])\s*$/

/**
 * Text after a line's last bar line ("| let ring", "| x2", "|<-- let ring", "|x2"); else null.
 * It's text when it holds a character no tab line holds (even with dashes: "| repeat --- 4x"),
 * when it's a repeat count, or when a space sets it off and it has no run of dashes.
 */
function splitText(line: string): { line: string; text: string | null } {
    const last = line.lastIndexOf('|')
    if (last < 0) return { line, text: null }
    const rest = line.slice(last + 1)
    const text = rest.trim()
    if (!text) return { line, text: null }
    const isText =
        NOT_TAB.test(text) || COUNT.test(text) || (/^\s/.test(rest) && !text.includes('--'))
    return isText ? { line: line.slice(0, last + 1), text } : { line, text: null }
}

function tabLineOf(raw: string): TabLine | null {
    const { line, text } = splitText(raw.trimEnd())
    let string: TabLine['string'] = null
    const m = STRING_PREFIX.exec(line)!
    const body = line.slice(m[0].length)
    if (
        STRING_BODY.test(body) &&
        (line.match(/-/g)?.length ?? 0) >= 4 &&
        (line.includes('|') || /^\s*[A-Ga-g][#b]?\s*[-|:]/.test(line))
    )
        string = { name: m[1] ?? null, body, offset: m[0].length, barred: /[|:]$/.test(m[0]) }
    let drum: TabLine['drum'] = null
    const d = DRUM_LINE.exec(line)
    const name = d ? d[1]!.toLowerCase().replace(/[ .-]/g, '') : ''
    const known = DRUM_NAMES.get(name)
    if (d && known && (d[2]!.match(/[^\s|:]/g)?.length ?? 0) >= 4)
        drum = { drum: known, name, body: d[2]!, lettered: /^[A-Ga-g]$/.test(d[1]!) }
    return string || drum ? { string, drum, text } : null
}

type System =
    | {
          kind: 'strings'
          names: (string | null)[]
          lines: string[]
          texts: string[]
          /** Palm-muted columns (in the lines' columns), from a PM line above. */
          muted: Set<number>
          /** True when no bar line comes before its first bar (`e ---3|5---`). */
          openStart: boolean
      }
    | { kind: 'drums'; drums: Drum[]; lines: string[]; texts: string[] }

const textsOf = (run: TabLine[]) => [
    ...new Set(run.map((l) => l.text).filter((t): t is string => t !== null))
]

/**
 * Systems written one under the other without a blank line: a run of string lines splits where
 * its first two names come back (e B G D A E e B …; a low E isn't a new system).
 */
function splitStrings(run: TabLine[]): TabLine[][] {
    const out: TabLine[][] = []
    let start = 0
    for (let i = 2; i < run.length - 1; i++) {
        const [a, b] = [run[start]!.string!.name, run[start + 1]!.string!.name]
        if (
            a !== null &&
            run[i]!.string!.name === a &&
            run[i + 1]!.string!.name === b &&
            i - start >= 2
        ) {
            out.push(run.slice(start, i))
            start = i
        }
    }
    out.push(run.slice(start))
    return out
}

/** A run of drum lines, split where a drum line comes back (two systems without a blank line). */
function splitDrums(run: TabLine[]): TabLine[][] {
    const out: TabLine[][] = []
    let current: TabLine[] = []
    for (const line of run) {
        if (current.some((l) => l.drum!.name === line.drum!.name)) {
            out.push(current)
            current = []
        }
        current.push(line)
    }
    out.push(current)
    return out
}

/** A palm mute line: PM or P.M. marks, then dashes, dots or spaces (`PM----  P.M.--`). */
const PM_LINE = /^[\sPpMm.\-_|=~]*$/
const PM_MARK = /P\.?M/i

/**
 * The column ranges (inclusive) a palm mute line marks: each PM through its last dash before the
 * next PM; empty when the line isn't one.
 */
export function palmMutesOf(line: string): [number, number][] {
    if (!PM_LINE.test(line) || !PM_MARK.test(line)) return []
    const ranges: [number, number][] = []
    for (let i = 0; i < line.length; i++) {
        const c = line[i]!
        const mark = (c === 'P' || c === 'p') && /^\.?[Mm]/.test(line.slice(i + 1, i + 3))
        if (mark) ranges.push([i, i])
        else if (c !== ' ' && ranges.length) ranges[ranges.length - 1]![1] = i
    }
    return ranges
}

/**
 * A run of tab lines as string systems: named lines alone, unnamed ones in threes or more. A palm
 * mute line just above the run marks its first system.
 */
function stringSystems(run: TabLine[], above: string | null = null): System[] {
    return splitStrings(run).flatMap((part, index): System[] => {
        const names = part.map((l) => l.string!.name)
        if (part.length < 3 && names.some((n) => n === null)) return []
        const lines = part.map((l) => l.string!.body)
        const offset = part[0]!.string!.offset
        const muted = new Set<number>()
        if (index === 0 && above !== null)
            for (const [a, b] of palmMutesOf(above))
                for (let col = Math.max(a, offset); col <= b; col++) muted.add(col - offset)
        const openStart = part.some((l) => !l.string!.barred)
        return [{ kind: 'strings', names, lines, texts: textsOf(part), muted, openStart }]
    })
}

/**
 * A run of consecutive tab lines as systems. Drums when every line names a drum, and a name isn't
 * a string's (HH, S, BD) or a line has hits; B, C and F alone with dashes are strings.
 */
function systemsOfRun(run: TabLine[], above: string | null): System[] {
    if (!run.length) return []
    if (
        run.every((l) => l.drum) &&
        run.some((l) => !l.string || !l.drum!.lettered || /[xXoOgfdb#@*+]/.test(l.drum!.body))
    )
        return splitDrums(run).map((part) => ({
            kind: 'drums',
            drums: part.map((l) => l.drum!.drum),
            lines: part.map((l) => l.drum!.body),
            texts: textsOf(part)
        }))
    if (run.every((l) => l.string)) return stringSystems(run, above)
    // Mixed: the string lines among them, each stretch on its own.
    const out: System[] = []
    let stretch: TabLine[] = []
    for (const l of [...run, null]) {
        if (l?.string) stretch.push(l)
        else {
            if (stretch.length) out.push(...stringSystems(stretch, out.length ? null : above))
            stretch = []
        }
    }
    return out
}

/** Groups of consecutive tab lines (highest string first, as tabs are written). */
function systemsOf(text: string): System[] {
    const systems: System[] = []
    let run: TabLine[] = []
    /** The line above the run (a palm mute line, maybe). */
    let above: string | null = null
    let previous: string | null = null
    for (const raw of text.split(/\r?\n/)) {
        const line = tabLineOf(raw)
        if (line) {
            if (!run.length) above = previous
            run.push(line)
        } else {
            systems.push(...systemsOfRun(run, above))
            run = []
        }
        previous = raw
    }
    systems.push(...systemsOfRun(run, above))
    return systems
}

/**
 * An alphaTex note (`fret.string`, `x.string` for a dead note, or a drum) and its effects; a
 * fretted note has its string, to tie it.
 */
interface TexNote {
    tex: string
    effects: string[]
    string?: number
}

/** A beat: its notes and the column it starts at. */
interface Beat {
    notes: TexNote[]
    col: number
}

/** A bar: its beats, and its columns from `start` to `end` (bar lines excluded). */
interface Bar {
    beats: Beat[]
    start: number
    end: number
}

/**
 * A system's bars: bar lines and repeat signs (|: :|) split them; a bar of dashes only has no
 * beats (a rest bar). `beatAt` reads a column's beat, and how many extra columns it took.
 */
function barsOf(
    lines: string[],
    beatAt: (padded: string[], col: number) => { beat: TexNote[]; skip: number; at?: number }
): Bar[] {
    const width = Math.max(...lines.map((l) => l.length))
    const padded = lines.map((l) => l.padEnd(width, '-'))
    const bars: Bar[] = []
    let beats: Beat[] = []
    let filled = false
    let start = 0
    for (let col = 0; col < width; col++) {
        if (padded.every((l) => l[col] === '|' || l[col] === ':')) {
            if (filled) bars.push({ beats, start, end: col })
            beats = []
            filled = false
            start = col + 1
            continue
        }
        // Spaces between bar lines (`|  |`) aren't a bar.
        if (padded.some((l) => l[col] !== ' ')) filled = true
        const { beat, skip, at } = beatAt(padded, col)
        if (beat.length) beats.push({ notes: beat, col: at ?? col })
        col += skip
    }
    if (filled) bars.push({ beats, start, end: width })
    return bars
}

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'

/** Frets two digits wide: 10 to 24 (`65` is 6 then 5, `00` two open strings). */
const twoDigits = (a: string | undefined, b: string | undefined) =>
    (a === '1' || a === '2') && isDigit(b) && Number(a + b) <= 24

/** A string line read in one pass (see `techniquesOf`). */
interface StringLine {
    /** The frets starting at each column: the fret, and the columns it takes. */
    frets: Map<number, { fret: number; width: number }>
    /** The alphaTex effects of the note starting at each column. */
    effects: Map<number, string[]>
}

/**
 * A string line's frets and techniques, read in one pass. `8b10r8p5`: 8 bent a whole tone and
 * released, then pulled off to 5 (a bend's target and its release are not notes; `7^9` bends
 * too). `5h7`, `7p5` hammer-on and pull-off; `5/7`, `7\5`, `5s7` slides (`/5` slides in from
 * below, `\5` from above, `5/` out upwards, `5\` downwards); `~` or `v` vibrato; `<12>` a natural
 * harmonic.
 */
export function techniquesOf(body: string): StringLine {
    const frets = new Map<number, { fret: number; width: number }>()
    const effects = new Map<number, string[]>()
    const hidden = new Set<number>()
    /** A fret written at `at` (`10` or `(10)`), not a note; null when there's none. */
    const target = (at: number): { fret: number | null; next: number } => {
        let j = at
        const open = body[j] === '('
        if (open) j++
        if (!isDigit(body[j])) return { fret: null, next: at }
        const width = twoDigits(body[j], body[j + 1]) ? 2 : 1
        const fret = Number(body.slice(j, j + width))
        for (let w = 0; w < width; w++) hidden.add(j + w)
        j += width
        if (open && body[j] === ')') j++
        return { fret, next: j }
    }
    for (let i = 0; i < body.length;) {
        if (!isDigit(body[i]) || hidden.has(i)) {
            i++
            continue
        }
        const width = twoDigits(body[i], body[i + 1]) ? 2 : 1
        const fret = Number(body.slice(i, i + width))
        frets.set(i, { fret, width })
        const fx: string[] = []
        const before = body[i - 1]
        let k = i + width
        if (before === '<' && body[k] === '>') {
            fx.push('nh')
            k++
        } else if ((before === '/' || before === '\\') && !/[\d)>]/.test(body[i - 2] ?? '-'))
            fx.push(before === '/' ? 'sib' : 'sia')
        // A bend (b or ^) to its target fret (a whole tone when none is written), maybe released.
        if (body[k] === 'b' || body[k] === '^') {
            const up = target(k + 1)
            k = up.next
            const semitones = up.fret !== null && up.fret > fret ? Math.min(up.fret - fret, 4) : 2
            const points = [0, semitones * 2]
            if (body[k] === 'r') {
                const down = target(k + 1)
                k = down.next
                const back = down.fret === null ? 0 : (down.fret - fret) * 2
                points.push(Math.min(points[1]!, Math.max(0, back)))
            }
            fx.push(`b (${points.join(' ')})`)
        }
        if (body[k] === '~' || body[k] === 'v') {
            fx.push('v')
            while (body[k] === '~' || body[k] === 'v') k++
        }
        const next = body[k]
        const onto = isDigit(body[k + 1]) || (body[k + 1] === '(' && isDigit(body[k + 2]))
        if ((next === 'h' || next === 'p') && onto) fx.push('h')
        else if (next === '/' || next === '\\' || next === 's') {
            if (onto) fx.push('sl')
            else if (next !== 's') fx.push(next === '/' ? 'sou' : 'sod')
        }
        if (fx.length) effects.set(i, fx)
        i += width
    }
    return { frets, effects }
}

/**
 * A column of a string system: its notes (string from 1, the highest, or line `i`'s string
 * `numbers[i]`), `x` a dead note, with the effects `techniquesOf` found and palm mute (`pm`) in
 * the muted ranges.
 */
const stringBeatAt =
    (lines: StringLine[], muted: Set<number>, numbers: number[] = []) =>
    (padded: string[], col: number): { beat: TexNote[]; skip: number; at: number } => {
        const beat: TexNote[] = []
        const strings = new Set<number>()
        /** Where the beat starts: a harmonic's `<` before its fret. */
        let start = col
        let wide = false
        /** The note starting at `at` on line `i`, if any. */
        const read = (i: number, at: number) => {
            const c = padded[i]![at]
            const pm = muted.has(at) ? ['pm'] : []
            if (c === 'x' || c === 'X') {
                beat.push({ tex: `x.${numbers[i] ?? i + 1}`, effects: pm })
                strings.add(i)
                return
            }
            const note = lines[i]!.frets.get(at)
            if (!note) return
            if (note.width === 2 && at === col) wide = true
            if (padded[i]![at - 1] === '<') start = Math.min(start, at - 1)
            beat.push({
                tex: `${note.fret}.${numbers[i] ?? i + 1}`,
                effects: [...(lines[i]!.effects.get(at) ?? []), ...pm],
                string: numbers[i] ?? i + 1
            })
            strings.add(i)
        }
        padded.forEach((_, i) => read(i, col))
        // Two-digit frets take two columns: a fret written one column right on another string
        // (right-aligned under a 12) belongs to the same beat.
        if (wide) padded.forEach((_, i) => strings.has(i) || read(i, col + 1))
        return { beat, skip: wide ? 1 : 0, at: start }
    }

/** Usual tunings by string count, highest string first (MIDI), for tabs without string names. */
const BY_COUNT: Record<number, number[]> = {
    3: [64, 59, 55],
    4: [43, 38, 33, 28],
    5: [43, 38, 33, 28, 23],
    6: [64, 59, 55, 50, 45, 40],
    7: [64, 59, 55, 50, 45, 40, 35]
}

/** Standard tuning by string number (1 the highest), up to an 8-string guitar. */
const BY_NUMBER = [64, 59, 55, 50, 45, 40, 35, 30]

/** Standard guitar, lowest string first. */
const GUITAR = { names: ['E', 'A', 'D', 'G', 'B', 'E'], midis: [40, 45, 50, 55, 59, 64] }

/** Basses tuned in fourths from E or B: an octave below a guitar. */
const BASS = ['E A D G', 'B E A D G']

/** A string name with its letter uppercase ("e" → "E", "bb" → "Bb"). */
const upper = (name: string) => name[0]!.toUpperCase() + name.slice(1)

/**
 * The tuning a system's string names say (highest string first, as tabs are written), highest
 * first; null when unknown (alphaTex's default, standard guitar).
 */
function tuningOf(names: (string | null)[]): number[] | null {
    const strings = names.length
    if (names.every((n) => n !== null && /^\d$/.test(n)))
        return names.every((n) => BY_NUMBER[Number(n) - 1])
            ? names.map((n) => BY_NUMBER[Number(n) - 1]!)
            : null
    if (names.every((n) => n !== null && /^[A-Ga-g]/.test(n))) {
        const lowFirst = [...(names as string[])].reverse()
        const spelled = lowFirst.map(upper).join(' ')
        if (BASS.includes(spelled))
            return parseTuning(spelled)!
                .map((m) => m - 12)
                .reverse()
        // Strings of a standard guitar (e B G D, the top four; A D G): their guitar octaves. A
        // lone E is the high one when written "e".
        const starts = [...GUITAR.names.keys()].filter((start) =>
            lowFirst.every((n, i) => GUITAR.names[start + i] === upper(n))
        )
        if (starts.length) {
            const start = starts.length > 1 && lowFirst[0] === 'e' ? starts.at(-1)! : starts[0]!
            return GUITAR.midis.slice(start, start + strings).reverse()
        }
        if (strings === 1) {
            // A lone string with another name: in the guitar's middle octave (C3 to B3).
            const chroma = chromaOf(upper(names[0]!))
            return chroma === null ? null : [48 + ((chroma - 48 + 120) % 12)]
        }
        const tuning = parseTuning(spelled)
        if (tuning) return tuning.reverse()
    }
    return BY_COUNT[strings] ?? null
}

/**
 * A six-string guitar with a lone string on it (as MIDI): standard tuning, the string where a
 * standard guitar has it, else in place of the nearest one. The tuning, highest first, and the
 * string's number.
 */
function onGuitar(midi: number): { tuning: number[]; string: number } {
    const tuning = [...BY_COUNT[6]!]
    let index = tuning.indexOf(midi)
    if (index < 0) {
        index = tuning.reduce(
            (best, m, i) => (Math.abs(m - midi) < Math.abs(tuning[best]! - midi) ? i : best),
            0
        )
        tuning[index] = midi
    }
    return { tuning, string: index + 1 }
}

/**
 * Strings of a standard guitar (as MIDI, highest first) on a six-string guitar (#71): a lone string
 * (see onGuitar), or 2 to 5 neighbouring strings in their places (e B G D are strings 1 to 4, A E
 * strings 5 and 6), so an excerpt shows a guitar's staff. The tuning, highest first, and each
 * string's number; null for other tunings (basses, 7-string guitars, open tunings).
 */
function placedOnGuitar(tuning: number[]): { tuning: number[]; strings: number[] } | null {
    if (tuning.length === 1) {
        const { tuning: six, string } = onGuitar(tuning[0]!)
        return { tuning: six, strings: [string] }
    }
    const standard = BY_COUNT[6]!
    if (tuning.length > 5) return null
    const at = tuning.map((m) => standard.indexOf(m))
    if (at[0]! < 0 || at.some((i, k) => i !== at[0]! + k)) return null
    return { tuning: [...standard], strings: at.map((i) => i + 1) }
}

/** A column of a drum system: its hits, as alphaTex notes. */
const drumBeatAt =
    (drums: Drum[]) =>
    (padded: string[], col: number): { beat: TexNote[]; skip: number } => {
        const beat: TexNote[] = []
        padded.forEach((line, i) => {
            const hit = line[col]!
            if (!/[xXoOgfdb#@*+]/.test(hit)) return
            const name = articulationOf(drums[i]!, hit)
            if (!beat.some((n) => n.tex === name)) beat.push({ tex: name, effects: effectOf(hit) })
        })
        return { beat, skip: 0 }
    }

/** Note values by length in sixteenths, longest first: sixteenths, alphaTex duration, dotted. */
const VALUES: [number, number, boolean][] = [
    [24, 1, true],
    [16, 1, false],
    [12, 2, true],
    [8, 2, false],
    [6, 4, true],
    [4, 4, false],
    [3, 8, true],
    [2, 8, false],
    [1, 16, false]
]

/** A length in sixteenths as note values: the longest that fits, then what's left. */
function valuesOf(sixteenths: number): { duration: number; dotted: boolean }[] {
    const out: { duration: number; dotted: boolean }[] = []
    for (let left = sixteenths; left > 0;) {
        const [length, duration, dotted] = VALUES.find(([n]) => n <= left)!
        out.push({ duration, dotted })
        left -= length
    }
    return out
}

/**
 * A meter: its time signature, a bar's and a beat's length in sixteenths, and the grids a bar's
 * beats may sit on (divisions of the bar), coarsest first.
 */
export interface Meter {
    ts: [number, number]
    length: number
    beat: number
    grids: number[]
}

/** 4/4: whole notes to sixteenths. */
const COMMON: Meter = { ts: [4, 4], length: 16, beat: 4, grids: [1, 2, 4, 8, 16] }
/** 3/4: a dotted half, quarters, eighths, sixteenths. */
const THREE_FOUR: Meter = { ts: [3, 4], length: 12, beat: 4, grids: [1, 3, 6, 12] }
/** 6/8: a dotted half, dotted quarters, eighths, sixteenths. */
const SIX_EIGHT: Meter = { ts: [6, 8], length: 12, beat: 6, grids: [1, 2, 6, 12] }
/** 12/8: a dotted whole, dotted halves, dotted quarters, eighths, sixteenths. */
const TWELVE_EIGHT: Meter = { ts: [12, 8], length: 24, beat: 6, grids: [1, 2, 4, 12, 24] }

/**
 * True when beats `cols` apart keep their spacing at positions `at`: equal gaps the same length,
 * a wider gap no shorter.
 */
function keepsSpacing(cols: number[], at: number[]): boolean {
    const lengths = new Map<number, number>()
    for (let i = 1; i < cols.length; i++) {
        const gap = cols[i]! - cols[i - 1]!
        const length = at[i]! - at[i - 1]!
        if ((lengths.get(gap) ?? length) !== length) return false
        lengths.set(gap, length)
    }
    const sorted = [...lengths].sort((a, b) => a[0] - b[0])
    return sorted.every(([, length], i) => i === 0 || length >= sorted[i - 1]![1])
}

/** Lengths a note value has, in sixteenths (others need a tie). */
const PLAIN = new Set(VALUES.map(([n]) => n))

/**
 * Tries to fit a bar's beats (their columns) to `n` divisions of the bar, the bar running
 * `span` columns from `origin`: within `slack` columns of the grid, distinct, before the bar's
 * end, keeping their spacing, and without ties unless `ties` (then on whole columns only). Their
 * positions in sixteenths and the worst distance to the grid; null when they don't fit.
 */
function fit(
    cols: number[],
    n: number,
    [origin, span]: [number, number],
    slack: number,
    ties: boolean,
    bar: number
): { at: number[]; error: number } | null {
    const step = span / n
    // Ties only on a grid that falls on columns (a tab written a sixteenth a column, say).
    if (step < 1 || (ties && !Number.isInteger(step))) return null
    const at: number[] = []
    let error = 0
    for (const col of cols) {
        const exact = (col - origin) / step
        const k = Math.round(exact)
        const off = Math.abs(exact - k) * step
        // A column off is 1.0000000000000004 off once divided and multiplied back.
        if (k < 0 || k >= n || off > slack + 1e-9 || (at.length && k * (bar / n) <= at.at(-1)!))
            return null
        error = Math.max(error, off)
        at.push(k * (bar / n))
    }
    if (!ties && at.some((p, i) => !PLAIN.has((at[i + 1] ?? bar) - p))) return null
    return keepsSpacing(cols, at) ? { at, error } : null
}

/**
 * Where a bar's beats fall, in sixteenths from its start, read from their columns (from the bar's
 * start), on the coarsest grid of a bar of `meter` (4/4: whole notes to sixteenths) that fits: first within
 * 0.4 of a column and with plain note values, then within a column (a tab written a column off),
 * then on a grid that falls on columns, with ties. A grid step is a column wide at least, and
 * equal gaps get equal lengths. The bar runs from `pad` (the dashes every bar starts with) to
 * its end, or `pad` columns less; from fewer dashes than `pad` to its end (a bar that starts with
 * a rest); when the first beat comes later, from its start too (a rest first). Null when nothing
 * fits (a sketch, not a rhythm).
 */
export function positionsOf(
    cols: number[],
    width: number,
    pad: number,
    meter: Meter = COMMON
): number[] | null {
    if (!cols.length) return []
    const spans: [number, number][] = [
        [pad, width - pad],
        [pad, width]
    ]
    // Fewer dashes before the bar than the row's pad (#71): a bar whose first beat is a rest
    // can't show how many dashes start it, so every count up to the pad is tried, and the one
    // that fits the grid best keeps the same columns on the same beats bar after bar.
    for (let start = 1; start < pad; start++) spans.push([start, width - start])
    if (cols[0]! > pad) spans.push([0, width])
    for (const [slack, ties] of [
        [0.4, false],
        [1, false],
        [0.4, true]
    ] as const)
        for (const n of meter.grids) {
            const fits = spans
                .map((span) => fit(cols, n, span, slack, ties, meter.length))
                .filter((f) => f !== null)
            if (fits.length) return fits.reduce((a, b) => (b.error < a.error ? b : a)).at
        }
    return null
}

/** A bar's events: a beat (its index) or a rest (-1), and its length in sixteenths. */
export type Rhythm = { beat: number; sixteenths: number }[]

/**
 * Rests from `at` sixteenths to `end` (the end of the bar), showing the beats: up to the next
 * eighth, eighths up to the next beat, then a rest a beat long (two beats on the first or middle
 * beat of a four-beat bar: r8 r4 r2 in 4/4, r8 r4. in 6/8).
 */
function restsFrom(at: number, meter: Meter, end = meter.length): Rhythm {
    const out: Rhythm = []
    const { beat, length: bar } = meter
    for (let p = at; p < end;) {
        const half = bar === 4 * beat && p % (2 * beat) === 0 && p <= bar / 2 ? [2 * beat] : []
        const lengths = p % 2 ? [1] : p % beat ? [2, 1] : [...half, beat, 2, 1]
        const length = lengths.find((n) => n <= end - p)!
        out.push({ beat: -1, sixteenths: length })
        p += length
    }
    return out
}

/**
 * A bar's rhythm when no grid fits its columns (see positionsOf): the bar's most frequent gap
 * between beats is an eighth (a sixteenth when eighths overrun the bar), other gaps a whole number
 * of them (one at least), the last beat one, and rests fill the rest of the bar (4/4 unless
 * `meter` says). Before eighths give way to sixteenths, the hammer-ons, pull-offs and slides
 * (`legato`: the beats that lead on to the next one) take one eighth for both notes of the pair,
 * a sixteenth each, as many pairs as the bar needs, first ones first (#71): the letter written
 * between the two frets takes a column that isn't time. Every beat a sixteenth when even that is
 * too long.
 */
export function sketchRhythmOf(
    cols: number[],
    meter: Meter = COMMON,
    legato: readonly number[] = []
): Rhythm {
    const gaps = cols.slice(1).map((c, i) => c - cols[i]!)
    const counts = new Map<number, number>()
    for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1)
    // The most frequent gap, the narrowest when two are as frequent.
    const unit = [...counts].reduce<[number, number] | null>(
        (best, e) => (!best || e[1] > best[1] || (e[1] === best[1] && e[0] < best[0]) ? e : best),
        null
    )?.[0]
    for (const eighth of [2, 1]) {
        const lengths = cols.map(
            (_, i) => eighth * (i < gaps.length ? Math.max(1, Math.round(gaps[i]! / unit!)) : 1)
        )
        let total = lengths.reduce((a, b) => a + b, 0)
        if (eighth === 2)
            for (const i of legato) {
                if (total <= meter.length) break
                if (i + 1 >= lengths.length || lengths[i] !== 2) continue
                // The pair's second note starts a sixteenth earlier, and the beats after it an
                // eighth earlier.
                const next = Math.max(1, lengths[i + 1]! - 1)
                total -= 1 + lengths[i + 1]! - next
                lengths[i] = 1
                lengths[i + 1] = next
            }
        if (total > meter.length) continue
        return [
            ...lengths.map((sixteenths, beat) => ({ beat, sixteenths })),
            ...restsFrom(total, meter)
        ]
    }
    return cols.map((_, beat) => ({ beat, sixteenths: 1 }))
}

/** Effects that lead on to the next beat: a hammer-on or pull-off, a slide into the next note. */
const LEGATO = new Set(['h', 'sl'])

/** The beats that lead on to the next one with a hammer-on, a pull-off or a slide. */
const legatoOf = (beats: Beat[]) =>
    beats.flatMap((b, i) => (b.notes.some((n) => n.effects.some((e) => LEGATO.has(e))) ? [i] : []))

/** A bar to write: its beats (columns from its start), its width, and how its length is read. */
interface Measure {
    beats: Beat[]
    width: number
    /** The dashes its row writes before beat 1 (see padOf). */
    pad: number
    /**
     * `whole`: a bar, as long as its width; `start` or `end`: a bar's start or end (a fragment
     * that joins no other), a bar the tab's typical width long.
     */
    part: 'whole' | 'start' | 'end'
    /** The tab's first bar, a pickup (an anacrusis): its beats only, no rests before them. */
    pickup: boolean
    text: string | null
}

/**
 * A bar's rhythm from its columns (see positionsOf), else a sketch's (see sketchRhythmOf). The
 * start or end of a bar is placed in a bar of the tab's `typical` width.
 */
function rhythmOf(m: Measure, typical: number, meter: Meter): Rhythm {
    const bar = meter.length
    const span = m.part === 'whole' ? m.width : typical
    const shift = m.part === 'end' ? typical - m.width : 0
    const cols = m.beats.map((b) => b.col + shift)
    if (m.part === 'start' && cols.length) {
        // A bar's start: its last beat lasts to the fragment's end, rests fill the bar.
        const at = positionsOf([...cols, m.width], span, m.pad, meter)
        if (at) {
            const end = at.pop()!
            const out: Rhythm = at[0]! > 0 ? [{ beat: -1, sixteenths: at[0]! }] : []
            at.forEach((p, beat) => out.push({ beat, sixteenths: (at[beat + 1] ?? end) - p }))
            return [...out, ...restsFrom(end, meter)]
        }
    }
    const at = positionsOf(cols, span, m.pad, meter)
    if (!at) {
        const sketch = sketchRhythmOf(
            m.beats.map((b) => b.col),
            meter,
            legatoOf(m.beats)
        )
        if (m.part !== 'end') return sketch
        const notes = sketch.filter((e) => e.beat >= 0)
        const total = notes.reduce((sum, e) => sum + e.sixteenths, 0)
        return m.pickup ? notes : [...restsFrom(0, meter, bar - total), ...notes]
    }
    const first = at[0]!
    const out: Rhythm =
        first === 0 || m.pickup
            ? []
            : m.part === 'end'
              ? restsFrom(0, meter, first)
              : [{ beat: -1, sixteenths: first }]
    at.forEach((p, beat) => out.push({ beat, sixteenths: (at[beat + 1] ?? bar) - p }))
    return out
}

/** The dashes a system writes before beat 1 of a bar: the fewest before a first beat, 3 at most. */
const padOf = (bars: Bar[]) =>
    bars.reduce((pad, b) => (b.beats.length ? Math.min(pad, b.beats[0]!.col - b.start) : pad), 3)

/** A system's bars, as read. */
interface Row {
    bars: Bar[]
    /** The dashes its bars start with (see padOf). */
    pad: number
    texts: string[]
    /** No bar line before its first bar (`e ---3|5---`), or after its last (`|0---`). */
    openStart: boolean
    openEnd: boolean
}

function rowOf(lines: string[], bars: Bar[], texts: string[], openStart: boolean): Row {
    const width = Math.max(...lines.map((l) => l.length))
    return {
        bars,
        pad: padOf(bars),
        texts,
        openStart: openStart && bars[0]?.start === 0,
        openEnd: bars.at(-1)?.end === width
    }
}

/**
 * A typical bar's width in columns: the median (the upper one) of the bars with notes and a bar
 * line on each side. Null when there are fewer than two: fragments can't be told apart then.
 */
function typicalWidth(rows: Row[]): number | null {
    const widths: number[] = []
    for (const row of rows)
        row.bars.forEach((bar, i) => {
            const closed = (i > 0 || !row.openStart) && (i < row.bars.length - 1 || !row.openEnd)
            if (closed && bar.beats.length) widths.push(bar.end - bar.start)
        })
    if (widths.length < 2) return null
    widths.sort((a, b) => a - b)
    return widths[widths.length >> 1]!
}

/** The most frequent of `values`, the smallest when two are as frequent; undefined when none. */
function mostFrequent(values: number[]): { value: number; count: number } | undefined {
    const counts = new Map<number, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    let best: { value: number; count: number } | undefined
    for (const [value, count] of counts)
        if (!best || count > best.count || (count === best.count && value < best.value))
            best = { value, count }
    return best
}

/**
 * The tab's meter, from its typical bars: a bar line on each side, notes, and the typical width
 * (a column more or less). The narrowest gap between their beats at least half as frequent as
 * the most frequent one is a unit; a bar holds as
 * many units as fit its width (half a unit left over is no unit), or up to its last beat. When
 * 2/3 of the typical bars, their beats on the units (within 0.4 column), hold the same count
 * (two bars at least): 3 units are 3/4; 6 are 6/8, or 3/4 when more bars group them in twos than
 * in threes (beats only on units 0 2 4 or 0 3, or bass notes, the lowest string's when it doesn't
 * sound on every beat, so); 12 are 12/8. Else, or with any other count, 4/4.
 */
function meterOf(rows: Row[], typical: number | null): Meter {
    if (typical === null) return COMMON
    const bars: { bar: Bar; pad: number }[] = []
    for (const row of rows)
        row.bars.forEach((bar, i) => {
            const closed = (i > 0 || !row.openStart) && (i < row.bars.length - 1 || !row.openEnd)
            const width = bar.end - bar.start
            if (closed && bar.beats.length && Math.abs(width - typical) <= 1)
                bars.push({ bar, pad: row.pad })
        })
    const gaps = new Map<number, number>()
    for (const { bar } of bars)
        for (let i = 1; i < bar.beats.length; i++) {
            const gap = bar.beats[i]!.col - bar.beats[i - 1]!.col
            gaps.set(gap, (gaps.get(gap) ?? 0) + 1)
        }
    // The narrowest gap at least half as frequent as the most frequent one (a shuffle's eighths).
    const top = Math.max(0, ...gaps.values())
    const unit = Math.min(...[...gaps].filter(([, n]) => n * 2 >= top).map(([gap]) => gap))
    if (bars.length < 2 || !Number.isFinite(unit)) return COMMON
    const counts: number[] = []
    /** Bars grouping six units in twos (3/4) and in threes (6/8). */
    let twos = 0
    let threes = 0
    for (const { bar, pad } of bars) {
        const exact = bar.beats.map((b) => (b.col - bar.start - pad) / unit)
        if (exact.some((u) => Math.abs(u - Math.round(u)) * unit > 0.4 + 1e-9)) {
            counts.push(0)
            continue
        }
        const at = exact.map(Math.round)
        const count = Math.max(Math.ceil((bar.end - bar.start - pad) / unit - 0.5), at.at(-1)! + 1)
        counts.push(count)
        if (count !== 6) continue
        const lowest = bar.beats.reduce(
            (low, b) => b.notes.reduce((l, n) => Math.max(l, n.string ?? 0), low),
            0
        )
        const bass = at.filter((_, i) => bar.beats[i]!.notes.some((n) => n.string === lowest))
        for (const group of [at, bass.length < at.length ? bass : []]) {
            if (group.some((u) => u !== 0 && u % 2 === 0) && group.every((u) => u % 2 === 0)) twos++
            else if (group.includes(3) && group.every((u) => u % 3 === 0)) threes++
        }
    }
    const most = mostFrequent(counts)!
    if (most.count * 3 < bars.length * 2) return COMMON
    if (most.value === 3) return THREE_FOUR
    if (most.value === 6) return twos > threes ? THREE_FOUR : SIX_EIGHT
    return most.value === 12 ? TWELVE_EIGHT : COMMON
}

/**
 * The bars to write, joining bars split across rows (#70). A fragment is a bar 2/3 of a typical
 * bar wide at most. A row's last bar, a fragment, joins the next row's first bar when no bar line
 * ends the row (without notes, it's left out then), or when that bar is a fragment too and no bar
 * line starts its row or the two are a typical bar wide at most (a quarter more). A fragment before
 * a row's first bar line that joins nothing is a bar's end (a pickup into the next bar); the tab's
 * first bar, a fragment, is a pickup bar; a row's last bar, a fragment without a bar line after
 * it, that joins nothing is a bar's start.
 */
function measuresOf(rows: Row[], typical: number | null): Measure[] {
    const short = (width: number) => typical !== null && width <= (typical * 2) / 3
    const out: Measure[] = []
    /** A row's last bar, joining the next row's first bar. */
    let carry: Measure | null = null
    rows.forEach((row, r) => {
        const before = out.length
        const next = rows[r + 1]
        row.bars.forEach((bar, i) => {
            const beats = bar.beats.map((b) => ({ notes: b.notes, col: b.col - bar.start }))
            let m: Measure = {
                beats,
                width: bar.end - bar.start,
                pad: row.pad,
                part: 'whole',
                pickup: false,
                text: null
            }
            const joined = i === 0 && carry !== null
            if (carry && i === 0) {
                // The next row's dashes before beat 1 aren't time.
                const shift = carry.width - row.pad
                m = {
                    ...carry,
                    beats: [
                        ...carry.beats,
                        ...beats.map((b) => ({ notes: b.notes, col: b.col + shift }))
                    ],
                    width: carry.width + m.width - row.pad
                }
                carry = null
            }
            if (i === row.bars.length - 1 && short(m.width)) {
                const after = next?.bars[0]
                const together = after ? m.width + after.end - after.start - next.pad : 0
                if (
                    after &&
                    (row.openEnd ||
                        (short(after.end - after.start) &&
                            (next.openStart || together <= typical! * 1.25)))
                ) {
                    if (m.beats.length || !row.openEnd) carry = m
                    return
                }
                if (row.openEnd && !joined) {
                    if (!m.beats.length) return
                    m.part = 'start'
                }
            }
            const first = !out.length
            if (i === 0 && !joined && m.part === 'whole' && short(m.width) && m.beats.length)
                if (first || row.openStart) {
                    m.part = 'end'
                    m.pickup = first
                }
            out.push(m)
        })
        const target = carry ?? (out.length > before ? out.at(-1)! : null)
        if (row.texts.length && target) {
            const text = row.texts.join(' / ')
            target.text = target.text ? `${target.text} / ${text}` : text
        }
    })
    return out
}

/**
 * Bars written without bar lines between them (#71): a bar whose columns fit no grid (see
 * positionsOf) and whose beats need more eighths than a bar of `meter` holds (its most frequent
 * gap an eighth, the narrowest when two are as frequent; each gap a whole number of them, one at
 * least; the last beat one), and is a bar and a half of them wide at least, is split into bars
 * of that many eighths, from its `pad`. A bar between
 * two beats with no beat of its own is a rest bar; the columns after the last beat's bar aren't a
 * bar. Each piece is then read as a bar of its own, so quarters and eighths keep their 2:1 gaps.
 */
function splitUnbarred(measures: Measure[], meter: Meter): Measure[] {
    return measures.flatMap((m) => {
        if (m.part !== 'whole' || m.beats.length < 2) return [m]
        const cols = m.beats.map((b) => b.col)
        if (positionsOf(cols, m.width, m.pad, meter)) return [m]
        const gaps = cols.slice(1).map((c, i) => c - cols[i]!)
        const unit = mostFrequent(gaps)!.value
        const eighths = gaps.reduce((sum, g) => sum + Math.max(1, Math.round(g / unit)), 1)
        const perBar = meter.length / 2
        const span = unit * perBar
        // A bar a little too full stays one bar (see sketchRhythmOf); a line a bar and a half
        // long at least is several.
        if (eighths <= perBar || m.width - m.pad < span * 1.5) return [m]
        const count = Math.floor((cols.at(-1)! - m.pad) / span) + 1
        // Each beat goes to one piece: the first whose end is past it, the last for the rest.
        // One pass over the beats, so a long line stays linear (filtering every beat for every
        // piece was quadratic). The edges are the same comparisons as `from` and `from + span`.
        const pieces: Beat[][] = Array.from({ length: count }, () => [])
        for (const b of m.beats) {
            let k = Math.min(count - 1, Math.max(0, Math.floor((b.col - m.pad) / span)))
            while (k < count - 1 && b.col >= m.pad + (k + 1) * span) k++
            while (k > 0 && b.col < m.pad + k * span) k--
            pieces[k]!.push({ notes: b.notes, col: b.col - k * span })
        }
        return pieces.map((beats, k): Measure => {
            return {
                beats,
                width: m.pad + span,
                pad: m.pad,
                part: 'whole',
                pickup: false,
                text: k === count - 1 ? m.text : null
            }
        })
    })
}

/** An alphaTex string: quotes and backslashes escaped. */
const quoted = (text: string) => `"${text.replace(/[\\"]/g, (c) => `\\${c}`)}"`

const withEffects = (tex: string, effects: string[]) =>
    effects.length ? `${tex}{${effects.join(' ')}}` : tex

/** A beat as alphaTex (a rest without notes), with its beat effects. */
function beatTex(notes: TexNote[], effects: string[]): string {
    if (!notes.length) return withEffects('r', effects)
    if (notes.length === 1) return withEffects(notes[0]!.tex, [...notes[0]!.effects, ...effects])
    return withEffects(`(${notes.map((n) => withEffects(n.tex, n.effects)).join(' ')})`, effects)
}

interface TexBar {
    beats: TexNote[][]
    rhythm: Rhythm
    text: string | null
    /** A pickup bar (alphaTex's `\\ac`). */
    pickup?: boolean
}

/** Effects that lead to the next note (hammer-on, pull-off, slides): on a tied note's end. */
const LINKS = new Set(['h', 'sl', 'sou', 'sod'])

/**
 * A beat's notes over `pieces` note values: the notes, then the fretted ones tied (`-.string`),
 * the effects that lead on to the next note on the last piece, palm mute on each; dead notes and
 * drums don't ring on, so a rest follows them.
 */
function tied(notes: TexNote[], pieces: number): TexNote[][] {
    if (pieces === 1) return [notes]
    const out = [notes.map((n) => ({ ...n, effects: n.effects.filter((e) => !LINKS.has(e)) }))]
    for (let piece = 1; piece < pieces; piece++)
        out.push(
            notes
                .filter((n) => n.string !== undefined)
                .map((n) => ({
                    tex: `-.${n.string}`,
                    effects: n.effects.filter(
                        (e) => e === 'pm' || (piece === pieces - 1 && LINKS.has(e))
                    )
                }))
        )
    return out
}

/**
 * Bars as alphaTex: each beat its length (a length no note value has is tied to the rest of it),
 * a whole rest for an empty bar, annotations on the last beat that sounds.
 */
function texOf(bars: TexBar[], meter: Meter): string {
    let duration = 0
    const out = bars.map(({ beats, rhythm, text, pickup }) => {
        const items: { notes: TexNote[]; duration: number; dotted: boolean }[] = []
        if (!beats.length)
            for (const value of meter === COMMON
                ? [{ duration: 1, dotted: false }]
                : valuesOf(meter.length))
                items.push({ notes: [], ...value })
        for (const { beat, sixteenths } of rhythm) {
            const values = valuesOf(sixteenths)
            const notes = tied(beat >= 0 ? beats[beat]! : [], values.length)
            values.forEach((value, i) => items.push({ notes: notes[i]!, ...value }))
        }
        let annotated = items.length - 1
        while (annotated > 0 && !items[annotated]!.notes.length) annotated--
        if (!items[annotated]!.notes.length) annotated = items.length - 1
        const tex = items
            .map((item, i) => {
                const effects = item.dotted ? ['d'] : []
                if (text && i === annotated) effects.push(`txt ${quoted(text)}`)
                const head = item.duration === duration ? '' : `:${item.duration} `
                duration = item.duration
                return head + beatTex(item.notes, effects)
            })
            .join(' ')
        return pickup ? `\\ac ${tex}` : tex
    })
    return out.join(' |\n')
}

/**
 * alphaTex for a plain-text tab; null when no tab lines are found. String lines are mostly dashes
 * with a bar line or a name; one named line is enough, unnamed ones need three. A drum tab becomes
 * a percussion track. Staves with no notes become empty bars (whole rests), so a blank stave
 * reads as one to fill. The tuning is written when the strings aren't a standard guitar's.
 */
export function textTabToAlphaTex(text: string): string | null {
    const systems = systemsOf(text)
    const first = systems[0]
    if (!first) return null
    let tuning = first.kind === 'strings' ? tuningOf(first.names) : null
    // alphaTab draws no staff for one string, and a guitarist reads a few strings on a guitar's
    // staff: they go on a six-string guitar, each in its place.
    const placed = tuning ? placedOnGuitar(tuning) : null
    if (placed) tuning = placed.tuning
    const rows: Row[] = []
    if (first.kind === 'drums') {
        for (const s of systems)
            if (s.kind === 'drums')
                rows.push(rowOf(s.lines, barsOf(s.lines, drumBeatAt(s.drums)), s.texts, false))
    } else {
        const same = JSON.stringify(tuningOf(first.names))
        const strings = placed?.strings ?? []
        for (const s of systems) {
            if (s.kind !== 'strings' || JSON.stringify(tuningOf(s.names)) !== same) continue
            const beatAt = stringBeatAt(s.lines.map(techniquesOf), s.muted, strings)
            rows.push(rowOf(s.lines, barsOf(s.lines, beatAt), s.texts, s.openStart))
        }
    }
    const typical = typicalWidth(rows)
    const meter = meterOf(rows, typical)
    const bars: TexBar[] = splitUnbarred(measuresOf(rows, typical), meter).map((m) => ({
        beats: m.beats.map((b) => b.notes),
        rhythm: rhythmOf(m, typical ?? 0, meter),
        text: m.text,
        pickup: m.pickup
    }))
    if (!bars.length) return null
    const ts = meter === COMMON ? [] : [`\\ts ${meter.ts.join(' ')}`]
    if (first.kind === 'drums')
        return [
            '\\instrument percussion',
            '\\articulation defaults',
            ...ts,
            texOf(bars, meter)
        ].join('\n')
    const standard = tuning?.join(' ') === BY_COUNT[6]!.join(' ')
    const header =
        tuning && !standard ? [`\\tuning (${tuning.map((m) => noteOf(m)).join(' ')})`] : []
    return [...header, ...ts, texOf(bars, meter)].join('\n')
}
