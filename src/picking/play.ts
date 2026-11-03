/**
 * Hearing a picking pattern (#51): each slot's notes on their strings, letting them ring until
 * the string is picked again or the chord changes, the thumb firmer than the fingers, the beats
 * stressed; in time (swung when asked), over one chord or one chord a bar, with a count-in, a
 * metronome click and a loop (`runPasses`, the timing of strumming patterns and progressions).
 */
import { STANDARD_TUNING } from '../chord/guitar.js'
import { parseTuning } from '../fretboard/tuning.js'
import type { VoicingLookup } from '../voicings/index.js'
import { lightPlayer, type NoteEvent, type NotePlayer, type Sound } from '../playback/player.js'
import { startsReported, START_WAIT } from '../playback/follow.js'
import {
    followTimes,
    type ProgressionChanges,
    type ProgressionHandle,
    type ProgressionSettings
} from '../playback/progression.js'
import { runPasses, tempoOf, type Pass, type StrumTiming } from '../strum/play.js'
import { parsePicking, type PickingPattern } from './pattern.js'
import { pickingFrets, pluckNote, type PickedNote } from './voicing.js'

/** A pattern ready to play: each slot's notes, over its bar's chord. */
export interface PickingScore {
    slots: { notes: PickedNote[]; thumb: boolean[] }[]
    slotsPerBeat: number
    beatsPerBar: number
    slotsPerPulse: number
    swing: number | null
    /** Each bar's chord (as written), null for E minor or the open strings. */
    chords: (string | null)[]
}

export interface PickingScoreOptions {
    /** A chord to pick (wins over the pattern's `chord:`). */
    chord?: string | null
    /** One chord a bar (wins over the pattern's `chords:`); the pattern repeats over them. */
    chords?: readonly string[]
    /** Open strings, lowest first; standard by default. */
    tuning?: readonly number[]
    voicings?: VoicingLookup
}

/**
 * The bars played: one a chord when chords are given (the pattern's bars in turn), else the
 * pattern's bars over its one chord; each slot's notes on that bar's grip.
 */
export function pickingScore(
    pattern: PickingPattern,
    options: PickingScoreOptions = {}
): PickingScore {
    const tuning = options.tuning ?? STANDARD_TUNING
    const list = options.chords?.length ? [...options.chords] : pattern.chords
    const one = options.chord !== undefined ? options.chord : pattern.chord
    const bars = list.length ? Math.max(list.length, 1) : pattern.bars
    const chords = Array.from({ length: bars }, (_, b) =>
        list.length ? list[b % list.length]! : one
    )
    const grips = new Map<string | null, (number | null)[]>()
    const gripOf = (chord: string | null) => {
        if (!grips.has(chord)) grips.set(chord, pickingFrets(chord, tuning, options.voicings))
        return grips.get(chord)!
    }
    const slots: PickingScore['slots'] = []
    for (let b = 0; b < bars; b++) {
        const chord = chords[b]!
        const frets = gripOf(chord)
        const own = b % pattern.bars
        for (let k = 0; k < pattern.slotsPerBar; k++) {
            const slot = pattern.slots[own * pattern.slotsPerBar + k]!
            const notes: PickedNote[] = []
            const thumb: boolean[] = []
            for (const pluck of slot.plucks) {
                const note = pluckNote(pluck, frets, tuning, chord)
                // Two plucks on one string sound once.
                if (!note || notes.some((n) => n.string === note.string)) continue
                notes.push(note)
                thumb.push('finger' in pluck && pluck.finger === 'p')
            }
            slots.push({ notes, thumb })
        }
    }
    return {
        slots,
        slotsPerBeat: pattern.slotsPerBeat,
        beatsPerBar: pattern.beatsPerBar,
        slotsPerPulse: pattern.slotsPerPulse,
        swing: pattern.swing,
        chords
    }
}

/** MIDI velocities: the thumb, a finger; the bar's first beat and the counted beats add. */
export const PICKING_VELOCITY = { thumb: 86, finger: 72, first: 8, beat: 4 }
const HUMAN = 3
const CLICK = { first: 88, beat: 84, other: 81, duration: 0.05 }

