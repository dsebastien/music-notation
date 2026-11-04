/**
 * Fingering in plain words (#53): what a chord diagram shows, written out for players who don't
 * read diagrams yet ("Index on the B string, 1st fret. Strum from the 5th string (A)."). Guitar
 * chords say the capo, the strings to strum, the barres, each finger's string and fret, muted and
 * open strings; piano chords say each hand's fingers on their keys.
 */
import { fingerVoicing } from './generate.js'
import { STANDARD_TUNING } from './guitar.js'
import { Note } from 'tonal'
import { noteOf } from '../theory/pitch.js'

/** A fretted chord: frets and fingers lowest string first, as `chord` blocks write them. */
export interface GuitarFingering {
    frets: readonly (number | null)[]
    /** One per string (`1`–`4`, `T`; null for none). Worked out from the frets when absent. */
    fingers?: readonly (string | null)[]
    /** Open strings as MIDI numbers, lowest first. Standard tuning for 6 strings when absent. */
    tuning?: readonly number[]
    /** The open strings' names as the tuning spells them (Eb, Ab…), lowest first; else sharps. */
    tuningNames?: readonly string[]
    /** A capo's fret: the frets count from it, as the diagram draws them. */
    capo?: number
    /** `nut`: the frets are the real neck's, with the capo below them. */
    fretsFrom?: 'capo' | 'nut'
}

/** A piano chord: its keys (MIDI numbers), their fingers and hands. */
export interface PianoFingering {
    keys: readonly number[]
    /** Finger per key: `1` (thumb) to `5` (little finger). */
    fingers?: ReadonlyMap<number, string>
    /** Hand per key; one unnamed hand when absent. */
    hands?: ReadonlyMap<number, 'left' | 'right'>
    /** Spelling per pitch class (C# or Db), as the chord spells its notes; sharps when absent. */
    names?: ReadonlyMap<number, string>
}

