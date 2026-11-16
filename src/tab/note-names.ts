/**
 * Note names on a tab or a score (#112): the name of every note, written above the tablature, for
 * readers who learn the notes. alphaTab has no such drawing, so the names are given to it as
 * lyrics, one line per note of a beat, the highest first (on a tab, the same order as the strings).
 * A staff that has lyrics of its own keeps them: its names go in the beats' text, on one line.
 */
import { noteInNaming, type Naming } from '../theory/naming.js'
import { nameOf } from '../theory/pitch.js'

/** The part of an alphaTab note read here. */
export interface NamedNote {
    realValue: number
    isDead: boolean
    isTieDestination: boolean
}

/** The part of an alphaTab beat read and written here. */
export interface NamedBeat {
    isRest: boolean
    notes: NamedNote[]
    lyrics: string[] | null
    text: string | null
}

/** The part of an alphaTab score read here. */
export interface NamedScore {
    tracks: {
        staves: {
            isPercussion: boolean
            bars: {
                /** Sharps (above 0) or flats (below 0) of the key. */
                keySignature?: number
                masterBar?: { keySignature?: number }
                voices: { beats: NamedBeat[] }[]
            }[]
        }[]
    }[]
}

/**
 * The names of a beat's notes, the highest first: flats in a key with flats, sharps otherwise.
 * Tied notes (they don't sound again) and dead notes (no pitch) have none. Octaves aren't written.
 */
export function namesOfBeat(beat: NamedBeat, naming: Naming, flats: boolean): string[] {
    if (beat.isRest) return []
    return beat.notes
        .filter((note) => !note.isDead && !note.isTieDestination && Number.isFinite(note.realValue))
        .sort((a, b) => b.realValue - a.realValue)
        .map((note) => noteInNaming(nameOf(((note.realValue % 12) + 12) % 12, flats), naming))
}

/**
 * Writes the name of every note of `score` on its beats. Drum staves have none. Returns a function
 * that takes the names away again (the beats get back what they had).
 */
export function nameNotes(score: NamedScore, naming: Naming = 'letters'): () => void {
    const undo: (() => void)[] = []
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            if (staff.isPercussion) continue
            const beats = staff.bars.flatMap((bar) =>
                bar.voices.flatMap((voice) => voice.beats.map((beat) => ({ bar, beat })))
            )
            // Lyrics of its own: the names don't mix with the verses.
            const sung = beats.some(({ beat }) => (beat.lyrics?.length ?? 0) > 0)
            for (const { bar, beat } of beats) {
                const key = Number(bar.keySignature ?? bar.masterBar?.keySignature ?? 0)
                const names = namesOfBeat(beat, naming, key < 0)
                if (!names.length) continue
                if (!sung) {
                    const before = beat.lyrics
                    beat.lyrics = names
                    undo.push(() => (beat.lyrics = before))
                } else if (!beat.text) {
                    const before = beat.text
                    beat.text = names.join(' ')
                    undo.push(() => (beat.text = before))
                }
            }
        }
    }
    return () => {
        for (const back of undo.splice(0)) back()
    }
}

/** A block's `names:` value: on or off; null when it is neither. */
export function namesOf(value: string): boolean | null {
    const v = value.trim().toLowerCase()
    if (v === 'on' || v === 'yes' || v === 'true') return true
    if (v === 'off' || v === 'no' || v === 'false') return false
    return null
}
