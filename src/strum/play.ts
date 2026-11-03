/**
 * Hearing a strumming pattern (#22): each strum as the chord's notes, low to high for a down
 * strum and high to low for an up strum, accents louder, ghost strums soft, muted strums a short
 * percussive chuck; in time, with a count-in, looped without a gap. Plays through any NotePlayer
 * (the light synthesizer or an app's soundfont).
 */
import { STANDARD_TUNING } from '../chord/guitar.js'
import { parseTuning } from '../fretboard/tuning.js'
import { readChord } from '../theory/chord-name.js'
import type { VoicingLookup } from '../voicings/index.js'
import { strumVoicing } from './voicing.js'
import {
    lightPlayer,
    type NoteEvent,
    type NotePlayer,
    type PlayHandle,
    type Sound
} from '../playback/player.js'
import { sawStart, startsReported } from '../playback/follow.js'
import {
    DEFAULT_TEMPO,
    MAX_TEMPO,
    MIN_TEMPO,
    parseStrum,
    type StrumPattern,
    type Stroke
} from './pattern.js'

/** A pattern ready to play: each slot's strum and the notes it sounds. */
export interface StrumScore {
    slots: { stroke: Stroke; accent: boolean; ghost: boolean; pitches: number[] }[]
    slotsPerBeat: number
    beatsPerBar: number
}

/**
 * Each slot's notes: the chord that starts there, else the one before it. Strums before the first
 * change take `chord:` when written, else the chord the pattern ends on (as when it repeats).
 */
export function scoreOf(
    pattern: StrumPattern,
    voicing: (chord: string | null) => number[]
): StrumScore {
    const changes = pattern.slots.filter((s) => s.chord)
    let current = pattern.chord ?? changes[changes.length - 1]?.chord ?? null
    let pitches = voicing(current)
    return {
        slotsPerBeat: pattern.slotsPerBeat,
        beatsPerBar: pattern.beatsPerBar,
        slots: pattern.slots.map((slot) => {
            if (slot.chord && slot.chord !== current) {
                current = slot.chord
                pitches = voicing(current)
            }
            return { stroke: slot.stroke, accent: slot.accent, ghost: slot.ghost, pitches }
        })
    }
}

export interface StrumEventOptions {
    /** Beats a minute (the time signature's beat: a quarter in 4/4, an eighth in 6/8). */
    bpm?: number
    /** A bar of clicks first. */
    countIn?: boolean
    /** How long the last strum rings after the pattern, in seconds (0 when it loops). */
    tail?: number
}

/** MIDI velocities: a normal strum, an accent, a ghost strum, a muted one. */
export const STRUM_VELOCITY = { normal: 90, accent: 120, ghost: 40, mute: 80 }
/** The count-in's clicks: a high short note, higher on the first beat. */
const CLICK = { first: 88, other: 81, duration: 0.05 }
/** Up strums catch the higher strings. */
const UP_STRINGS = 4
const MUTE_SECONDS = 0.04

/** Beats a minute within bounds; the default when it isn't a number. */
export const tempoOf = (bpm: number | null | undefined) =>
    bpm === null || bpm === undefined || !Number.isFinite(bpm)
        ? DEFAULT_TEMPO
        : Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, bpm))

/** When a slot's strum is played in a pass: from its start, for one slot. */
export interface StrumTiming {
    slot: number
    /** Seconds from the start of the pass. */
    time: number
    duration: number
}

/**
 * The notes of one pass of a pattern (with the count-in first when asked), its length in seconds
 * (count-in plus the pattern's bars, without the last strum's ring), the time the next pass starts
 * when it loops, and when each strum is played (to light it).
 */
