/**
 * A progression in time (#46): one chord a bar, strummed on the beats (or once a bar, arpeggiated,
 * or to a strumming pattern), with a metronome click, a count-in and a loop, through any
 * NotePlayer. `progression` blocks and ChordPro charts play this way from their bar; apps call
 * `playProgression` with their own player and tempo.
 */
import { STANDARD_TUNING } from '../chord/guitar.js'
import { parseTuning } from '../fretboard/tuning.js'
import { pianoVoicing } from '../keyboard/piano-chord.js'
import { readChord } from '../theory/chord-name.js'
import type { VoicingLookup } from '../voicings/index.js'
import { isCompound, parseStrum, type StrumPattern } from '../strum/pattern.js'
import {
    runPasses,
    strumEvents,
    tempoOf,
    type Pass,
    type StrumFollower,
    type StrumScore,
    type StrumSettings,
    type StrumTiming
} from '../strum/play.js'
import { strumVoicing } from '../strum/voicing.js'
import {
    lightPlayer,
    type NoteEvent,
    type NotePlayer,
    type PlayHandle,
    type Sound
} from './player.js'
import { startsReported, START_WAIT } from './follow.js'

/** How each bar's chord is played. */
export type ProgressionStrum = 'beats' | 'bar' | 'arpeggio'

export const PROGRESSION_STRUMS: readonly ProgressionStrum[] = ['beats', 'bar', 'arpeggio']

/**
 * One chord of a progression: its name (as shown, null when unnamed), the notes it sounds (lowest
 * first) and how long it lasts: `beats` of the time signature as written (quarters in 4/4,
 * eighths in 6/8), a bar when absent (#75). The last chord fills the last bar.
 */
export interface ProgressionBar {
    chord: string | null
    pitches: readonly number[]
    beats?: number
}

/** Where each chord starts and how long it lasts, in written beats, and the bars they fill. */
interface Spans {
    /** Each chord's first written beat and length. */
    spans: { start: number; length: number }[]
    /** The chord sounding on each written beat. */
    chordAt: number[]
    /** Whole bars. */
    bars: number
}

function spansOf(chords: readonly ProgressionBar[], beatsPerBar: number): Spans {
    const spans: Spans['spans'] = []
    const chordAt: number[] = []
    let at = 0
    chords.forEach((chord, i) => {
        const given = chord.beats
        const length =
            given === undefined || !Number.isFinite(given)
                ? beatsPerBar
                : Math.max(1, Math.round(given))
        spans.push({ start: at, length })
        for (let k = 0; k < length; k++) chordAt.push(i)
        at += length
    })
    const bars = Math.max(1, Math.ceil(at / beatsPerBar))
    // The last chord rings to the end of its bar.
    const last = spans[spans.length - 1]
    if (last) {
        const end = bars * beatsPerBar
        last.length += end - at
        while (chordAt.length < end) chordAt.push(spans.length - 1)
    }
    return { spans, chordAt, bars }
}

export interface ProgressionEventOptions {
    /** Counted beats a minute (a quarter in 4/4; a dotted quarter with a 6/8 pattern); 90. */
    bpm?: number
    /** Beats in a bar, 1 to 16; 4 by default. A pattern's own time signature wins. */
    beatsPerBar?: number
    /** The note that counts as a beat (4 by default; 8 in 6/8, counted in dotted quarters). */
    beatUnit?: number
    /** `beats` (a down strum on each beat, by default), `bar` (one strum a bar), `arpeggio`. */
    strum?: ProgressionStrum
    /** A strumming pattern played in each bar instead (its bars in turn, its chords ignored). */
    pattern?: StrumPattern | null
    /** The most time between the strings of a strum, in seconds: 0.012 by default, 0 a block. */
    spread?: number
    /** A metronome click on every beat; on by default. */
    click?: boolean
    /** A bar of clicks first. */
    countIn?: boolean
    /** How long the last chord rings after the progression, in seconds (0 when it loops). */
    tail?: number
    /** Varies the small differences between strums from pass to pass. */
    seed?: number
}

/** Clicks: the bar's first beat high, the counted beats lower, the others lowest. */
const CLICK = { first: 88, beat: 84, other: 81, duration: 0.05 }
/** The metronome sits under the music; the count-in is as loud as the strum bar's. */
const CLICK_VELOCITY = { first: 92, beat: 76, other: 62 }

