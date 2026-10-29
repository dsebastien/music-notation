/**
 * Plain-text tabs (the kind pasted from the web) → alphaTex, so they draw and play as ```tab
 * blocks (#25). Durations aren't written in text tabs: every beat becomes an eighth note.
 */
import { parseTuning } from '../fretboard/tuning.js'
import { noteOf } from '../theory/pitch.js'

/** A tab line: an optional string name, then mostly dashes, frets and bar lines. */
const STRING_LINE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?[-0-9xX|:hpbrsvt/\\~^().*<>\s]*$/

/** A tab line: mostly dashes, and a bar line or a string name (a line of dashes alone is a rule). */
const isStringLine = (line: string) =>
    STRING_LINE.test(line) &&
    (line.match(/-/g)?.length ?? 0) >= 4 &&
    (line.includes('|') || /^\s*[A-Ga-g][#b]?\s*[-|:]/.test(line))

interface System {
    names: (string | null)[]
    lines: string[]
}

/** Groups of consecutive tab lines (highest string first, as tabs are written). */
function systemsOf(text: string): System[] {
    const systems: System[] = []
    let current: System | null = null
    for (const raw of text.split(/\r?\n/)) {
        if (isStringLine(raw)) {
            const m = /^\s*([A-Ga-g][#b]?)?\s*[|:]?/.exec(raw)!
            current ??= { names: [], lines: [] }
            current.names.push(m[1] ?? null)
            current.lines.push(raw.slice(m[0].length))
        } else if (current) {
            if (current.lines.length >= 4) systems.push(current)
            current = null
        }
    }
    if (current && current.lines.length >= 4) systems.push(current)
    return systems
}

/** One system's bars: each bar a list of beats, each beat its notes (fret, string from 1). */
function barsOf(lines: string[]): { fret: number; string: number }[][][] {
    const width = Math.max(...lines.map((l) => l.length))
    const padded = lines.map((l) => l.padEnd(width, '-'))
    const bars: { fret: number; string: number }[][][] = [[]]
    for (let col = 0; col < width; col++) {
        // Bar lines, repeat signs (|: :|) included.
        if (padded.every((l) => l[col] === '|' || l[col] === ':')) {
            if (bars[bars.length - 1]!.length) bars.push([])
            continue
        }
        const beat: { fret: number; string: number }[] = []
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
        if (beat.length) bars[bars.length - 1]!.push(beat)
        if (wide) col++
    }
    return bars.filter((b) => b.length)
}

/** Usual tunings by string count, lowest string first (MIDI), for tabs without string names. */
const BY_COUNT: Record<number, number[]> = {
    4: [28, 33, 38, 43],
    5: [23, 28, 33, 38, 43],
    7: [35, 40, 45, 50, 55, 59, 64]
}

/** Basses tuned in fourths from E or B: an octave below a guitar. */
const BASS = ['E A D G', 'B E A D G']

/**
 * The tuning a tab's string names say (highest string first, as tabs are written), lowest first;
 * null for standard guitar (alphaTex's default).
 */
function tuningOf(names: (string | null)[]): number[] | null {
    const strings = names.length
    if (names.every((n) => n !== null)) {
        const lowFirst = [...names].reverse()
        if (strings === 6 && lowFirst.join(' ').toLowerCase() === 'e a d g b e') return null
        const tuning = parseTuning(lowFirst.join(' '))
        if (!tuning) return BY_COUNT[strings] ?? null
        const bass = BASS.includes(lowFirst.map((n) => n.toUpperCase()).join(' '))
        return bass ? tuning.map((m) => m - 12) : tuning
    }
    return strings === 6 ? null : (BY_COUNT[strings] ?? null)
}

/**
 * alphaTex for a plain-text tab; null when no tab lines are found (four strings or more, mostly
 * dashes). The tuning is written when the string names aren't standard guitar.
 */
export function textTabToAlphaTex(text: string): string | null {
    const systems = systemsOf(text)
    if (!systems.length) return null
    const strings = systems[0]!.lines.length
    const names = systems[0]!.names
    const bars = systems.flatMap((s) => (s.lines.length === strings ? barsOf(s.lines) : []))
    if (!bars.length) return null
    const header: string[] = []
    const tuning = tuningOf(names)
    if (tuning)
        header.push(
            `\\tuning (${[...tuning]
                .reverse()
                .map((m) => noteOf(m))
                .join(' ')})`
        )
    const beat = (notes: { fret: number; string: number }[]) =>
        notes.length === 1
            ? `${notes[0]!.fret}.${notes[0]!.string}`
            : `(${notes.map((n) => `${n.fret}.${n.string}`).join(' ')})`
    const body = bars.map((bar) => bar.map(beat).join(' ')).join(' |\n')
    return [...header, `:8 ${body}`].join('\n')
}
