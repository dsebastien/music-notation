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
import { t } from '../i18n/translate.js'
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
    /**
     * Compound time (6/8, 9/8, 12/8…): the beat felt and counted for the tempo is a dotted note,
     * three of the written beats.
     */
    compound: boolean
    /** Slots in one counted beat: `slotsPerBeat`, three times that in compound time. */
    slotsPerPulse: number
    /**
     * Swung pairs of slots (`swing:`): where the second slot of each pair falls, as a fraction of
     * the pair (2/3 for a triplet swing, a shuffle); null when straight.
     */
    swing: number | null
    slotsPerBar: number
    bars: number
    /** The chord for the whole pattern (`chord:`), until a change. */
    chord: string | null
    /** Beats a minute (`tempo:`), null when not written. */
    tempo: number | null
    /** Open strings for playback (`tuning:`), as written; null for standard guitar. */
    tuning: string | null
    title: string | null
    /**
     * How strums written alone were read when the hand's motion placed them and the bar ends with
     * whole beats of no strum (`D U D U` in triplets: `D - U D - U` and 2 empty beats), with what
     * to write instead; null otherwise (#73).
     */
    note: string | null
}

/** Bounds that keep a pattern quick to draw and to hear. */
export const MAX_STRUM_BARS = 16
export const DEFAULT_TEMPO = 90
/** The default tempo of compound time, in dotted quarters (8ths at 180 a minute). */
export const DEFAULT_COMPOUND_TEMPO = 60
export const MIN_TEMPO = 20
export const MAX_TEMPO = 240

const KEYS = ['pattern', 'time', 'subdivision', 'swing', 'chord', 'tempo', 'bpm', 'tuning', 'title']
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

/** "4/4", "6/8", "C" (common time), "cut" (2/2). Throws a message for the user. */
export function parseTime(text: string): { beatsPerBar: number; beatUnit: number } {
    const word = text.trim().toLowerCase()
    if (word === 'c' || word === 'common') return { beatsPerBar: 4, beatUnit: 4 }
    if (word === 'cut' || word === '¢') return { beatsPerBar: 2, beatUnit: 2 }
    const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(word)
    const beats = m ? Number(m[1]) : NaN
    const unit = m ? Number(m[2]) : NaN
    if (!(beats >= 1 && beats <= 16) || ![2, 4, 8, 16].includes(unit))
        throw new Error(t('strum.time.invalid', { text }))
    return { beatsPerBar: beats, beatUnit: unit }
}

/**
 * Compound time: 6, 9 or 12 (any multiple of 3 from 6) 8ths or 16ths a bar, felt in dotted
 * beats of three (6/8 is two beats of three 8ths). 3/8 is counted in three.
 */
export const isCompound = (beatsPerBar: number, beatUnit: number) =>
    beatUnit >= 8 && beatsPerBar >= 6 && beatsPerBar % 3 === 0

/**
 * `swing:` as where the second slot of each pair falls: yes (or on, shuffle, triplet) is 2/3, a
 * triplet swing; a percentage from 50 (straight) to 75 is that much of the pair; no (or off,
 * straight) is null. Throws a message.
 */
export function parseSwing(text: string): number | null {
    const word = text.trim().toLowerCase()
    if (['yes', 'on', 'true', 'swing', 'swung', 'shuffle', 'triplet', 'triplets'].includes(word))
        return 2 / 3
    if (['no', 'off', 'false', 'straight', 'none'].includes(word)) return null
    const m = /^(\d{2}(?:\.\d+)?)\s*%?$/.exec(word)
    const n = m ? Number(m[1]) : NaN
    if (!(n >= 50 && n <= 75)) throw new Error(t('strum.swing.invalid', { text }))
    return n === 50 ? null : n / 100
}

