/**
 * What keyboards and fretboards highlight: the notes of a chord, a scale or an explicit list, with
 * the root and each note's label (name, degree, interval).
 */
import { Chord, Scale } from 'tonal'
import { chromaOf, isFlat, midiOf, splitChordSymbol } from './pitch.js'
import { canonicalSuffix } from './suffix.js'

export type NoteLabel = 'notes' | 'degrees' | 'intervals' | 'fingers' | 'none'

export interface NoteSetMember {
    chroma: number
    /** As spelled by the chord, scale or list ("Bb", not "A#"). */
    name: string
    /** 1-based position in the chord or scale; null for a plain list. */
    degree: number | null
    /** "1P", "3m", "5P"…; null for a plain list. */
    interval: string | null
}

export interface NoteSet {
    /** "A minor pentatonic", "Cmaj7", or the notes as written. */
    title: string
    members: NoteSetMember[]
    /** Chroma of the root; null for a plain list. */
    root: number | null
    /** Exact pitches (MIDI), when the notes were given with octaves ("C4 E4 G4"). */
    pitches: number[] | null
    preferFlats: boolean
}

const memberFor = (set: NoteSet, chroma: number): NoteSetMember | undefined =>
    set.members.find((m) => m.chroma === chroma)

/** The member a pitch belongs to, if any. */
export const memberOf = (set: NoteSet, midi: number): NoteSetMember | undefined =>
    set.pitches && !set.pitches.includes(midi) ? undefined : memberFor(set, ((midi % 12) + 12) % 12)

/** tonal's "3m", "5d", "4A", "1P" → how musicians write them: "b3", "b5", "#4", "R". */
export function intervalLabel(interval: string): string {
    const m = /^(\d+)([PMmdA]+)$/.exec(interval)
    if (!m) return interval
    const [, number, quality] = m
    if (number === '1' && quality === 'P') return 'R'
    const perfect = ['1', '4', '5', '8', '11', '12'].includes(
        String(((Number(number) - 1) % 7) + 1)
    )
    if (quality === 'P' || quality === 'M') return number!
    if (quality === 'm') return `b${number}`
    if (quality!.startsWith('A')) return `${'#'.repeat(quality!.length)}${number}`
    // Diminished: one flat below perfect, two below major.
    return `${'b'.repeat(quality!.length + (perfect ? 0 : 1))}${number}`
}

/** Text shown on a highlighted note. */
export function labelOf(member: NoteSetMember, label: NoteLabel, finger?: string): string {
    switch (label) {
        case 'none':
            return ''
        case 'degrees':
            return member.degree === null ? member.name : String(member.degree)
        case 'intervals':
            return member.interval === null ? member.name : intervalLabel(member.interval)
        case 'fingers':
            return finger ?? ''
        default:
            return member.name
    }
}

const fromNames = (
    title: string,
    names: string[],
    intervals: string[] | null,
    chord = false
): NoteSet | null => {
    const members: NoteSetMember[] = []
    names.forEach((name, i) => {
        const chroma = chromaOf(name)
        if (chroma === null || members.some((m) => m.chroma === chroma)) return
        members.push({
            chroma,
            name,
            // A chord's degrees are its interval numbers (1 3 5 7); a scale's, its positions.
            degree: intervals
                ? chord
                    ? Number(/^\d+/.exec(intervals[i] ?? '')?.[0] ?? i + 1)
                    : i + 1
                : null,
            interval: intervals?.[i] ?? null
        })
    })
    if (!members.length) return null
    return {
        title,
        members,
        root: intervals ? members[0]!.chroma : null,
        pitches: null,
        preferFlats: names.some(isFlat)
    }
}

/** Notes of a chord symbol ("Cmaj7", "C/G"); null when tonal doesn't know it. */
export function chordNoteSet(symbol: string): NoteSet | null {
    const parts = splitChordSymbol(symbol)
    if (!parts) return null
    const chord = Chord.get(parts.root + canonicalSuffix(parts.suffix))
    if (chord.empty) return null
    const bass = parts.bass
    const set = fromNames(symbol.trim(), chord.notes, chord.intervals, true)
    const bassChroma = bass ? chromaOf(bass) : null
    if (set && bass && bassChroma !== null && !memberFor(set, bassChroma)) {
        set.members.push({ chroma: bassChroma, name: bass, degree: null, interval: null })
    }
    return set
}

/** Notes of a scale ("A minor pentatonic", "D dorian"); null when tonal doesn't know it. */
export function scaleNoteSet(name: string): NoteSet | null {
    const scale = Scale.get(name.trim())
    if (scale.empty || !scale.tonic) return null
    return fromNames(name.trim(), scale.notes, scale.intervals)
}

/** An explicit list: "A C E" (pitch classes) or "A3 C4 E4" (exact pitches). */
export function listNoteSet(text: string): NoteSet | null {
    const tokens = text.split(/[\s,]+/).filter(Boolean)
    if (!tokens.length) return null
    const withOctaves = tokens.every((t) => midiOf(t) !== null)
    const names = withOctaves ? tokens.map((t) => t.replace(/-?\d$/, '')) : tokens
    if (!withOctaves && names.some((n) => chromaOf(n) === null)) return null
    const set = fromNames(tokens.join(' '), names, null)
    if (set && withOctaves) set.pitches = tokens.map((t) => midiOf(t)!)
    return set
}
