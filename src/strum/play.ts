/**
 * Hearing a strumming pattern (#22): each strum as the chord's notes, low to high for a down
 * strum and high to low for an up strum, with a groove (up strums softer than down strums, the
 * beats stressed, a little variation from strum to strum), accents louder, ghost strums soft,
 * muted strums a percussive chuck; in time (swung when asked), with a count-in of clicks, looped
 * without a gap. Plays through any NotePlayer (the light synthesizer or an app's soundfont).
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
    DEFAULT_COMPOUND_TEMPO,
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
    /**
     * Slots in one counted beat, the one the tempo counts: `slotsPerBeat` by default, three
     * times that in compound time (a dotted quarter in 6/8).
     */
    slotsPerPulse?: number
    /** Where the second slot of each pair falls (2/3 for a triplet swing); straight when absent. */
    swing?: number | null
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
        slotsPerPulse: pattern.slotsPerPulse,
        swing: pattern.swing,
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
    /**
     * Beats a minute: the counted beat (a quarter in 4/4, a dotted quarter in 6/8, 9/8 and
     * 12/8, an eighth in 3/8).
     */
    bpm?: number
    /** A bar of clicks first. */
    countIn?: boolean
    /** How long the last strum rings after the pattern, in seconds (0 when it loops). */
    tail?: number
    /** Varies the small differences between strums from pass to pass (the pass's number). */
    seed?: number
    /** The most time between a strum's strings, in seconds: 0.012 by default (0 a block). */
    spread?: number
}

/**
 * MIDI velocities: a down strum (`normal`), an up strum, an accent, a ghost strum, a muted one
 * (a chuck, on the down motion). The beats add `STRUM_STRESS`; each strum varies a little.
 */
export const STRUM_VELOCITY = { normal: 84, up: 70, accent: 118, ghost: 38, mute: 95 }
/** Added on the bar's first beat, and on the other counted beats (1 and 4 in 6/8). */
export const STRUM_STRESS = { first: 10, beat: 5 }
/** The most a strum's velocity varies from the written one, either way. */
const HUMAN = 3
/** The count-in's clicks: a short percussive tick (a high note for players without clicks). */
const CLICK = { first: 88, beat: 84, other: 81, duration: 0.05 }
/** Up strums catch the higher strings. */
const UP_STRINGS = 4
const MUTE_SECONDS = 0.06

/**
 * The app's tempo (quarter notes a minute, as for scales) as the pattern's counted beat, at the
 * same quarter-note speed, rounded and within 20–240: halves in 2/2 (90 → 45), 8ths in 3/8
 * (90 → 180), dotted quarters in x/8 compound time (90 → 60), dotted 8ths in x/16 (90 → 120).
 * Undefined stays undefined.
 */
export const countedTempoOf = (bpm: number | undefined, compound: boolean, beatUnit = 4) => {
    if (bpm === undefined || !Number.isFinite(bpm)) return bpm
    const unit = Number.isFinite(beatUnit) && beatUnit > 0 ? beatUnit : 4
    // The counted beat in quarters: 4 / unit, three of those in compound time.
    const quarters = (4 / unit) * (compound ? 3 : 1)
    return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm / quarters)))
}

/**
 * Beats a minute within bounds; the default when it isn't a number (90, or 60 dotted quarters in
 * compound time).
 */
export const tempoOf = (bpm: number | null | undefined, compound = false) =>
    bpm === null || bpm === undefined || !Number.isFinite(bpm)
        ? compound
            ? DEFAULT_COMPOUND_TEMPO
            : DEFAULT_TEMPO
        : Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, bpm))

/** A small whole number from -HUMAN to HUMAN, the same for the same slot and seed. */
function humanize(slot: number, seed: number): number {
    let h = Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(seed + 7, 0x85ebca6b)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
    return ((h >>> 0) % (2 * HUMAN + 1)) - HUMAN
}

/**
 * How hard a strum is played: down strums firmer than up strums, the bar's first beat and the
 * other counted beats stressed (a groove), accents loud, ghost strums soft, a muted strum a firm
 * chuck; then a little variation, so no two strums are the same.
 */