/** A strumming pattern's bars, each its slots (as many slots as a bar holds). */
function patternBars(pattern: StrumPattern): StrumPattern['slots'][] {
    const perBar = pattern.slotsPerBeat * pattern.beatsPerBar
    const bars: StrumPattern['slots'][] = []
    for (let i = 0; i < pattern.slots.length; i += perBar)
        bars.push(pattern.slots.slice(i, i + perBar))
    return bars.length ? bars : [[]]
}

/**
 * The score of a progression strummed: every bar's slots (one a written beat) with its chord's
 * notes. `beats` is a down strum on each counted beat (1 and 4 in 6/8), `bar` one down strum
 * ringing the bar; a pattern plays its bars in turn.
 */
function strumScoreOf(
    chords: readonly ProgressionBar[],
    timeline: Spans,
    beatsPerBar: number,
    perPulse: number,
    strum: Exclude<ProgressionStrum, 'arpeggio'>,
    pattern: StrumPattern | null
): StrumScore {
    const plain = { accent: false, ghost: false }
    const pitchesAt = (beat: number) => [...chords[timeline.chordAt[beat] ?? 0]!.pitches]
    const bars = Array.from({ length: timeline.bars }, (_, b) => b)
    if (pattern) {
        const own = patternBars(pattern)
        return {
            slotsPerBeat: pattern.slotsPerBeat,
            beatsPerBar: pattern.beatsPerBar,
            slotsPerPulse: pattern.slotsPerPulse,
            swing: pattern.swing,
            // Each slot strums the chord of its beat.
            slots: bars.flatMap((b) =>
                own[b % own.length]!.map((s, k) => ({
                    stroke: s.stroke,
                    accent: s.accent,
                    ghost: s.ghost,
                    pitches: pitchesAt(b * beatsPerBar + Math.floor(k / pattern.slotsPerBeat))
                }))
            )
        }
    }
    const starts = new Set(timeline.spans.map((s) => s.start))
    return {
        slotsPerBeat: 1,
        beatsPerBar,
        slotsPerPulse: perPulse,
        swing: null,
        slots: bars.flatMap((b) =>
            Array.from({ length: beatsPerBar }, (_, beat) => {
                const at = b * beatsPerBar + beat
                // Once a bar: the bar's first beat and each chord change.
                const struck =
                    strum === 'bar' ? beat === 0 || starts.has(at) : beat % perPulse === 0
                return {
                    ...plain,
                    stroke: struck ? ('down' as const) : ('rest' as const),
                    pitches: pitchesAt(at)
                }
            })
        )
    }
}

/** An arpeggio's order: the bass, then up the strings and back down, over and over. */
function arpeggioOrder(pitches: readonly number[]): number[] {
    if (pitches.length < 3) return [...pitches]
    const up = pitches.slice(1)
    return [pitches[0]!, ...up, ...up.slice(1, -1).reverse()]
}

const clickAt = (time: number, beat: number, perPulse: number, loud: boolean): NoteEvent => {
    const level = beat === 0 ? 'first' : beat % perPulse === 0 ? 'beat' : 'other'
    return {
        midi: CLICK[level],
        time,
        duration: CLICK.duration,
        velocity: loud ? { first: 115, beat: 95, other: 75 }[level] : CLICK_VELOCITY[level],
        kind: 'click'
    }
}

/**
 * The notes of one pass of a progression (the count-in first when asked), its length in seconds,
 * and when each bar is played (`strums`, one a bar: `slot` is the bar's index), to light it.
 */
