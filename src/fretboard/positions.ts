/**
 * Scale positions on a neck: the notes to play in one place, string by string.
 *
 * - Boxes: 2 notes per string, starting from the n-th scale note on the low string (5-note scales:
 *   the five pentatonic boxes).
 * - CAGED (7-note scales): the scale's pentatonic box n, plus the other scale notes, each on the
 *   string that keeps the hand in place. Box 1 starts on the root, the E shape; going up the neck
 *   come the D, C, A and G shapes.
 * - 3NPS: 3 notes per string, starting from the n-th scale degree.
 * Scales with no pentatonic inside (locrian, harmonic minor…) use 3NPS for their CAGED positions.
 */
import type { NoteSet } from '../theory/note-set.js'

export type PositionSystem = 'box' | 'caged' | '3nps'

/** One played note: string (lowest first) and fret. */
export interface Cell {
    string: number
    fret: number
}

export const CAGED_SHAPES = ['E', 'D', 'C', 'A', 'G'] as const

const MAJOR_PENTATONIC = ['1P', '2M', '3M', '5P', '6M']
const MINOR_PENTATONIC = ['1P', '3m', '4P', '5P', '7m']

/** The scale's chromas in scale order, root first. */
const chromasOf = (set: NoteSet) => set.members.map((m) => m.chroma)

/** Ascending pitches of the given chromas, from `start` on, `count` of them. */
function ascending(chromas: number[], start: number, count: number): number[] {
    const out: number[] = []
    for (let midi = start; out.length < count && midi < start + 12 * 8; midi++) {
        if (chromas.includes(((midi % 12) + 12) % 12)) out.push(midi)
    }
    return out
}

/** The fret of a chroma on the low string, at or above `from`. */
const fretOn = (open: number, chroma: number, from: number) => {
    let fret = from
    while ((open + fret) % 12 !== chroma) fret++
    return fret
}

/** Fills strings in order with `perString` notes each, from a sequence of ascending pitches. */
function fill(sequence: number[], tuning: number[], perString: number): Cell[] {
    const cells: Cell[] = []
    tuning.forEach((open, string) => {
        for (const midi of sequence.slice(string * perString, (string + 1) * perString)) {
            if (midi - open >= 0) cells.push({ string, fret: midi - open })
        }
    })
    return cells
}

/** How many positions a scale has in a system. */
export function positionCount(set: NoteSet, system: PositionSystem): number {
    if (system === '3nps') return set.members.length
    return 5
}

/** The pentatonic inside a 7-note scale, in scale order; null when it has none. */
function pentatonicOf(set: NoteSet): number[] | null {
    const intervals = set.members.map((m) => m.interval ?? '')
    for (const pentatonic of [MAJOR_PENTATONIC, MINOR_PENTATONIC]) {
        if (pentatonic.every((i) => intervals.includes(i))) {
            return set.members
                .filter((m) => pentatonic.includes(m.interval ?? ''))
                .map((m) => m.chroma)
        }
    }
    return null
}

/** The notes of position `n` (1-based); null when the scale or position doesn't fit the system. */
export function scalePosition(
    set: NoteSet,
    tuning: number[],
    system: PositionSystem,
    n: number
): Cell[] | null {
    if (set.root === null || n < 1 || n > positionCount(set, system)) return null
    const open = tuning[0]!
    const chromas = chromasOf(set)
    const notes = tuning.length * 3
    const nps =
        system === '3nps' || (system === 'caged' && chromas.length !== 5 && !pentatonicOf(set))
    const pentatonic = chromas.length === 5 ? chromas : pentatonicOf(set)
    if (!nps && !pentatonic) return null
    const startChroma = nps ? chromas[(n - 1) % chromas.length]! : pentatonic![(n - 1) % 5]!
    // The lowest octave where every note is on the neck (a box may reach a fret below its start).
    for (let start = fretOn(open, startChroma, 0); start <= 36; start += 12) {
        const cells = nps
            ? fill(ascending(chromas, open + start, notes), tuning, 3)
            : withOther(
                  fill(ascending(pentatonic!, open + start, tuning.length * 2), tuning, 2),
                  system === 'caged' && chromas.length !== 5 ? chromas : null,
                  tuning
              )
        if (cells && cells.every((c) => c.fret >= 0)) return cells
    }
    return null
}

/** A box as is, or with the other scale notes (CAGED); null when a note falls off the neck. */
function withOther(box: Cell[], chromas: number[] | null, tuning: number[]): Cell[] | null {
    // `fill` drops notes below the nut: a box missing some isn't on the neck.
    if (box.length < tuning.length * 2) return null
    return chromas ? withOtherNotes(box, chromas, tuning) : box
}

/**
 * Adds the scale notes the pentatonic box leaves out, between its notes, on the string that keeps
 * the hand inside the box's frets; a fret of stretch on either side only when neither string can.
 */
function withOtherNotes(box: Cell[], chromas: number[], tuning: number[]): Cell[] {
    const pitch = (c: Cell) => tuning[c.string]! + c.fret
    const min = Math.min(...box.map((c) => c.fret))
    const max = Math.max(...box.map((c) => c.fret))
    const out = [...box]
    const ordered = [...box].sort((a, b) => pitch(a) - pitch(b))
    const outside = (fret: number) => (fret < min ? min - fret : fret > max ? fret - max : 0)
    for (let i = 0; i + 1 < ordered.length; i++) {
        const below = ordered[i]!
        const above = ordered[i + 1]!
        for (let midi = pitch(below) + 1; midi < pitch(above); midi++) {
            if (!chromas.includes(midi % 12)) continue
            const onBelow = midi - tuning[below.string]!
            const onAbove = midi - tuning[above.string]!
            // The string that keeps the note closest to the box (the lower one on a tie).
            const string =
                below.string === above.string || onAbove < 0 || outside(onBelow) <= outside(onAbove)
                    ? below.string
                    : above.string
            out.push({ string, fret: midi - tuning[string]! })
        }
    }
    return out
}

/** Parses `position:` and `shape:` for a scale: the system and the position number. */
export function positionOf(
    positionText: string | undefined,
    shapeText: string | undefined
): { system: PositionSystem; n: number } | null {
    const shape = shapeText?.trim().toLowerCase()
    const n = positionText === undefined ? null : Number(positionText)
    if (positionText !== undefined && (!Number.isInteger(n) || n! < 1)) {
        throw new Error(`position must be a whole number from 1, got "${positionText}"`)
    }
    if (shape === undefined || shape === '') return n === null ? null : { system: 'box', n }
    if (shape === '3nps') return { system: '3nps', n: n ?? 1 }
    const caged = CAGED_SHAPES.findIndex((s) => s.toLowerCase() === shape.replace(/^caged\s*/, ''))
    if (caged >= 0) return { system: 'caged', n: caged + 1 }
    throw new Error(`Unknown shape "${shapeText}": use C, A, G, E, D or 3nps`)
}