export function strumVelocity(
    slot: { stroke: Stroke; accent: boolean; ghost: boolean },
    up: boolean,
    inBar: number,
    slotsPerPulse: number,
    seed = 0,
    index = inBar
): number {
    const stress =
        inBar === 0 ? STRUM_STRESS.first : inBar % slotsPerPulse === 0 ? STRUM_STRESS.beat : 0
    const written = slot.ghost
        ? STRUM_VELOCITY.ghost
        : slot.accent
          ? STRUM_VELOCITY.accent + stress / 2
          : slot.stroke === 'mute'
            ? STRUM_VELOCITY.mute - (up ? 10 : 0) + stress / 2
            : (up ? STRUM_VELOCITY.up : STRUM_VELOCITY.normal) + stress
    const varied = written + (slot.ghost ? Math.sign(humanize(index, seed)) : humanize(index, seed))
    return Math.round(Math.min(127, Math.max(1, varied)))
}

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
    const pulse = score.slotsPerPulse ?? score.slotsPerBeat
    const compound = pulse > score.slotsPerBeat
    const slot = 60 / tempoOf(options.bpm, compound) / pulse
    // The time signature's beat (an 8th in 6/8), what the count-in clicks.
    const beat = slot * score.slotsPerBeat
    const swing = score.swing ?? 0.5
    // A swung pair's second slot comes later (2/3 of the pair in a triplet swing).
    const timeOf = (i: number) => (i % 2 ? (i - 1 + 2 * swing) * slot : i * slot)
    const seed = options.seed ?? 0
    const events: NoteEvent[] = []
    let start = 0
    if (options.countIn) {
        const perPulse = pulse / score.slotsPerBeat
        for (let b = 0; b < score.beatsPerBar; b++)
            events.push({
                midi: b === 0 ? CLICK.first : b % perPulse === 0 ? CLICK.beat : CLICK.other,
                time: b * beat,
                duration: CLICK.duration,
                velocity: b === 0 ? 115 : b % perPulse === 0 ? 95 : 75,
                kind: 'click'
            })
        start = score.beatsPerBar * beat
    }
    const end = start + score.slots.length * slot
    const tail = Math.max(0, options.tail ?? 1)
    const sounding = score.slots.flatMap((s, i) => (s.stroke === 'rest' ? [] : [i]))
    const strums: StrumTiming[] = []
    sounding.forEach((i, n) => {
        const s = score.slots[i]!
        const at = start + timeOf(i)
        strums.push({ slot: i, time: at, duration: timeOf(i + 1) - timeOf(i) })
        // A strum rings until the next one (a muted strum damps it too), the last one past the end.
        const next = sounding[n + 1]
        const until = next === undefined ? end + tail : start + timeOf(next)
        const inBar = i % (score.slotsPerBeat * score.beatsPerBar)
        // A muted strum on an up slot is an up stroke (the hand's motion, as when placing; in
        // triplets, a shuffle: up on the third triplet).
        const upSlot = score.slotsPerBeat === 3 ? inBar % 3 === 2 : inBar % 2 === 1
        const up = s.stroke === 'up' || (s.stroke === 'mute' && upSlot)
        const strings = up ? s.pitches.slice(-UP_STRINGS).reverse() : s.pitches
        // The strings of one strum, a few milliseconds apart (closer at fast tempos).
        const muted = s.stroke === 'mute'
        // A chuck slaps the strings nearly at once.
        const spread =
            Math.min(
                Math.max(0, options.spread ?? 0.012),
                (slot * 0.4) / Math.max(1, strings.length)
            ) * (muted ? 0.5 : 1)
        const velocity = strumVelocity(s, up, inBar, pulse, seed, i)
        strings.forEach((midi, k) => {
            const time = at + k * spread
            const duration = muted ? MUTE_SECONDS : Math.max(MUTE_SECONDS, until - time)
            events.push(
                muted
                    ? { midi, time, duration, velocity, kind: 'muted' }
                    : { midi, time, duration, velocity }
            )
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

/** One pass of a piece played in time: its notes, its length in seconds, and what to light. */
export interface Pass {
    events: NoteEvent[]
    /** Seconds until the next pass starts when it loops (the last note's ring not counted). */
    length: number
    strums: StrumTiming[]
}

/** What each pass is made from: the settings read at that pass, the first pass or not, its number. */
export type PassMaker = (settings: StrumSettings, first: boolean, id: number) => Pass

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
    return runPasses(
        (s, first, id) =>
            strumEvents(score, {
                bpm: s.bpm,
                countIn: first && s.countIn,
                tail: s.loop ? 0 : TAIL,
                seed: id
            }),
        player,
        settings,
        timers,
        onEnd,
        follow
    )
}

/**
 * Plays the passes `make` returns, as `runStrum` plays a strumming pattern's (see there): the
 * timing of progressions (#46) and picking patterns (#51) too.
 */
export function runPasses(
    make: PassMaker,
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
        const { events, length, strums } = make(s, first, id)
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
    /** Beats a minute: the pattern's `tempo:`, else 90 (60 dotted quarters in compound time). */
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
        bpm: tempoOf(options.bpm ?? parsed.tempo, parsed.compound),
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
