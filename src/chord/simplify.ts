/**
 * Easier chords for a song (#45): the plainer chords of a chord's family that are easier to play
 * (Cmaj9 → Cmaj7, G5 → G, E9 → E7), and the capo that turns the most chords into open shapes.
 * "Easier" is the difficulty of the easiest voicing the generator finds.
 */
import { chordInfo, generateVoicings, type VoicingOptions } from './generate.js'
import { splitChordSymbol } from '../theory/pitch.js'
import { canonicalSuffix } from '../theory/suffix.js'
import { transposeChord } from '../theory/transpose.js'

export interface EasierOptions {
    /** Open-string pitches (MIDI), lowest string first; standard guitar by default. */
    tuning?: number[]
}

/** The easiest voicing of a chord: its frets and how hard it is; null when nothing plays it. */
interface Easiest {
    frets: (number | null)[]
    difficulty: number
    open: boolean
}

/** The easiest voicing of the last chords asked, by tuning and symbol: a chart asks them often. */
const easiest = new Map<string, Easiest | null>()
const KEPT = 512

function easiestOf(symbol: string, options: EasierOptions): Easiest | null {
    const key = `${options.tuning?.join(',') ?? ''}|${symbol}`
    const known = easiest.get(key)
    if (known !== undefined) return known
    const generation: VoicingOptions = options.tuning ? { tuning: options.tuning } : {}
    const first = generateVoicings(symbol, generation)[0]
    const found = first
        ? { frets: [...first.frets], difficulty: first.difficulty, open: first.shape === 'Open' }
        : null
    if (easiest.size >= KEPT) easiest.delete(easiest.keys().next().value!)
    easiest.set(key, found)
    return found
}

/**
 * The plainer chords of a chord's family, the nearest first: without its bass, its seventh chord
 * (Cmaj9 → Cmaj7, E9 → E7), then its triad (C, Em); a half-diminished chord's minor 7th first
 * (Bm7b5 → Bm7); a chord without a third (G5, Dsus4) its major chord. Suffixes, not symbols.
 */
function plainerSuffixes(symbol: string): string[] {
    const info = chordInfo(symbol)
    if (!info) return []
    const has = (interval: string) => info.members.some((m) => m.interval === interval)
    const third = has('3M') ? 'major' : has('3m') ? 'minor' : null
    const diminished = third === 'minor' && has('5d')
    const pick = (...found: [string, string][]) => found.find(([i]) => has(i))?.[1] ?? null
    const seventh =
        third !== 'minor'
            ? pick(['7M', 'maj7'], ['7m', '7'])
            : diminished
              ? pick(['7d', 'dim7'], ['7m', 'm7b5'])
              : pick(['7m', 'm7'])
    const steps: string[] = []
    if (seventh) steps.push(seventh)
    if (seventh === 'm7b5') steps.push('m7')
    if (seventh === 'dim7') steps.push('dim')
    // A diminished triad is as plain as its family gets; the others end on a major or minor chord.
    else if (!(diminished && !seventh)) steps.push(third === 'minor' ? 'm' : '')
    return steps.filter((suffix, i) => suffix !== info.suffix && steps.indexOf(suffix) === i)
}

/** A chord's plainer chords, the nearest first: each with the chord's bass, then without it. */
function plainerChords(symbol: string): string[] {
    const parts = splitChordSymbol(symbol)
    if (!parts) return []
    const own = `${parts.root}${canonicalSuffix(parts.suffix)}`
    const bass = parts.bass ? `/${parts.bass}` : ''
    const found: string[] = bass ? [`${parts.root}${parts.suffix}`] : []
    for (const suffix of plainerSuffixes(symbol)) {
        if (bass) found.push(`${parts.root}${suffix}${bass}`)
        found.push(`${parts.root}${suffix}`)
    }
    return found.filter((chord, i) => chord !== own + bass && found.indexOf(chord) === i)
}

/** An easier chord of a chord's family. */
export interface EasierChord {
    symbol: string
    /** Its easiest voicing, lowest string first (null: muted), and how hard it is (lower is easier). */
    frets: (number | null)[]
    difficulty: number
}

/**
 * The chords of a chord's family that are easier to play than the chord itself, the easiest
 * first (the nearest to the chord when two are as easy): Cmaj9 → Cmaj7; G5 → G; E9 → E7, E;
 * Bm7b5 → Bm7. Empty when nothing plainer is easier (Am7, F#) or the symbol isn't a chord.
 */
