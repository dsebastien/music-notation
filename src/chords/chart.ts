/** ChordPro songs rendered as HTML charts: chords above the lyrics, transposable. */
import { html } from '../render/dom.js'
import { keyPrefersFlats, transposeChord, transposeKey } from '../theory/transpose.js'
import type { Song } from './chordpro.js'
import type { Hand, LayoutDefaults } from '../render/layout.js'
import type { VoicingLookup } from '../voicings/index.js'
import {
    chordDiagram,
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

const SECTION_LABELS: Record<string, string> = {
    chorus: 'Chorus',
    bridge: 'Bridge',
    tab: 'Tab',
    grid: 'Grid'
}

export function renderChart(doc: Document, song: Song, options: ChartOptions = {}): HTMLElement {
    const extra = options.transpose ?? 0
    const semitones = song.transpose + (Number.isFinite(extra) ? Math.round(extra) : 0)
    const key = song.key ? transposeKey(song.key, semitones) : null
    const flats = key ? keyPrefersFlats(key) : undefined
    const chord = (symbol: string) => transposeChord(symbol, semitones, flats)
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
            ...(flats === undefined ? {} : { flats })
        })

    const root = html(doc, 'div', 'mn-chart')
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
                const shown = transposeChord(definition.name, moved, flats)
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
                    seg.appendChild(
                        html(
                            doc,
                            'span',
                            'mn-chord',
                            segment.chord === null ? '' : chord(segment.chord)
                        )
                    )
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
