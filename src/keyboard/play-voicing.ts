/**
 * What a keyboard drawing a chord in every octave plays (#61): one voicing, not every lit key.
 */
import { Interval } from 'tonal'
import type { NoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'

const pc = (midi: number) => ((midi % 12) + 12) % 12

/**
 * One voicing of a chord within the keys `from`–`to` (MIDI), struck as a block: root position
 * from the lowest root drawn (G7: G B D F, C9: C E G Bb D), each note an octave lower when it
 * would pass the last key. A slash chord takes its lowest bass key, then the chord's other notes
 * in close position above it (C/E: E G C). Null when the set has exact pitches (they play as
 * drawn), no root, or no root key within the range.
 */
export function chordVoicingIn(set: NoteSet, from: number, to: number): number[] | null {
    if (set.pitches || set.root === null || from > to) return null
    const root = set.root
    const bassName = splitChordSymbol(set.title)?.bass
    const bass = bassName ? chromaOf(bassName) : null
    const lowest = (chroma: number, above: number) => {
        for (let midi = Math.max(from, above); midi <= to; midi++)
            if (pc(midi) === chroma) return midi
        return null
    }
    if (bass !== null && bass !== undefined && bass !== root) {
        const low = lowest(bass, from)
        if (low !== null) {
            const above = set.members
                .filter((m) => m.chroma !== bass)
                .map((m) => lowest(m.chroma, low + 1))
                .filter((midi): midi is number => midi !== null)
            return [...new Set([low, ...above])].sort((a, b) => a - b)
        }
    }
    const start = lowest(root, from)
    if (start === null) return null
    const notes = set.members
        .filter((m) => m.interval !== null && m.chroma !== bass)
        .map((m) => {
            const steps = Interval.semitones(m.interval!)
            let midi =
                start +
                (steps === undefined || !Number.isFinite(steps) ? pc(m.chroma - root) : steps)
            while (midi > to) midi -= 12
            return midi
        })
        .filter((midi) => midi >= from)
    return [...new Set([start, ...notes])].sort((a, b) => a - b)
}
