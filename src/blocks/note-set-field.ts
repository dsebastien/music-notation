/** Shared by keyboard and fretboard blocks: which notes to show and how to label them. */
import type { BlockSource } from './block-source'
import {
    chordNoteSet,
    listNoteSet,
    scaleNoteSet,
    type NoteLabel,
    type NoteSet
} from '../theory/note-set'

const LABELS = new Set<NoteLabel>(['notes', 'degrees', 'intervals', 'fingers', 'none'])

/** `scale:`, `chord:` or `notes:`; a shorthand first line is tried as each, in that order. */
export function noteSetOf(block: BlockSource): NoteSet {
    const scale = block.fields.get('scale')
    const chord = block.fields.get('chord')
    const notes = block.fields.get('notes')
    if (scale !== undefined) return orFail(scaleNoteSet(scale), `Unknown scale "${scale}"`)
    if (chord !== undefined) return orFail(chordNoteSet(chord), `Unknown chord "${chord}"`)
    if (notes !== undefined) return orFail(listNoteSet(notes), `Invalid notes "${notes}"`)
    if (block.head) {
        const set = scaleNoteSet(block.head) ?? chordNoteSet(block.head) ?? listNoteSet(block.head)
        return orFail(set, `"${block.head}" is not a scale, chord or list of notes`)
    }
    throw new Error('Add "scale:", "chord:" or "notes:"')
}

export function labelField(block: BlockSource, fallback: NoteLabel): NoteLabel {
    const value = block.fields.get('labels')?.toLowerCase()
    if (value === undefined) return fallback
    if (!LABELS.has(value as NoteLabel)) {
        throw new Error(`Unknown labels "${value}": use notes, degrees, intervals, fingers or none`)
    }
    return value as NoteLabel
}

export function orFail<T>(value: T | null, message: string): T {
    if (value === null) throw new Error(message)
    return value
}