export function strumEvents(
    score: StrumScore,
    options: StrumEventOptions = {}
): { events: NoteEvent[]; length: number; strums: StrumTiming[] } {
    const beat = 60 / tempoOf(options.bpm)
    const slot = beat / score.slotsPerBeat
    const events: NoteEvent[] = []
    let start = 0
    if (options.countIn) {
        for (let b = 0; b < score.beatsPerBar; b++)
            events.push({
                midi: b === 0 ? CLICK.first : CLICK.other,
                time: b * beat,
                duration: CLICK.duration,
                velocity: b === 0 ? 110 : 80
            })
        start = score.beatsPerBar * beat
    }
    const end = start + score.slots.length * slot
    const tail = Math.max(0, options.tail ?? 1)
    const sounding = score.slots.flatMap((s, i) => (s.stroke === 'rest' ? [] : [i]))
    const strums: StrumTiming[] = []
    sounding.forEach((i, n) => {
        const s = score.slots[i]!
        const at = start + i * slot
        strums.push({ slot: i, time: at, duration: slot })
        // A strum rings until the next one (a muted strum damps it too), the last one past the end.
        const next = sounding[n + 1]
        const until = next === undefined ? end + tail : start + next * slot
        const inBar = i % (score.slotsPerBeat * score.beatsPerBar)
        // A muted strum on an up slot is an up stroke (the hand's motion, as when placing).
        const upSlot = score.slotsPerBeat === 3 ? inBar % 3 === 1 : inBar % 2 === 1
        const up = s.stroke === 'up' || (s.stroke === 'mute' && upSlot)
        const strings = up ? s.pitches.slice(-UP_STRINGS).reverse() : s.pitches
        // The strings of one strum, a few milliseconds apart (closer at fast tempos).
        const spread = Math.min(0.012, (slot * 0.4) / Math.max(1, strings.length))
        const velocity =
            s.stroke === 'mute'
                ? s.accent
                    ? STRUM_VELOCITY.accent
                    : s.ghost
                      ? STRUM_VELOCITY.ghost
                      : STRUM_VELOCITY.mute
                : s.accent
                  ? STRUM_VELOCITY.accent
                  : s.ghost
                    ? STRUM_VELOCITY.ghost
                    : STRUM_VELOCITY.normal
        strings.forEach((midi, k) => {
            const time = at + k * spread
            const duration =
                s.stroke === 'mute' ? MUTE_SECONDS : Math.max(MUTE_SECONDS, until - time)
            events.push({ midi, time, duration, velocity })
        })
    })
    return { events, length: end, strums }
}

/** What a strum player reads at each pass, so the bar's changes apply from the next pass. */
export interface StrumSettings {
    bpm: number
    countIn: boolean
    loop: boolean
    sound: Sound
    volume: number
}

/** Stands for the notes given to playStrum in place of a chord. */
const GIVEN = '\u0000given'

/** A first start report later than this (ms) after the play call is a load, not the player's lead. */
const LOADING = 250

/** The last strum's ring after a pattern that doesn't loop, in seconds. */
const TAIL = 1.2

/** Lights the strums of one pass as they sound (see `followNotes`). */
export interface StrumFollower {
    /** The pass's notes started sounding now. */
    heard(): void
    stop(): void
}

/**
 * Plays a score through `player`, pass after pass while `settings().loop` is on. Each next pass
 * is started on a timer at the exact end of the previous one, counted from the first pass's start
 * (so delays don't add up), and is scheduled by the player like the first: no gap, no drift. With
 * a player that says when its notes start (`reportsStart`, or seen calling `onStart`), the
 * passes are counted from that moment, so a first play that waits for a soundfont isn't cut by the
 * second pass; a player not known to report yet is counted from the play call until its first
 * start report, if that comes before the second pass. `follow` gets each pass's strums, to light
 * them from the moment they sound.
 */
