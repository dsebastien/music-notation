/**
 * Strumming patterns (#8): `D - D U - U D U`, the way they're written on the web. A pattern is a
 * row of slots, one per subdivision of the beat (8ths, 16ths or triplets), each a down strum, an
 * up strum, a muted strum or nothing, with accents, ghost strums and chord changes.
 *
 * Written forms that work:
 * - one symbol per slot, with rests: `D - D U - U D U`, `D-DU-UDU`, `D . D U . U D U`;
 * - strums only, placed by the hand's motion (down on the beat, up between): `D DU UDU`,
 *   `DDUUDU`, `D D D D`, and `D-D-U-U-D-U` (dashes between strums as separators);
 * - arrows for D and U: `↓ ↓↑ ↑↓↑`;
 * - a chord line above a pattern line (each chord starts on the slot below it), or `[G]` in the
 *   pattern; a line of counts (`1 & 2 & 3 & 4 &`) is skipped.
 */
import { readChord, suggestChords } from '../theory/chord-name.js'

export type Stroke = 'down' | 'up' | 'mute' | 'rest'

export type Subdivision = '8ths' | '16ths' | 'triplets'

export interface StrumSlot {
    stroke: Stroke
    /** Played louder (`D>`). */
    accent: boolean
    /** Played softly (`(U)`). */
    ghost: boolean
    /** A chord that starts on this slot (as written, a symbol), or null. */
    chord: string | null
}

export interface StrumPattern {
    slots: StrumSlot[]
    /** The time signature: beats a bar and the note that counts as a beat (4/4, 3/4, 6/8). */
    beatsPerBar: number
    beatUnit: number
    subdivision: Subdivision
    /** Slots in one beat (2 for 8ths in 4/4, 1 for 8ths in 6/8). */
    slotsPerBeat: number
    slotsPerBar: number
    bars: number
    /** The chord for the whole pattern (`chord:`), until a change. */
    chord: string | null
    /** Beats a minute (`tempo:`), null when not written. */
    tempo: number | null
    /** Open strings for playback (`tuning:`), as written; null for standard guitar. */
    tuning: string | null
    title: string | null
}

/** Bounds that keep a pattern quick to draw and to hear. */
export const MAX_STRUM_BARS = 16
export const DEFAULT_TEMPO = 90
export const MIN_TEMPO = 20
export const MAX_TEMPO = 240

const KEYS = ['pattern', 'time', 'subdivision', 'chord', 'tempo', 'bpm', 'tuning', 'title']
const FIELD = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/

/** A line of counts written under or over a pattern ("1 & 2 &", "1 e & a", "1 + 2 +"). */
const COUNTS = /^(?:\d+|&|\+|e|a|and|trip|let|ta)(?:\s+(?:\d+|&|\+|e|a|and|trip|let|ta))*$/i
const isCountLine = (line: string) => /\d/.test(line) && COUNTS.test(line.trim())

const STROKES: Record<string, Stroke> = {
    'd': 'down',
    'u': 'up',
    'x': 'mute',
    '↓': 'down',
    '↑': 'up'
}
const RESTS = new Set(['-', '.', '_'])
const HELP =
    'write D or ↓ (down), U or ↑ (up), X (muted), - (no strum), > after a strum for an accent, (U) for a ghost strum, [G] for a chord change'

const BOTH = 'A strum is either accented (D>) or a ghost strum ((D)), not both'

/** "4/4", "6/8", "C" (common time), "cut" (2/2). Throws a message for the user. */
export function parseTime(text: string): { beatsPerBar: number; beatUnit: number } {
    const t = text.trim().toLowerCase()
    if (t === 'c' || t === 'common') return { beatsPerBar: 4, beatUnit: 4 }
    if (t === 'cut' || t === '¢') return { beatsPerBar: 2, beatUnit: 2 }
    const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(t)
    const beats = m ? Number(m[1]) : NaN
    const unit = m ? Number(m[2]) : NaN
    if (!(beats >= 1 && beats <= 16) || ![2, 4, 8, 16].includes(unit))
        throw new Error(`Invalid time "${text}": use e.g. time: 4/4, 3/4 or 6/8`)
    return { beatsPerBar: beats, beatUnit: unit }
}

/** "8ths", "eighths", "8"; "16ths", "sixteenths", "16"; "triplets". Throws a message. */
export function parseSubdivision(text: string): Subdivision {
    const t = text
        .trim()
        .toLowerCase()
        .replace(/\s+notes?$/, '')
    if (['8ths', '8th', '8', '1/8', 'eighths', 'eighth', 'eights'].includes(t)) return '8ths'
    if (['16ths', '16th', '16', '1/16', 'sixteenths', 'sixteenth'].includes(t)) return '16ths'
    if (['triplets', 'triplet', '8th triplets', 'eighth triplets', '3'].includes(t))
        return 'triplets'
    throw new Error(`Invalid subdivision "${text}": use 8ths, 16ths or triplets`)
}

