/**
 * Chord diagrams for ChordPro charts: the "chords used" row and `{chord: …}` drawn in place.
 * Shapes come from the song's definitions first, then the voicing lookup (guitar) or root position
 * from middle C (piano), as `chord` blocks draw a bare symbol.
 */
import { renderGuitarDiagram, type FrettedVoicing, baseFretOf } from '../chord/guitar.js'
import { soundingChord } from '../chord/capo.js'
import { keyRangeOf, renderKeyboard } from '../keyboard/keyboard.js'
import { pianoPitches } from '../keyboard/piano-chord.js'
import { html } from '../render/dom.js'
import type { Hand, LayoutDefaults } from '../render/layout.js'
import { chordNoteSet, listNoteSet, type NoteSet } from '../theory/note-set.js'
import { parseChord } from '../theory/chord-symbol.js'
import { chromaOf, noteOf, splitChordSymbol } from '../theory/pitch.js'
import { transposeChord } from '../theory/transpose.js'
import type { VoicingLookup } from '../voicings/index.js'
import type { Song } from './chordpro.js'
import { absoluteFrets, findDefinition, type ChordDefinition } from './defines.js'

export type ChartInstrument = 'guitar' | 'piano'

export interface ChordDrawing {
    instrument: ChartInstrument
    /** Guitar voicings for chords the song doesn't define (see `/voicings`). */
    voicings?: VoicingLookup
    orientation?: LayoutDefaults['orientation']
    hand?: Hand
    /** The song's capo: guitar shapes get its bar and sound (and root marks) at it. */
    capo?: number
}

/** At most this many diagrams in the row (as in a block of diagrams), so a page stays quick. */
const MAX_ROW = 32

/** A transposed shape goes no higher than this fret. */
const MAX_SHIFTED_FRET = 15

/**
 * Chord names as written in the lyrics, in order of first appearance, without repeats. Names
 * that can't be chords (N.C., %, *Coda annotations) are left out.
 */
export function chordsUsed(song: Song): string[] {
    const seen = new Set<string>()
    for (const section of song.sections) {
        for (const line of section.lines) {
            if (line.kind !== 'lyrics') continue
            for (const { chord } of line.segments) {
                const name = chord?.trim()
                if (name && /^[A-G]/.test(name)) seen.add(name)
            }
        }
    }
    return [...seen]
}

/**
 * A movable guitar shape (no open string) moved by semitones, up or down, whichever stays lower on
 * the neck, with the same fingers. Null for a shape with open strings: moved, it would be another
 * shape (an open G two frets up is a hard stretch, not the A anyone plays), so the voicing lookup
 * draws the new chord instead.
 */
function shifted(voicing: FrettedVoicing, semitones: number): FrettedVoicing | null {
    const up = ((semitones % 12) + 12) % 12
    if (!up) return voicing
    const sounding = voicing.frets.filter((f): f is number => f !== null)
    if (!sounding.length || sounding.includes(0)) return null
    const by = [up, up - 12]
        .filter((n) => sounding.every((f) => f + n >= 1 && f + n <= MAX_SHIFTED_FRET))
        .sort((a, b) => a - b)[0]
    if (by === undefined) return null
    const frets = voicing.frets.map((f) => (f === null ? null : f + by))
    return { frets, fingers: [...voicing.fingers], baseFret: baseFretOf(frets) }
}

/** A definition's guitar shape: its frets (or the chord it copies from the lookup), and fingers. */
function definedVoicing(
    definition: ChordDefinition,
    voicings: VoicingLookup | undefined
): FrettedVoicing | null {
    const copied =
        definition.copy && parseChord(definition.copy)
            ? (voicings?.(definition.copy, 0) ?? null)
            : null
    const frets = absoluteFrets(definition) ?? copied?.frets ?? null
    if (!frets) return null
    const written = definition.fingers ?? (definition.frets ? null : copied?.fingers) ?? null
    // Fingers on open and muted strings mean nothing.
    const fingers = frets.map((f, i) => (f ? (written?.[i] ?? null) : null))
    const fretted = frets.filter((f): f is number => f !== null && f > 0)
    const base = definition.baseFret
    return {
        frets,
        fingers,
        // A given base fret is shown when it's the lowest fret played; otherwise computed.
        baseFret:
            base && base > 1 && fretted.length && base <= Math.min(...fretted)
                ? base
                : definition.frets
                  ? baseFretOf(frets)
                  : (copied?.baseFret ?? baseFretOf(frets))
    }
}

/** The notes keys play: semitones above the root, from the root in middle C's octave. */
function keysNoteSet(symbol: string, keys: readonly number[]): NoteSet | null {
    const parts = splitChordSymbol(symbol)
    const root = parts ? chromaOf(parts.root) : null
    if (!parts || root === null) return null
    const pitches = [...new Set(keys.map((k) => 60 + root + k))].sort((a, b) => a - b)
    const known = chordNoteSet(symbol)
    // The chord's own spelling when the keys only play its notes (Bb, not A#).
    if (known && pitches.every((p) => known.members.some((m) => m.chroma === p % 12))) {
        return { ...known, pitches }
    }
    const flats = known?.preferFlats ?? /^[A-G]b/.test(parts.root)
    const set = listNoteSet(pitches.map((p) => noteOf(p, flats)).join(' '), parts.root)
    if (!set) return null
    set.title = symbol
    return set
}

