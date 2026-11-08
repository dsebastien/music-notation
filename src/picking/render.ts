/**
 * A picking pattern drawn as a small tab (#51): one line a string (the highest on top), each
 * note's fret on its string over the bar's chord, the finger under each slot (p, p', i, m, a, or
 * the string's number), the counts (1 & 2 &…) under them, chord names over the bars they start,
 * bar lines. Each slot is a `g[data-mn-beat]` with its notes (`data-mn-notes`: string:fret:midi),
 * so a page can play it and light the slot that sounds.
 */
import { shown } from '../theory/naming.js'
import { svg, svgLabel, svgLine, svgRoot } from '../render/dom.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import { parseTuning } from '../fretboard/tuning.js'
import type { RenderOptions } from '../blocks/renderers.js'
import { countOf } from '../strum/pattern.js'
import { countedTempoOf } from '../strum/play.js'
import { formatPicking, parsePicking, pluckText, type PickingPattern } from './pattern.js'
import { pickingScore, type PickingScore } from './play.js'

export interface PickingOptions {
    title?: string
    /** Open strings, lowest first; standard by default. */
    tuning?: readonly number[]
    /** Beats a minute playback starts at (the pattern's own tempo wins). */
    bpm?: number
    voicings?: RenderOptions['voicings']
}

const ROW_SLOTS = 16
const PAD = 12
const TITLE = 22
const CHORDS = 18
const STRING_GAP = 11
const FINGERS = 16
const COUNTS = 16
const ROW_GAP = 14

const slotWidth = (slotsPerBeat: number) => (slotsPerBeat >= 4 ? 22 : slotsPerBeat === 3 ? 24 : 26)

