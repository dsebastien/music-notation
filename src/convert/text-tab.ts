/**
 * Plain-text tabs (the kind pasted from the web) → alphaTex, so they draw and play as ```tab
 * blocks (#25, #37). Durations aren't written in text tabs: every beat becomes an eighth note.
 * Guitar and bass tabs (strings named by letter, by number, or not at all; short excerpts on the
 * strings they show) and drum tabs (one line per drum: `HH|x-x-…`, `S |----o---`) are read;
 * text after a line's last bar line (`| let ring`) becomes an annotation.
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
const effectOf = (hit: string) => (hit === 'X' || hit === 'O' ? '{ac}' : hit === 'g' ? '{g}' : '')

interface TabLine {
    /** As a string line: its name (letter or number) and what follows it. */
    string: { name: string | null; body: string } | null
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
        string = { name: m[1] ?? null, body }
    let drum: TabLine['drum'] = null
    const d = DRUM_LINE.exec(line)
    const name = d ? d[1]!.toLowerCase().replace(/[ .-]/g, '') : ''
    const known = DRUM_NAMES.get(name)
    if (d && known && (d[2]!.match(/[^\s|:]/g)?.length ?? 0) >= 4)
        drum = { drum: known, name, body: d[2]!, lettered: /^[A-Ga-g]$/.test(d[1]!) }
    return string || drum ? { string, drum, text } : null
}

type System =
    | { kind: 'strings'; names: (string | null)[]; lines: string[]; texts: string[] }
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

/** A run of tab lines as string systems: named lines alone, unnamed ones in threes or more. */
function stringSystems(run: TabLine[]): System[] {
    return splitStrings(run).flatMap((part): System[] => {
        const names = part.map((l) => l.string!.name)
        if (part.length < 3 && names.some((n) => n === null)) return []
        const lines = part.map((l) => l.string!.body)
        return [{ kind: 'strings', names, lines, texts: textsOf(part) }]
    })
}

/**
 * A run of consecutive tab lines as systems. Drums when every line names a drum, and a name isn't
 * a string's (HH, S, BD) or a line has hits; B, C and F alone with dashes are strings.
 */
function systemsOfRun(run: TabLine[]): System[] {
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
    if (run.every((l) => l.string)) return stringSystems(run)
    // Mixed: the string lines among them, each stretch on its own.
    const out: System[] = []
    let stretch: TabLine[] = []
    for (const l of [...run, null]) {
        if (l?.string) stretch.push(l)
        else {
            if (stretch.length) out.push(...stringSystems(stretch))
            stretch = []
        }
    }
    return out
}

/** Groups of consecutive tab lines (highest string first, as tabs are written). */
function systemsOf(text: string): System[] {
    const systems: System[] = []
    let run: TabLine[] = []
    for (const raw of text.split(/\r?\n/)) {
        const line = tabLineOf(raw)
        if (line) run.push(line)
        else {
            systems.push(...systemsOfRun(run))
            run = []
        }
    }
    systems.push(...systemsOfRun(run))
    return systems
}

type Note = { fret: number; string: number }

/**
 * A system's bars: bar lines and repeat signs (|: :|) split them; each bar a list of beats (empty
 * for a bar of dashes only, a rest bar). `beatAt` reads a column's beat, and how many extra
 * columns it took.
 */
function barsOf<T>(
    lines: string[],
    beatAt: (padded: string[], col: number) => { beat: T[]; skip: number }
): T[][][] {
    const width = Math.max(...lines.map((l) => l.length))
    const padded = lines.map((l) => l.padEnd(width, '-'))
    const bars: T[][][] = []
    let beats: T[][] = []
    let filled = false
    for (let col = 0; col < width; col++) {
        if (padded.every((l) => l[col] === '|' || l[col] === ':')) {
            if (filled) bars.push(beats)
            beats = []
            filled = false
            continue
        }
        // Spaces between bar lines (`|  |`) aren't a bar.
        if (padded.some((l) => l[col] !== ' ')) filled = true
        const { beat, skip } = beatAt(padded, col)
        if (beat.length) beats.push(beat)
        col += skip
    }
    if (filled) bars.push(beats)
    return bars
}

