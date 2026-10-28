/** Tunings of fretted instruments: open-string pitches (MIDI), lowest string first. */
import { chromaOf, midiOf } from '../theory/pitch.js'

const NAMED = new Map<string, string>(
    Object.entries({
        'standard': 'E2 A2 D3 G3 B3 E4',
        'drop d': 'D2 A2 D3 G3 B3 E4',
        'dadgad': 'D2 A2 D3 G3 A3 D4',
        'open g': 'D2 G2 D3 G3 B3 D4',
        'open d': 'D2 A2 D3 F#3 A3 D4',
        'open e': 'E2 B2 E3 G#3 B3 E4',
        'half step down': 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4',
        'bass': 'E1 A1 D2 G2',
        'ukulele': 'G4 C4 E4 A4'
    })
)

/**
 * "standard", "Drop D", "E2 A2 D3 G3 B3 E4", or letters only ("DADGAD", "EbAbDbGbBbEb"): letters
 * get octaves going up from the one closest to E2. Null when invalid.
 */
export function parseTuning(text: string): number[] | null {
    const trimmed = text.trim()
    const named = NAMED.get(trimmed.toLowerCase().replace(/\s*\(.*\)$/, ''))
    if (named) return parseTuning(named)
    const spaced = trimmed.split(/[\s,]+/).filter(Boolean)
    if (spaced.length > 1 && spaced.every((t) => midiOf(t) !== null)) {
        return spaced.map((t) => midiOf(t)!)
    }
    // A "b" is a flat only after an uppercase letter: "eadgbe" is six strings, "EbAb…" are flats.
    const names = spaced.length > 1 ? spaced : (trimmed.match(/[A-G][#♯b♭]?|[a-g][#♯♭]?/g) ?? [])
    if (names.length < 2 || names.join('') !== spaced.join('')) return null
    const midis: number[] = []
    for (const name of names) {
        const chroma = chromaOf(name)
        if (chroma === null) return null
        const previous = midis[midis.length - 1]
        if (previous === undefined) {
            // The octave whose pitch is closest to E2 (40).
            const candidates = [28, 40, 52].map((c) => c - (c % 12) + chroma)
            midis.push(candidates.reduce((a, b) => (Math.abs(b - 40) < Math.abs(a - 40) ? b : a)))
        } else {
            let midi = previous - (previous % 12) + chroma
            while (midi <= previous) midi += 12
            midis.push(midi)
        }
    }
    return midis
}
