/** ChordPro songs rendered as HTML charts: chords above the lyrics, transposable. */
import { html } from '../render/dom.js'
import { keyMove, keyPrefersFlats, transposeChord, transposeKey } from '../theory/transpose.js'
import type { Song } from './chordpro.js'
import type { Hand, LayoutDefaults } from '../render/layout.js'
import type { VoicingLookup } from '../voicings/index.js'
import { findKey } from '../theory/find.js'
import { parseChord } from '../theory/chord-symbol.js'
import { chordNoteSet } from '../theory/note-set.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import { soundingChord } from '../chord/capo.js'
import { progressionPitches } from '../playback/progression.js'
import { parseTime } from '../strum/pattern.js'
import { findDefinition } from './defines.js'
import {
    chordDiagram,
    chordsUsed,
    missingMessage,
    renderChordsUsed,
    type ChartInstrument,
    type ChordDrawing
} from './chart-diagrams.js'

export interface ChartOptions {
    /** Semitones added to the song's own `{transpose}`. */
    transpose?: number
    /**
     * The chords used row, when the song has no `{diagrams}`: `'top'`, `'bottom'` or `'off'`
     * (the default).
     */
    diagrams?: 'top' | 'bottom' | 'off'
    /** Guitar (default) or piano diagrams, when the song has no `{instrument}`. */
    instrument?: ChartInstrument
    /** Guitar voicings for chords the song doesn't define (see `/voicings`). */
    voicings?: VoicingLookup
    /** Diagram orientation: `chord` for guitar, `keyboard` for piano. */
    orientation?: LayoutDefaults['orientation']
    /** Left-handed guitar diagrams. */
    hand?: Hand
}

const PLACEMENTS = new Set(['top', 'bottom', 'off'])

/** A song's `{time}` as beats/unit ("3/4"); null when it doesn't read. */
function timeOf(text: string | null): string | null {
    if (!text) return null
    try {
        const { beatsPerBar, beatUnit } = parseTime(text)
        return `${beatsPerBar}/${beatUnit}`
    } catch {
        return null
    }
}

const SECTION_LABELS: Record<string, string> = {
    chorus: 'Chorus',
    bridge: 'Bridge',
    tab: 'Tab',
    grid: 'Grid'
}

/** The key a song's chords are likeliest in ("C", "Am"); null when none reads. */
function guessedKey(song: Song): string | null {
    const chords = chordsUsed(song).filter((c) => parseChord(c) && chordNoteSet(c))
    const found = chords.length ? findKey(chords) : null
    return found ? `${found.tonic}${found.mode === 'minor' ? 'm' : ''}` : null
}

