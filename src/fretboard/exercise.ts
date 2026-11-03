/**
 * Scale positions and arpeggios as tab exercises (#47): the notes of one position, in playing
 * order, as alphaTex for a `tab` block, so the run plays in time with alphaTab's count-in,
 * metronome and speed control.
 *
 * - The notes are the position's dots (`scalePosition`), each pitch once, string by string.
 * - `up` plays them from the lowest to the highest, `down` from the highest to the lowest.
 * - `both` (up and down) plays them in the order a diagram plays a scale (#61): from the lowest
 *   root up to the highest note, down to the lowest note, back up to that root; the top and the
 *   bottom note once each. With the root lowest, that is up and back down.
 * - Rhythms in 4/4 (the metronome clicks quarters): 8ths (8 notes a bar), triplets (3 eighths a
 *   beat, 12 a bar, as tuplets), 16ths (16 a bar). The last bar ends with rests.
 */
import { chordNoteSet, scaleNoteSet, type NoteSet } from '../theory/note-set.js'
import { noteOf } from '../theory/pitch.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import { parseTuning } from './tuning.js'
import {
    isArpeggio,
    positionCount,
    positionOf,
    scalePosition,
    type Cell,
    type Numbering,
    type PositionSystem
} from './positions.js'

export type ExerciseDirection = 'up' | 'down' | 'both'

export type ExerciseRhythm = '8ths' | 'triplets' | '16ths'

/** A scale (`A minor pentatonic`), a chord's arpeggio (`Am7`), or a note set of either. */
export type ExerciseNotes = { scale: string } | { arpeggio: string } | NoteSet

export interface ExerciseOptions {
    /** Position 1 to 5 (CAGED, boxes) or 1 to 7 (3NPS); 1 by default. */
    position?: number
    /** `E`, `D`, `C`, `A`, `G` (a CAGED shape) or `3nps`, as the fretboard block's `shape:`. */
    shape?: string
    /** Up and down by default. */
    direction?: ExerciseDirection
    /** 8ths by default. */
    rhythm?: ExerciseRhythm
    /** Open strings (MIDI, lowest first) or a tuning name (`drop d`); standard by default. */
    tuning?: number[] | string
    /** Quarters a minute, 20 to 240 (rounded); 60 by default. */
    tempo?: number
    /** The lowest octave of the position inside these frets (else the lowest one). */
    frets?: [number, number]
    /** `minor` numbers a major pentatonic's positions from its relative minor. */
    numbering?: Numbering
    /** A title over the tab. */
    title?: string
}

/** The tempo of an exercise without one: slow enough to learn the run. */
export const DEFAULT_EXERCISE_TEMPO = 60

/** Notes in one 4/4 bar, per rhythm. */
const PER_BAR: Record<ExerciseRhythm, number> = { '8ths': 8, 'triplets': 12, '16ths': 16 }

/** The duration that starts the run (alphaTex keeps it for every next note). */
const DURATION: Record<ExerciseRhythm, string> = {
    '8ths': ':8',
    'triplets': ':8 {tu 3}',
    '16ths': ':16'
}

/** Reads `exercise:`: up, down, or up-down (also `both`, `up and down`). */
export function parseDirection(text: string): ExerciseDirection {
    const value = text.trim().toLowerCase().replace(/\s+/g, ' ')
    if (value === 'up' || value === 'down') return value
    if (['up-down', 'up down', 'up and down', 'updown', 'both'].includes(value)) return 'both'
    throw new Error(`exercise: use up, down or up-down, got "${text}"`)
}

/** Reads `rhythm:`: 8ths, triplets or 16ths. */
export function parseRhythm(text: string): ExerciseRhythm {
    const value = text.trim().toLowerCase()
    if (['8ths', '8th', '8', 'eighths', 'eighth'].includes(value)) return '8ths'
    if (['triplets', 'triplet', '8th triplets'].includes(value)) return 'triplets'
    if (['16ths', '16th', '16', 'sixteenths', 'sixteenth'].includes(value)) return '16ths'
    throw new Error(`rhythm: use 8ths, triplets or 16ths, got "${text}"`)
}

const tempoOf = (tempo: number | undefined) =>
    tempo === undefined || !Number.isFinite(tempo)
        ? DEFAULT_EXERCISE_TEMPO
        : Math.min(240, Math.max(20, Math.round(tempo)))

/**
 * The cells of a run in playing order: each pitch once (on the lowest string that has it), then
 * up, down, or up and down from the lowest root (`root`, a pitch class; null: from the lowest note).
 */
export function exerciseRun(
    cells: Cell[],
    tuning: number[],
    root: number | null,
    direction: ExerciseDirection
): Cell[] {
    const pitch = (c: Cell) => tuning[c.string]! + c.fret
    const byPitch = new Map<number, Cell>()
    for (const cell of [...cells].sort((a, b) => pitch(a) - pitch(b) || a.string - b.string)) {
        if (!byPitch.has(pitch(cell))) byPitch.set(pitch(cell), cell)
    }
    const up = [...byPitch.values()]
    if (direction === 'up') return up
    const down = [...up].reverse()
    if (direction === 'down' || up.length < 2) return direction === 'down' ? down : up
    const start =
        root === null
            ? 0
            : Math.max(
                  0,
                  up.findIndex((c) => pitch(c) % 12 === root)
              )
    // From the root to the top, down to the bottom, back up to the root.
    return [...up.slice(start), ...down.slice(1), ...up.slice(1, start + 1)]
}