/** The pattern's drawing over its chords, with what playback needs on its elements. */
export function renderPicking(
    doc: Document,
    pattern: PickingPattern,
    options: PickingOptions = {}
): SVGElement {
    const tuning = options.tuning ?? STANDARD_TUNING
    const score: PickingScore = pickingScore(pattern, {
        tuning,
        ...(options.voicings ? { voicings: options.voicings } : {})
    })
    const { slotsPerBar, slotsPerBeat } = pattern
    const slotsPerPulse = pattern.slotsPerPulse
    const bars = score.chords.length
    const width = slotWidth(slotsPerBeat)
    const barsPerRow = Math.max(1, Math.floor(ROW_SLOTS / slotsPerBar))
    const rows = Math.ceil(bars / barsPerRow)
    const strings = tuning.length
    const hasChords = score.chords.some(Boolean)
    const title = options.title ?? pattern.title ?? pattern.name ?? undefined
    const staff = (strings - 1) * STRING_GAP
    const rowHeight = (hasChords ? CHORDS : 0) + 8 + staff + 8 + FINGERS + COUNTS
    const gridWidth = Math.ceil(PAD * 2 + Math.min(bars, barsPerRow) * slotsPerBar * width)
    const titleWidth = title ? Math.ceil(title.length * 8 + PAD * 2) : 0
    const totalWidth = Math.max(gridWidth, titleWidth)
    const shift = (totalWidth - gridWidth) / 2
    const top0 = title ? TITLE : 0
    const totalHeight = top0 + rows * rowHeight + (rows - 1) * ROW_GAP + 4

    const written = formatPicking(pattern)
    const time = `${pattern.beatsPerBar}/${pattern.beatUnit}`
    const chordsText = [...new Set(score.chords.filter(Boolean))].join(' ')
    const root = svgRoot(
        doc,
        totalWidth,
        totalHeight,
        'mn-picking',
        `${title ? `${title}: p` : 'P'}icking pattern ${written}, ${time}, ${pattern.subdivision}${chordsText ? `, over ${chordsText}` : ''}`
    )
    root.setAttribute('data-mn-picking', written)
    root.setAttribute('data-mn-time', time)
    root.setAttribute('data-mn-subdivision', pattern.subdivision)
    root.setAttribute('data-mn-slots-per-beat', String(slotsPerBeat))
    root.setAttribute('data-mn-strings', String(strings))
    if (pattern.swing) root.setAttribute('data-mn-swing', String(pattern.swing))
    const bpm = pattern.tempo ?? options.bpm
    if (bpm !== undefined) root.setAttribute('data-mn-tempo', String(bpm))
    if (title) root.appendChild(svgLabel(doc, title, [totalWidth / 2, 10], 'mn-title'))

    const body = shift ? svg(doc, 'g', { transform: `translate(${shift} 0)` }) : root
    if (body !== root) root.appendChild(body)
    for (let r = 0; r < rows; r++) {
        const y0 = top0 + r * (rowHeight + ROW_GAP)
        const chordY = y0 + CHORDS / 2
        const staffTop = y0 + (hasChords ? CHORDS : 0) + 8
        const staffBottom = staffTop + staff
        const fingerY = staffBottom + 8 + FINGERS / 2
        const countY = fingerY + FINGERS / 2 + COUNTS / 2
        const firstBar = r * barsPerRow
        const n = Math.min(barsPerRow, bars - firstBar)
        const right = PAD + n * slotsPerBar * width
        // The strings: the highest on top.
        for (let s = 0; s < strings; s++) {
            const y = staffTop + s * STRING_GAP
            body.appendChild(svgLine(doc, [PAD, y], [right, y], 'mn-picking-string'))
        }
        for (let b = 0; b <= n; b++) {
            const x = PAD + b * slotsPerBar * width
            body.appendChild(svgLine(doc, [x, staffTop], [x, staffBottom], 'mn-picking-bar'))
        }
        for (let i = firstBar * slotsPerBar; i < (firstBar + n) * slotsPerBar; i++) {
            const slot = score.slots[i]!
            const own = pattern.slots[i % pattern.slots.length]!
            const col = i - firstBar * slotsPerBar
            const x = PAD + (col + 0.5) * width
            const onBeat = col % slotsPerPulse === 0
            const bar = Math.floor(i / slotsPerBar)
            const g = svg(doc, 'g', {
                'class': `mn-picking-slot${slot.notes.length ? '' : ' mn-picking-rest'}`,
                'data-mn-beat': i,
                'data-mn-notes': slot.notes.length
                    ? slot.notes
                          .map(
                              (note, k) =>
                                  `${note.string}:${note.fret}:${note.midi}${slot.thumb[k] ? ':p' : ''}`
                          )
                          .join(' ')
                    : undefined
            })
            g.appendChild(
                svg(doc, 'rect', {
                    class: 'mn-picking-cell',
                    x: x - width / 2,
                    y: staffTop - 7,
                    width,
                    height: countY - staffTop + 14
                })
            )
            for (const note of slot.notes) {
                const y = staffTop + (strings - 1 - note.string) * STRING_GAP
                const text = String(note.fret)
                g.appendChild(
                    svg(doc, 'rect', {
                        class: 'mn-picking-gap',
                        x: x - (text.length > 1 ? 8 : 5),
                        y: y - 6,
                        width: text.length > 1 ? 16 : 10,
                        height: 12
                    })
                )
                g.appendChild(svgLabel(doc, text, [x, y], 'mn-picking-fret'))
            }
            const finger = own.plucks.map(pluckText).join('')
            if (finger)
                g.appendChild(
                    svgLabel(
                        doc,
                        finger,
                        [x, fingerY],
                        own.plucks.some((p) => 'finger' in p && p.finger === 'p')
                            ? 'mn-picking-finger mn-picking-thumb'
                            : 'mn-picking-finger'
                    )
                )
            g.appendChild(
                svgLabel(
                    doc,
                    countOf(i, slotsPerBeat, slotsPerBar),
                    [x, countY],
                    onBeat ? 'mn-strum-count mn-strum-count-beat' : 'mn-strum-count'
                )
            )
            const chord = score.chords[bar]
            const starts =
                i % slotsPerBar === 0 && chord && (bar === 0 || score.chords[bar - 1] !== chord)
            if (starts) {
                g.appendChild(
                    svgLabel(
                        doc,
                        shown(chord),
                        [x - width / 2 + 3, chordY],
                        'mn-strum-chord',
                        'start'
                    )
                )
                g.setAttribute('data-mn-chord', chord)
            }
            if (i % slotsPerBar === 0) g.setAttribute('data-mn-bar', String(bar))
            body.appendChild(g)
        }
    }
    return root
}

/**
 * A ```picking block: the pattern drawn over its chord or chords, with each slot's notes for
 * playback. Throws a message for the user.
 */
export function renderPickingBlock(doc: Document, source: string, options: RenderOptions): Element {
    // Read once for its tuning (up to 12 strings), then for the block's own strings.
    const first = parsePicking(source, 12)
    const tuning = first.tuning ? parseTuning(first.tuning) : null
    if (first.tuning && !tuning)
        throw new Error(
            `Unknown tuning "${first.tuning}": use e.g. tuning: standard, drop d, open g or E2 A2 D3 G3 B3 E4`
        )
    if (tuning && tuning.length > 12) throw new Error('At most 12 strings')
    const pattern = parsePicking(source, tuning?.length ?? 6)
    const bpm = countedTempoOf(
        typeof options.play === 'object' ? options.play.bpm : undefined,
        pattern.compound,
        pattern.beatUnit
    )
    return renderPicking(doc, pattern, {
        ...(tuning ? { tuning } : {}),
        ...(options.voicings ? { voicings: options.voicings } : {}),
        ...(bpm !== undefined && Number.isFinite(bpm) ? { bpm } : {})
    })
}