export function progressionEvents(
    bars: readonly ProgressionBar[],
    options: ProgressionEventOptions = {}
): Pass {
    const pattern = options.pattern ?? null
    const beatsPerBar = pattern
        ? pattern.beatsPerBar
        : Math.min(16, Math.max(1, Math.round(options.beatsPerBar ?? 4) || 4))
    const beatUnit = pattern ? pattern.beatUnit : (options.beatUnit ?? 4)
    const strum = options.strum ?? 'beats'
    const compound = isCompound(beatsPerBar, beatUnit)
    // Written beats in a counted one: three in compound time (6/8 counts dotted quarters).
    const perPulse = compound ? 3 : 1
    const bpm = tempoOf(options.bpm, compound)
    const tail = Math.max(0, options.tail ?? 1)
    const spread = options.spread
    const timeline = spansOf(bars, beatsPerBar)
    // The written beat (an 8th in 6/8).
    let beat: number
    let events: NoteEvent[]
    if (strum === 'arpeggio' && !pattern) {
        beat = 60 / bpm / perPulse
        const start = options.countIn ? beatsPerBar * beat : 0
        // Eighths: two a quarter, one an eighth in x/8.
        const slotsPerBeat = beatUnit >= 8 ? 1 : 8 / beatUnit
        const slot = beat / slotsPerBeat
        const end = start + timeline.bars * beatsPerBar * beat
        events = []
        const slots = Math.max(1, Math.round(beatsPerBar * slotsPerBeat))
        for (let b = 0; b < timeline.bars; b++) {
            const barStart = start + b * beatsPerBar * beat
            const barEnd = barStart + beatsPerBar * beat
            for (let k = 0; k < slots; k++) {
                const at = b * beatsPerBar + Math.floor(k / slotsPerBeat)
                const index = timeline.chordAt[at] ?? 0
                const span = timeline.spans[index]!
                const order = arpeggioOrder(bars[index]!.pitches)
                if (!order.length) continue
                // From the chord's first note in this bar: a new chord starts the arpeggio again.
                const from = Math.max(span.start * slotsPerBeat, b * slots)
                const n = b * slots + k - from
                const time = barStart + k * slot
                const spanEnd = start + (span.start + span.length) * beat
                const ring = Math.min(barEnd, spanEnd)
                const counted = k % (slotsPerBeat * perPulse) === 0
                // Each note rings to the bar's or the chord's end (let ring), as a picked chord.
                events.push({
                    midi: order[n % order.length]!,
                    time,
                    duration: Math.max(0.06, (ring >= end ? end + tail : ring) - time),
                    velocity: k === 0 ? 92 : counted ? 80 : 72
                })
            }
        }
        if (options.countIn)
            for (let i = 0; i < beatsPerBar; i++) events.push(clickAt(i * beat, i, perPulse, true))
    } else {
        const score = strumScoreOf(
            bars,
            timeline,
            beatsPerBar,
            perPulse,
            strum === 'arpeggio' ? 'beats' : strum,
            pattern
        )
        const pulse = score.slotsPerPulse ?? score.slotsPerBeat
        beat = (60 / bpm / pulse) * score.slotsPerBeat
        events = strumEvents(score, {
            bpm,
            countIn: options.countIn ?? false,
            tail,
            ...(options.seed === undefined ? {} : { seed: options.seed }),
            ...(spread === undefined ? {} : { spread })
        }).events
    }
    const start = options.countIn ? beatsPerBar * beat : 0
    const barLength = beatsPerBar * beat
    // The metronome clicks the counted beats (1 and 4 in 6/8).
    if (options.click ?? true)
        for (let b = 0; b < timeline.bars; b++)
            for (let i = 0; i < beatsPerBar; i += perPulse)
                events.push(clickAt(start + b * barLength + i * beat, i, perPulse, false))
    events.sort((a, b) => a.time - b.time)
    // Each chord as it sounds (to light it), and each bar (to count bars).
    const strums: StrumTiming[] = timeline.spans.map((span, i) => ({
        slot: i,
        time: start + span.start * beat,
        duration: span.length * beat
    }))
    const barTimes: StrumTiming[] = Array.from({ length: timeline.bars }, (_, b) => ({
        slot: b,
        time: start + b * barLength,
        duration: barLength
    }))
    return { events, length: start + timeline.bars * barLength, strums, bars: barTimes }
}

/** The chord sounding at the start of each bar (its index in the progression). */
export function chordOfBars(bars: readonly ProgressionBar[], beatsPerBar: number): number[] {
    const perBar = Math.min(16, Math.max(1, Math.round(beatsPerBar) || 4))
    const timeline = spansOf(bars, perBar)
    return Array.from({ length: timeline.bars }, (_, b) => timeline.chordAt[b * perBar] ?? 0)
}

/**
 * A chord to play: a symbol (or words), or an object with its name to show, its notes (lowest
 * first; from the name when absent) and how long it lasts (`beats` as written, a bar by default).
 */
export type ProgressionChordInput =
    string | { chord?: string | null; pitches?: readonly number[]; beats?: number }

