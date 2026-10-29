/**
 * Chord transitions (#21): which voicing of the next chord the hand reaches most easily from the
 * one it holds, and the voicings of a whole progression with the least movement. Fingers that stay
 * on their fret (anchors) and slide along their string (guides) make changes clean.
 */
import { fingerVoicing, generateVoicings, type GeneratedVoicing } from './generate.js'
import { STANDARD_TUNING } from './guitar.js'
import { noteOf } from '../theory/pitch.js'

export interface TransitionStep {
    voicing: GeneratedVoicing
    /** Strings (indexes, lowest first) whose finger stays on the same fret. */
    anchors: number[]
    /** Strings whose finger slides along the string to another fret. */
    guides: number[]
    /** Frets the hand moves along the neck (between the lowest fretted notes). */
    shift: number
    /** How much the hand moves: fingers lifted and placed, slides, the shift. Lower is easier. */
    movement: number
    /** What to do, in plain words. */
    tips: string[]
}

export interface TransitionOptions {
    /** Open-string pitches (MIDI), lowest string first; standard guitar by default. */
    tuning?: number[]
    /** The fingers of the voicing held (worked out when absent). */
    fromFingers?: (string | null)[]
    /** How many of the next chord's easiest voicings to consider (30 by default). */
    candidates?: number
}

const FINGER_NAMES: Record<string, string> = {
    '1': 'index finger',
    '2': 'middle finger',
    '3': 'ring finger',
    '4': 'pinky',
    'T': 'thumb'
}

const ordinal = (n: number) =>
    `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

/** "the B string", "the low E string", "the high E string". */
function stringName(tuning: readonly number[], s: number): string {
    const name = noteOf(tuning[s]!).replace(/-?\d+$/, '')
    const same = tuning.filter((p) => noteOf(p).replace(/-?\d+$/, '') === name).length
    if (same < 2) return `the ${name} string`
    const lowest = tuning.findIndex((p) => noteOf(p).replace(/-?\d+$/, '') === name)
    return `the ${s === lowest ? 'low' : 'high'} ${name} string`
}

const lowestFret = (frets: readonly (number | null)[]) => {
    const fretted = frets.filter((f): f is number => f !== null && f > 0)
    return fretted.length ? Math.min(...fretted) : 0
}

/** The move from one fingered voicing to another. */
function move(
    from: readonly (number | null)[],
    fromFingers: readonly (string | null)[],
    to: GeneratedVoicing,
    tuning: readonly number[]
): Omit<TransitionStep, 'voicing'> {
    const anchors: number[] = []
    const guides: number[] = []
    let movement = 0
    const tips: string[] = []
    to.frets.forEach((fret, s) => {
        const finger = to.fingers[s]
        if (fret === null || fret === 0 || !finger) return
        const before = from[s]
        if (before === fret && fromFingers[s] === finger) {
            anchors.push(s)
            return
        }
        // The same finger on the same string, another fret: it slides.
        if (before !== null && before !== undefined && before > 0 && fromFingers[s] === finger) {
            guides.push(s)
            movement += 0.5 + 0.1 * Math.abs(fret - before)
            return
        }
        movement += 1
    })
    // Barred strings share a finger: count each finger once.
    const placed = new Set(
        to.frets.flatMap((f, s) =>
            f && to.fingers[s] && !anchors.includes(s) && !guides.includes(s) ? [to.fingers[s]] : []
        )
    )
    const strings = new Set(
        to.frets.flatMap((f, s) =>
            f && to.fingers[s] && !anchors.includes(s) && !guides.includes(s) ? [s] : []
        )
    )
    movement -= strings.size - placed.size
    const shift = Math.abs(lowestFret(to.frets) - lowestFret(from))
    movement += 0.3 * shift
    const fingerName = (f: string | null | undefined) => FINGER_NAMES[f ?? ''] ?? 'finger'
    const seen = new Set<string>()
    for (const s of anchors) {
        const f = to.fingers[s]!
        if (seen.has(f)) continue
        seen.add(f)
        tips.push(
            `Keep your ${fingerName(f)} on ${stringName(tuning, s)}'s ${ordinal(to.frets[s]!)} fret.`
        )
    }
    for (const s of guides) {
        const f = to.fingers[s]!
        if (seen.has(f)) continue
        seen.add(f)
        tips.push(
            `Slide your ${fingerName(f)} along ${stringName(tuning, s)} from fret ${from[s]} to ${to.frets[s]}.`
        )
    }
    if (shift >= 2) {
        const up = lowestFret(to.frets) > lowestFret(from)
        tips.push(`Move your hand ${up ? 'up' : 'down'} ${shift} frets.`)
    }
    if (!anchors.length && !guides.length && shift < 2) {
        tips.push('Lift all your fingers together and place them as one shape.')
    }
    return { anchors, guides, shift, movement: Math.round(movement * 10) / 10, tips }
}

