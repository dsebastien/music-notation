/**
 * Fingerpicking patterns (#51, fence `picking`): `key: value` lines and pattern lines of one
 * token a slot, PIMA letters (p the thumb on the bass, p' the thumb on the alternate bass, i m a
 * the fingers on strings 3 2 1) or string numbers (1 the highest), `+` or glued letters for notes
 * picked together (a pinch: `p+a`, `pa`), `-` `.` `_` rests, `|` bar lines. Named patterns:
 * Travis, alternate bass, 1-2-3-4 (an arpeggio).
 */
import {
    isCompound,
    MAX_TEMPO,
    MIN_TEMPO,
    parseSubdivision,
    parseSwing,
    parseTime,
    slotsPerBeatOf,
    type Subdivision
} from '../strum/pattern.js'

/** The thumb on the bass or the alternate bass, a finger, or a string by number. */
export type Pluck =
    { finger: 'p'; alternate: boolean } | { finger: 'i' | 'm' | 'a' } | { string: number }

export interface PickingSlot {
    /** What sounds in the slot, together; empty for a rest. */
    plucks: Pluck[]
}

export interface PickingPattern {
    slots: PickingSlot[]
    beatsPerBar: number
    beatUnit: number
    subdivision: Subdivision
    slotsPerBeat: number
    compound: boolean
    /** Slots in one counted beat: `slotsPerBeat`, three times that in compound time. */
    slotsPerPulse: number
    swing: number | null
    slotsPerBar: number
    /** The pattern's own bars (it repeats over every chord). */
    bars: number
    /** The chord picked (`chord:`), or null. */
    chord: string | null
    /** One chord a bar (`chords:` or `progression:`), the pattern repeating; empty when none. */
    chords: string[]
    tempo: number | null
    tuning: string | null
    title: string | null
    /** The named pattern written (`pattern: travis`), as named; null when written out. */
    name: string | null
}

/** Bounds that keep a pattern quick to draw and to hear. */
export const MAX_PICKING_BARS = 16

/** The named patterns, in 8ths: each fills a bar, repeated, in the block's time. */
export const PICKING_PATTERNS: Readonly<Record<string, { name: string; slots: string }>> = {
    'travis': { name: 'Travis', slots: "p m p' i p m p' i" },
    'alternate bass': { name: 'Alternate bass', slots: "p i m i p' i m i" },
    '1-2-3-4': { name: '1-2-3-4', slots: 'p i m a p i m a' }
}

const ALIASES: Record<string, string> = {
    'travis picking': 'travis',
    'alternating bass': 'alternate bass',
    'alternate-bass': 'alternate bass',
    'arpeggio': '1-2-3-4',
    'pima': '1-2-3-4',
    '1234': '1-2-3-4'
}

/** A named pattern's key ("travis"), from any case and the usual other names; null otherwise. */
export function namedPicking(text: string): string | null {
    const t = text.trim().toLowerCase().replace(/\s+/g, ' ')
    const key = ALIASES[t] ?? t
    return PICKING_PATTERNS[key] ? key : null
}

const KEYS = [
    'pattern',
    'time',
    'subdivision',
    'swing',
    'chord',
    'chords',
    'progression',
    'tempo',
    'bpm',
    'tuning',
    'title'
]
const FIELD = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/
/** A line of counts ("1 & 2 &", "1 e & a"): it has an & or a +, and only counts. */
const COUNTS = /^(?:\d+|&|\+|e|a|and|trip|let)(?:\s+(?:\d+|&|\+|e|a|and|trip|let))*$/i
const isCountLine = (line: string) => /[&+]/.test(line) && COUNTS.test(line.trim())
const RESTS = new Set(['-', '.', '_'])
const HELP =
    "write p (the thumb on the bass), p' (the alternate bass), i, m, a (strings 3, 2, 1), a string number from 1 (the highest), - for a rest, + between notes picked together (p+a)"

