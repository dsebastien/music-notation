/**
 * Checks a guitar voicing against its chord (#62): the notes it sounds, the note in the bass, and
 * whether a hand can play it with the fingers given. The voicing lookup uses it to repair or drop
 * the database's wrong voicings; its tests run it over every voicing the lookup hands out.
 */
import { STANDARD_TUNING } from '../chord/guitar.js'
import { chordInfo, fingerVoicing } from '../chord/generate.js'
import { nameOf } from '../theory/pitch.js'

const chromaAt = (frets: readonly (number | null)[], s: number) =>
    (STANDARD_TUNING[s]! + frets[s]!) % 12

/** An altered dominant's possible notes, from its root: 3, b7, then b5, #5, b9, #9. */
const ALT_CORE = [4, 10]
const ALT_TENSIONS = [6, 8, 1, 3]

/**
 * What's wrong with a standard-tuning voicing (lowest string first, null muted) of a chord, in
 * words; null when it plays the chord: every required tone (root, third or sus note, seventh or
 * sixth, altered notes, the highest extension; the perfect fifth and lower extensions may be left
 * out), no other note, the root (a slash chord's bass; any note of a dim7) lowest, and a hand can
 * finger it. An altered dominant (7alt) sounds the root, third and seventh and at least one of b5,
 * #5, b9, #9.
 */
export function voicingProblem(symbol: string, frets: readonly (number | null)[]): string | null {
    const info = chordInfo(symbol)
    if (!info) return `${symbol} is not a chord the library reads`
    if (frets.length !== STANDARD_TUNING.length) return 'not six strings'
    const sounding = frets.flatMap((f, s) => (f === null ? [] : [s]))
    if (sounding.length < 2) return 'fewer than two strings sound'
    const chromas = new Set(sounding.map((s) => chromaAt(frets, s)))
    const { root } = info
    let allowed: number[]
    let required: number[]
    if (info.suffix === '7alt') {
        required = [root, ...ALT_CORE.map((i) => (root + i) % 12)]
        const tensions = ALT_TENSIONS.map((i) => (root + i) % 12)
        allowed = [...required, ...tensions]
        if (!tensions.some((c) => chromas.has(c))) return 'no altered fifth or ninth'
    } else {
        allowed = info.tones.map((t) => t.chroma)
        required = info.tones.filter((t) => t.required).map((t) => t.chroma)
    }
    const extra = [...chromas].filter((c) => !allowed.includes(c))
    if (extra.length) return `plays ${extra.map((c) => nameOf(c)).join(', ')}, not in the chord`
    const missing = required.filter((c) => !chromas.has(c))
    if (missing.length) return `misses ${missing.map((c) => nameOf(c)).join(', ')}`
    const pitches = sounding.map((s) => STANDARD_TUNING[s]! + frets[s]!)
    const bass = Math.min(...pitches) % 12
    const wanted = info.bass ?? root
    // A diminished seventh is symmetrical: any of its notes may be the bass (Cdim7 xx1212).
    const anyBass = info.suffix === 'dim7' && info.bass === null
    if (bass !== wanted && !anyBass) return `has ${nameOf(bass)} in the bass, not ${nameOf(wanted)}`
    if (new Set(pitches).size < pitches.length) return 'plays one pitch on two strings'
    if (!fingerVoicing(frets)) return 'no hand can play it'
    return null
}

/**
 * What's wrong with the fingers of a voicing; null when they're fine: one finger (1–4) on each
 * fretted string and none elsewhere, a finger on several strings only as a barre (one fret, the
 * index or the ring finger, every string under it sounding at that fret or higher, or the pinky on
 * the two highest strings), and higher
 * fingers never on lower frets.
 */
export function fingeringProblem(
    frets: readonly (number | null)[],
    fingers: readonly (string | null)[]
): string | null {
    const strings = new Map<number, number[]>()
    for (let s = 0; s < frets.length; s++) {
        const fret = frets[s]
        const finger = fingers[s] ?? null
        if (!fret) {
            if (finger !== null) return `a finger on an open or muted string`
            continue
        }
        const n = Number(finger)
        if (!(n >= 1 && n <= 4)) return `no finger on a fretted string`
        strings.set(n, [...(strings.get(n) ?? []), s])
    }
    const fretOf = new Map<number, number>()
    for (const [finger, list] of strings) {
        const fret = frets[list[0]!]!
        if (list.some((s) => frets[s] !== fret)) return `finger ${finger} on two frets`
        if (list.length > 1) {
            // The pinky barres only the two highest strings (E6/9 022122, Cm6/9 x31233).
            const topTwo =
                list.length === 2 && list[0] === frets.length - 2 && list[1] === frets.length - 1
            if (finger !== 1 && finger !== 3 && !(finger === 4 && topTwo))
                return `a barre with finger ${finger}`
            for (let s = list[0]!; s <= list[list.length - 1]!; s++) {
                const f = frets[s]
                // Only the index lies over strings fretted higher.
                if (f === null || f === undefined || f < fret || (f > fret && finger !== 1))
                    return `finger ${finger} barres over a string it can't`
            }
        }
        fretOf.set(finger, fret)
    }
    const used = [...fretOf].sort((a, b) => a[0] - b[0])
    for (let i = 1; i < used.length; i++) {
        if (used[i]![1] < used[i - 1]![1])
            return `finger ${used[i]![0]} below finger ${used[i - 1]![0]}`
    }
    return null
}

/**
 * Whether a strummed hand sounds only the voicing's notes: no muted string between two sounding
 * ones (Bdim x20x01 can't be strummed cleanly), except the jazz grips that mute the A string under
 * a root on the low E (F#6 2x132x, Fm6 1x0111, F#m7b5 2x221x), which players damp with the
 * fretting hand (#72).
 */
export function strummable(frets: readonly (number | null)[]): boolean {
    const sounding = frets.flatMap((f, s) => (f === null ? [] : [s]))
    if (sounding.length < 2) return true
    const inside = []
    for (let s = sounding[0]!; s <= sounding[sounding.length - 1]!; s++)
        if (frets[s] === null) inside.push(s)
    if (!inside.length) return true
    return frets.length === 6 && sounding[0] === 0 && inside.length === 1 && inside[0] === 1
}