/** A column of a string system: its notes (fret, string from 1). */
function stringBeatAt(padded: string[], col: number): { beat: Note[]; skip: number } {
    const beat: Note[] = []
    let wide = false
    padded.forEach((line, i) => {
        const c = line[col]!
        if (!/\d/.test(c) || /\d/.test(line[col - 1] ?? '')) return
        const two = /\d/.test(line[col + 1] ?? '') ? line.slice(col, col + 2) : c
        if (two.length === 2) wide = true
        beat.push({ fret: Number(two), string: i + 1 })
    })
    // Two-digit frets take two columns: a fret written one column right on another string
    // (right-aligned under a 12) belongs to the same beat.
    if (wide)
        padded.forEach((line, i) => {
            if (beat.some((n) => n.string === i + 1)) return
            const c = line[col + 1] ?? ''
            if (!/\d/.test(c) || /\d/.test(line[col] ?? '')) return
            const two = /\d/.test(line[col + 2] ?? '') ? line.slice(col + 1, col + 3) : c
            beat.push({ fret: Number(two), string: i + 1 })
        })
    return { beat, skip: wide ? 1 : 0 }
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

/** A column of a drum system: its hits, as alphaTex notes. */
const drumBeatAt =
    (drums: Drum[]) =>
    (padded: string[], col: number): { beat: string[]; skip: number } => {
        const beat: string[] = []
        padded.forEach((line, i) => {
            const hit = line[col]!
            if (!/[xXoOgfdb#@*+]/.test(hit)) return
            const name = articulationOf(drums[i]!, hit)
            if (!beat.some((n) => n.startsWith(name + '{') || n === name))
                beat.push(name + effectOf(hit))
        })
        return { beat, skip: 0 }
    }

/** An alphaTex string: quotes and backslashes escaped. */
const quoted = (text: string) => `"${text.replace(/[\\"]/g, (c) => `\\${c}`)}"`

/** Bars as alphaTex: eighth-note beats, a whole rest for an empty bar, annotations last. */
function texOf(bars: { beats: string[]; text: string | null }[]): string {
    let duration = 0
    const out = bars.map(({ beats, text }) => {
        const wanted = beats.length ? 8 : 1
        const items = beats.length ? [...beats] : ['r']
        if (text) items[items.length - 1] += `{txt ${quoted(text)}}`
        const head = wanted === duration ? '' : `:${wanted} `
        duration = wanted
        return head + items.join(' ')
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
    const bars: { beats: string[]; text: string | null }[] = []
    const add = (systemBars: string[][][], texts: string[]) => {
        const at = bars.length
        bars.push(...systemBars.map((b) => ({ beats: b.map(chord), text: null })))
        if (texts.length && bars.length > at) bars[bars.length - 1]!.text = texts.join(' / ')
    }
    const chord = (notes: string[]) => (notes.length === 1 ? notes[0]! : `(${notes.join(' ')})`)
    if (first.kind === 'drums') {
        for (const s of systems)
            if (s.kind === 'drums') add(barsOf(s.lines, drumBeatAt(s.drums)), s.texts)
        if (!bars.length) return null
        return ['\\instrument percussion', '\\articulation defaults', texOf(bars)].join('\n')
    }
    const tuning = tuningOf(first.names)
    const same = JSON.stringify(tuning)
    for (const s of systems) {
        if (s.kind !== 'strings' || JSON.stringify(tuningOf(s.names)) !== same) continue
        const noteBars = barsOf(s.lines, stringBeatAt)
        add(
            noteBars.map((bar) => bar.map((beat) => beat.map((n) => `${n.fret}.${n.string}`))),
            s.texts
        )
    }
    if (!bars.length) return null
    const standard = tuning?.join(' ') === BY_COUNT[6]!.join(' ')
    const header =
        tuning && !standard ? [`\\tuning (${tuning.map((m) => noteOf(m)).join(' ')})`] : []
    return [...header, texOf(bars)].join('\n')
}