/** Slots in one beat of the time signature. Throws when the subdivision can't divide the beat. */
export function slotsPerBeatOf(subdivision: Subdivision, beatUnit: number): number {
    if (subdivision === 'triplets') {
        if (beatUnit !== 4)
            throw new Error(
                `Triplets need a quarter-note beat (time: 4/4, 3/4…); for ${beatUnit === 8 ? 'a 6/8 feel use time: 6/8 with 8ths' : 'this time use 8ths or 16ths'}`
            )
        return 3
    }
    const n = (subdivision === '8ths' ? 8 : 16) / beatUnit
    if (n < 1)
        throw new Error(`8ths are longer than a beat of x/${beatUnit}: use subdivision: 16ths`)
    return n
}

/** A unit of a pattern line: one slot's worth of text, where it was written. */
interface Unit {
    stroke: Stroke
    accent: boolean
    ghost: boolean
    chord: string | null
    /** Column in its line. */
    column: number
    /** Written at the start of a token (after a space or a bar line), not glued to a symbol. */
    spaced: boolean
}

/** A run of units ended by `|` or the end of a line: one or more whole bars. */
interface Segment {
    units: Unit[]
    /** The line it came from, for chords written above. */
    line: number
}

/** The chord in `[...]`, as shown; throws when it isn't one. */
function chordOf(written: string): string {
    const text = written.trim()
    const chord = text ? readChord(text) : null
    if (!chord)
        throw new Error(
            text
                ? `Didn't recognize the chord "${text}": try ${suggestChords(text)}`
                : 'Empty chord "[]": write the chord inside, e.g. [G]'
        )
    // Words ("A Minor") are shown as their symbol, which fits above a slot.
    return /\s/.test(text) ? chord.symbol : text
}

/** A pattern line's units, split into segments at bar lines. Throws a message for the user. */
function readLine(line: string, lineIndex: number): Segment[] {
    const segments: Segment[] = [{ units: [], line: lineIndex }]
    let ghost = false
    let accentNext = false
    let chordNext: string | null = null
    let previous: Unit | null = null
    // A symbol was written since the last space or bar line.
    let glued = false
    for (let i = 0; i < line.length; i++) {
        const c = line[i]!
        const units = segments[segments.length - 1]!.units
        const lower = c.toLowerCase()
        if (c === ' ' || c === '\t') {
            previous = null
            glued = false
            continue
        }
        if (c === '[') {
            const end = line.indexOf(']', i)
            if (end < 0) throw new Error(`Missing "]" after "${line.slice(i)}": write e.g. [G]`)
            chordNext = chordOf(line.slice(i + 1, end))
            i = end
            previous = null
            continue
        }
        if (c === '|') {
            if (ghost) throw new Error('A bar line inside ( ): close the ghost strums first')
            if (units.length) segments.push({ units: [], line: lineIndex })
            previous = null
            glued = false
            continue
        }
        if (c === '>') {
            if (previous && previous.stroke !== 'rest' && !previous.accent) {
                if (previous.ghost) throw new Error(BOTH)
                previous.accent = true
            } else accentNext = true
            continue
        }
        if (c === '(') {
            if (ghost) throw new Error("Ghost strums can't be nested: write (U), not ((U))")
            ghost = true
            previous = null
            continue
        }
        if (c === ')') {
            if (!ghost) throw new Error('")" without "(": write a ghost strum as (U)')
            ghost = false
            continue
        }
        const stroke = STROKES[lower] ?? (RESTS.has(c) ? 'rest' : null)
        if (!stroke) throw new Error(`Didn't understand "${c}" in "${line.trim()}": ${HELP}`)
        const isRest = stroke === 'rest'
        if (isRest && (accentNext || ghost)) {
            throw new Error(
                accentNext
                    ? 'An accent needs a strum: write D> or U>'
                    : 'Write ghost strums as (D) or (U), without rests inside'
            )
        }
        if (accentNext && ghost) throw new Error(BOTH)
        const unit: Unit = {
            stroke,
            accent: !isRest && accentNext,
            ghost: !isRest && ghost,
            chord: chordNext,
            column: i,
            spaced: !glued
        }
        glued = true
        accentNext = false
        chordNext = null
        units.push(unit)
        previous = unit
    }
    if (ghost) throw new Error(`Missing ")" in "${line.trim()}": write a ghost strum as (U)`)
    if (accentNext) throw new Error('An accent needs a strum: write D> or U>')
    if (chordNext)
        throw new Error(`The chord [${chordNext}] ends the pattern: put it before a strum or a -`)
    return segments.filter((s) => s.units.length)
}