function humanize(slot: number, seed: number): number {
    let h = Math.imul(slot + 3, 0x9e3779b1) ^ Math.imul(seed + 11, 0x85ebca6b)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
    return ((h >>> 0) % (2 * HUMAN + 1)) - HUMAN
}

export interface PickingEventOptions {
    /** Counted beats a minute (a dotted quarter in 6/8); 90 (60 in compound time). */
    bpm?: number
    countIn?: boolean
    /** A metronome click on each counted beat; off by default. */
    click?: boolean
    /** How long the last notes ring after the pattern, in seconds (0 when it loops). */
    tail?: number
    seed?: number
}

/**
 * One pass of a picking score: its notes (with the count-in first when asked), its length, and
 * when each slot is played (`strums`, one a slot with notes), to light it.
 */
export function pickingEvents(score: PickingScore, options: PickingEventOptions = {}): Pass {
    const pulse = score.slotsPerPulse
    const compound = pulse > score.slotsPerBeat
    const slot = 60 / tempoOf(options.bpm, compound) / pulse
    const beat = slot * score.slotsPerBeat
    const swing = score.swing ?? 0.5
    const timeOf = (i: number) => (i % 2 ? (i - 1 + 2 * swing) * slot : i * slot)
    const perBar = score.slotsPerBeat * score.beatsPerBar
    const perPulse = pulse / score.slotsPerBeat
    const seed = options.seed ?? 0
    const events: NoteEvent[] = []
    const click = (time: number, b: number, loud: boolean) => {
        const level = b === 0 ? 'first' : b % perPulse === 0 ? 'beat' : 'other'
        events.push({
            midi: CLICK[level],
            time,
            duration: CLICK.duration,
            velocity: loud
                ? { first: 115, beat: 95, other: 75 }[level]
                : { first: 92, beat: 76, other: 62 }[level],
            kind: 'click'
        })
    }
    let start = 0
    if (options.countIn) {
        for (let b = 0; b < score.beatsPerBar; b++) click(b * beat, b, true)
        start = score.beatsPerBar * beat
    }
    const end = start + score.slots.length * slot
    const tail = Math.max(0, options.tail ?? 1)
    const strums: StrumTiming[] = []
    // A note rings until its string is picked again, or until its bar ends when the next bar
    // has another chord (the hand moves), or past the end.
    const barEnd = (i: number) => {
        const bar = Math.floor(i / perBar)
        let b = bar + 1
        while (b < score.chords.length && score.chords[b] === score.chords[bar]) b++
        return b >= score.chords.length ? end + tail : start + timeOf(b * perBar)
    }
    score.slots.forEach((s, i) => {
        if (!s.notes.length) return
        const at = start + timeOf(i)
        strums.push({ slot: i, time: at, duration: timeOf(i + 1) - timeOf(i) })
        const inBar = i % perBar
        const stress =
            inBar === 0 ? PICKING_VELOCITY.first : inBar % pulse === 0 ? PICKING_VELOCITY.beat : 0
        const limit = barEnd(i)
        s.notes.forEach((note, k) => {
            let until = limit
            for (let j = i + 1; j < score.slots.length; j++) {
                const later = start + timeOf(j)
                if (later >= limit) break
                if (score.slots[j]!.notes.some((n) => n.string === note.string)) {
                    until = later
                    break
                }
            }
            const written = s.thumb[k] ? PICKING_VELOCITY.thumb : PICKING_VELOCITY.finger
            const velocity = Math.round(
                Math.min(127, Math.max(1, written + stress + humanize(i * 8 + k, seed)))
            )
            events.push({
                midi: note.midi,
                time: at,
                duration: Math.max(0.06, until - at),
                velocity
            })
        })
    })
    if (options.click)
        for (let i = 0; i < score.slots.length; i += pulse)
            click(start + i * slot, (i % perBar) / score.slotsPerBeat, false)
    events.sort((a, b) => a.time - b.time)
    const bars = score.chords.map((_, b) => ({
        slot: b,
        time: start + timeOf(b * perBar),
        duration: timeOf((b + 1) * perBar) - timeOf(b * perBar)
    }))
    return { events, length: end, strums, bars }
}

