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
 * Major pentatonic positions can be numbered from the relative minor (`numbering: minor`), as many
 * courses do: position 1 is then the relative minor's box 1.
 *
 * Arpeggios (a chord's notes): CAGED positions are the chord tones of the CAGED position of the
 * root's major scale (natural minor for chords with a minor third), chord tones outside that scale
 * added on the string that keeps the hand in place.
 */
import { scaleNoteSet, type NoteSet } from '../theory/note-set.js'

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

/** A chord's notes (not a scale, not a list): positions are arpeggios. */
export const isArpeggio = (set: NoteSet): boolean =>
    set.root !== null && !set.scaleType && !set.list

/** A chord's own tones (a slash chord's bass outside the chord left out), root first. */
const chordTones = (set: NoteSet) =>
    set.members.filter((m) => m.interval !== null).map((m) => m.chroma)

/** How many positions a scale or chord has in a system. */
export function positionCount(set: NoteSet, system: PositionSystem): number {
    if (isArpeggio(set)) return 5
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

/** The highest fret a fretboard can show. */
export const MAX_FRET = 36

/** How positions are numbered: from the scale's root (default), or from the relative minor. */
export type Numbering = 'root' | 'minor'

/**
 * Where to draw a position and how it's numbered: `within` picks the lowest octave inside those
 * frets (else the lowest); `numbering: 'minor'` counts a major pentatonic's positions from its
 * relative minor.
 */
export interface PositionOptions {
    within?: [number, number]
    numbering?: Numbering
}

const isMajorPentatonic = (set: NoteSet) =>
    set.members.map((m) => m.interval).join(' ') === MAJOR_PENTATONIC.join(' ')

/** The relative minor's root, as the scale spells it (its 5th note: the 6th degree). */
export const relativeMinorOf = (set: NoteSet): string | undefined =>
    isMajorPentatonic(set) ? set.members[4]!.name : undefined

/**
 * Reads `numbering:` for a scale's positions. `minor` (or `relative minor`) only applies to major
 * pentatonic boxes and 3NPS positions; anywhere else it's an error that says where it applies.
 */
export function numberingOf(
    text: string | undefined,
    set: NoteSet,
    system: PositionSystem
): Numbering {
    const value = text?.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!value) return 'root'
    if (value !== 'minor' && value !== 'relative minor') {
        throw new Error(`numbering: use minor (positions from the relative minor), got "${text}"`)
    }
    if (!isMajorPentatonic(set)) {
        throw new Error(
            `numbering: minor is for major pentatonic positions (e.g. A major pentatonic), not ${set.title}`
        )
    }
    if (system === 'caged') {
        throw new Error('numbering: minor numbers boxes and 3nps positions, not CAGED shapes')
    }
    return 'minor'
}

/** Position `n` in a numbering, as numbered from the root (the relative minor's root is 5th). */
const fromRoot = (set: NoteSet, system: PositionSystem, n: number, numbering?: Numbering) =>
    numbering === 'minor' &&
    system !== 'caged' &&
    isMajorPentatonic(set) &&
    n >= 1 &&
    n <= positionCount(set, system)
        ? ((n + 3) % positionCount(set, system)) + 1
        : n

const lowestFret = (cells: Cell[]) => Math.min(...cells.map((c) => c.fret))
const highestFret = (cells: Cell[]) => Math.max(...cells.map((c) => c.fret))

/**
 * The notes of position `n` (1-based), in the lowest octave where every note is on the neck (or
 * the lowest one inside `within`); null when the scale or position doesn't fit the system.
 */
export function scalePosition(
    set: NoteSet,
    tuning: number[],
    system: PositionSystem,
    n: number,
    options: PositionOptions = {}
): Cell[] | null {
    const octaves = octavesOf(set, tuning, system, fromRoot(set, system, n, options.numbering))
    const within = options.within
    const inside = within
        ? octaves.find((cells) => lowestFret(cells) >= within[0] && highestFret(cells) <= within[1])
        : undefined
    return inside ?? octaves[0] ?? null
}

/**
 * Every position in neck order, position 1 first: the first in its lowest octave, each next one in
 * the lowest octave at or above the previous one (by their lowest frets), or in its own lowest
 * octave when that would go past fret 36 (or `maxFret`: a capo leaves fewer frets). Null for a
 * position that doesn't fit the system.
 * With `numbering: 'minor'`, a major pentatonic starts from its relative minor's box 1.
 */
export function neckPositions(
    set: NoteSet,
    tuning: number[],
    system: PositionSystem,
    numbering: Numbering = 'root',
    maxFret: number = MAX_FRET
): (Cell[] | null)[] {
    let floor = 0
    return Array.from({ length: positionCount(set, system) }, (_, i) => {
        const octaves = octavesOf(set, tuning, system, fromRoot(set, system, i + 1, numbering))
        const cells =
            octaves.find((c) => lowestFret(c) >= floor && highestFret(c) <= maxFret) ??
            octaves[0] ??
            null
        if (cells) floor = lowestFret(cells)
        return cells
    })
}

/** Position `n` in each octave where every note is on the neck, lowest first. */
function octavesOf(set: NoteSet, tuning: number[], system: PositionSystem, n: number): Cell[][] {
    if (set.root === null || n < 1 || n > positionCount(set, system)) return []
    if (isArpeggio(set)) return arpeggioOctaves(set, tuning, system, n)
    const open = tuning[0]!
    const chromas = chromasOf(set)
    const notes = tuning.length * 3
    const nps =
        system === '3nps' || (system === 'caged' && chromas.length !== 5 && !pentatonicOf(set))
    const pentatonic = chromas.length === 5 ? chromas : pentatonicOf(set)
    if (!nps && !pentatonic) return []
    const startChroma = nps ? chromas[(n - 1) % chromas.length]! : pentatonic![(n - 1) % 5]!
    const out: Cell[][] = []
    // A box may reach a fret below its start: only octaves with every note on the neck count.
    for (let start = fretOn(open, startChroma, 0); start <= MAX_FRET; start += 12) {
        const cells = nps
            ? fill(ascending(chromas, open + start, notes), tuning, 3)
            : withOther(
                  fill(ascending(pentatonic!, open + start, tuning.length * 2), tuning, 2),
                  system === 'caged' && chromas.length !== 5 ? chromas : null,
                  tuning
              )
        if (cells && cells.every((c) => c.fret >= 0)) out.push(cells)
    }
    return out
}

/**
 * An arpeggio's position `n` in each octave where every note is on the neck: the chord tones of
 * the root's major (or natural minor) scale's CAGED position n (3NPS has no arpeggio positions).
 */
function arpeggioOctaves(
    set: NoteSet,
    tuning: number[],
    system: PositionSystem,
    n: number
): Cell[][] {
    const tones = chordTones(set)
    if (system === '3nps') return []
    // A chord with a minor third sits in the natural minor scale's shapes, others in the major's.
    const minor = set.members.some((m) => m.interval === '3m')
    const parent = scaleNoteSet(`${set.members[0]!.name} ${minor ? 'minor' : 'major'}`)
    if (!parent) return []
    const inScale = new Set(parent.members.map((m) => m.chroma))
    const outside = tones.filter((c) => !inScale.has(c))
    const pitch = (c: Cell) => tuning[c.string]! + c.fret
    return octavesOf(parent, tuning, 'caged', n)
        .map((cells) =>
            (outside.length ? withOtherNotes(cells, outside, tuning) : cells).filter((c) =>
                tones.includes(pitch(c) % 12)
            )
        )
        .filter((cells) => cells.length > 0)
}

/** A box as is, or with the other scale notes (CAGED); null when a note falls off the neck. */
function withOther(box: Cell[], chromas: number[] | null, tuning: number[]): Cell[] | null {
    // `fill` drops notes below the nut: a box missing some isn't on the neck.
    if (box.length < tuning.length * 2) return null
    return chromas ? withOtherNotes(box, chromas, tuning) : box
}

/**
 * Adds the scale notes the pentatonic box leaves out, between its notes, on the string that keeps
 * the hand inside the box's frets (a fret of stretch on either side only when neither string can),
 * and below and above it on the outer strings, inside the position's frets.
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
    // Below the box's lowest note and above its highest, the outer strings take the notes inside
    // the position's frets too: in standard tuning both E strings then show the same notes.
    const low = 0
    const high = tuning.length - 1
    const lowest = pitch(ordered[0]!)
    const highest = pitch(ordered[ordered.length - 1]!)
    const from = Math.min(...out.map((c) => c.fret))
    const to = Math.max(...out.map((c) => c.fret))
    const extra: Cell[] = []
    for (let fret = from; fret <= to; fret++) {
        const below = tuning[low]! + fret
        if (below < lowest && chromas.includes(below % 12)) extra.push({ string: low, fret })
        const above = tuning[high]! + fret
        if (above > highest && chromas.includes(above % 12)) extra.push({ string: high, fret })
    }
    return [...out, ...extra]
}

/** Parses `position:` and `shape:` for a scale or an arpeggio: the system and the position number. */
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
    // `E`, `CAGED E` or `E shape`, as voicings name their shapes.
    const letter = shape.replace(/^caged\s*/, '').replace(/[\s-]*shape$/, '')
    const caged = CAGED_SHAPES.findIndex((s) => s.toLowerCase() === letter)
    if (caged >= 0) return { system: 'caged', n: caged + 1 }
    throw new Error(`Unknown shape "${shapeText}": use C, A, G, E, D or 3nps`)
}