/** A line of chords to put above the next pattern line: chord symbols at columns. */
function chordLine(line: string): { chord: string; column: number }[] | null {
    const out: { chord: string; column: number }[] = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    let strokeLetters = true
    while ((m = re.exec(line))) {
        const token = m[0]
        if (token === '|') continue
        if (!readChord(token)) return null
        if (!/^[dux]$/i.test(token)) strokeLetters = false
        out.push({ chord: token, column: m.index })
    }
    // A line of only D (a chord too) reads as strums.
    return out.length && !strokeLetters ? out : null
}

/** Strum, rest, strum, rest… strum: dashes written between strums as separators. */
const separated = (units: Unit[]) =>
    units.length % 2 === 1 &&
    units.every((u, i) => (i % 2 === 0) === (u.stroke !== 'rest') && (i % 2 === 0 || !u.chord))

/** A segment's units placed on slots (from `at`), and where the next segment starts. */
interface Placed {
    units: Unit[]
    slots: number[]
    /** Whether the hand's motion put a rest just before each unit. */
    gaps: boolean[]
    end: number
}

/**
 * Places one segment from slot `at`. One symbol a slot when it fills whole bars. Otherwise, when
 * only strums are written (or dashes between strums as separators), the hand's motion places
 * them: down on the beat and up between, so a down strum takes the next even slot of the bar, an
 * up strum the next odd one (in triplets: down, up, down in each beat), and the slots skipped are
 * rests; the segment is padded to the end of its bar. Null when neither reads.
 */
function place(segment: Segment, at: number, perBar: number, perBeat: number): Placed | null {
    const { units } = segment
    if (units.length % perBar === 0)
        return {
            units,
            slots: units.map((_, i) => at + i),
            gaps: units.map(() => false),
            end: at + units.length
        }
    const hasRests = units.some((u) => u.stroke === 'rest')
    if (hasRests && !separated(units)) return null
    const strums = units.filter((u) => u.stroke !== 'rest')
    const upAt = (slot: number) =>
        perBeat === 3 ? (slot % perBar) % 3 === 1 : (slot % perBar) % 2 === 1
    const slots: number[] = []
    const gaps: boolean[] = []
    for (const unit of strums) {
        // A muted strum glued to a strum (DX) takes the next slot, down or up (a chuck on the beat
        // or between); written alone (D X D X), it's a down strum's motion, like D D D D.
        const down = unit.stroke === 'down' || (unit.stroke === 'mute' && unit.spaced)
        const gap = (unit.stroke !== 'mute' || unit.spaced) && upAt(at) === down
        if (gap) at++
        slots.push(at++)
        gaps.push(gap)
    }
    return { units: strums, slots, gaps, end: Math.ceil(at / perBar) * perBar }
}

/** A segment that isn't whole bars: how many slots a bar has, and which subdivision fits. */
function countError(
    units: Unit[],
    beatsPerBar: number,
    beatUnit: number,
    subdivision: Subdivision
): Error {
    const perBar = beatsPerBar * slotsPerBeatOf(subdivision, beatUnit)
    const n = units.length
    const fits = (['8ths', '16ths', 'triplets'] as const).filter((sub) => {
        if (sub === subdivision) return false
        try {
            return n % (beatsPerBar * slotsPerBeatOf(sub, beatUnit)) === 0
        } catch {
            return false
        }
    })
    return new Error(
        `${beatsPerBar}/${beatUnit} in ${subdivision} has ${perBar} slots a bar, but "${units.map(symbolOf).join(' ')}" has ${n}: fill each bar with - (no strum)${fits.length ? ` or write subdivision: ${fits.join(' or ')}` : ''}`
    )
}

