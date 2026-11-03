/**
 * A strumming pattern drawn as a beat grid (#8): the counts (1 & 2 &…) under the slots, an arrow
 * per strum (down or up), accents (>) over them, muted strums as an X, ghost strums small and in
 * parentheses, chord names over the slot they start on, bar lines between bars. SVG with theme
 * colors, like the other diagrams. Each slot is a `g[data-mn-beat]` (its index from 0), so a page
 * can light the strum that plays.
 */
import { html, svg, svgLabel, svgLine, svgRoot } from '../render/dom.js'
import { parseTuning } from '../fretboard/tuning.js'
import type { RenderOptions } from '../blocks/renderers.js'
import { countOf, formatStrum, parseStrum, type StrumPattern, type StrumSlot } from './pattern.js'
import { strumVoicing } from './voicing.js'
import { countedTempoOf } from './play.js'

export interface StrumOptions {
    title?: string
    /** The notes each chord sounds (lowest string first), for playback; see `strumVoicing`. */
    voicing?: (chord: string | null) => number[]
    /**
     * Beats a minute playback starts at, counting the pattern's counted beat (a dotted quarter in
     * compound time); the pattern's own tempo wins.
     */
    bpm?: number
}

/** At most this many slots in a row of the drawing (two bars of 8ths in 4/4), then it wraps. */
const ROW_SLOTS = 16
const PAD = 12
const TITLE = 22
/** The feel line ("Swing") over the grid. */
const FEEL = 16
const CHORDS = 18
const ACCENTS = 12
const ARROWS = 34
const COUNTS = 18
const ROW_GAP = 12

const slotWidth = (slotsPerBeat: number) => (slotsPerBeat >= 4 ? 22 : slotsPerBeat === 3 ? 24 : 28)

/** The feel written over the grid: "Swing", "Swing 60%", "16th swing"; null when straight. */
function swingLabel(pattern: StrumPattern): string | null {
    const swing = pattern.swing
    if (!swing) return null
    const triplet = Math.abs(swing - 2 / 3) < 0.001
    const amount = triplet ? '' : ` ${Math.round(swing * 100)}%`
    // Swing plays pairs of slots: 8ths, or 16ths.
    return `${pattern.subdivision === '16ths' ? '16th swing' : 'Swing'}${amount}`
}

/** A down or up arrow centered on x, between top and bottom. */
function arrow(doc: Document, x: number, top: number, bottom: number, up: boolean, cls: string) {
    const head = 7
    const tip = up ? top : bottom
    const base = up ? top + head + 1 : bottom - head - 1
    return [
        svgLine(doc, [x, up ? base : top], [x, up ? bottom : base], `mn-strum-arrow${cls}`),
        svg(doc, 'path', {
            class: `mn-strum-head${cls}`,
            d: `M${x - 5} ${base}L${x + 5} ${base}L${x} ${tip}Z`
        })
    ]
}

/** The drawing of one slot: an arrow, an X, or nothing, with its accent or parentheses. */
function slotMarks(
    doc: Document,
    slot: StrumSlot,
    x: number,
    accentY: number,
    top: number,
    bottom: number
): Element[] {
    const marks: Element[] = []
    if (slot.stroke === 'rest') return marks
    const cls = slot.accent ? ' mn-strum-accented' : slot.ghost ? ' mn-strum-ghost' : ''
    // Ghost strums: smaller, so they don't rest on color alone, and in parentheses.
    const inset = slot.ghost ? 5 : 0
    const t = top + inset
    const b = bottom - inset
    if (slot.stroke === 'mute') {
        const mid = (top + bottom) / 2
        const r = slot.ghost ? 4 : 6
        marks.push(
            svgLine(doc, [x - r, mid - r], [x + r, mid + r], `mn-strum-mute${cls}`),
            svgLine(doc, [x - r, mid + r], [x + r, mid - r], `mn-strum-mute${cls}`)
        )
    } else marks.push(...arrow(doc, x, t, b, slot.stroke === 'up', cls))
    if (slot.ghost) {
        const mid = (top + bottom) / 2
        marks.push(svgLabel(doc, '(', [x - 8, mid - 1], 'mn-strum-paren'))
        marks.push(svgLabel(doc, ')', [x + 8, mid - 1], 'mn-strum-paren'))
    }
    if (slot.accent)
        marks.push(
            svg(doc, 'path', {
                class: 'mn-strum-accent',
                d: `M${x - 5} ${accentY}L${x + 5} ${accentY + 3.5}L${x - 5} ${accentY + 7}`
            })
        )
    return marks
}