export function runStrum(
    score: StrumScore,
    player: () => NotePlayer,
    settings: () => StrumSettings,
    timers: Pick<Window, 'setTimeout' | 'clearTimeout'>,
    onEnd?: () => void,
    follow?: (strums: StrumTiming[], player: NotePlayer) => StrumFollower
): PlayHandle {
    let stopped = false
    let timer: number | undefined
    let pass = 0
    // When the first pass would have been asked for without any wait; then the passes' lengths.
    let anchor: number | null = null
    let elapsed = 0
    const handles: PlayHandle[] = []
    const followers: StrumFollower[] = []
    const finish = () => {
        if (stopped) return
        stopped = true
        onEnd?.()
    }
    const schedule = (looping: boolean) => {
        timer = timers.setTimeout(
            () => {
                if (stopped) return
                if (settings().loop) play(false)
                else if (looping) finish()
            },
            Math.max(0, anchor! + elapsed * 1000 - Date.now())
        )
    }
    const play = (first: boolean) => {
        if (stopped) return
        const s = settings()
        const id = ++pass
        const looping = s.loop
        const { events, length, strums } = strumEvents(score, {
            bpm: s.bpm,
            countIn: first && s.countIn,
            tail: looping ? 0 : TAIL
        })
        const current = player()
        const follower = follow?.(strums, current)
        if (follower) followers.push(follower)
        while (followers.length > 2) followers.shift()
        const called = Date.now()
        // Waits for the player's start only on the first pass (a soundfont may load first).
        const waits = first && startsReported(current)
        let heard = false
        elapsed += length
        handles.push(
            current.play(events, {
                sound: s.sound,
                volume: s.volume,
                // A pass that didn't loop ends the playback once its last strum has rung.
                onEnd: () => {
                    if (id === pass && !looping) finish()
                },
                onStart: () => {
                    if (stopped || heard) return
                    heard = true
                    sawStart(current)
                    follower?.heard()
                    if (!first) return
                    // The time the player takes to start is kept (it takes it every pass): the
                    // passes are counted from the play call. A long wait is loading, after which
                    // the player starts at once (a soundfont): they're counted from now.
                    const now = Date.now()
                    const at = now - called < LOADING ? called : now
                    if (waits) {
                        anchor = at
                        schedule(looping)
                    } else if (id === pass && anchor !== null && at !== anchor) {
                        // A player that reports without declaring it, heard before the second
                        // pass was asked for: count from its start.
                        timers.clearTimeout(timer)
                        anchor = at
                        schedule(looping)
                    }
                }
            })
        )
        // Older passes have ended; their handles only matter while their notes may ring.
        while (handles.length > 2) handles.shift()
        if (!waits) {
            anchor ??= called
            schedule(looping)
        }
    }
    play(true)
    return {
        stop() {
            stopped = true
            timers.clearTimeout(timer)
            for (const h of handles) h.stop()
            for (const f of followers) f.stop()
        }
    }
}

export interface PlayStrumOptions {
    /** Beats a minute: the pattern's `tempo:`, else 90. */
    bpm?: number
    /** A chord symbol (or words), or the notes to strum, lowest string first. */
    chord?: string | readonly number[]
    /** Open strings (MIDI, lowest first) or a tuning name (`standard`, `drop d`, `ukulele`…). */
    tuning?: readonly number[] | string
    /** A bar of clicks first; false by default. */
    countIn?: boolean
    loop?: boolean
    /** The light synthesizer of `window` by default. */
    player?: NotePlayer
    /** The window to play in (popouts have their own); the global one by default. */
    window?: Window
    sound?: Sound
    /** 0 to 1, 0.8 by default. */
    volume?: number
    /** Called once the pattern is over (not after stop). */
    onEnd?: () => void
    /** Finds guitar voicings for chords (see `/voicings`); generated voicings otherwise. */
    voicings?: VoicingLookup
}

/**
 * Plays a strumming pattern (a ```strum block's text, or a parsed pattern). The chord changes
 * written in the pattern win over `chord`, which wins over the pattern's `chord:`. Throws the
 * block's message when the text has a mistake.
 */
export function playStrum(
    pattern: string | StrumPattern,
    options: PlayStrumOptions = {}
): PlayHandle {
    const parsed = typeof pattern === 'string' ? parseStrum(pattern) : pattern
    const given = options.tuning ?? parsed.tuning ?? null
    const tuning =
        given === null
            ? STANDARD_TUNING
            : typeof given === 'string'
              ? parseTuning(given)
              : [...given]
    if (!tuning) throw new Error(`Unknown tuning "${String(given)}"`)
    // The chord given here takes the place of the pattern's `chord:`.
    const chord = options.chord
    if (typeof chord === 'string' && !readChord(chord))
        throw new Error(`Didn't recognize the chord "${chord}"`)
    const fixed = Array.isArray(chord) ? [...(chord as readonly number[])] : null
    const score = scoreOf(
        chord === undefined ? parsed : { ...parsed, chord: fixed ? GIVEN : (chord as string) },
        (symbol) =>
            symbol === GIVEN && fixed ? fixed : strumVoicing(symbol, tuning, options.voicings)
    )
    const win = options.window ?? (typeof window === 'undefined' ? undefined : window)
    const player = options.player ?? (win ? lightPlayer(win) : null)
    if (!player) throw new Error('playStrum needs a player or a window')
    const settings: StrumSettings = {
        bpm: tempoOf(options.bpm ?? parsed.tempo),
        countIn: options.countIn ?? false,
        loop: options.loop ?? false,
        sound: options.sound ?? 'guitar',
        volume: Number.isFinite(options.volume) ? Math.min(1, Math.max(0, options.volume!)) : 0.8
    }
    return runStrum(
        score,
        () => player,
        () => settings,
        win ?? globalThis,
        options.onEnd
    )
}
