/**
 * The notes a strum of a chord sounds (#8, #22): the guitar voicing chord diagrams show (or the
 * easiest one for the tuning), in string order, as a down strum hits them. Strum drawings record
 * them for playback.
 */
import { STANDARD_TUNING } from '../chord/guitar.js'
import { generateVoicings } from '../chord/generate.js'
import { readChord } from '../theory/chord-name.js'
import { chordNoteSet } from '../theory/note-set.js'
import type { VoicingLookup } from '../voicings/index.js'

/** Without a chord, patterns strum E minor (open strings 022000) on a standard guitar. */
export const DEFAULT_STRUM_CHORD = 'Em'
const E_MINOR = [40, 47, 52, 55, 59, 64]

const sameTuning = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((p, i) => p === b[i])

/** The last voicings worked out (a page of patterns reuses a few chords). */
const cache = new Map<string, number[]>()

/**
 * The notes a strum of `chord` sounds, in string order (lowest string first, as a down strum
 * hits them). The voicing lookup's first voicing on a standard guitar when given, else the
 * easiest generated voicing, else the chord's notes stacked from the low string. Without a chord:
 * E minor on a standard guitar, the open strings on other tunings.
 */
export function strumVoicing(
    chord: string | null,
    tuning: readonly number[] = STANDARD_TUNING,
    voicings?: VoicingLookup
): number[] {
    const standard = sameTuning(tuning, STANDARD_TUNING)
    if (!chord) return standard ? [...E_MINOR] : [...tuning]
    const symbol = readChord(chord)?.symbol ?? chord
    const key = `${symbol}@${tuning.join(',')}${voicings && standard ? '+' : ''}`
    const known = cache.get(key)
    if (known) return [...known]
    const fromFrets = (frets: readonly (number | null)[]) =>
        frets.flatMap((f, s) => (f === null || tuning[s] === undefined ? [] : [tuning[s] + f]))
    let pitches: number[] = []
    if (voicings && standard) {
        try {
            const found = voicings(symbol, 0)
            if (found) pitches = fromFrets(found.frets)
        } catch {
            // Falls back to a generated voicing.
        }
    }
    if (!pitches.length) {
        const generated = generateVoicings(symbol, { tuning: [...tuning] })[0]
        if (generated) pitches = fromFrets(generated.frets)
    }
    if (!pitches.length) {
        // The chord's notes stacked up from the lowest string.
        let previous = (tuning[0] ?? 40) - 1
        for (const member of chordNoteSet(symbol)?.members ?? []) {
            let midi = previous + 1
            while (midi % 12 !== member.chroma) midi++
            pitches.push(midi)
            previous = midi
        }
    }
    if (!pitches.length) pitches = standard ? [...E_MINOR] : [...tuning]
    if (cache.size >= 64) cache.delete(cache.keys().next().value!)
    cache.set(key, pitches)
    return [...pitches]
}