/** The pattern's drawing, with what playback needs on its elements. */
export function renderStrum(
    doc: Document,
    pattern: StrumPattern,
    options: StrumOptions = {}
): SVGElement {
    const { slotsPerBar, slotsPerBeat } = pattern
    // The counted beats: each beat, or 1 and 4 in 6/8 (dotted beats of three).
    const slotsPerPulse = pattern.slotsPerPulse ?? slotsPerBeat
    const feel = swingLabel(pattern)
    const width = slotWidth(slotsPerBeat)
    const barsPerRow = Math.max(1, Math.floor(ROW_SLOTS / slotsPerBar))
    const rows = Math.ceil(pattern.bars / barsPerRow)
    const hasChords = Boolean(pattern.chord) || pattern.slots.some((s) => s.chord)
    const title = options.title ?? pattern.title ?? undefined
    const rowHeight = (hasChords ? CHORDS : 0) + ACCENTS + ARROWS + COUNTS
    // Wide enough for a long chord name over a row's last slots.
    const chordEnd = pattern.slots.reduce((end, slot, i) => {
        const chord = slot.chord ?? (i === 0 ? pattern.chord : null)
        if (!chord) return end
        const col = i % (barsPerRow * slotsPerBar)
        return Math.max(end, PAD + col * width + 3 + chord.length * 7.5)
    }, 0)
    const gridWidth = Math.ceil(
        Math.max(PAD * 2 + Math.min(pattern.bars, barsPerRow) * slotsPerBar * width, chordEnd + 4)
    )
    // A title wider than the grid widens the drawing, the grid centered under it.
    const titleWidth = title ? Math.ceil(title.length * 8 + PAD * 2) : 0
    const totalWidth = Math.max(gridWidth, titleWidth)
    const shift = (totalWidth - gridWidth) / 2
    const top0 = (title ? TITLE : 0) + (feel ? FEEL : 0)
    const totalHeight = top0 + rows * rowHeight + (rows - 1) * ROW_GAP + 6

    const written = formatStrum(pattern)
    const time = `${pattern.beatsPerBar}/${pattern.beatUnit}`
    const root = svgRoot(
        doc,
        totalWidth,
        totalHeight,
        'mn-strum',
        `${title ? `${title}: s` : 'S'}trumming pattern ${written}, ${time}, ${pattern.subdivision}${feel ? `, ${feel.toLowerCase()}` : ''}`
    )
    root.setAttribute('data-mn-strum', written)
    root.setAttribute('data-mn-time', time)
    root.setAttribute('data-mn-subdivision', pattern.subdivision)
    root.setAttribute('data-mn-slots-per-beat', String(slotsPerBeat))
    if (pattern.swing) root.setAttribute('data-mn-swing', String(pattern.swing))
    const bpm = pattern.tempo ?? options.bpm
    if (bpm !== undefined) root.setAttribute('data-mn-tempo', String(bpm))
    if (title) root.appendChild(svgLabel(doc, title, [totalWidth / 2, 10], 'mn-title'))
    if (feel)
        root.appendChild(
            svgLabel(
                doc,
                feel,
                [shift + PAD, (title ? TITLE : 0) + FEEL / 2],
                'mn-strum-feel',
                'start'
            )
        )

    // What the first strums sound: `chord:`, else the chord the pattern ends on (it repeats).
    const changes = pattern.slots.filter((s) => s.chord)
    const first = pattern.chord ?? changes[changes.length - 1]?.chord ?? null
    if (options.voicing) {
        root.setAttribute('data-mn-voicing', options.voicing(first).join(' '))
        if (first) root.setAttribute('data-mn-strum-chord', first)
    }

    const body = shift ? svg(doc, 'g', { transform: `translate(${shift} 0)` }) : root
    if (body !== root) root.appendChild(body)
    for (let r = 0; r < rows; r++) {
        const y0 = top0 + r * (rowHeight + ROW_GAP)
        const chordY = y0 + CHORDS / 2
        const accentY = y0 + (hasChords ? CHORDS : 0) + 2
        const top = accentY + ACCENTS - 2
        const bottom = top + ARROWS - 6
        const lineY = bottom + 4
        const countY = lineY + COUNTS / 2 + 1
        const firstBar = r * barsPerRow
        const bars = Math.min(barsPerRow, pattern.bars - firstBar)
        const right = PAD + bars * slotsPerBar * width
        body.appendChild(svgLine(doc, [PAD, lineY], [right, lineY], 'mn-strum-line'))
        // Bar lines at both ends and between bars.
        for (let b = 0; b <= bars; b++) {
            const x = PAD + b * slotsPerBar * width
            body.appendChild(svgLine(doc, [x, top - 2], [x, lineY + 4], 'mn-strum-bar'))
        }
        for (let i = firstBar * slotsPerBar; i < (firstBar + bars) * slotsPerBar; i++) {
            const slot = pattern.slots[i]!
            const col = i - firstBar * slotsPerBar
            const x = PAD + (col + 0.5) * width
            const onBeat = col % slotsPerPulse === 0
            const g = svg(doc, 'g', {
                'class': `mn-strum-slot mn-strum-slot-${slot.stroke}`,
                'data-mn-beat': i,
                'data-mn-stroke': slot.stroke,
                'data-mn-accent': slot.accent ? 'true' : undefined,
                'data-mn-ghost': slot.ghost ? 'true' : undefined
            })
            // The slot's box: a target for a later highlight, drawn invisible.
            g.appendChild(
                svg(doc, 'rect', {
                    class: 'mn-strum-cell',
                    x: x - width / 2,
                    y: accentY - 2,
                    width,
                    height: lineY - accentY + COUNTS + 2
                })
            )
            for (const mark of slotMarks(doc, slot, x, accentY, top, bottom)) g.appendChild(mark)
            // A tick on the line: taller on the beat.
            g.appendChild(svgLine(doc, [x, lineY], [x, lineY + (onBeat ? 4 : 2)], 'mn-strum-tick'))
            g.appendChild(
                svgLabel(
                    doc,
                    countOf(i, slotsPerBeat, slotsPerBar),
                    [x, countY],
                    onBeat ? 'mn-strum-count mn-strum-count-beat' : 'mn-strum-count'
                )
            )
            const chord = slot.chord ?? (i === 0 ? pattern.chord : null)
            if (chord) {
                const label = svgLabel(
                    doc,
                    chord,
                    [x - width / 2 + 3, chordY],
                    'mn-strum-chord',
                    'start'
                )
                g.appendChild(label)
                g.setAttribute('data-mn-chord', chord)
                if (options.voicing && slot.chord)
                    g.setAttribute('data-mn-voicing', options.voicing(slot.chord).join(' '))
            }
            body.appendChild(g)
        }
    }
    return root
}

