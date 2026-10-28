/**
 * Fretboards with the notes of a scale, chord or list, as SVG. Horizontal by default, high string
 * on top like tabs; vertical has the nut on top, like a chord diagram.
 */
import { svg, svgLabel, svgLine, svgRoot, svgText } from '../render/dom.js'
import { neckFrame, titleWidth, type Hand, type Orientation } from '../render/layout.js'
import { labelOf, memberOf, type NoteLabel, type NoteSet } from '../theory/note-set.js'
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
    const [from, to] = options.frets ?? [0, 12]
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
        options.title ?? `Fretboard: ${set.title}`
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
    // The 12th fret's pair sits between the 2nd and 3rd strings from each edge.
    const pair = (strings > 3 ? 1.5 : 0.5) * STRING_GAP
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
            frame.at(0, openW),
            frame.at(acrossLength, openW),
            first === 1 ? 'mn-nut' : 'mn-fret'
        )
    )
    for (let fret = first; fret <= to; fret++) {
        root.appendChild(
            svgLine(doc, frame.at(0, wire(fret)), frame.at(acrossLength, wire(fret)), 'mn-fret')
        )
    }
    // Highest string first, so the document reads top to bottom in the default orientation.
    for (let s = strings - 1; s >= 0; s--) {
        const open = tuning[s]!
        root.appendChild(
            svgLine(doc, frame.at(across(s), 0), frame.at(across(s), wire(to)), 'mn-string')
        )
        root.appendChild(
            svgLabel(
                doc,
                nameOf(open, set.preferFlats),
                frame.at(across(s), vertical ? -10 : -12),
                'mn-string-name'
            )
        )
        for (let fret = from; fret <= to; fret++) {
            const member = memberOf(set, open + fret)
            if (!member) continue
            const isRoot = set.root === member.chroma
            const point = frame.at(across(s), center(fret))
            const [cx, cy] = point
            root.appendChild(
                svg(doc, 'circle', { class: `mn-dot${isRoot ? ' mn-root' : ''}`, cx, cy, r: 8 })
            )
            const text = labelOf(member, label)
            if (text) root.appendChild(svgLabel(doc, text, point, 'mn-dot-text'))
        }
    }
    return root
}
