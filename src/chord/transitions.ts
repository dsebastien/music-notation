/**
 * Chord transitions (#21): which voicing of the next chord the hand reaches most easily from the
 * one it holds, and the voicings of a whole progression with the least movement. Fingers that stay
 * on their fret (anchors) and slide along their string (guides) make changes clean.
 */
import { fingerVoicing, generateVoicings, type GeneratedVoicing } from './generate.js'
import { STANDARD_TUNING } from './guitar.js'
import { noteOf } from '../theory/pitch.js'
import type { VoicingLookup } from '../voicings/index.js'

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

/** A slide longer than this many frets is a finger lifted and placed again. */
const MAX_SLIDE = 3

/** "the B string", "the low E string", "the high E string"; by number when three share a name. */
function stringName(tuning: readonly number[], s: number): string {
    const name = noteOf(tuning[s]!).replace(/-?\d+$/, '')
    const same = tuning.filter((p) => noteOf(p).replace(/-?\d+$/, '') === name).length
    if (same < 2) return `the ${name} string`
    if (same > 2) return `the ${ordinal(tuning.length - s)} string (${name})`
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
        // The same finger on the same string, a few frets away: it slides. Further, it's lifted.
        if (
            before !== null &&
            before !== undefined &&
            before > 0 &&
            fromFingers[s] === finger &&
            Math.abs(fret - before) <= MAX_SLIDE
        ) {
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

export interface ProgressionOptions {
    /** Open-string pitches (MIDI), lowest string first; standard guitar by default. */
    tuning?: number[]
    /** How many of each chord's easiest voicings to weigh (12 by default). */
    candidates?: number
    /** The voicing database (see `/voicings`): its voicings of each chord are weighed too, and
     * preferred. Only used in standard tuning. */
    voicings?: VoicingLookup
}

/** How many of a chord's database voicings are weighed. */
const DATABASE_VOICINGS = 6

/** Frets the lowest fretted note may sit at before a shape counts as far up the neck. */
const HIGH_POSITION = 5

/** How much a shape's cost weighs against the moves in a progression: a guitarist reads the
 * shapes first, so a standard shape is worth a few more fingers to place. */
const SHAPE_WEIGHT = 2

/** The shapes teachers write first: open chords, and E- and A-shape barre chords. */
const teacherShape = ({ shape, reasons }: GeneratedVoicing) =>
    shape === 'Open' || ((shape === 'E shape' || shape === 'A shape') && reasons.includes('barre'))

/**
 * What a shape costs in a progression, besides its moves: its ease; a penalty for each fret it
 * sits above the 5th (teachers write the shapes near the nut); penalties for a partial shape (no
 * fifth, the highest string muted, fewer than five strings outside the open chords), a reach, an
 * open string inside the shape, and a shape other than an open chord or an E- or A-shape barre (a
 * power chord: its bass above the 5th string); a bonus for the database's voicings (the standard
 * shapes).
 */
function shapeCost(voicing: GeneratedVoicing, fromDatabase: boolean): number {
    const { frets, shape, reasons } = voicing
    let cost = 0.4 * voicing.difficulty
    cost += 0.6 * Math.max(0, lowestFret(frets) - HIGH_POSITION)
    if (reasons.includes('no fifth')) cost += 1.5
    if (reasons.includes('reach')) cost += 1
    if (reasons.includes('open string inside the shape')) cost += 1
    if (shape === 'Power chord') {
        // Power chords sit on the low strings.
        cost += 0.8 * Math.max(0, frets.findIndex((f) => f !== null) - 1)
    } else {
        if (frets[frets.length - 1] === null) cost += 1
        const sounding = frets.filter((f) => f !== null).length
        if (shape !== 'Open') cost += 0.6 * Math.max(0, Math.min(5, frets.length - 1) - sounding)
        if (!teacherShape(voicing)) cost += 0.5
    }
    if (fromDatabase) cost -= 0.6
    return cost
}

interface Candidate {
    voicing: GeneratedVoicing
    cost: number
}

/** A chord's voicings to weigh: its easiest, and the database's (when it has them). */
function candidatesOf(
    symbol: string,
    tuning: number[],
    count: number,
    voicings: VoicingLookup | undefined
): Candidate[] {
    const all = generateVoicings(symbol, { tuning })
    const picked = new Map<GeneratedVoicing, boolean>()
    for (const v of all.slice(0, count)) picked.set(v, false)
    if (voicings && sameTuning(tuning, STANDARD_TUNING)) {
        const byFrets = new Map(all.map((v) => [v.frets.join(','), v]))
        for (let i = 0; i < DATABASE_VOICINGS; i++) {
            const found = voicings(symbol, i)
            if (!found) break
            // Only shapes the generator plays too: root in the bass, a hand can hold them.
            const v = byFrets.get(found.frets.join(','))
            if (v) picked.set(v, true)
        }
    }
    return [...picked].map(([voicing, db]) => ({ voicing, cost: shapeCost(voicing, db) }))
}

const sameTuning = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((p, i) => p === b[i])

/**
 * The voicing of each chord that makes the whole progression easiest: the shapes and the moves
 * between them, together (each chord's easiest 12 voicings are weighed, and the voicing database's
 * when given). Shapes near the nut, full shapes and the database's standard ones are preferred.
 * The first step has no move. Empty when a chord is unknown.
 */
export function smoothProgression(
    chords: readonly string[],
    options: ProgressionOptions = {}
): ProgressionStep[] {
    const tuning = options.tuning ?? STANDARD_TUNING
    const count = options.candidates ?? 12
    const cache = new Map<string, Candidate[]>()
    const lists = chords.map((c) => {
        let list = cache.get(c)
        if (!list) {
            list = candidatesOf(c, tuning, count, options.voicings)
            cache.set(c, list)
        }
        return list
    })
    if (!chords.length || lists.some((l) => !l.length)) return []
    // Cheapest way to end on each voicing of each chord, and where it came from.
    let costs = lists[0]!.map((c) => SHAPE_WEIGHT * c.cost)
    const back: number[][] = []
    for (let i = 1; i < lists.length; i++) {
        const prev = lists[i - 1]!
        const next = lists[i]!.map(({ voicing, cost }) => {
            let best = Infinity
            let from = 0
            prev.forEach((p, j) => {
                const step = move(p.voicing.frets, p.voicing.fingers, voicing, tuning)
                const total = costs[j]! + step.movement + SHAPE_WEIGHT * cost
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
        const voicing = lists[i]![pick]!.voicing
        if (i === 0) return { chord: chords[0]!, voicing }
        const previous = lists[i - 1]![picks[i - 1]!]!.voicing
        return {
            chord: chords[i]!,
            voicing,
            ...move(previous.frets, previous.fingers, voicing, tuning)
        }
    })
}
