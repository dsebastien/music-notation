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
    rootNameOf,
    scaleNoteSet,
    type NoteLabel,
    type NoteMarks,
    type NoteSet,
    type NoteSetMember
} from '../theory/note-set.js'
import { t } from '../i18n/translate.js'

const LABELS = new Set<NoteLabel>(['notes', 'degrees', 'intervals', 'none'])

/** The chord of `chord:` or `arpeggio:` (they name the same thing: both is a mistake). */
export function chordField(block: BlockSource): string | undefined {
    const chord = block.fields.get('chord')
    const arpeggio = block.fields.get('arpeggio')
    if (chord !== undefined && arpeggio !== undefined) {
        throw new Error(t('blocks.noteSet.chordOrArpeggio'))
    }
    return chord ?? arpeggio
}

/**
 * `scale:`, `chord:` (or `arpeggio:`) or `notes:`; a shorthand first line is tried as each, in that order. `root:`
 * gives a list its intervals and degrees; a shorthand line with a root is read as a list first.
 */
export function noteSetOf(block: BlockSource): NoteSet {
    const scale = block.fields.get('scale')
    // An arpeggio is a chord's notes, one at a time (`arpeggio: Am7`).
    const chord = chordField(block)
    const notes = block.fields.get('notes')
    // An empty `root:` line is no root, like other empty keys.
    const root = block.fields.get('root')?.trim() || undefined
    if (root !== undefined) {
        if (scale !== undefined) throw rootNotForList('scale')
        if (chord !== undefined) throw rootNotForList('chord')
        if (rootNameOf(root) === null) {
            throw new Error(t('blocks.noteSet.invalidRoot', { root }))
        }
        if (notes !== undefined)
            return orFail(listNoteSet(notes, root), t('blocks.noteSet.invalidNotes', { notes }))
        if (block.head) {
            const list = listNoteSet(block.head, root)
            if (list) return list
            if (scaleNoteSet(block.head)) throw rootNotForList('scale')
            if (chordNoteSet(block.head)) throw rootNotForList('chord')
            throw new Error(t('blocks.noteSet.notAList', { head: block.head }))
        }
        throw new Error(t('blocks.noteSet.addNotesForRoot'))
    }
    if (scale !== undefined) {
        if (isScaleWithoutRoot(scale))
            throw new Error(t('blocks.noteSet.addRoot', { scale: scale.trim() }))
        return orFail(scaleNoteSet(scale), t('blocks.noteSet.unknownScale', { scale }))
    }
    if (chord !== undefined)
        return orFail(chordNoteSet(chord), t('blocks.noteSet.unknownChord', { chord }))
    if (notes !== undefined)
        return orFail(listNoteSet(notes), t('blocks.noteSet.invalidNotes', { notes }))
    if (block.head && isScaleWithoutRoot(block.head)) {
        throw new Error(t('blocks.noteSet.addRoot', { scale: block.head.trim() }))
    }
    if (block.head) {
        // Exact notes ("C4", "E5") before chords: tonal reads them as quartal or power chords.
        const exact = listNoteSet(block.head)
        const set =
            scaleNoteSet(block.head) ??
            (exact?.pitches ? exact : null) ??
            chordNoteSet(block.head) ??
            exact
        return orFail(set, t('blocks.noteSet.notAScaleChordOrList', { head: block.head }))
    }
    throw new Error(t('blocks.noteSet.addSource'))
}

const rootNotForList = (what: 'scale' | 'chord') =>
    new Error(
        t(
            what === 'scale'
                ? 'blocks.noteSet.rootListsOnlyScale'
                : 'blocks.noteSet.rootListsOnlyChord'
        )
    )

/** `labels:`; `fingers` only where fingering was given (piano chords). */
export function labelField(block: BlockSource, fallback: NoteLabel, fingers = false): NoteLabel {
    const value = block.fields.get('labels')?.toLowerCase()
    if (value === undefined) return fallback
    if (!LABELS.has(value as NoteLabel) && !(fingers && value === 'fingers')) {
        throw new Error(
            t(fingers ? 'blocks.noteSet.unknownLabelsFingers' : 'blocks.noteSet.unknownLabels', {
                value
            })
        )
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
        if (set.members.every((m) => m.interval === null)) {
            throw new Error(t('blocks.noteSet.highlightNeedsIntervals'))
        }
        const labels = highlight
            .replace(/♭/g, 'b')
            .replace(/♯/g, '#')
            .split(/[\s,]+/)
            .filter(Boolean)
        for (const label of labels) {
            const hits = set.members.filter(
                (m) =>
                    m.interval !== null && intervalLabel(m.interval) === label.replace(/^1$/, 'R')
            )
            if (!hits.length) {
                throw new Error(t('blocks.noteSet.notInSet', { label, title: set.title }))
            }
            picked.push(...hits)
        }
    }
    if (picked.length) marks.characteristic = new Set(picked.map((m) => m.chroma))

    const compare = block.fields.get('compare')?.trim()
    if (compare) {
        const tonic = Scale.get(scaleName(compare)).tonic
        // A list's root, when given; else the scale's or chord's first note.
        const root = rootNameOf(block.fields.get('root') ?? '') ?? set.members[0]?.name ?? ''
        const parent = orFail(
            scaleNoteSet(tonic ? compare : `${root} ${compare}`),
            `Unknown scale "${compare}" to compare with: use e.g. compare: major`
        )
        const own = new Set(set.members.map((m) => m.chroma))
        const theirs = new Set(parent.members.map((m) => m.chroma))
        marks.different = new Set([...own].filter((c) => !theirs.has(c)))
        marks.ghosts = new Set([...theirs].filter((c) => !own.has(c)))
        marks.ghostNames = new Map(
            parent.members.filter((m) => !own.has(m.chroma)).map((m) => [m.chroma, m.name])
        )
    }
    chordOverScale(block, set, marks)
    return marks
}

/**
 * `chord:` with `scale:` (#48): the scale stays drawn, the chord's tones in it are marked, its
 * other notes are passing notes, and chord tones outside the scale are drawn faint (like the notes
 * of a compared scale).
 */
function chordOverScale(block: BlockSource, set: NoteSet, marks: NoteMarks): void {
    const text = chordField(block)?.trim()
    if (!text || block.fields.get('scale') === undefined || !set.scaleType) return
    const chord = orFail(chordNoteSet(text), `Unknown chord "${text}": use e.g. chord: Am7`)
    const inScale = new Set(set.members.map((m) => m.chroma))
    marks.chordTones = new Set(chord.members.map((m) => m.chroma).filter((c) => inScale.has(c)))
    for (const member of chord.members) {
        if (inScale.has(member.chroma)) continue
        ;(marks.ghosts ??= new Set()).add(member.chroma)
        ;(marks.ghostNames ??= new Map()).set(member.chroma, member.name)
    }
}