/** One token's plucks; throws a message naming it. */
function plucksOf(token: string, strings: number): Pluck[] {
    const parts = token.includes('+') ? token.split('+') : [token]
    const plucks: Pluck[] = []
    const add = (p: Pluck) => {
        const same = plucks.some((q) => JSON.stringify(q) === JSON.stringify(p))
        if (!same) plucks.push(p)
    }
    for (const part of parts) {
        if (!part) throw new Error(`Didn't understand "${token}": ${HELP}`)
        if (/^\d+$/.test(part)) {
            const n = Number(part)
            if (n < 1 || n > strings)
                throw new Error(
                    `String ${n} doesn't exist: strings go from 1 (the highest) to ${strings}`
                )
            add({ string: n })
            continue
        }
        // Glued letters: a pinch (pa, p'm).
        const letters = /^(?:p'?|i|m|a)+$/i.test(part)
            ? part.toLowerCase().match(/p'?|i|m|a/g)
            : null
        if (!letters) throw new Error(`Didn't understand "${token}": ${HELP}`)
        for (const l of letters)
            add(
                l.startsWith('p')
                    ? { finger: 'p', alternate: l === "p'" }
                    : { finger: l as 'i' | 'm' | 'a' }
            )
    }
    return plucks
}

/** The slots of pattern text, in bars: each run between bar lines is whole bars. */
function slotsOf(
    lines: string[],
    perBar: number,
    strings: number,
    time: string,
    subdivision: Subdivision
): PickingSlot[] {
    const slots: PickingSlot[] = []
    const runs: PickingSlot[][] = [[]]
    for (const line of lines) {
        for (const token of line.replace(/\|/g, ' | ').split(/\s+/).filter(Boolean)) {
            if (token === '|') {
                runs.push([])
                continue
            }
            if ([...token].every((c) => RESTS.has(c))) {
                for (const _ of token) runs[runs.length - 1]!.push({ plucks: [] })
                continue
            }
            runs[runs.length - 1]!.push({ plucks: plucksOf(token.replace(/[’`]/g, "'"), strings) })
        }
    }
    for (const run of runs) {
        if (!run.length) continue
        if (run.length % perBar) {
            throw new Error(
                `A bar of ${time} in ${subdivision} has ${perBar} slots, found ${run.length}${runs.length > 1 ? ' between bar lines' : ''}: add notes or rests (-) so each bar has ${perBar}, or change time:`
            )
        }
        slots.push(...run)
    }
    return slots
}

/** Reads a ```picking block. Throws a message for the user. */
export function parsePicking(source: string, strings = 6): PickingPattern {
    const fields = new Map<string, string>()
    const lines: string[] = []
    for (const raw of source.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line) continue
        const m = FIELD.exec(line)
        if (m && !/^\d/.test(line)) {
            const key = m[1]!.toLowerCase()
            if (!KEYS.includes(key))
                throw new Error(
                    `Unknown key "${m[1]}": use time, subdivision, swing, chord, chords, tempo, tuning, title or pattern`
                )
            const name = key === 'bpm' ? 'tempo' : key === 'progression' ? 'chords' : key
            fields.set(name, m[2]!.trim())
        } else if (!isCountLine(line)) lines.push(line)
    }
    const timeText = fields.get('time') || '4/4'
    const { beatsPerBar, beatUnit } = parseTime(timeText)
    const time = `${beatsPerBar}/${beatUnit}`
    const written = fields.get('subdivision')
    const subdivision = written ? parseSubdivision(written) : '8ths'
    const slotsPerBeat = slotsPerBeatOf(subdivision, beatUnit)
    const perBar = beatsPerBar * slotsPerBeat
    const compound = isCompound(beatsPerBar, beatUnit)
    const swingText = fields.get('swing')
    const swing = swingText ? parseSwing(swingText) : null
    if (swing !== null && (subdivision === 'triplets' || compound || slotsPerBeat % 2))
        throw new Error(
            'Swing plays pairs of 8ths or 16ths inside a beat: remove swing:, or write time: 4/4 with 8ths'
        )
    const tempoText = fields.get('tempo')
    let tempo: number | null = null
    if (tempoText) {
        tempo = Number(tempoText.replace(/\s*bpm$/i, ''))
        if (!Number.isFinite(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO)
            throw new Error(
                `Invalid tempo "${tempoText}": use beats a minute from ${MIN_TEMPO} to ${MAX_TEMPO}, e.g. tempo: 80`
            )
    }
    const patternText = fields.get('pattern')
    const name = patternText ? namedPicking(patternText) : null
    if (patternText && lines.length)
        throw new Error('Write the pattern once: as pattern: or as pattern lines, not both')
    let slots: PickingSlot[]
    if (name) {
        // A named pattern fills one bar, its 8ths repeated in the block's time.
        const own = PICKING_PATTERNS[name]!.slots.split(' ')
        slots = Array.from({ length: perBar }, (_, i) => ({
            plucks: plucksOf(own[i % own.length]!, strings)
        }))
    } else {
        const text = patternText ? [patternText] : lines
        if (!text.length)
            throw new Error(
                `Write a pattern: a line such as p i m a p i m a, or pattern: travis, alternate bass or 1-2-3-4`
            )
        slots = slotsOf(text, perBar, strings, time, subdivision)
    }
    const bars = slots.length / perBar
    if (bars > MAX_PICKING_BARS)
        throw new Error(
            `At most ${MAX_PICKING_BARS} bars in one pattern: split it into several blocks`
        )
    const chords = (fields.get('chords') ?? '').split(/[\s,|]+/).filter(Boolean)
    if (chords.length > MAX_PICKING_BARS * 2)
        throw new Error(`At most ${MAX_PICKING_BARS * 2} chords, found ${chords.length}`)
    return {
        slots,
        beatsPerBar,
        beatUnit,
        subdivision,
        slotsPerBeat,
        compound,
        slotsPerPulse: compound ? slotsPerBeat * 3 : slotsPerBeat,
        swing,
        slotsPerBar: perBar,
        bars,
        chord: fields.get('chord') || null,
        chords,
        tempo,
        tuning: fields.get('tuning') || null,
        title: fields.get('title') || null,
        name: name ? PICKING_PATTERNS[name]!.name : null
    }
}

/** A pluck as written: p, p', i, m, a, or the string's number. */
export const pluckText = (p: Pluck) =>
    'string' in p ? String(p.string) : p.finger === 'p' && p.alternate ? "p'" : p.finger

/** A pattern as one line of tokens ("p m p' i p m p' i"), bars separated by `|`. */
export function formatPicking(pattern: PickingPattern): string {
    const out: string[] = []
    pattern.slots.forEach((slot, i) => {
        if (i && i % pattern.slotsPerBar === 0) out.push('|')
        out.push(slot.plucks.length ? slot.plucks.map(pluckText).join('+') : '-')
    })
    return out.join(' ')
}