export interface PlayProgressionOptions {
    /** Counted beats a minute (a quarter in 4/4, a dotted quarter with a 6/8 pattern); 90. */
    bpm?: number
    /** Beats in a bar, 1 to 16; 4 by default. A pattern's time signature wins. */
    beatsPerBar?: number
    /** The note that counts as a beat: 4 by default; 8 in 6/8 (counted in dotted quarters). */
    beatUnit?: number
    /** `beats` (by default), `bar` or `arpeggio`. */
    strum?: ProgressionStrum
    /** A strumming pattern (a ```strum block's text, or parsed) played in every bar. */
    pattern?: string | StrumPattern
    /** A metronome click on every beat; on by default. */
    click?: boolean
    /** A bar of clicks first; off by default. */
    countIn?: boolean
    loop?: boolean
    /** Open strings (MIDI, lowest first) or a tuning name, for chord symbols; standard. */
    tuning?: readonly number[] | string
    /** Finds guitar voicings for chord symbols (see `/voicings`); generated ones otherwise. */
    voicings?: VoicingLookup
    /** The light synthesizer of `window` by default. */
    player?: NotePlayer
    /** The window to play in (popouts have their own); the global one by default. */
    window?: Window
    /** Guitar by default; piano plays piano voicings of chord symbols, as blocks. */
    sound?: Sound
    /** 0 to 1, 0.8 by default. */
    volume?: number
    /** Called as each bar starts sounding: its index, the chord sounding, the pass (from 1). */
    onBar?: (bar: number, chord: string | null, pass: number) => void
    /** Called as each chord starts sounding: its index in `chords`, its name, the pass (#75). */
    onChord?: (index: number, chord: string | null, pass: number) => void
    /** Called once the progression is over (not after stop). */
    onEnd?: () => void
}

/** What can change while a progression plays; it applies from the next pass. */
export interface ProgressionChanges {
    bpm?: number
    loop?: boolean
    click?: boolean
    volume?: number
    sound?: Sound
}

export interface ProgressionHandle extends PlayHandle {
    /** Changes the tempo, loop, click, volume or sound from the next pass. */
    update(changes: ProgressionChanges): void
}

/** At most this many bars a progression (a long chart plays its first ones). */
export const MAX_PROGRESSION_BARS = 256

/** The notes of a chord symbol: a guitar voicing (the strum's), or a piano voicing on piano. */
export function progressionPitches(
    chord: string,
    sound: Sound = 'guitar',
    tuning: readonly number[] = STANDARD_TUNING,
    voicings?: VoicingLookup
): number[] {
    if (sound === 'piano') {
        const piano = pianoVoicing(readChord(chord)?.symbol ?? chord)?.pitches
        if (piano?.length) return [...piano]
    }
    return strumVoicing(chord, tuning, voicings)
}

/** Calls `call(i)` as each timing starts, from `heard()` (or `wait` ms after it's made). */
export function followTimes(
    win: Pick<Window, 'setTimeout' | 'clearTimeout'>,
    times: readonly StrumTiming[],
    call: (timing: StrumTiming) => void,
    wait: number = START_WAIT
): StrumFollower {
    const timers: ReturnType<Window['setTimeout']>[] = []
    let begun = false
    let stopped = false
    const begin = () => {
        if (begun || stopped) return
        begun = true
        for (const t of times)
            timers.push(win.setTimeout(() => !stopped && call(t), Math.max(0, t.time * 1000)))
    }
    const fallback = Number.isFinite(wait) ? win.setTimeout(begin, Math.max(0, wait)) : undefined
    return {
        heard() {
            if (fallback !== undefined) win.clearTimeout(fallback)
            begin()
        },
        stop() {
            stopped = true
            if (fallback !== undefined) win.clearTimeout(fallback)
            for (const t of timers) win.clearTimeout(t)
        }
    }
}

/** The settings of a progression player, read at each pass. */
export interface ProgressionSettings extends StrumSettings {
    click: boolean
}

/**
 * Plays `bars` pass after pass (see `runStrum` for the timing), from `settings()` read at each
 * pass. `follow` gets each pass's bars (`slot` is the bar's index), to light them.
 */
export function runProgression(
    bars: readonly ProgressionBar[],
    options: Pick<ProgressionEventOptions, 'beatsPerBar' | 'beatUnit' | 'strum' | 'pattern'>,
    player: () => NotePlayer,
    settings: () => ProgressionSettings,
    timers: Pick<Window, 'setTimeout' | 'clearTimeout'>,
    onEnd?: () => void,
    follow?: (chords: StrumTiming[], player: NotePlayer, pass: number, made: Pass) => StrumFollower
): PlayHandle {
    let pass = 0
    const make = (s: StrumSettings, first: boolean, id: number): Pass =>
        progressionEvents(bars, {
            ...options,
            bpm: s.bpm,
            click: (s as ProgressionSettings).click,
            countIn: first && s.countIn,
            tail: s.loop ? 0 : 1.2,
            seed: id,
            spread: s.sound === 'piano' ? 0 : 0.012
        })
    return runPasses(
        (s, first, id) => {
            pass = id
            return make(s, first, id)
        },
        player,
        settings,
        timers,
        onEnd,
        follow ? (strums, current, made) => follow(strums, current, pass, made) : undefined
    )
}

