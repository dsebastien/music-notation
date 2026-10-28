/** Shared by keyboard and fretboard blocks: which notes to show and how to label them. */
import type { BlockSource } from './block-source.js'
import {
    chordNoteSet,
    listNoteSet,
    scaleNoteSet,
    type NoteLabel,
    type NoteSet
} from '../theory/note-set.js'

const LABELS = new Set<NoteLabel>(['notes', 'degrees', 'intervals', 'none'])

/** `scale:`, `chord:` or `notes:`; a shorthand first line is tried as each, in that order. */
export function noteSetOf(block: BlockSource): NoteSet {
    const scale = block.fields.get('scale')
    const chord = block.fields.get('chord')
    const notes = block.fields.get('notes')
    if (scale !== undefined) return orFail(scaleNoteSet(scale), `Unknown scale "${scale}"`)
    if (chord !== undefined) return orFail(chordNoteSet(chord), `Unknown chord "${chord}"`)
    if (notes !== undefined) return orFail(listNoteSet(notes), `Invalid notes "${notes}"`)
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