/** Movement and ease together: an easy shape far away isn't easier than a harder one next door. */
const score = (step: Omit<TransitionStep, 'voicing' | 'tips'>, voicing: GeneratedVoicing) =>
    step.movement + 0.4 * voicing.difficulty

/**
 * The next chord's voicings, ranked by how easily the hand gets there from the one it holds:
 * anchors and guides first, then a small move, then an easy shape. Empty when the chord is
 * unknown.
 */
export function transition(
    from: readonly (number | null)[],
    toChord: string,
    options: TransitionOptions = {}
): TransitionStep[] {
    const tuning = options.tuning ?? STANDARD_TUNING
    if (from.length !== tuning.length) return []
    const fromFingers = options.fromFingers ?? fingerVoicing(from) ?? from.map(() => null)
    const candidates = generateVoicings(toChord, { tuning }).slice(0, options.candidates ?? 30)
    return candidates
        .map((voicing) => ({ voicing, ...move(from, fromFingers, voicing, tuning) }))
        .sort((a, b) => score(a, a.voicing) - score(b, b.voicing))
}

export interface ProgressionStep extends Partial<Omit<TransitionStep, 'voicing'>> {
    chord: string
    voicing: GeneratedVoicing
}

/**
 * The voicing of each chord that makes the whole progression easiest: the shapes' ease and the
 * moves between them, together (each chord's easiest 12 voicings are weighed). The first step has
 * no move. Empty when a chord is unknown.
 */
export function smoothProgression(
    chords: readonly string[],
    options: { tuning?: number[]; candidates?: number } = {}
): ProgressionStep[] {
    const tuning = options.tuning ?? STANDARD_TUNING
    const lists = chords.map((c) =>
        generateVoicings(c, { tuning }).slice(0, options.candidates ?? 12)
    )
    if (!chords.length || lists.some((l) => !l.length)) return []
    // Cheapest way to end on each voicing of each chord, and where it came from.
    let costs = lists[0]!.map((v) => 0.4 * v.difficulty)
    const back: number[][] = []
    for (let i = 1; i < lists.length; i++) {
        const prev = lists[i - 1]!
        const fingersOf = prev.map((v) => v.fingers)
        const next = lists[i]!.map((v) => {
            let best = Infinity
            let from = 0
            prev.forEach((p, j) => {
                const step = move(p.frets, fingersOf[j]!, v, tuning)
                const total = costs[j]! + score(step, v)
                if (total < best) {
                    best = total
                    from = j
                }
            })
            return { best, from }
        })
        back.push(next.map((n) => n.from))
        costs = next.map((n) => n.best)
    }
    const picks: number[] = [costs.indexOf(Math.min(...costs))]
    for (let i = back.length - 1; i >= 0; i--) picks.unshift(back[i]![picks[0]!]!)
    return picks.map((pick, i) => {
        const voicing = lists[i]![pick]!
        if (i === 0) return { chord: chords[0]!, voicing }
        const previous = lists[i - 1]![picks[i - 1]!]!
        return {
            chord: chords[i]!,
            voicing,
            ...move(previous.frets, previous.fingers, voicing, tuning)
        }
    })
}