/**
 * Plays chords in time, one a bar (#46): strummed on the beats by default, with a metronome
 * click, a count-in when asked, and a loop. Chord symbols take the strum's guitar voicing (a piano
 * voicing with `sound: 'piano'`); given notes play as given. Throws on a chord it can't read, an
 * unknown tuning, or a pattern with a mistake.
 */
export function playProgression(
    chords: readonly ProgressionChordInput[],
    options: PlayProgressionOptions = {}
): ProgressionHandle {
    const sound: Sound = options.sound === 'piano' ? 'piano' : 'guitar'
    const given = options.tuning ?? null
    const tuning =
        given === null
            ? STANDARD_TUNING
            : typeof given === 'string'
              ? parseTuning(given)
              : [...given]
    if (!tuning) throw new Error(`Unknown tuning "${String(given)}"`)
    if (!chords.length) throw new Error('playProgression needs at least one chord')
    const bars: ProgressionBar[] = chords.slice(0, MAX_PROGRESSION_BARS).map((c) => {
        const name = typeof c === 'string' ? c : (c.chord ?? null)
        const beats = typeof c === 'string' ? undefined : c.beats
        const timed = beats === undefined ? {} : { beats }
        if (typeof c !== 'string' && c.pitches)
            return { chord: name, pitches: [...c.pitches], ...timed }
        const read = name ? readChord(name) : null
        if (!read) throw new Error(`Didn't recognize the chord "${name ?? ''}"`)
        return {
            chord: name,
            pitches: progressionPitches(read.symbol, sound, tuning, options.voicings),
            ...timed
        }
    })
    const pattern =
        typeof options.pattern === 'string'
            ? parseStrum(options.pattern)
            : (options.pattern ?? null)
    const win = options.window ?? (typeof window === 'undefined' ? undefined : window)
    const player = options.player ?? (win ? lightPlayer(win) : null)
    if (!player) throw new Error('playProgression needs a player or a window')
    const compound = pattern
        ? pattern.compound
        : isCompound(options.beatsPerBar ?? 4, options.beatUnit ?? 4)
    const settings: ProgressionSettings = {
        bpm: tempoOf(options.bpm ?? pattern?.tempo, compound),
        countIn: options.countIn ?? false,
        loop: options.loop ?? false,
        click: options.click ?? true,
        sound,
        volume: Number.isFinite(options.volume) ? Math.min(1, Math.max(0, options.volume!)) : 0.8
    }
    const timers = win ?? globalThis
    const { onBar, onChord } = options
    const perBar = pattern ? pattern.beatsPerBar : (options.beatsPerBar ?? 4)
    const barChords = chordOfBars(bars, perBar)
    const handle = runProgression(
        bars,
        {
            ...(options.beatsPerBar === undefined ? {} : { beatsPerBar: options.beatsPerBar }),
            ...(options.beatUnit === undefined ? {} : { beatUnit: options.beatUnit }),
            ...(options.strum ? { strum: options.strum } : {}),
            pattern
        },
        () => player,
        () => settings,
        timers,
        options.onEnd,
        onBar || onChord
            ? (timings, current, pass, made) => {
                  const wait = startsReported(current) ? Infinity : START_WAIT
                  const followers = [
                      ...(onChord
                          ? [
                                followTimes(
                                    timers,
                                    timings,
                                    (t) => onChord(t.slot, bars[t.slot]?.chord ?? null, pass),
                                    wait
                                )
                            ]
                          : []),
                      ...(onBar
                          ? [
                                followTimes(
                                    timers,
                                    made.bars ?? timings,
                                    (t) =>
                                        onBar(
                                            t.slot,
                                            bars[barChords[t.slot] ?? 0]?.chord ?? null,
                                            pass
                                        ),
                                    wait
                                )
                            ]
                          : [])
                  ]
                  return {
                      heard: () => followers.forEach((f) => f.heard()),
                      stop: () => followers.forEach((f) => f.stop())
                  }
              }
            : undefined
    )
    return {
        stop: () => handle.stop(),
        update(changes) {
            if (changes.bpm !== undefined && Number.isFinite(changes.bpm))
                settings.bpm = tempoOf(changes.bpm, compound)
            if (changes.loop !== undefined) settings.loop = changes.loop
            if (changes.click !== undefined) settings.click = changes.click
            if (changes.volume !== undefined && Number.isFinite(changes.volume))
                settings.volume = Math.min(1, Math.max(0, changes.volume))
            if (changes.sound === 'guitar' || changes.sound === 'piano')
                settings.sound = changes.sound
        }
    }
}