const ordinal = (n: number) =>
    `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

const GUITAR_FINGERS: Record<string, string> = {
    '1': 'Index',
    '2': 'Middle',
    '3': 'Ring',
    '4': 'Pinky',
    'T': 'Thumb'
}

const PIANO_FINGERS: Record<string, string> = {
    '1': 'thumb',
    '2': 'index finger',
    '3': 'middle finger',
    '4': 'ring finger',
    '5': 'little finger'
}

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "A", "C and E", "A, D and G". */
const andList = (items: string[]) =>
    items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

const letter = (midi: number) => noteOf(midi).replace(/-?\d+$/, '')

/**
 * What players call each string. When every name is different, or only the two outer strings share
 * one (low E and high E), by name: "the A string", "the low E string". Otherwise (drop D, DADGAD,
 * open tunings) two strings could read alike, so every string is named by its number and note:
 * "the 4th string (D)". Without a tuning, numbers only.
 */
function stringNames(
    tuning: readonly number[] | null,
    count: number,
    spelled?: readonly string[]
): string[] {
    const letters = tuning?.map((p, s) => spelled?.[s] ?? letter(p)) ?? []
    const repeated = letters.filter((name, i) => letters.indexOf(name) !== i)
    const byName =
        tuning !== null &&
        (repeated.length === 0 ||
            (repeated.length === 1 && letters[0] === letters[count - 1] && count > 2))
    return Array.from({ length: count }, (_, s) => {
        if (!byName) return numbered(tuning, count, s, spelled)
        const name = letters[s]!
        if (repeated.length && s === 0) return `the low ${name} string`
        if (repeated.length && s === count - 1) return `the high ${name} string`
        return `the ${name} string`
    })
}

/** "the 5th string (A)", for the strings to strum. */
function numbered(
    tuning: readonly number[] | null,
    count: number,
    s: number,
    spelled?: readonly string[]
): string {
    const name = tuning ? (spelled?.[s] ?? letter(tuning[s]!)) : null
    return `the ${ordinal(count - s)} string${name ? ` (${name})` : ''}`
}

function guitarWords(input: GuitarFingering): string[] {
    const { frets } = input
    const count = frets.length
    const tuning = input.tuning ?? (count === 6 ? STANDARD_TUNING : null)
    const spelled = input.tuningNames?.length === count ? input.tuningNames : undefined
    const names = stringNames(tuning, count, spelled)
    const capo = input.capo ?? 0
    const fromNut = capo > 0 && input.fretsFrom === 'nut'
    // The shape as the hand plays it: frets from the capo (the real neck's minus the capo with
    // frets-from: nut). A string at the capo's fret rings open there.
    const shape = frets.map((f) => (f === null ? null : fromNut ? Math.max(0, f - capo) : f))
    const fingers = input.fingers?.some((f) => f)
        ? input.fingers
        : (fingerVoicing(shape) ?? frets.map(() => null))
    const sentences: string[] = []
    if (capo) {
        sentences.push(
            `Capo on the ${ordinal(capo)} fret${fromNut ? '' : ': frets count from the capo'}.`
        )
    }
    const sounding = frets.flatMap((f, s) => (f !== null ? [s] : []))
    if (!sounding.length) return [...sentences, 'Every string is muted: no note sounds.']
    const low = sounding[0]!
    const high = sounding.at(-1)!
    if (low === 0 && high === count - 1) {
        sentences.push(count === 6 ? 'Strum all six strings.' : 'Strum every string.')
    } else if (high === count - 1) {
        sentences.push(`Strum from ${numbered(tuning, count, low, spelled)}.`)
    } else {
        sentences.push(
            `Strum from ${numbered(tuning, count, low, spelled)} to ${numbered(tuning, count, high, spelled)}.`
        )
    }
    // Barres: one finger on two strings or more at the same fret.
    const barred = new Set<number>()
    const byFinger = new Map<string, number[]>()
    shape.forEach((f, s) => {
        const finger = fingers[s]
        if (f !== null && f > 0 && finger)
            byFinger.set(finger, [...(byFinger.get(finger) ?? []), s])
    })
    const said = new Set<string>()
    const fingerName = (finger: string) => GUITAR_FINGERS[finger] ?? `Finger ${finger}`
    frets.forEach((fret, s) => {
        if (fret === null || shape[s] === 0) return
        const finger = fingers[s]
        if (!finger) {
            sentences.push(`Press ${names[s]} at the ${ordinal(fret)} fret.`)
            return
        }
        if (said.has(finger)) return
        said.add(finger)
        const strings = byFinger.get(finger)!.filter((t) => frets[t] === fret)
        if (strings.length > 1) {
            const from = count - strings.at(-1)!
            const to = count - strings[0]!
            for (const t of strings) barred.add(t)
            sentences.push(
                `${fingerName(finger)} bars the ${ordinal(fret)} fret, strings ${from} to ${to}.`
            )
        } else {
            sentences.push(`${fingerName(finger)} on ${names[s]}, ${ordinal(fret)} fret.`)
        }
        // The same finger on another fret (rare, as written): said string by string.
        for (const t of byFinger.get(finger)!) {
            if (frets[t] !== fret) {
                sentences.push(
                    `${fingerName(finger)} also on ${names[t]}, ${ordinal(frets[t]!)} fret.`
                )
            }
        }
    })
    // Strings inside the strummed range that don't sound: a fretting finger touches them lightly.
    const muted = frets.flatMap((f, s) => (f === null && s > low && s < high ? [names[s]!] : []))
    if (muted.length) {
        sentences.push(
            `Mute ${andList(muted)}: let a fretting finger touch ${muted.length > 1 ? 'them' : 'it'} lightly.`
        )
    }
    // Open strings (under a barre they are fretted, so not open).
    const open = shape.flatMap((f, s) => (f === 0 && !barred.has(s) ? [names[s]!] : []))
    if (open.length) {
        const where = capo ? ' at the capo' : ' open'
        const plural = open.length > 1
        // "The A and high E strings", or each name in full when one has a number.
        sentences.push(
            open.every((n) => /^the [^(]+ string$/.test(n))
                ? `The ${andList(open.map((n) => n.slice(4, -7)))} ${plural ? 'strings ring' : 'string rings'}${where}.`
                : `${capitalized(andList(open))} ${plural ? 'ring' : 'rings'}${where}.`
        )
    }
    return sentences
}

function pianoWords(input: PianoFingering): string[] {
    const keys = [...input.keys].sort((a, b) => a - b)
    if (!keys.length) return []
    // When a name comes twice (C3 and C4), every key gets its octave, so the keys read alike.
    const plain = (midi: number) => input.names?.get(midi % 12) ?? letter(midi)
    const octaves = new Set(keys.map(plain)).size < keys.length
    // The octave of the spelled name: B#3 is MIDI 60 and Cb5 is MIDI 71.
    const keyName = (midi: number) => {
        const name = plain(midi)
        if (!octaves) return name
        return `${name}${Math.floor((midi - (Note.get(name).alt || 0)) / 12) - 1}`
    }
    const part = (group: number[]) => {
        const fingered = group.map((k) => {
            const finger = input.fingers?.get(k)
            return finger
                ? `${PIANO_FINGERS[finger] ?? `finger ${finger}`} on ${keyName(k)}`
                : keyName(k)
        })
        return group.every((k) => input.fingers?.has(k)) ? fingered.join(', ') : andList(fingered)
    }
    const hands = input.hands
    if (!hands?.size) {
        return [
            keys.every((k) => input.fingers?.has(k))
                ? `${capitalized(part(keys))}.`
                : `Play ${part(keys)}.`
        ]
    }
    return (['left', 'right'] as const).flatMap((hand) => {
        const group = keys.filter((k) => (hands.get(k) ?? 'right') === hand)
        return group.length ? [`${capitalized(hand)} hand: ${part(group)}.`] : []
    })
}

/**
 * The fingering of a chord in plain sentences, in the order a player sets the hand: for a fretted
 * chord the capo, the strings to strum, barres and fingers (low string first), muted strings
 * inside the strummed range, open strings; for a piano chord each hand's fingers on their keys
 * (left hand first). Fingers a guitar chord doesn't give are worked out from its frets.
 */
export function fingeringInWords(chord: GuitarFingering | PianoFingering): string[] {
    return 'frets' in chord ? guitarWords(chord) : pianoWords(chord)
}