/**
 * alphaTex for a run of cells: the tempo, the tuning when it isn't standard, 4/4, then the notes
 * (`fret.string`, strings counted from the highest) bar by bar, the last bar filled with rests.
 */
export function exerciseTex(
    run: Cell[],
    tuning: number[],
    options: { rhythm?: ExerciseRhythm; tempo?: number; title?: string } = {}
): string {
    const rhythm = options.rhythm ?? '8ths'
    const perBar = PER_BAR[rhythm]
    const tokens = run.map((c) => `${c.fret}.${tuning.length - c.string}`)
    while (tokens.length % perBar !== 0 || tokens.length === 0) tokens.push('r')
    const bars: string[] = []
    for (let i = 0; i < tokens.length; i += perBar) bars.push(tokens.slice(i, i + perBar).join(' '))
    const standard = tuning.join(' ') === STANDARD_TUNING.join(' ')
    return [
        ...(options.title ? [`\\title "${options.title.replace(/["\\]/g, '\\$&')}"`] : []),
        `\\tempo ${tempoOf(options.tempo)}`,
        '.',
        ...(standard
            ? []
            : [
                  `\\tuning (${[...tuning]
                      .reverse()
                      .map((m) => noteOf(m))
                      .join(' ')})`
              ]),
        '\\ts 4 4',
        `${DURATION[rhythm]} ${bars.join(' |\n')}`
    ].join('\n')
}

const NAMED: Record<PositionSystem, string> = { 'box': 'box', 'caged': 'CAGED', '3nps': '3nps' }

/** The note set of an exercise's notes; throws a message saying what to write. */
function setOf(notes: ExerciseNotes): NoteSet {
    if ('scale' in notes && typeof notes.scale === 'string') {
        const set = scaleNoteSet(notes.scale)
        if (!set) throw new Error(`Unknown scale "${notes.scale}"`)
        return set
    }
    if ('arpeggio' in notes && typeof notes.arpeggio === 'string') {
        const set = chordNoteSet(notes.arpeggio)
        if (!set) throw new Error(`Unknown chord "${notes.arpeggio}"`)
        return set
    }
    return notes as NoteSet
}

/**
 * Where a scale's or arpeggio's position is: a numbered position of a 5-note scale is a box, of
 * a 7-note scale and of an arpeggio a CAGED shape; `shape:` picks CAGED shapes or 3NPS. Throws when
 * the set has no positions (a list) or the position doesn't exist.
 */
export function exercisePosition(
    set: NoteSet,
    tuning: number[],
    at: { system: PositionSystem; n: number },
    options: { frets?: [number, number]; numbering?: Numbering } = {}
): Cell[] {
    if (set.root === null || set.list) {
        throw new Error(
            'An exercise needs a scale or an arpeggio: e.g. scale: A minor or arpeggio: Am7'
        )
    }
    const arpeggio = isArpeggio(set)
    const system: PositionSystem =
        at.system === 'box' && (arpeggio || set.members.length !== 5) ? 'caged' : at.system
    if (arpeggio && system === '3nps') {
        throw new Error(
            'Arpeggios use CAGED shapes: position 1 to 5, or shape: E, D, C, A or G (not 3nps)'
        )
    }
    const cells = scalePosition(set, tuning, system, at.n, {
        ...(options.frets ? { within: options.frets } : {}),
        ...(options.numbering ? { numbering: options.numbering } : {})
    })
    if (!cells?.length) {
        const count = positionCount(set, system)
        throw new Error(
            `${set.title} has ${count} ${NAMED[system]} positions: use position 1 to ${count}`
        )
    }
    return cells
}

/**
 * A scale position or an arpeggio as a tab exercise: alphaTex for a `tab` block (see the module
 * comment for the order and the rhythms). Pure; throws a message saying what to write instead.
 */
export function exerciseTab(notes: ExerciseNotes, options: ExerciseOptions = {}): string {
    const set = setOf(notes)
    const tuning =
        typeof options.tuning === 'string'
            ? parseTuning(options.tuning)
            : (options.tuning ?? STANDARD_TUNING)
    if (!tuning || tuning.length < 2) throw new Error(`Unknown tuning "${String(options.tuning)}"`)
    const at = positionOf(
        options.position === undefined ? undefined : String(options.position),
        options.shape
    ) ?? { system: 'box', n: 1 }
    const cells = exercisePosition(set, tuning, at, options)
    return exerciseTex(exerciseRun(cells, tuning, set.root, options.direction ?? 'both'), tuning, {
        ...(options.rhythm ? { rhythm: options.rhythm } : {}),
        ...(options.tempo !== undefined ? { tempo: options.tempo } : {}),
        ...(options.title ? { title: options.title } : {})
    })
}
