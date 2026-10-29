/** Shared by keyboard and fretboard blocks: which notes to show and how to label them. */
import type { BlockSource } from './block-source.js'
import {
    characteristicIntervals,
    isScaleWithoutRoot,
    marksByDefault,
    scaleName
} from '../theory/scales.js'
import { Scale } from 'tonal'
import {
    chordNoteSet,
    intervalLabel,
    listNoteSet,
    scaleNoteSet,
    type NoteLabel,
    type NoteMarks,
    type NoteSet,
    type NoteSetMember
} from '../theory/note-set.js'

const LABELS = new Set<NoteLabel>(['notes', 'degrees', 'intervals', 'none'])

/** `scale:`, `chord:` or `notes:`; a shorthand first line is tried as each, in that order. */
export function noteSetOf(block: BlockSource): NoteSet {
    const scale = block.fields.get('scale')
    const chord = block.fields.get('chord')
    const notes = block.fields.get('notes')
    if (scale !== undefined) {
        if (isScaleWithoutRoot(scale)) throw new Error(`Add a root note: C ${scale.trim()}`)
        return orFail(scaleNoteSet(scale), `Unknown scale "${scale}"`)
    }
    if (chord !== undefined) return orFail(chordNoteSet(chord), `Unknown chord "${chord}"`)
    if (notes !== undefined) return orFail(listNoteSet(notes), `Invalid notes "${notes}"`)
    if (block.head && isScaleWithoutRoot(block.head)) {
        throw new Error(`Add a root note: C ${block.head.trim()}`)
    }
    if (block.head) {
        // Exact notes ("C4", "E5") before chords: tonal reads them as quartal or power chords.
        const exact = listNoteSet(block.head)
        const set =
            scaleNoteSet(block.head) ??
            (exact?.pitches ? exact : null) ??
            chordNoteSet(block.head) ??
            exact
        return orFail(set, `"${block.head}" is not a scale, chord or list of notes`)
    }
    throw new Error('Add "scale:", "chord:" or "notes:"')
}

/** `labels:`; `fingers` only where fingering was given (piano chords). */
export function labelField(block: BlockSource, fallback: NoteLabel, fingers = false): NoteLabel {
    const value = block.fields.get('labels')?.toLowerCase()
    if (value === undefined) return fallback
    if (!LABELS.has(value as NoteLabel) && !(fingers && value === 'fingers')) {
        const choices = fingers
            ? 'notes, degrees, intervals, fingers or none'
            : 'notes, degrees, intervals or none'
        throw new Error(`Unknown labels "${value}": use ${choices}`)
    }
    return value as NoteLabel
}

export function orFail<T>(value: T | null, message: string): T {
    if (value === null) throw new Error(message)
    return value
}

/**
 * Notes to set apart: `highlight:` (characteristic, none, or intervals such as "b5 7"; modes and
 * blues mark their characteristic notes by default) and `compare:` (a parent scale: notes that
 * differ outlined, its notes missing here drawn faint).
 */
export function marksOf(block: BlockSource, set: NoteSet): NoteMarks {
    const marks: NoteMarks = {}
    const highlight = block.fields.get('highlight')?.trim()
    const written = block.fields.get('scale') ?? block.head ?? ''
    let picked: NoteSetMember[] = []
    if (highlight === undefined || highlight.toLowerCase() === 'characteristic') {
        const intervals = set.scaleType ? characteristicIntervals(set.scaleType) : []
        if (highlight !== undefined || marksByDefault(written)) {
            picked = set.members.filter((m) => intervals.includes(m.interval ?? ''))
        }
    } else if (highlight.toLowerCase() !== 'none' && highlight !== '') {
        const labels = highlight.split(/[\s,]+/).filter(Boolean)
        for (const label of labels) {
            const hits = set.members.filter(
                (m) =>
                    m.interval !== null && intervalLabel(m.interval) === label.replace(/^1$/, 'R')
            )
            if (!hits.length) {
                throw new Error(`"${label}" isn't in ${set.title}: use its intervals (R, b3, 5…)`)
            }
            picked.push(...hits)
        }
    }
    if (picked.length) marks.characteristic = new Set(picked.map((m) => m.chroma))

    const compare = block.fields.get('compare')?.trim()
    if (compare) {
        const tonic = Scale.get(scaleName(compare)).tonic
        const root = set.members[0]?.name ?? ''
        const parent = orFail(
            scaleNoteSet(tonic ? compare : `${root} ${compare}`),
            `Unknown scale "${compare}" to compare with: use e.g. compare: major`
        )
        const own = new Set(set.members.map((m) => m.chroma))
        const theirs = new Set(parent.members.map((m) => m.chroma))
        marks.different = new Set([...own].filter((c) => !theirs.has(c)))
        marks.ghosts = new Set([...theirs].filter((c) => !own.has(c)))
    }
    return marks
}
