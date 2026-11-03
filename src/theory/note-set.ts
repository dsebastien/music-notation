/**
 * What keyboards and fretboards highlight: the notes of a chord, a scale or an explicit list, with
 * the root and each note's label (name, degree, interval).
 */
import { Chord, Interval, Scale } from 'tonal'
import { chromaOf, isFlat, midiOf, splitChordSymbol } from './pitch.js'
import { canonicalSuffix } from './suffix.js'
import { scaleName, scaleSpelling } from './scales.js'

export type NoteLabel = 'notes' | 'degrees' | 'intervals' | 'fingers' | 'none'

export interface NoteSetMember {
    chroma: number
    /** As spelled by the chord, scale or list ("Bb", not "A#"). */
    name: string
    /** 1-based position in the chord or scale (a list with a root: the interval number); null
     * for a plain list. */
    degree: number | null
    /** "1P", "3m", "5P"…; null for a plain list without a root. */
    interval: string | null
}

export interface NoteSet {
    /** "A minor pentatonic", "Cmaj7", or the notes as written. */
    title: string
    members: NoteSetMember[]
    /** Chroma of the root; null for a plain list without a root. */
    root: number | null
    /** Exact pitches (MIDI), when the notes were given with octaves ("C4 E4 G4"). */
    pitches: number[] | null
    preferFlats: boolean
    /** tonal's scale type ("minor", "lydian"), for scales. */
    scaleType?: string
    /** An explicit list ("C E G"), with or without a root. */
    list?: boolean
}

/** Notes to set apart (chromas): a mode's characteristic notes, notes that differ from a parent
 * scale, and the parent's notes missing here (drawn faint). */
export interface NoteMarks {
    characteristic?: Set<number>
    different?: Set<number>
    ghosts?: Set<number>
    /** The ghosts as the compared scale spells them (C minor's Eb, not D#). */
    ghostNames?: Map<number, string>
    /** A chord drawn over a scale: its tones in the scale; the scale's other notes are passing. */
    chordTones?: Set<number>
}

/** Classes for a highlighted note: root, characteristic, different. */
export function markClasses(set: NoteSet, chroma: number, marks: NoteMarks = {}): string {
    const classes: string[] = []
    if (set.root === chroma) classes.push('mn-root')
    else if (marks.characteristic?.has(chroma)) classes.push('mn-char')
    if (marks.different?.has(chroma)) classes.push('mn-diff')
    if (marks.chordTones) classes.push(marks.chordTones.has(chroma) ? 'mn-tone' : 'mn-passing')
    return classes.length ? ` ${classes.join(' ')}` : ''
}

/** The marks in words, for screen readers: ", characteristic notes: F#; differs: F#". */
export function describeMarks(set: NoteSet, marks: NoteMarks = {}): string {
    const names = (chromas?: Set<number>) =>
        set.members.filter((m) => chromas?.has(m.chroma)).map((m) => m.name)
    const characteristic = names(marks.characteristic)
    const different = names(marks.different)
    const tones = names(marks.chordTones)
    return (
        (characteristic.length ? `, characteristic notes: ${characteristic.join(' ')}` : '') +
        (different.length ? `, different from the compared scale: ${different.join(' ')}` : '') +
        (tones.length ? `, chord tones: ${tones.join(' ')}` : '')
    )
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
    // Root and type apart: joined, C(#5) would read as C# 5.
    const chord = Chord.getChord(canonicalSuffix(parts.suffix), parts.root)
    if (chord.empty) return null
    const bass = parts.bass
    const set = fromNames(symbol.trim(), chord.notes, chord.intervals, true)
    const bassChroma = bass ? chromaOf(bass) : null
    if (set && bass && bassChroma !== null && !memberFor(set, bassChroma)) {
        set.members.push({ chroma: bassChroma, name: bass, degree: null, interval: null })
    }
    return set
}

/**
 * Notes given with a chord symbol take the chord's root and its spelling (Cdim7 over C Eb Gb A:
 * the A is written Bbb, as the symbol spells it); notes the chord doesn't have keep theirs.
 */
export function respell(set: NoteSet, chord: NoteSet): void {
    set.root = chord.root
    for (const member of set.members) {
        const own = memberFor(chord, member.chroma)
        if (own) member.name = own.name
    }
}

/** Notes of a scale ("A minor pentatonic", "D dorian"); null when tonal doesn't know it. */
export function scaleNoteSet(name: string): NoteSet | null {
    const scale = Scale.get(scaleName(name))
    if (scale.empty || !scale.tonic) return null
    const { notes, intervals } = scaleSpelling(scale)
    const set = fromNames(name.trim(), notes, intervals)
    if (set) set.scaleType = scale.type
    return set
}

/** A root written for a list ("C", "f#", "E♭", "A3"): its name ("C", "F#", "Eb"), else null. */
export function rootNameOf(text: string): string | null {
    const name = text.trim().replace(/-?\d$/, '').replace(/♯/g, '#').replace(/♭/g, 'b')
    if (chromaOf(name) === null) return null
    return name[0]!.toUpperCase() + name.slice(1)
}

/** The usual interval for each number of semitones above a root, when the spelling gives none. */
const PLAIN_INTERVALS = ['1P', '2m', '2M', '3m', '3M', '4P', '5d', '5P', '6m', '6M', '7m', '7M']

/** The interval from a root to a note, spelled by their letters ("C" to "Eb": 3m, to "D#": 2A);
 * a unison or octave that isn't perfect (C to C#, C to Cb) takes the usual name (2m, 7M). */
export function intervalFrom(root: string, name: string): string | null {
    const from = rootNameOf(root)
    const to = rootNameOf(name)
    if (from === null || to === null) return null
    const semitones = (chromaOf(to)! - chromaOf(from)! + 12) % 12
    if (semitones === 0) return '1P'
    const spelled = Interval.distance(from, to)
    const m = /^(\d+)([PMmdA]+)$/.exec(spelled)
    return m && m[1] !== '1' && m[1] !== '8' ? spelled : PLAIN_INTERVALS[semitones]!
}

/**
 * An explicit list: "A C E" (pitch classes) or "A3 C4 E4" (exact pitches). With a `root`, each
 * note gets its interval from it (degrees are the interval numbers, 1 3 5) and the root its color;
 * the root doesn't have to be in the list. Null when a note or the root isn't a note name.
 */
export function listNoteSet(text: string, root?: string): NoteSet | null {
    const tokens = text.split(/[\s,]+/).filter(Boolean)
    if (!tokens.length) return null
    const withOctaves = tokens.every((t) => midiOf(t) !== null)
    const names = withOctaves ? tokens.map((t) => t.replace(/-?\d$/, '')) : tokens
    if (!withOctaves && names.some((n) => chromaOf(n) === null)) return null
    const set = fromNames(tokens.join(' '), names, null)
    if (!set) return null
    set.list = true
    if (withOctaves) set.pitches = tokens.map((t) => midiOf(t)!)
    if (root === undefined) return set
    const rootName = rootNameOf(root)
    if (rootName === null) return null
    set.root = chromaOf(rootName)
    for (const member of set.members) {
        member.interval = intervalFrom(rootName, member.name)
        member.degree = Number(/^\d+/.exec(member.interval ?? '')?.[0] ?? 1)
    }
    return set
}