export interface PlayPickingOptions {
    /** A chord to pick (wins over the pattern's `chord:`). */
    chord?: string | null
    /** One chord a bar (wins over the pattern's `chords:`); the pattern repeats over them. */
    chords?: readonly string[]
    /** Counted beats a minute: the pattern's `tempo:`, else 90 (60 in compound time). */
    bpm?: number
    /** Open strings (MIDI, lowest first) or a tuning name; the pattern's, else standard. */
    tuning?: readonly number[] | string
    /** Finds guitar voicings for chords (see `/voicings`); generated voicings otherwise. */
    voicings?: VoicingLookup
    countIn?: boolean
    loop?: boolean
    /** A metronome click on each counted beat; off by default. */
    click?: boolean
    /** The light synthesizer of `window` by default. */
    player?: NotePlayer
    window?: Window
    sound?: Sound
    /** 0 to 1, 0.8 by default. */
    volume?: number
    /** Called as each bar starts sounding: its index, its chord, the pass (from 1). */
    onBar?: (bar: number, chord: string | null, pass: number) => void
    /** Called once the pattern is over (not after stop). */
    onEnd?: () => void
}

/**
 * Plays a picking pattern (a ```picking block's text, or a parsed pattern) over a chord or one
 * chord a bar. Throws the block's message when the text has a mistake, or on an unknown chord or
 * tuning. `update` changes the tempo, loop, click, volume or sound from the next pass.
 */
export function playPicking(
    pattern: string | PickingPattern,
    options: PlayPickingOptions = {}
): ProgressionHandle {
    const parsed = typeof pattern === 'string' ? parsePicking(pattern) : pattern
    const given = options.tuning ?? parsed.tuning
    const tuning =
        given === null
            ? STANDARD_TUNING
            : typeof given === 'string'
              ? parseTuning(given)
              : [...given]
    if (!tuning) throw new Error(`Unknown tuning "${String(given)}"`)
    const score = pickingScore(parsed, {
        ...(options.chord !== undefined ? { chord: options.chord } : {}),
        ...(options.chords ? { chords: options.chords } : {}),
        ...(options.voicings ? { voicings: options.voicings } : {}),
        tuning
    })
    const win = options.window ?? (typeof window === 'undefined' ? undefined : window)
    const player = options.player ?? (win ? lightPlayer(win) : null)
    if (!player) throw new Error('playPicking needs a player or a window')
    const settings: ProgressionSettings = {
        bpm: tempoOf(options.bpm ?? parsed.tempo, parsed.compound),
        countIn: options.countIn ?? false,
        loop: options.loop ?? false,
        click: options.click ?? false,
        sound: options.sound ?? 'guitar',
        volume: Number.isFinite(options.volume) ? Math.min(1, Math.max(0, options.volume!)) : 0.8
    }
    const timers = win ?? globalThis
    const onBar = options.onBar
    let pass = 0
    const handle = runPasses(
        (s, first, id) => {
            pass = id
            return pickingEvents(score, {
                bpm: s.bpm,
                countIn: first && s.countIn,
                click: settings.click,
                tail: s.loop ? 0 : 1.2,
                seed: id
            })
        },
        () => player,
        () => settings,
        timers,
        options.onEnd,
        onBar
            ? (_strums, current, made) => {
                  const thisPass = pass
                  return followTimes(
                      timers,
                      made.bars ?? [],
                      (t) => onBar(t.slot, score.chords[t.slot] ?? null, thisPass),
                      startsReported(current) ? Infinity : START_WAIT
                  )
              }
            : undefined
    )
    return {
        stop: () => handle.stop(),
        update(changes: ProgressionChanges) {
            if (changes.bpm !== undefined && Number.isFinite(changes.bpm))
                settings.bpm = tempoOf(changes.bpm, parsed.compound)
            if (changes.loop !== undefined) settings.loop = changes.loop
            if (changes.click !== undefined) settings.click = changes.click
            if (changes.volume !== undefined && Number.isFinite(changes.volume))
                settings.volume = Math.min(1, Math.max(0, changes.volume))
            if (changes.sound === 'guitar' || changes.sound === 'piano')
                settings.sound = changes.sound
        }
    }
}