export function renderChart(doc: Document, song: Song, options: ChartOptions = {}): HTMLElement {
    const extra = options.transpose ?? 0
    const semitones = song.transpose + (Number.isFinite(extra) ? Math.round(extra) : 0)
    const key = song.key ? transposeKey(song.key, semitones) : null
    const flats = key ? keyPrefersFlats(key) : undefined
    // Chords move by the interval between the keys (letters kept: G → F#, C → B). Without a
    // {key}, the key the chords are likeliest in, so every chord moves the same way (C F G7 Bb up
    // 1: Db Gb Ab7 Cb, not C# F# G#7 B).
    const from = song.key ?? (semitones % 12 ? guessedKey(song) : null)
    const move = from ? keyMove(from, semitones) : null
    const spelling = move ?? flats
    const chord = (symbol: string) => transposeChord(symbol, semitones, spelling)
    const drawing: ChordDrawing = {
        instrument: song.instrument ?? (options.instrument === 'piano' ? 'piano' : 'guitar'),
        ...(options.voicings ? { voicings: options.voicings } : {}),
        ...(options.orientation ? { orientation: options.orientation } : {}),
        ...(options.hand ? { hand: options.hand } : {})
    }
    const placement =
        song.diagrams ?? (PLACEMENTS.has(options.diagrams as string) ? options.diagrams! : 'off')
    // The chart's line says "Capo N": a row right under it doesn't say it again; a row at the
    // bottom, far from that line, does.
    const used = (capoCaption: boolean) =>
        renderChordsUsed(doc, song, {
            ...drawing,
            semitones,
            capoCaption,
            ...(spelling === undefined ? {} : { spelling })
        })

    const root = html(doc, 'div', 'mn-chart')
    // Played in time from its bar (#46): each chord above the lyrics a bar, in order.
    root.setAttribute('data-mn-progression-play', '')
    root.setAttribute('data-mn-sound', drawing.instrument === 'piano' ? 'piano' : 'guitar')
    const time = timeOf(song.time)
    if (time) root.setAttribute('data-mn-time', time)
    const tempo = Number(song.tempo)
    if (song.tempo && Number.isFinite(tempo) && tempo >= 20 && tempo <= 240)
        root.setAttribute('data-mn-tempo', String(Math.round(tempo)))
    let bars = 0
    const sounds = new Map<string, string | null>()
    // What a chord sounds: its diagram's notes (the song's shape, the capo), else the strum's.
    const soundOf = (written: string, shown: string): string | null => {
        const known = sounds.get(shown)
        if (known !== undefined) return known
        let pitches: string | null = null
        try {
            pitches =
                chordDiagram(doc, shown, findDefinition(song.definitions, written), semitones, {
                    ...drawing,
                    ...(song.capo ? { capo: song.capo } : {})
                })?.getAttribute('data-mn-pitches') ?? null
        } catch {
            pitches = null
        }
        if (!pitches && parseChord(shown) && chordNoteSet(shown)) {
            try {
                const sounding = song.capo ? soundingChord(shown, song.capo) : shown
                pitches = progressionPitches(
                    sounding,
                    drawing.instrument,
                    STANDARD_TUNING,
                    options.voicings
                ).join(' ')
            } catch {
                pitches = null
            }
        }
        sounds.set(shown, pitches || null)
        return pitches || null
    }
    if (song.title || song.subtitle || song.artist) {
        const header = html(doc, 'div', 'mn-chart-header')
        if (song.title) header.appendChild(html(doc, 'div', 'mn-chart-title', song.title))
        const by = [song.subtitle, song.artist].filter(Boolean).join(' · ')
        if (by) header.appendChild(html(doc, 'div', 'mn-chart-subtitle', by))
        root.appendChild(header)
    }
    const meta = [
        key ? `Key ${key}` : null,
        song.capo ? `Capo ${song.capo}` : null,
        song.tempo ? `${song.tempo} BPM` : null,
        song.time ? song.time : null,
        semitones % 12 ? `Transposed ${semitones > 0 ? '+' : ''}${semitones}` : null
    ].filter((m): m is string => m !== null)
    if (meta.length) root.appendChild(html(doc, 'div', 'mn-chart-meta', meta.join(' · ')))
    // Directives the chart couldn't read: what to write instead, and the rest still draws.
    for (const warning of song.warnings) {
        root.appendChild(html(doc, 'div', 'mn-error-message', warning))
    }
    if (placement === 'top') {
        const row = used(false)
        if (row) root.appendChild(row)
    }

    for (const section of song.sections) {
        const el = html(doc, 'div', `mn-section mn-section-${section.kind}`)
        const label = section.label ?? SECTION_LABELS[section.kind]
        if (label) el.appendChild(html(doc, 'div', 'mn-section-label', label))
        for (const line of section.lines) {
            if (line.kind === 'empty') el.appendChild(html(doc, 'div', 'mn-line mn-line-empty'))
            else if (line.kind === 'comment')
                el.appendChild(html(doc, 'div', 'mn-line mn-comment', line.text))
            else if (line.kind === 'text')
                el.appendChild(html(doc, 'pre', 'mn-line mn-pre', line.text))
            else if (line.kind === 'chord') {
                // In place: transposed only when written in brackets ({chord: [Am]}), as ChordPro does.
                const { definition } = line
                if (!definition.diagram) continue
                const moved = definition.transposable ? semitones : 0
                const shown = transposeChord(definition.name, moved, spelling)
                const inline = html(doc, 'div', 'mn-line mn-chart-chord')
                let diagram: SVGElement | null = null
                try {
                    // Under a capo, played and drawn like the chords used row.
                    diagram = chordDiagram(doc, shown, definition, moved, {
                        ...drawing,
                        ...(song.capo ? { capo: song.capo } : {})
                    })
                } catch {
                    diagram = null
                }
                inline.appendChild(
                    diagram ??
                        html(
                            doc,
                            'div',
                            'mn-error-message',
                            missingMessage([shown], drawing.instrument)
                        )
                )
                el.appendChild(inline)
            } else {
                const row = html(doc, 'div', 'mn-line')
                const chordsOnly = line.segments.every((s) => !s.text.trim())
                if (chordsOnly) row.classList.add('mn-chords-only')
                for (const segment of line.segments) {
                    const seg = html(doc, 'span', 'mn-seg')
                    const mark = html(
                        doc,
                        'span',
                        'mn-chord',
                        segment.chord === null ? '' : chord(segment.chord)
                    )
                    if (segment.chord !== null) {
                        const shown = chord(segment.chord)
                        const voicing = soundOf(segment.chord, shown)
                        if (voicing) {
                            mark.setAttribute('data-mn-bar', String(bars++))
                            mark.setAttribute('data-mn-chord', shown)
                            mark.setAttribute('data-mn-voicing', voicing)
                        }
                    }
                    seg.appendChild(mark)
                    seg.appendChild(
                        html(doc, 'span', 'mn-lyric', segment.text || (chordsOnly ? '' : ' '))
                    )
                    row.appendChild(seg)
                }
                el.appendChild(row)
            }
        }
        root.appendChild(el)
    }
    if (placement === 'bottom') {
        const row = used(true)
        if (row) root.appendChild(row)
    }
    return root
}
