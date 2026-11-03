/**
 * Which string and fret each pluck of a picking pattern sounds over a chord (#51): the chord's
 * grip (the voicing lookup's first voicing on a standard guitar, else the easiest generated one),
 * the thumb on its bass (the lowest string it sounds) or on the alternate bass (the chord's fifth
 * on a string next to the bass), the fingers i m a on strings 3 2 1.
 */
import { STANDARD_TUNING } from '../chord/guitar.js'
import { generateVoicings } from '../chord/generate.js'
import { readChord } from '../theory/chord-name.js'
import { chordNoteSet } from '../theory/note-set.js'
import type { VoicingLookup } from '../voicings/index.js'
import type { Pluck } from './pattern.js'

/** One note picked: its string (0 the lowest), fret and pitch. */
export interface PickedNote {
    string: number
    fret: number
    midi: number
}

/** Without a chord: E minor (022000) on a standard guitar, the open strings on other tunings. */
const E_MINOR = [0, 2, 2, 0, 0, 0]

const sameTuning = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((p, i) => p === b[i])

/** The chord's grip, lowest string first (null a muted string). Throws on an unknown chord. */
export function pickingFrets(
    chord: string | null,
    tuning: readonly number[] = STANDARD_TUNING,
    voicings?: VoicingLookup
): (number | null)[] {
    const standard = sameTuning(tuning, STANDARD_TUNING)
    if (!chord) return standard ? [...E_MINOR] : tuning.map(() => 0)
    const read = readChord(chord)
    if (!read) throw new Error(`Didn't recognize the chord "${chord}"`)
    if (voicings && standard) {
        try {
            const found = voicings(read.symbol, 0)
            if (found) return [...found.frets]
        } catch {
            // A generated voicing then.
        }
    }
    const generated = generateVoicings(read.symbol, { tuning: [...tuning] })[0]
    if (generated) return [...generated.frets]
    throw new Error(`No playable voicing of ${chord} for this tuning`)
}

/** Strings the fingers play by default (counted from the highest, 1). */
const FINGER_STRINGS = { i: 3, m: 2, a: 1 } as const

/** The chord's fifth (or the closest tone to it: b5, #5), its third otherwise, as a chroma. */
function alternateChroma(chord: string | null, bass: number): number {
    const set = chord ? chordNoteSet(readChord(chord)?.symbol ?? chord) : null
    const members = set?.members ?? []
    // Intervals as tonal names them: 5P, 5d, 5A; 3M, 3m.
    const fifth = members.find((m) => (m.interval ?? '').startsWith('5'))
    const third = members.find((m) => (m.interval ?? '').startsWith('3'))
    return (fifth ?? third)?.chroma ?? (bass + 7) % 12
}

/**
 * A chord tone on a string the grip doesn't sound, fretted within reach (frets 0–5, near the
 * grip): `chromas` in order of preference. Null when none fits.
 */
function frettedOn(
    string: number,
    chromas: readonly number[],
    tuning: readonly number[]
): PickedNote | null {
    for (const chroma of chromas)
        for (let fret = 0; fret <= 5; fret++) {
            const midi = tuning[string]! + fret
            if (((midi % 12) + 12) % 12 === chroma) return { string, fret, midi }
        }
    return null
}

/**
 * The note a pluck sounds over a grip; null when nothing fits (a finger whose strings are all
 * muted). The alternate bass: the chord's fifth on the string closest to the bass, a sounding
 * one first (costs 1 a string away), else fretted on a muted string below the bass (1.5, plus
 * 0.25 when fretted), on the strings below the fingers' (4 to 6 on a guitar): C x32010 alternates
 * with G on string 6 (fret 3), G 320003 with D on string 4, D xx0232 with A on string 5, Am x02210
 * with E on string 4.
 */
export function pluckNote(
    pluck: Pluck,
    frets: readonly (number | null)[],
    tuning: readonly number[],
    chord: string | null
): PickedNote | null {
    const count = tuning.length
    const sounding = (s: number): PickedNote | null => {
        const f = frets[s]
        return f === null || f === undefined ? null : { string: s, fret: f, midi: tuning[s]! + f }
    }
    const strings = frets.flatMap((f, s) => (f === null || f === undefined ? [] : [s]))
    const bassString = strings[0]
    if (bassString === undefined) return null
    const bass = sounding(bassString)!
    if ('string' in pluck) {
        const s = count - pluck.string
        if (s < 0) return null
        // A string the grip mutes: the chord's root, fifth or third fretted on it.
        const root = chord ? chordNoteSet(readChord(chord)?.symbol ?? chord)?.root : null
        const bassChroma = bass.midi % 12
        return (
            sounding(s) ??
            frettedOn(
                s,
                [root ?? bassChroma, alternateChroma(chord, bassChroma), (bassChroma + 4) % 12],
                tuning
            )
        )
    }
    if (pluck.finger === 'p') {
        if (!pluck.alternate) return bass
        const chroma = alternateChroma(chord, bass.midi % 12)
        let best: { note: PickedNote; cost: number } | null = null
        // The bass strings: below the fingers' strings (strings 4 to 6 on a guitar).
        for (let s = 0; s < Math.max(1, count - 3); s++) {
            if (s === bassString) continue
            const own = sounding(s)
            let note: PickedNote | null = null
            let cost = Math.abs(s - bassString)
            if (own) {
                if (own.midi % 12 === chroma) note = own
            } else if (s < bassString) {
                note = frettedOn(s, [chroma], tuning)
                if (note) cost += 0.5 + (note.fret ? 0.25 : 0)
            }
            if (note && (!best || cost < best.cost)) best = { note, cost }
        }
        if (best) return best.note
        // No fifth near the bass: the next sounding string above it.
        return sounding(strings[1] ?? bassString)
    }
    // A finger on its string, else the nearest sounding string above the bass.
    const own = count - FINGER_STRINGS[pluck.finger]
    if (own > bassString && sounding(own)) return sounding(own)
    const above = strings.filter((s) => s > bassString)
    if (!above.length) return null
    const nearest = [...above].sort((a, b) => Math.abs(a - own) - Math.abs(b - own) || b - a)[0]!
    return sounding(nearest)
}