export function simplifyChord(symbol: string, options: EasierOptions = {}): EasierChord[] {
    const own = easiestOf(symbol.trim(), options)
    const limit = own ? own.difficulty : Infinity
    return plainerChords(symbol.trim())
        .map((chord, order) => ({ chord, order, voicing: easiestOf(chord, options) }))
        .filter((c) => c.voicing !== null && c.voicing.difficulty < limit)
        .sort((a, b) => a.voicing!.difficulty - b.voicing!.difficulty || a.order - b.order)
        .map((c) => ({
            symbol: c.chord,
            frets: [...c.voicing!.frets],
            difficulty: c.voicing!.difficulty
        }))
}

/** The easiest chord of a chord's family: the chord itself when nothing plainer is easier. */
export function easierChord(symbol: string, options: EasierOptions = {}): string {
    return simplifyChord(symbol, options)[0]?.symbol ?? symbol.trim()
}

export interface CapoOptions extends EasierOptions {
    /** The highest capo fret tried, 7 by default (0 to 12). */
    maxCapo?: number
}

/** A chord of the song with a capo on: the shape to play. */
export interface CapoShape {
    /** The chord as it sounds. */
    chord: string
    /** The chord shape to play behind the capo ("G" for an A with a capo on 2). */
    shape: string
    /** The shape's easiest voicing, counted from the capo; null when nothing plays it. */
    frets: (number | null)[] | null
    /** An open shape (first position, with open strings). */
    open: boolean
    difficulty: number
}

/** A capo fret (0: no capo) and what the song's chords become with it. */
export interface CapoChoice {
    capo: number
    shapes: CapoShape[]
    /** How many of the chords are open shapes. */
    open: number
    /** The shapes' difficulties added up (lower is easier). */
    difficulty: number
}

/** What a chord nothing plays counts for, so a capo that leaves one out isn't the easiest. */
const UNPLAYABLE = 12

/** What each fret of a capo adds to the shapes' difficulty when two frets are compared. */
const CAPO_COST = 0.5

/** A shape's name: the chord a capo's frets lower, with a natural root when there is one. */
function shapeName(chord: string, capo: number): string {
    if (!capo) return chord
    const flat = transposeChord(chord, -capo, true)
    const sharp = transposeChord(chord, -capo, false)
    if (flat === sharp) return flat
    // An accidental either way: the chord's own way of writing it.
    return /^[A-G]b/.test(chord) ? flat : sharp
}

/**
 * Every capo fret from 0 to `maxCapo` for a song's chords (as they sound, without a capo), the
 * best first: the most open shapes, then the least effort (the shapes' difficulties, plus half a
 * point a capo fret), then the lowest fret. Each chord counts once; text that isn't a chord is
 * left out. Empty when no chord reads.
 */
export function capoChoices(chords: readonly string[], options: CapoOptions = {}): CapoChoice[] {
    const distinct = [...new Set(chords.map((c) => c.trim()))].filter((c) => chordInfo(c) !== null)
    if (!distinct.length) return []
    const max = Math.min(12, Math.max(0, Math.round(options.maxCapo ?? 7) || 0))
    const choices: CapoChoice[] = []
    for (let capo = 0; capo <= max; capo++) {
        const shapes = distinct.map((chord): CapoShape => {
            const shape = shapeName(chord, capo)
            const voicing = easiestOf(shape, options)
            return {
                chord,
                shape,
                frets: voicing ? [...voicing.frets] : null,
                open: voicing?.open ?? false,
                difficulty: voicing?.difficulty ?? UNPLAYABLE
            }
        })
        choices.push({
            capo,
            shapes,
            open: shapes.filter((s) => s.open).length,
            difficulty: shapes.reduce((sum, s) => sum + s.difficulty, 0)
        })
    }
    // A capo high on the neck is a cost too: between two frets with as many open shapes, half a
    // point of difficulty a fret.
    const effort = (c: CapoChoice) => c.difficulty + CAPO_COST * c.capo
    return choices.sort((a, b) => b.open - a.open || effort(a) - effort(b) || a.capo - b.capo)
}

/**
 * The capo fret that lets the most of a song's chords be played as open shapes, with the shapes
 * to play (fret 0 when no capo does better). Null when no chord reads.
 */
export function bestCapo(chords: readonly string[], options: CapoOptions = {}): CapoChoice | null {
    return capoChoices(chords, options)[0] ?? null
}
