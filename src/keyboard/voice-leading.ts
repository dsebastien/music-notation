/**
 * Piano voicings for a progression with the smallest movement between chords (#9): each chord in
 * close position, in the inversion whose notes lie nearest the chord before.
 */
import { chordNoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'

/** The lowest note of the upper voices stays within F3 to G4, so a long progression doesn't drift. */
const LOW = 53
const HIGH = 67

/** Total distance from each note to the nearest note of the other chord, both ways. */
function movement(a: number[], b: number[]): number {
    const nearest = (n: number, list: number[]) => Math.min(...list.map((m) => Math.abs(m - n)))
    return a.reduce((s, n) => s + nearest(n, b), 0) + b.reduce((s, n) => s + nearest(n, a), 0)
}

/** A chord's tones stacked upwards from one of them (close position), from a given pitch. */
function stacked(chromas: number[], first: number, low: number): number[] {
    const order = [...chromas.slice(first), ...chromas.slice(0, first)]
    const out: number[] = []
    let previous = low - 1
    for (const chroma of order) {
        let midi = previous + 1 + ((((chroma - previous - 1) % 12) + 12) % 12)
        if (!out.length) midi = low + ((((chroma - low) % 12) + 12) % 12)
        out.push(midi)
        previous = midi
    }
    return out
}

/**
 * MIDI pitches for each chord, low to high: the first in root position from middle C's octave,
 * each next one in the close-position inversion that moves least from the one before (ties go to
 * the lower one). A slash chord's bass sounds below. Null for a chord that doesn't read.
 */
export function voiceLead(symbols: readonly string[]): (number[] | null)[] {
    let previous: number[] | null = null
    return symbols.map((symbol) => {
        const set = chordNoteSet(symbol)
        if (!set) return null
        const bassName = splitChordSymbol(symbol)?.bass
        const bass = bassName ? chromaOf(bassName) : null
        // A bass outside the chord only sounds below it.
        const tones = set.members
            .filter((m) => !(bass !== null && m.chroma === bass && m.degree === null))
            .map((m) => m.chroma)
        let best: number[] | null = null
        if (!previous) best = stacked(tones, 0, 60)
        else {
            let cost = Infinity
            for (let first = 0; first < tones.length; first++) {
                for (let low = LOW; low <= HIGH; low++) {
                    if ((((low - tones[first]!) % 12) + 12) % 12 !== 0) continue
                    const candidate = stacked(tones, first, low)
                    const c = movement(candidate, previous)
                    if (c < cost) {
                        cost = c
                        best = candidate
                    }
                }
            }
        }
        previous = best
        if (bass === null) return best
        // A bass below the left hand's usual reach of the chord: at least a fourth under it.
        let low = 48 + bass
        while (low > best![0]! - 5) low -= 12
        return [low, ...best!]
    })
}