/** Parses a ```strum block. Throws an Error whose message says what to write instead. */
export function parseStrum(source: string): StrumPattern {
    const fields = new Map<string, string>()
    const lines: string[] = []
    for (const raw of source.split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '')
        if (!line.trim()) continue
        const m = FIELD.exec(line.trim())
        if (m) {
            const key = m[1]!.toLowerCase()
            if (!KEYS.includes(key))
                throw new Error(
                    `Unknown key "${m[1]}": use time, subdivision, chord, tempo, tuning, title or pattern`
                )
            if (key === 'pattern') lines.push(m[2]!)
            else fields.set(key === 'bpm' ? 'tempo' : key, m[2]!.trim())
            continue
        }
        if (isCountLine(line)) continue
        lines.push(line)
    }

    const time = fields.get('time')
    const { beatsPerBar, beatUnit } = time ? parseTime(time) : { beatsPerBar: 4, beatUnit: 4 }
    const written = fields.get('subdivision')
    const subdivision = written ? parseSubdivision(written) : '8ths'
    const slotsPerBeat = slotsPerBeatOf(subdivision, beatUnit)
    const perBar = beatsPerBar * slotsPerBeat

    const tempoText = fields.get('tempo')
    let tempo: number | null = null
    if (tempoText) {
        tempo = Number(tempoText.replace(/\s*bpm$/i, ''))
        if (!Number.isFinite(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO)
            throw new Error(
                `Invalid tempo "${tempoText}": use beats a minute from ${MIN_TEMPO} to ${MAX_TEMPO}, e.g. tempo: 90`
            )
    }
    const chordText = fields.get('chord')
    const chord = chordText ? chordOf(chordText) : null

    // Pattern lines, each with the chord line written above it.
    const segments: Segment[] = []
    const above = new Map<number, { chord: string; column: number }[]>()
    lines.forEach((line, i) => {
        const chords = i < lines.length - 1 ? chordLine(line) : null
        if (chords) above.set(i + 1, chords)
        else segments.push(...readLine(line, i))
    })
    for (const line of above.keys())
        if (!segments.some((s) => s.line === line))
            throw new Error('A chord line needs a pattern line under it, e.g. D - D U - U D U')
    if (!segments.length)
        throw new Error('Write a strumming pattern, e.g. D - D U - U D U (or D DU UDU)')

    // Each segment (a line, or a part between bar lines) is placed on its own.
    const placed: (Placed & { line: number })[] = []
    let total = 0
    for (const segment of segments) {
        const here = place(segment, total, perBar, slotsPerBeat)
        if (!here) throw countError(segment.units, beatsPerBar, beatUnit, subdivision)
        placed.push({ ...here, line: segment.line })
        total = here.end
        if (total > perBar * MAX_STRUM_BARS) break
    }
    const bars = total / perBar
    if (bars > MAX_STRUM_BARS)
        throw new Error(
            `At most ${MAX_STRUM_BARS} bars in one pattern: split it into several blocks`
        )
    const slots: StrumSlot[] = Array.from({ length: bars * perBar }, () => ({
        stroke: 'rest',
        accent: false,
        ghost: false,
        chord: null
    }))
    for (const p of placed)
        p.units.forEach((unit, u) => {
            slots[p.slots[u]!] = {
                stroke: unit.stroke,
                accent: unit.accent,
                ghost: unit.ghost,
                chord: unit.chord
            }
        })
    // Chords written above a line start on the slot under them (or the next one).
    for (const [line, chords] of above) {
        const units = placed
            .filter((p) => p.line === line)
            .flatMap((p) =>
                p.units.map((unit, i) => ({ unit, slot: p.slots[i]!, gap: p.gaps[i]! }))
            )
        for (const { chord: written, column } of chords) {
            const name = chordOf(written)
            const under = units.find((u) => u.unit.column >= column)
            if (!under)
                throw new Error(
                    `The chord ${name} is past the end of its pattern line: move it over a strum`
                )
            // Over the gap a rest fills: the chord starts on that rest.
            const slot = under.unit.column > column && under.gap ? under.slot - 1 : under.slot
            if (!slots[slot]!.chord) slots[slot]!.chord = name
        }
    }

    return {
        slots,
        beatsPerBar,
        beatUnit,
        subdivision,
        slotsPerBeat,
        slotsPerBar: perBar,
        bars,
        chord,
        tempo,
        tuning: fields.get('tuning') || null,
        title: fields.get('title') || null
    }
}

function symbolOf(slot: { stroke: Stroke; accent: boolean; ghost: boolean }): string {
    const letter = { down: 'D', up: 'U', mute: 'X', rest: '-' }[slot.stroke]
    const marked = slot.accent ? `${letter}>` : letter
    return slot.ghost ? `(${marked})` : marked
}

/** The pattern written back, one symbol a slot, bars separated by `|`: `[G]D - D U - U D U`. */
export function formatStrum(pattern: StrumPattern): string {
    const bars: string[] = []
    for (let b = 0; b < pattern.bars; b++) {
        const slots = pattern.slots.slice(b * pattern.slotsPerBar, (b + 1) * pattern.slotsPerBar)
        bars.push(slots.map((s) => (s.chord ? `[${s.chord}]` : '') + symbolOf(s)).join(' '))
    }
    return bars.join(' | ')
}

/** What each slot is counted as: 1 & 2 &, 1 e & a, 1 & a (triplets), 1 2 3 4 5 6 (6/8). */
export function countOf(slot: number, slotsPerBeat: number, slotsPerBar: number): string {
    const inBar = slot % slotsPerBar
    const beat = Math.floor(inBar / slotsPerBeat) + 1
    const sub = inBar % slotsPerBeat
    if (sub === 0) return String(beat)
    if (slotsPerBeat === 2) return '&'
    if (slotsPerBeat === 3) return sub === 1 ? '&' : 'a'
    if (slotsPerBeat === 4) return ['', 'e', '&', 'a'][sub]!
    return sub === slotsPerBeat / 2 ? '&' : '·'
}