/** "8ths", "eighths", "8"; "16ths", "sixteenths", "16"; "triplets". Throws a message. */
export function parseSubdivision(text: string): Subdivision {
    const word = text
        .trim()
        .toLowerCase()
        .replace(/\s+notes?$/, '')
    if (['8ths', '8th', '8', '1/8', 'eighths', 'eighth', 'eights'].includes(word)) return '8ths'
    if (['16ths', '16th', '16', '1/16', 'sixteenths', 'sixteenth'].includes(word)) return '16ths'
    if (['triplets', 'triplet', '8th triplets', 'eighth triplets', '3'].includes(word))
        return 'triplets'
    throw new Error(t('strum.subdivision.invalid', { text }))
}

/** Slots in one beat of the time signature. Throws when the subdivision can't divide the beat. */
export function slotsPerBeatOf(subdivision: Subdivision, beatUnit: number): number {
    if (subdivision === 'triplets') {
        if (beatUnit !== 4)
            throw new Error(
                t(beatUnit === 8 ? 'strum.triplets.quarterBeat68' : 'strum.triplets.quarterBeat')
            )
        return 3
    }
    const n = (subdivision === '8ths' ? 8 : 16) / beatUnit
    if (n < 1) throw new Error(t('strum.subdivision.tooLong', { unit: beatUnit }))
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
                ? t('strum.chord.notRecognizedTry', {
                      chord: text,
                      suggestions: suggestChords(text)
                  })
                : t('strum.chord.empty')
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
            if (end < 0) throw new Error(t('strum.line.bracketMissing', { text: line.slice(i) }))
            chordNext = chordOf(line.slice(i + 1, end))
            i = end
            previous = null
            continue
        }
        if (c === '|') {
            if (ghost) throw new Error(t('strum.line.barInGhost'))
            if (units.length) segments.push({ units: [], line: lineIndex })
            previous = null
            glued = false
            continue
        }
        if (c === '>') {
            if (previous && previous.stroke !== 'rest' && !previous.accent) {
                if (previous.ghost) throw new Error(t('strum.line.accentAndGhost'))
                previous.accent = true
            } else accentNext = true
            continue
        }
        if (c === '(') {
            if (ghost) throw new Error(t('strum.line.ghostNested'))
            ghost = true
            previous = null
            continue
        }
        if (c === ')') {
            if (!ghost) throw new Error(t('strum.line.parenUnopened'))
            ghost = false
            continue
        }
        const stroke = STROKES[lower] ?? (RESTS.has(c) ? 'rest' : null)
        if (!stroke)
            throw new Error(
                t('strum.line.notUnderstood', { char: c, line: line.trim(), help: t('strum.help') })
            )
        const isRest = stroke === 'rest'
        if (isRest && (accentNext || ghost)) {
            throw new Error(
                t(accentNext ? 'strum.line.accentNeedsStrum' : 'strum.line.ghostNoRests')
            )
        }
        if (accentNext && ghost) throw new Error(t('strum.line.accentAndGhost'))
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
    if (ghost) throw new Error(t('strum.line.parenUnclosed', { line: line.trim() }))
    if (accentNext) throw new Error(t('strum.line.accentNeedsStrum'))
    if (chordNext) throw new Error(t('strum.line.chordEndsPattern', { chord: chordNext }))
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

/**
 * The next slot from `at` that the hand's motion strikes: down on the beat and up between (in
 * 8ths, even and odd slots; in 16ths, the same on each 8th and 16th); in triplets, a shuffle:
 * down on the beat, up on the third triplet (the middle one only when written with rests).
 */
