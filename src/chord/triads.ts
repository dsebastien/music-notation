/**
 * Triads on string sets (#19): three adjacent strings, one chord tone each, in their three
 * inversions up the neck; and a key's triads on one string set, the way guitarists learn the neck.
 */
import { Key } from 'tonal'
import { generateVoicings, type GeneratedVoicing } from './generate.js'
import { STANDARD_TUNING } from './guitar.js'
import { chordNoteSet, intervalLabel } from '../theory/note-set.js'

export interface Triad extends GeneratedVoicing {
    /** 0 root position, 1 first inversion (third in the bass), 2 second (fifth in the bass). */
    inversion: number
    /** The chord tone on top, as triad charts say it: R, 3, b3, 5… */
    top: string
}

export interface TriadOptions {
    /** Three adjacent strings (1 = the highest): [1, 2, 3], [2, 3, 4]… */
    strings: number[]
    /** One inversion (0, 1, 2) or all of them (the default). */
    inversion?: number | 'any'
    /** Open-string pitches (MIDI), lowest string first; standard guitar by default. */
    tuning?: number[]
    /** The highest fret used, 15 by default. */
    maxFret?: number
}

/** The inversion's name: "root position", "1st inversion", "2nd inversion". */
export const inversionName = (inversion: number): string =>
    inversion === 0 ? 'root position' : inversion === 1 ? '1st inversion' : '2nd inversion'

/**
 * Close triads (the three notes within four frets) of a three-note chord (major, minor, diminished, augmented, sus) on a string set,
 * up the neck (then root position first). Empty for other chords or a string set that isn't three
 * adjacent strings.
 */
export function triadVoicings(symbol: string, options: TriadOptions): Triad[] {
    const tuning = options.tuning ?? STANDARD_TUNING
    const set = chordNoteSet(symbol)
    const members = set?.members.filter((m) => m.interval !== null) ?? []
    if (!set || members.length !== 3) return []
    const strings = [...new Set(options.strings)].sort((a, b) => a - b)
    const adjacent = strings.length === 3 && strings[2]! - strings[0]! === 2
    if (!adjacent || strings[2]! > tuning.length) return []
    const voicings = generateVoicings(symbol, {
        tuning,
        strings,
        minStrings: 3,
        inversion: options.inversion ?? 'any',
        ...(options.maxFret !== undefined ? { maxFret: options.maxFret } : {})
    })
    const lowest = (v: GeneratedVoicing) =>
        Math.min(...v.frets.filter((f): f is number => f !== null))
    // Close shapes: the three notes within four frets, open strings counting as fret 0.
    const close = (v: GeneratedVoicing) => {
        const played = v.frets.filter((f): f is number => f !== null)
        return played.length === 3 && Math.max(...played) - Math.min(...played) <= 3
    }
    return voicings
        .filter((v) => close(v) && v.inversion !== null)
        .map((v): Triad => {
            // The top note: the highest-pitched sounding string.
            let top = -1
            let pitch = -Infinity
            v.frets.forEach((f, s) => {
                if (f !== null && tuning[s]! + f > pitch) {
                    pitch = tuning[s]! + f
                    top = s
                }
            })
            const chroma = (tuning[top]! + v.frets[top]!) % 12
            const member = members.find((m) => m.chroma === chroma)!
            return {
                ...v,
                inversion: v.inversion!,
                top: intervalLabel(member.interval!)
            }
        })
        .sort((a, b) => lowest(a) - lowest(b) || a.inversion - b.inversion)
}

export interface KeyTriad {
    /** "I", "ii", "iii", "IV", "V", "vi", "vii°". */
    numeral: string
    symbol: string
    triad: Triad
}

/** "G major", "E minor" (natural minor): the tonic and the mode; null otherwise. */
export function parseKey(text: string): { tonic: string; minor: boolean } | null {
    const m = /^\s*([A-Ga-g][#b♯♭]?)\s+(major|minor|maj|min)\s*$/i.exec(text)
    if (!m) return null
    const tonic = m[1]![0]!.toUpperCase() + (m[1]![1] ?? '').replace('♯', '#').replace('♭', 'b')
    return { tonic, minor: /^min/i.test(m[2]!) }
}

/**
 * A key's seven triads on a string set, one inversion, moving up the neck: each one at or above
 * the previous one when it can be. Null when the key can't be read.
 */
export function keyTriads(
    key: string,
    options: Omit<TriadOptions, 'inversion'> & { inversion?: number }
): KeyTriad[] | null {
    const parsed = parseKey(key)
    if (!parsed) return null
    const scale = parsed.minor ? Key.minorKey(parsed.tonic).natural : Key.majorKey(parsed.tonic)
    if (!scale.triads.length) return null
    const inversion = options.inversion ?? 0
    const out: KeyTriad[] = []
    let floor = 0
    scale.triads.forEach((symbol, i) => {
        // Up to fret 20, so a key started high keeps climbing instead of jumping back down.
        const list = triadVoicings(symbol, { maxFret: 20, ...options, inversion })
        if (!list.length) return
        const lowest = (t: Triad) => Math.min(...t.frets.filter((f): f is number => f !== null))
        const triad = list.find((t) => lowest(t) >= floor) ?? list[0]!
        floor = lowest(triad)
        const grade = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]!
        const quality = symbol.endsWith('dim') ? '°' : ''
        const minor = /m(?!aj)/.test(symbol.replace(/^[A-G][#b]?/, '')) || quality
        out.push({
            numeral: (minor ? grade.toLowerCase() : grade) + quality,
            symbol,
            triad
        })
    })
    return out
}