/**
 * A ```strum block: the pattern drawn, with each chord's notes for playback (the `voicings`
 * option's on a standard guitar, else generated ones, for the block's `tuning:`). Throws a
 * message for the user.
 */
export function renderStrumBlock(doc: Document, source: string, options: RenderOptions): Element {
    const pattern = parseStrum(source)
    const tuning = pattern.tuning ? parseTuning(pattern.tuning) : undefined
    if (tuning === null)
        throw new Error(
            `Unknown tuning "${pattern.tuning}": use e.g. tuning: standard, drop d, ukulele or E2 A2 D3 G3 B3 E4`
        )
    if (tuning && tuning.length > 12) throw new Error('At most 12 strings')
    // The app's bpm counts quarters: the same speed in the beat the pattern counts.
    const bpm = countedTempoOf(
        typeof options.play === 'object' ? options.play.bpm : undefined,
        pattern.compound,
        pattern.beatUnit
    )
    const drawn = renderStrum(doc, pattern, {
        voicing: (chord) => strumVoicing(chord, tuning, options.voicings),
        ...(bpm !== undefined && Number.isFinite(bpm) ? { bpm } : {})
    })
    if (!pattern.note) return drawn
    // How strums written alone were placed, under the grid: a note, not an error (#73).
    const wrap = html(doc, 'div', 'mn-strum-block')
    wrap.append(drawn, html(doc, 'p', 'mn-strum-note', pattern.note))
    return wrap
}
