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
import { parseStrum, type StrumPattern } from '../strum/pattern.js'
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

/** One bar: its chord (as shown, null when unnamed) and the notes it sounds, lowest first. */
export interface ProgressionBar {
    chord: string | null
    pitches: readonly number[]
}

export interface ProgressionEventOptions {
    /** Counted beats a minute (a quarter in 4/4; a dotted quarter with a 6/8 pattern); 90. */
    bpm?: number
    /** Beats in a bar, 1 to 16; 4 by default. A pattern's own time signature wins. */
    beatsPerBar?: number
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
/** Arpeggios: eighth notes. */
const ARPEGGIO_SLOTS = 2

/** A strumming pattern's bars, each its slots (as many slots as a bar holds). */
function patternBars(pattern: StrumPattern): StrumPattern['slots'][] {
    const perBar = pattern.slotsPerBeat * pattern.beatsPerBar
    const bars: StrumPattern['slots'][] = []
    for (let i = 0; i < pattern.slots.length; i += perBar)
        bars.push(pattern.slots.slice(i, i + perBar))
    return bars.length ? bars : [[]]
}

/**
 * The score of a progression strummed: every bar's slots with its chord's notes. `beats` is a down
 * strum on each beat, `bar` one down strum ringing the bar; a pattern plays its bars in turn.
 */
function strumScoreOf(
    bars: readonly ProgressionBar[],
    beatsPerBar: number,
    strum: Exclude<ProgressionStrum, 'arpeggio'>,
    pattern: StrumPattern | null
): StrumScore {
    const plain = { accent: false, ghost: false }
    if (pattern) {
        const own = patternBars(pattern)
        return {
            slotsPerBeat: pattern.slotsPerBeat,
            beatsPerBar: pattern.beatsPerBar,
            slotsPerPulse: pattern.slotsPerPulse,
            swing: pattern.swing,
            slots: bars.flatMap((bar, b) =>
                own[b % own.length]!.map((s) => ({
                    stroke: s.stroke,
                    accent: s.accent,
                    ghost: s.ghost,
                    pitches: [...bar.pitches]
                }))
            )
        }
    }
    return {
        slotsPerBeat: 1,
        beatsPerBar,
        slotsPerPulse: 1,
        swing: null,
        slots: bars.flatMap((bar) =>
            Array.from({ length: beatsPerBar }, (_, beat) => ({
                ...plain,
                stroke: strum === 'bar' && beat > 0 ? ('rest' as const) : ('down' as const),
                pitches: [...bar.pitches]
            }))
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
    const strum = options.strum ?? 'beats'
    const compound = pattern ? (pattern.slotsPerPulse ?? 1) > pattern.slotsPerBeat : false
    const bpm = tempoOf(options.bpm, compound)
    const tail = Math.max(0, options.tail ?? 1)
    const spread = options.spread
    let events: NoteEvent[]
    let start: number
    let beat: number
    let perPulse: number
    if (strum === 'arpeggio' && !pattern) {
        beat = 60 / bpm
        perPulse = 1
        start = options.countIn ? beatsPerBar * beat : 0
        const slot = beat / ARPEGGIO_SLOTS
        const end = start + bars.length * beatsPerBar * beat
        events = []
        bars.forEach((bar, b) => {
            const order = arpeggioOrder(bar.pitches)
            const barStart = start + b * beatsPerBar * beat
            const barEnd = b === bars.length - 1 ? end + tail : barStart + beatsPerBar * beat
            for (let k = 0; k < beatsPerBar * ARPEGGIO_SLOTS && order.length; k++) {
                const time = barStart + k * slot
                // Each note rings to the bar's end (let ring), as a picked chord does.
                events.push({
                    midi: order[k % order.length]!,
                    time,
                    duration: Math.max(0.06, barEnd - time),
                    velocity: k === 0 ? 92 : k % ARPEGGIO_SLOTS === 0 ? 80 : 72
                })
            }
        })
        if (options.countIn)
            for (let i = 0; i < beatsPerBar; i++) events.push(clickAt(i * beat, i, perPulse, true))
    } else {
        const score = strumScoreOf(
            bars,
            beatsPerBar,
            strum === 'arpeggio' ? 'beats' : strum,
            pattern
        )
        const pulse = score.slotsPerPulse ?? score.slotsPerBeat
        const slot = 60 / bpm / pulse
        beat = slot * score.slotsPerBeat
        perPulse = pulse / score.slotsPerBeat
        start = options.countIn ? beatsPerBar * beat : 0
        events = strumEvents(score, {
            bpm,
            countIn: options.countIn ?? false,
            tail,
            ...(options.seed === undefined ? {} : { seed: options.seed }),
            ...(spread === undefined ? {} : { spread })
        }).events
    }
    const barLength = beatsPerBar * beat
    if (options.click ?? true)
        bars.forEach((_, b) => {
            for (let i = 0; i < beatsPerBar; i++)
                events.push(clickAt(start + b * barLength + i * beat, i, perPulse, false))
        })
    events.sort((a, b) => a.time - b.time)
    const strums: StrumTiming[] = bars.map((_, b) => ({
        slot: b,
        time: start + b * barLength,
        duration: barLength
    }))
    return { events, length: start + bars.length * barLength, strums }
}

/** A chord to play: a symbol (or words), or its notes (lowest first) with the name to show. */
export type ProgressionChordInput = string | { chord?: string | null; pitches: readonly number[] }

export interface PlayProgressionOptions {
    /** Counted beats a minute (a quarter in 4/4, a dotted quarter with a 6/8 pattern); 90. */
    bpm?: number
    /** Beats in a bar, 1 to 16; 4 by default. A pattern's time signature wins. */
    beatsPerBar?: number
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
    /** Called as each bar starts sounding: its index, its chord, the pass (from 1). */
    onBar?: (bar: number, chord: string | null, pass: number) => void
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
    options: Pick<ProgressionEventOptions, 'beatsPerBar' | 'strum' | 'pattern'>,
    player: () => NotePlayer,
    settings: () => ProgressionSettings,
    timers: Pick<Window, 'setTimeout' | 'clearTimeout'>,
    onEnd?: () => void,
    follow?: (bars: StrumTiming[], player: NotePlayer, pass: number) => StrumFollower
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
        follow ? (strums, current) => follow(strums, current, pass) : undefined
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
        if (typeof c !== 'string') return { chord: c.chord ?? null, pitches: [...c.pitches] }
        const read = readChord(c)
        if (!read) throw new Error(`Didn't recognize the chord "${c}"`)
        return {
            chord: c,
            pitches: progressionPitches(read.symbol, sound, tuning, options.voicings)
        }
    })
    const pattern =
        typeof options.pattern === 'string'
            ? parseStrum(options.pattern)
            : (options.pattern ?? null)
    const win = options.window ?? (typeof window === 'undefined' ? undefined : window)
    const player = options.player ?? (win ? lightPlayer(win) : null)
    if (!player) throw new Error('playProgression needs a player or a window')
    const compound = pattern ? (pattern.slotsPerPulse ?? 1) > pattern.slotsPerBeat : false
    const settings: ProgressionSettings = {
        bpm: tempoOf(options.bpm ?? pattern?.tempo, compound),
        countIn: options.countIn ?? false,
        loop: options.loop ?? false,
        click: options.click ?? true,
        sound,
        volume: Number.isFinite(options.volume) ? Math.min(1, Math.max(0, options.volume!)) : 0.8
    }
    const timers = win ?? globalThis
    const onBar = options.onBar
    const handle = runProgression(
        bars,
        {
            ...(options.beatsPerBar === undefined ? {} : { beatsPerBar: options.beatsPerBar }),
            ...(options.strum ? { strum: options.strum } : {}),
            pattern
        },
        () => player,
        () => settings,
        timers,
        options.onEnd,
        onBar
            ? (timings, current, pass) =>
                  followTimes(
                      timers,
                      timings,
                      (t) => onBar(t.slot, bars[t.slot]?.chord ?? null, pass),
                      startsReported(current) ? Infinity : START_WAIT
                  )
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
