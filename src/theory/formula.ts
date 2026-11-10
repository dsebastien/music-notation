/**
 * What a chord or a scale is, in a few sentences (#52, `caption: formula`): its notes, its formula
 * (the intervals from the root, 1 b3 5), and for chords the quality in words and the other symbols,
 * for scales the steps between the notes (W W H). Names follow the drawing's naming (`shown`).
 */
import { Chord } from 'tonal'
import { chordNoteSet, intervalLabel, scaleNoteSet, type NoteSetMember } from './note-set.js'
import { splitChordSymbol } from './pitch.js'
import { canonicalSuffix } from './suffix.js'
import { parseChord } from './chord-symbol.js'
import { shown } from './naming.js'

/** At most this many other symbols for a chord. */
const MAX_ALIASES = 5

/** An interval as a formula writes it: 1 for the root, else as the dot labels do (b3, #11). */
const formulaLabel = (interval: string): string => {
    const label = intervalLabel(interval)
    return label === 'R' ? '1' : label
}

const formulaOf = (members: NoteSetMember[]) =>
    members.map((m) => formulaLabel(m.interval!)).join(' ')

/**
 * A chord's formula in sentences: "Am7 (A minor seventh): A C E G.", "Formula 1 b3 5 b7.",
 * "Also written Amin7, Ami7, A-7." A slash chord says its bass ("C/G (C major, G in the bass)").
 * Null when the library doesn't know the chord.
 */
export function chordFormula(symbol: string): string[] | null {
    const written = symbol.trim()
    const parts = splitChordSymbol(written)
    const set = parts ? chordNoteSet(written) : null
    if (!parts || !set) return null
    const chord = Chord.getChord(canonicalSuffix(parts.suffix), parts.root)
    const words = chord.type || parseChord(written)?.quality.toLowerCase() || parts.suffix
    const tones = set.members.filter((m) => m.interval !== null)
    const bass = parts.bass ? `, ${shown(parts.bass)} in the bass` : ''
    const sentences = [
        `${shown(written)} (${shown(parts.root)} ${words}${bass}): ${tones.map((m) => shown(m.name)).join(' ')}.`,
        `Formula ${formulaOf(tones)}.`
    ]
    const slash = parts.bass ? `/${parts.bass}` : ''
    const own = new Set([written, `${parts.root}${parts.suffix}${slash}`])
    const others = [
        ...new Set(
            chord.aliases
                // tonal's ^ spellings (C^7) are rare in print.
                .filter((alias) => !alias.includes('^'))
                .map((alias) => `${parts.root}${alias}${slash}`)
        )
    ]
        .filter((other) => !own.has(other))
        .slice(0, MAX_ALIASES)
    if (others.length) sentences.push(`Also written ${others.map((o) => shown(o)).join(', ')}.`)
    return sentences
}

/** Half steps between two notes as a step pattern writes them: H, W, W+H (3), 2W (4). */
const STEP_NAMES: Record<number, string> = { 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' }

/**
 * A scale's formula in sentences: "A minor pentatonic: A C D E G.", "Formula 1 b3 4 5 b7.",
 * "Steps W+H W W W+H W." Null when the library doesn't know the scale.
 */
export function scaleFormula(name: string): string[] | null {
    const set = scaleNoteSet(name)
    if (!set) return null
    const members = set.members.filter((m) => m.interval !== null)
    const chromas = members.map((m) => m.chroma)
    const steps = chromas.map((chroma, i) => {
        const next = chromas[(i + 1) % chromas.length]!
        const half = (next - chroma + 12) % 12 || 12
        return STEP_NAMES[half] ?? `${half}H`
    })
    return [
        `${shown(set.title)}: ${members.map((m) => shown(m.name)).join(' ')}.`,
        `Formula ${formulaOf(members)}.`,
        `Steps ${steps.join(' ')}.`
    ]
}
