/**
 * Fretboards with the notes of a scale, chord or list, as SVG. Horizontal by default, high string
 * on top like tabs; vertical has the nut on top, like a chord diagram.
 */
import { svg, svgLabel, svgLine, svgRoot, svgText } from '../render/dom.js'
import { neckFrame, titleWidth, type Hand, type Orientation } from '../render/layout.js'
import {
    labelOf,
    describeMarks,
    markClasses,
    memberOf,
    type NoteLabel,
    type NoteMarks,
    type NoteSet
} from '../theory/note-set.js'
import type { Cell } from './positions.js'
import { nameOf } from '../theory/pitch.js'
import { STANDARD_TUNING } from '../chord/guitar.js'

export interface FretboardOptions {
    /** Open-string pitches (MIDI), lowest string first. */
    tuning?: number[]
    /** First and last fret shown; 0 shows the open strings. */
    frets?: [number, number]
    label?: NoteLabel
    title?: string
    /** Horizontal (default) or vertical. */
    orientation?: Orientation
    /** Left-handed: mirrored (the nut on the right, or the low string on the right). */
    hand?: Hand
    /** Only these notes (a scale position); the frets shown follow them. */
    cells?: Cell[]
    marks?: NoteMarks
    /** Only notes on these strings (indexes, lowest first): triads on a string set. */
    strings?: number[]
}

const STRING_GAP = 20
const FRET_W = 44
const OPEN_W = 30
/** Room beyond the low string, for the fret numbers. */
const NUMBERS = 30
const TITLE = 22
const SINGLE_INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21])

export function renderFretboard(
    doc: Document,
    set: NoteSet,
    options: FretboardOptions = {}
): SVGElement {
    const tuning = options.tuning ?? STANDARD_TUNING
    const cells = options.cells
    const played = cells ? new Set(cells.map((c) => `${c.string}:${c.fret}`)) : null
    const [from, to] = cells?.length
        ? [Math.min(...cells.map((c) => c.fret)), Math.max(...cells.map((c) => c.fret))]
        : (options.frets ?? [0, 12])
    const first = Math.max(from, 1)
    const strings = tuning.length
    const label = options.label ?? 'notes'
    const orientation = options.orientation ?? 'horizontal'
    const vertical = orientation === 'vertical'
    const openW = from === 0 ? OPEN_W : 0
    const acrossLength = (strings - 1) * STRING_GAP
    const frame = neckFrame({
        orientation,
        hand: options.hand ?? 'right',
        across: acrossLength,
        along: openW + (to - first + 1) * FRET_W,
        // Room for the string names before the neck.
        before: vertical ? 20 : 24,
        after: 8,
        low: NUMBERS,
        high: 12,
        top: options.title ? TITLE : 0,
        minWidth: titleWidth(options.title)
    })
    // Neck coordinates: strings across (lowest first), from the open strings along.
    const across = (string: number) => string * STRING_GAP
    const wire = (fret: number) => openW + (fret - first + 1) * FRET_W
    const center = (fret: number) => (fret === 0 ? OPEN_W / 2 : wire(fret) - FRET_W / 2)

    const root = svgRoot(
        doc,
        frame.width,
        frame.height,
        'mn-fretboard',
        `${options.title ?? `Fretboard: ${set.title}`}${describeMarks(set, options.marks)}`
    )
    if (options.title) {
        root.appendChild(
            svgText(doc, options.title, {
                'class': 'mn-title',
                'x': frame.width / 2,
                'y': 15,
                'text-anchor': 'middle'
            })
        )
    }

    const inlay = (a: number, fret: number) => {
        const [cx, cy] = frame.at(a, center(fret))
        root.appendChild(svg(doc, 'circle', { class: 'mn-inlay', cx, cy, r: 4 }))
    }
    // The 12th fret's pair sits between the 2nd and 3rd strings from each edge (between the
    // outer two on 4 strings or fewer).
    const pair = (strings > 4 ? 1.5 : 0.5) * STRING_GAP
    for (let fret = first; fret <= to; fret++) {
        if (SINGLE_INLAYS.has(fret)) inlay(acrossLength / 2, fret)
        if (fret % 12 === 0) {
            inlay(acrossLength - pair, fret)
            inlay(pair, fret)
        }
        root.appendChild(svgLabel(doc, String(fret), frame.at(-18, center(fret)), 'mn-fret-number'))
    }
    root.appendChild(
        svgLine(
            doc,
            frame.at(acrossLength, openW),
            frame.at(0, openW),
            first === 1 ? 'mn-nut' : 'mn-fret'
        )
    )
    for (let fret = first; fret <= to; fret++) {
        root.appendChild(
            svgLine(doc, frame.at(acrossLength, wire(fret)), frame.at(0, wire(fret)), 'mn-fret')
        )
    }
    // Highest string first, so the document reads top to bottom in the default orientation.
    // What playback plays: every highlighted note, low to high.
    const sounding = new Set<number>()
    for (let s = strings - 1; s >= 0; s--) {
        const open = tuning[s]!
        root.appendChild(
            svgLine(doc, frame.at(across(s), 0), frame.at(across(s), wire(to)), 'mn-string')
        )
        // Before the neck: above it when vertical, ending next to it when horizontal.
        const name = nameOf(open, set.preferFlats)
        root.appendChild(
            vertical
                ? svgLabel(doc, name, frame.at(across(s), -10), 'mn-string-name')
                : svgLabel(
                      doc,
                      name,
                      frame.at(across(s), -8),
                      'mn-string-name',
                      options.hand === 'left' ? 'start' : 'end'
                  )
        )
        for (let fret = from; fret <= to; fret++) {
            const point = frame.at(across(s), center(fret))
            const [cx, cy] = point
            const member = memberOf(set, open + fret)
            const chroma = (open + fret) % 12
            const hidden = options.strings !== undefined && !options.strings.includes(s)
            if (!member || hidden || (played && !played.has(`${s}:${fret}`))) {
                // A parent scale's note missing here: a faint ring.
                if (!member && !hidden && options.marks?.ghosts?.has(chroma)) {
                    root.appendChild(svg(doc, 'circle', { class: 'mn-ghost', cx, cy, r: 7 }))
                }
                continue
            }
            const cls = `mn-dot${markClasses(set, member.chroma, options.marks)}`
            root.appendChild(
                svg(doc, 'circle', { 'class': cls, cx, cy, 'r': 8, 'data-midi': open + fret })
            )
            sounding.add(open + fret)
            const text = labelOf(member, label)
            if (text) root.appendChild(svgLabel(doc, text, point, 'mn-dot-text'))
        }
    }
    root.setAttribute('data-mn-pitches', [...sounding].sort((a, b) => a - b).join(' '))
    root.setAttribute('data-mn-play', 'scale')
    root.setAttribute('data-mn-sound', 'guitar')
    if (set.root !== null) root.setAttribute('data-mn-root', String(set.root))
    return root
}
