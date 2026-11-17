/**
 * The easier version of a ChordPro song (#45): `{simplify}` swaps a chord for an easier chord of
 * its family, `{capo: auto}` finds the capo that makes the most chords open shapes and writes the
 * shapes. The song given is never changed: the chart draws a copy with other chord names.
 */
import type { Line, Song } from './chordpro.js'
import { chordsUsed } from './chart-diagrams.js'
import { findDefinition } from './defines.js'
import { bestCapo, easierChord, type CapoChoice } from '../chord/simplify.js'
import { splitChordSymbol } from '../theory/pitch.js'
import { transposeChord, transposeKey } from '../theory/transpose.js'

export interface EasierSong {
    /** The song to draw: the song given when nothing changes. */
    song: Song
    /** The chords made easier, as the chart shows them: from the chord written to the easier one. */
    easier: { from: string; to: string }[]
    /** Whether `simplify` finds an easier chord for a chord of the song. */
    canSimplify: boolean
    /** The capo `{capo: auto}` found; null when the song doesn't ask or no capo does better. */
    capo: number | null
    /**
     * What `{capo: auto}` found, with the shapes to play, also when it is no capo (fret 0); null
     * when the song doesn't ask or none of its chords reads.
     */
    choice: CapoChoice | null
}

/** A written chord with the suffix (and the bass, when kept) of the easier chord shown for it. */
function withSuffixOf(written: string, easier: string): string {
    const own = splitChordSymbol(written)
    const other = splitChordSymbol(easier)
    if (!own || !other) return written
    return `${own.root}${other.suffix}${other.bass && own.bass ? `/${own.bass}` : ''}`
}

/**
 * The song a chart draws. `shownOf` gives a written chord as the chart shows it (transposed by
 * `semitones`). Guitar charts only: a piano chart comes back as it is. A chord with its own
 * `{define}` keeps the shape its author gave it, so it is not simplified.
 *
 * Easier chords keep their root, so the copy writes them with the song's own roots and the chart
 * transposes them as before. A capo's shapes are other chords: the copy then holds every chord as
 * the chart shows it, with the song's transposition taken out of it (and put into its key), so no
 * chord is transposed twice.
 */
export function easierSong(
    song: Song,
    shownOf: (written: string) => string,
    semitones: number,
    options: { simplify: boolean; guitar: boolean }
): EasierSong {
    const same: EasierSong = { song, easier: [], canSimplify: false, capo: null, choice: null }
    if (!options.guitar) return same
    const names = chordsUsed(song)
    const found = names
        .filter((written) => !findDefinition(song.definitions, written))
        .map((written) => {
            const from = shownOf(written).trim()
            return { written, from, to: easierChord(from) }
        })
        .filter((c) => c.to !== c.from)
    const canSimplify = found.length > 0
    /** Each chord as the song writes it → its easier chord, with the song's own root. */
    const simpler = new Map<string, string>()
    if (options.simplify)
        for (const c of found) simpler.set(c.written, withSuffixOf(c.written, c.to))
    const easier = options.simplify ? found.map(({ from, to }) => ({ from, to })) : []
    const simplified = (name: string) => simpler.get(name.trim()) ?? name
    const copy = (rename: (name: string, transposable: boolean) => string): Song['sections'] =>
        song.sections.map((section) => ({
            ...section,
            lines: section.lines.map((l): Line => {
                if (l.kind === 'lyrics')
                    return {
                        kind: 'lyrics',
                        segments: l.segments.map((s) =>
                            s.chord === null ? s : { ...s, chord: rename(s.chord, true) }
                        )
                    }
                // A chord drawn in place by its name alone follows; one with its own shape stays.
                const d = l.kind === 'chord' ? l.definition : null
                if (d && !d.frets && !d.keys && !d.copy)
                    return {
                        kind: 'chord',
                        definition: { ...d, name: rename(d.name, d.transposable) }
                    }
                return l
            })
        }))

    const best = song.capoAuto
        ? bestCapo(names.map((written) => shownOf(simplified(written)).trim()))
        : null
    if (!best || best.capo === 0) {
        if (!simpler.size) return { ...same, canSimplify, choice: best }
        return {
            song: { ...song, sections: copy(simplified) },
            easier,
            canSimplify,
            capo: null,
            choice: best
        }
    }
    const shapes = new Map(best.shapes.map((s) => [s.chord, s.shape]))
    // What the chart shows for a name: the capo's shape for the chord it sounds.
    const shape = (name: string, transposable: boolean) => {
        // Not a chord (N.C., an annotation): as written.
        if (!/^[A-G]/.test(name.trim())) return name
        const sounding = transposable ? shownOf(simplified(name)).trim() : simplified(name).trim()
        return shapes.get(sounding) ?? transposeChord(sounding, -best.capo)
    }
    return {
        song: {
            ...song,
            capo: best.capo,
            // The chords are written as shown: the song's transposition is in them, and in its key.
            transpose: song.transpose - semitones,
            key: song.key ? transposeKey(song.key, semitones) : null,
            sections: copy(shape)
        },
        easier,
        canSimplify,
        capo: best.capo,
        choice: best
    }
}
