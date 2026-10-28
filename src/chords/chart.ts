/** ChordPro songs rendered as HTML charts: chords above the lyrics, transposable. */
import { html } from '../render/dom.js'
import { keyPrefersFlats, transposeChord, transposeKey } from '../theory/transpose.js'
import type { Song } from './chordpro.js'

export interface ChartOptions {
    /** Semitones added to the song's own `{transpose}`. */
    transpose?: number
}

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
            else {
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
    return root
}