function nextMotion(
    at: number,
    motion: 'down' | 'up' | 'any',
    perBar: number,
    perBeat: number
): number {
    for (let slot = at; ; slot++) {
        const pos = perBeat === 3 ? (slot % perBar) % 3 : (slot % perBar) % 2
        const down = pos === 0
        const up = perBeat === 3 ? pos === 2 : pos === 1
        if (motion === 'down' ? down : motion === 'up' ? up : down || up) return slot
    }
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
 * up strum the next odd one (in triplets, a shuffle: down on the beat, up on the third triplet),
 * and the slots skipped are rests; the segment is padded to the end of its bar. Strums alone that
 * fill whole bars are one a slot, unless that puts an up strum on a beat or between beats' down
 * strums in simple time (`D DU UDU` in 3/4 is a 4/4 pattern, not `D D U U D U`). Null when
 * neither reads; the slots taken when the strums run past a bar and stop early in the next.
 */
function place(
    segment: Segment,
    at: number,
    perBar: number,
    perBeat: number,
    compound: boolean
): Placed | { spill: number } | null {
    const start = at
    const { units } = segment
    const hasRests = units.some((u) => u.stroke === 'rest')
    // An up strum on an even slot is against the hand's motion (8ths and 16ths in simple time;
    // triplets and compound time strum D U D, D D U… one a slot).
    const againstMotion =
        !hasRests &&
        !compound &&
        perBeat % 2 === 0 &&
        units.some((u, i) => u.stroke === 'up' && i % 2 === 0)
    if (units.length % perBar === 0 && !againstMotion)
        return {
            units,
            slots: units.map((_, i) => at + i),
            gaps: units.map(() => false),
            end: at + units.length
        }
    if (hasRests && !separated(units)) return null
    const strums = units.filter((u) => u.stroke !== 'rest')
    const slots: number[] = []
    const gaps: boolean[] = []
    for (const unit of strums) {
        // A muted strum glued to a strum (DX) takes the next slot the hand passes, down or up (a
        // chuck on the beat or between); written alone (D X D X), it's a down strum's motion.
        const motion =
            unit.stroke === 'up' ? 'up' : unit.stroke === 'down' || unit.spaced ? 'down' : 'any'
        const slot = nextMotion(at, motion, perBar, perBeat)
        slots.push(slot)
        gaps.push(slot > at)
        at = slot + 1
    }
    // Strums that run past a bar and fill less than half of the last one: likely a pattern for
    // another time signature (a 4/4 pattern in 3/4), not a bar of rests.
    const used = at % perBar
    if (at > start + perBar && used > 0 && used < perBar / 2) return { spill: at - start }
    return { units: strums, slots, gaps, end: Math.ceil(at / perBar) * perBar }
}

/** The time signature whose bar is `slots` long, when it's another one: "time: 3/4". */
function timeFor(slots: number, beatsPerBar: number, beatUnit: number, slotsPerBeat: number) {
    const beats = slots / slotsPerBeat
    return Number.isInteger(beats) && beats >= 2 && beats <= 12 && beats !== beatsPerBar
        ? `time: ${beats}/${beatUnit}`
        : null
}

/** "1 bar and 2 slots", "2 bars and 1 slot". */
const barsAndSlots = (slots: number, perBar: number) => {
    const bars = Math.floor(slots / perBar)
    const rest = slots % perBar
    return t('strum.count.barsAndSlots', {
        bars: t(bars === 1 ? 'strum.count.bar.one' : 'strum.count.bar.other', { n: bars }),
        slots: t(rest === 1 ? 'strum.count.slot.one' : 'strum.count.slot.other', { n: rest })
    })
}

/** Units as written: a space before each one written at a token's start (`D DU UDU`). */
const asWritten = (units: Unit[]) =>
    units.map((u, i) => (i && u.spaced ? ' ' : '') + symbolOf(u)).join('')

/**
 * Strums placed by the hand's motion that run past a bar and stop early in the next one: how many
 * slots a bar has, and what to write.
 */
function spillError(
    units: Unit[],
    slots: number,
    beatsPerBar: number,
    beatUnit: number,
    subdivision: Subdivision
): Error {
    const perBeat = slotsPerBeatOf(subdivision, beatUnit)
    const perBar = beatsPerBar * perBeat
    const time = timeFor(slots, beatsPerBar, beatUnit, perBeat)
    return new Error(
        t('strum.count.spill', {
            time: `${beatsPerBar}/${beatUnit}`,
            subdivision,
            perBar,
            written: asWritten(units),
            slots,
            count: barsAndSlots(slots, perBar),
            orTime: time ? t('strum.count.spillOrTime', { time }) : ''
        })
    )
}

/** A segment that isn't whole bars: how many slots a bar has, and which subdivision fits. */
function countError(
    units: Unit[],
    beatsPerBar: number,
    beatUnit: number,
    subdivision: Subdivision
): Error {
    const perBeat = slotsPerBeatOf(subdivision, beatUnit)
    const perBar = beatsPerBar * perBeat
    const n = units.length
    const time = timeFor(n, beatsPerBar, beatUnit, perBeat)
    const fits = (['8ths', '16ths', 'triplets'] as const).filter((sub) => {
        if (sub === subdivision) return false
        try {
            return n % (beatsPerBar * slotsPerBeatOf(sub, beatUnit)) === 0
        } catch {
            return false
        }
    })
    const items = [...(time ? [time] : []), ...fits.map((f) => `subdivision: ${f}`)]
    return new Error(
        t('strum.count.mismatch', {
            time: `${beatsPerBar}/${beatUnit}`,
            subdivision,
            perBar,
            written: units.map(symbolOf).join(' '),
            n,
            alternatives: items
                .map((item, i) =>
                    t(
                        i === 0
                            ? 'strum.count.alternative.first'
                            : i === items.length - 1
                              ? 'strum.count.alternative.last'
                              : 'strum.count.alternative.next',
                        { item }
                    )
                )
                .join('')
        })
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
            if (!KEYS.includes(key)) throw new Error(t('strum.key.unknown', { key: m[1]! }))
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
    const compound = isCompound(beatsPerBar, beatUnit)
    const swingText = fields.get('swing')
    const swing = swingText ? parseSwing(swingText) : null
    if (swing !== null) {
        if (subdivision === 'triplets') throw new Error(t('strum.swing.withTriplets'))
        if (compound)
            throw new Error(
                t('strum.swing.compound', {
                    time: `${beatsPerBar}/${beatUnit}`,
                    unit: beatUnit === 8 ? '8ths' : '16ths'
                })
            )
        if (slotsPerBeat % 2)
            throw new Error(
                t('strum.swing.oneSlot', { time: `${beatsPerBar}/${beatUnit}`, subdivision })
            )
    }

    const tempoText = fields.get('tempo')
    let tempo: number | null = null
    if (tempoText) {
        tempo = Number(tempoText.replace(/\s*bpm$/i, ''))
        if (!Number.isFinite(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO)
            throw new Error(
                t('strum.tempo.invalid', { text: tempoText, min: MIN_TEMPO, max: MAX_TEMPO })
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
            throw new Error(t('strum.pattern.chordLineAlone'))
    if (!segments.length) throw new Error(t('strum.pattern.missing'))

    // Each segment (a line, or a part between bar lines) is placed on its own.
    const placed: (Placed & { line: number; start: number })[] = []
    let total = 0
    for (const segment of segments) {
        const here = place(segment, total, perBar, slotsPerBeat, compound)
        if (!here) throw countError(segment.units, beatsPerBar, beatUnit, subdivision)
        if ('spill' in here)
            throw spillError(segment.units, here.spill, beatsPerBar, beatUnit, subdivision)
        placed.push({ ...here, line: segment.line, start: total })
        total = here.end
        if (total > perBar * MAX_STRUM_BARS) break
    }
    const bars = total / perBar
    if (bars > MAX_STRUM_BARS) throw new Error(t('strum.bars.tooMany', { max: MAX_STRUM_BARS }))
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
            if (!under) throw new Error(t('strum.chord.pastEnd', { chord: name }))
            // Over the gap a rest fills: the chord starts on that rest.
            const slot = under.unit.column > column && under.gap ? under.slot - 1 : under.slot
            if (!slots[slot]!.chord) slots[slot]!.chord = name
        }
    }

    // Strums the hand's motion moved, then whole beats of no strum to the end of the bar: say so.
    let note: string | null = null
    for (const p of placed) {
        if (!p.gaps.some(Boolean) || !p.slots.length) continue
        const last = Math.max(...p.slots)
        const empty = Math.floor((p.end - last - 1) / slotsPerBeat)
        if (empty < 1) continue
        const read = slots
            .slice(p.start, last + 1)
            .map((s) => symbolOf(s))
            .join(' ')
        note = t(empty === 1 ? 'strum.note.one' : 'strum.note.other', { read, n: empty })
        break
    }

    return {
        note,
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