/**
 * One chord's diagram: `shown` is the name the chart prints (transposed), `definition` the song's
 * shape for the chord as written, moved by `semitones`. Null when there's nothing to draw.
 */
export function chordDiagram(
    doc: Document,
    shown: string,
    definition: ChordDefinition | undefined,
    semitones: number,
    drawing: ChordDrawing
): SVGElement | null {
    const moved = semitones % 12 !== 0
    // A display name is for the chord as written: a transposed chord shows its new name.
    const title = (!moved && definition?.display) || shown
    const known = parseChord(shown) !== null && chordNoteSet(shown) !== null
    const capo = drawing.capo && drawing.capo > 0 ? drawing.capo : 0
    // Under a capo the chart's names are the shapes played; they sound higher.
    const sounding = capo ? soundingChord(shown, capo) : shown
    let el: SVGElement | null = null
    if (drawing.instrument === 'piano') {
        // A piano has no capo: it plays what the guitar sounds, and the title says so.
        // Keys are counted from the root, so they move with it.
        const set = definition?.keys
            ? keysNoteSet(sounding, definition.keys)
            : known
              ? pianoPitches(sounding)
              : null
        if (!set) return null
        el = renderKeyboard(doc, set, {
            playAs: 'chord',
            title: sounding === shown ? title : `${title} (sounds ${sounding})`,
            range: keyRangeOf(set),
            orientation: drawing.orientation?.keyboard
        })
    } else {
        const defined = definition ? definedVoicing(definition, drawing.voicings) : null
        const voicing =
            (defined && shifted(defined, semitones)) ??
            (known ? (drawing.voicings?.(shown, 0) ?? null) : null)
        if (!voicing) return null
        // Root marks follow the sounding chord.
        el = renderGuitarDiagram(doc, voicing, {
            title,
            root: chordNoteSet(sounding)?.root ?? null,
            orientation: drawing.orientation?.chord,
            hand: drawing.hand,
            ...(capo ? { capo, caption: false } : {})
        })
        // What it sounds, as chord blocks say it (a piano redrawing titles itself with it).
        if (sounding !== shown) el.setAttribute('data-mn-sounds', sounding)
    }
    el.setAttribute('data-mn-chord', shown)
    return el
}

/** What to write for chords with no diagram. */
export function missingMessage(names: readonly string[], instrument: ChartInstrument): string {
    const first = names[0] ?? 'X'
    const how =
        instrument === 'piano'
            ? `{define: ${first} keys …} (semitones above the root, e.g. keys 0 4 7)`
            : `{define: ${first} base-fret 1 frets …} (one fret per string, x for a muted one)`
    return `No diagram for ${names.join(', ')}: give the shape with ${how}`
}

export interface ChordsUsedOptions extends ChordDrawing {
    /** Semitones the chart moves chords by. */
    semitones: number
    /** Spell transposed chords with flats (the transposed key's way), or as written. */
    flats?: boolean
    /**
     * A "Capo N" caption over guitar shapes (default true). Charts leave it out when the row is
     * right under the chart's own line that says the capo.
     */
    capoCaption?: boolean
}

/**
 * The "chords used" row: every chord of the lyrics, in order of first appearance, as the chart
 * prints it (transposed), with the song's shapes first. With a capo, guitar shapes are the ones
 * played (the names above the lyrics) under a "Capo N" caption, and piano diagrams the chords that
 * sound ("G (sounds A)"). Null when no chord is used.
 */
export function renderChordsUsed(
    doc: Document,
    song: Song,
    options: ChordsUsedOptions
): HTMLElement | null {
    const { semitones, flats } = options
    const shownSeen = new Set<string>()
    const cells: HTMLElement[] = []
    const missing: string[] = []
    let skipped = 0
    for (const written of chordsUsed(song)) {
        const shown = transposeChord(written, semitones, flats)
        if (shownSeen.has(shown)) continue
        shownSeen.add(shown)
        const definition = findDefinition(song.definitions, written)
        if (definition && !definition.diagram) continue
        if (cells.length >= MAX_ROW) {
            skipped++
            continue
        }
        let el: SVGElement | null = null
        try {
            el = chordDiagram(doc, shown, definition, semitones, {
                ...options,
                ...(song.capo ? { capo: song.capo } : {})
            })
        } catch {
            el = null
        }
        if (!el) {
            missing.push(shown)
            continue
        }
        const cell = html(doc, 'div', 'mn-cell')
        cell.appendChild(el)
        cells.push(cell)
    }
    if (!cells.length && !missing.length) return null
    const root = html(doc, 'div', 'mn-chart-diagrams')
    // The shapes under a capo are guitar shapes: piano diagrams say what they sound in their titles.
    if (song.capo && options.instrument === 'guitar' && options.capoCaption !== false) {
        root.appendChild(html(doc, 'div', 'mn-chart-diagrams-caption', `Capo ${song.capo}`))
    }
    if (cells.length) {
        const row = html(doc, 'div', 'mn-row mn-chart-row')
        row.append(...cells)
        root.appendChild(row)
    }
    if (skipped) {
        root.appendChild(
            html(
                doc,
                'div',
                'mn-chart-diagrams-note',
                `${skipped} more chords not drawn (at most ${MAX_ROW})`
            )
        )
    }
    if (missing.length) {
        root.appendChild(
            html(doc, 'div', 'mn-chart-diagrams-note', missingMessage(missing, options.instrument))
        )
    }
    return root
}
