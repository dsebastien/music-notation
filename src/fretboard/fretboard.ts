/** Fretboards with the notes of a scale, chord or list, as SVG. High string on top, like tabs. */
import { svg, svgRoot, svgText } from '../render/dom'
import { labelOf, memberOf, type NoteLabel, type NoteSet } from '../theory/note-set'
import { nameOf } from '../theory/pitch'
import { STANDARD_TUNING } from '../chord/guitar'

export interface FretboardOptions {
    /** Open-string pitches (MIDI), lowest string first. */
    tuning?: number[]
    /** First and last fret shown; 0 shows the open strings. */
    frets?: [number, number]
    label?: NoteLabel
    title?: string
}

const STRING_GAP = 20
const FRET_W = 44
const OPEN_W = 30
const LEFT = 24
const TITLE = 22
const BOTTOM = 22
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
    const top = (options.title ? TITLE : 0) + 12
    const openW = from === 0 ? OPEN_W : 0
    const nutX = LEFT + openW
    const width = nutX + (to - first + 1) * FRET_W + 8
    const height = top + (strings - 1) * STRING_GAP + BOTTOM + 8
    // Row 0 is the highest string.
    const y = (row: number) => top + row * STRING_GAP
    const wireX = (fret: number) => nutX + (fret - first + 1) * FRET_W
    const centerX = (fret: number) => (fret === 0 ? LEFT + OPEN_W / 2 : wireX(fret) - FRET_W / 2)

    const root = svgRoot(
        doc,
        width,
        height,
        'mn-fretboard',
        options.title ?? `Fretboard: ${set.title}`
    )
    if (options.title) {
        root.appendChild(
            svgText(doc, options.title, {
                'class': 'mn-title',
                'x': width / 2,
                'y': 15,
                'text-anchor': 'middle'
            })
        )
    }

    const middle = y((strings - 1) / 2)
    for (let fret = first; fret <= to; fret++) {
        const cx = wireX(fret) - FRET_W / 2
        if (SINGLE_INLAYS.has(fret))
            root.appendChild(svg(doc, 'circle', { class: 'mn-inlay', cx, cy: middle, r: 4 }))
        if (fret % 12 === 0) {
            root.appendChild(
                svg(doc, 'circle', { class: 'mn-inlay', cx, cy: y(strings > 3 ? 1.5 : 0.5), r: 4 })
            )
            root.appendChild(
                svg(doc, 'circle', {
                    class: 'mn-inlay',
                    cx,
                    cy: y(strings > 3 ? strings - 2.5 : strings - 1.5),
                    r: 4
                })
            )
        }
        root.appendChild(
            svgText(doc, String(fret), {
                'class': 'mn-fret-number',
                'x': cx,
                'y': y(strings - 1) + BOTTOM,
                'text-anchor': 'middle'
            })
        )
    }
    root.appendChild(
        svg(doc, 'line', {
            class: first === 1 ? 'mn-nut' : 'mn-fret',
            x1: nutX,
            x2: nutX,
            y1: y(0),
            y2: y(strings - 1)
        })
    )
    for (let fret = first; fret <= to; fret++) {
        root.appendChild(
            svg(doc, 'line', {
                class: 'mn-fret',
                x1: wireX(fret),
                x2: wireX(fret),
                y1: y(0),
                y2: y(strings - 1)
            })
        )
    }
    for (let row = 0; row < strings; row++) {
        const open = tuning[strings - 1 - row]!
        root.appendChild(
            svg(doc, 'line', {
                class: 'mn-string',
                x1: nutX - openW,
                x2: wireX(to),
                y1: y(row),
                y2: y(row)
            })
        )
        root.appendChild(
            svgText(doc, nameOf(open, set.preferFlats), {
                'class': 'mn-string-name',
                'x': LEFT - 8,
                'y': y(row) + 4,
                'text-anchor': 'end'
            })
        )
        for (let fret = from; fret <= to; fret++) {
            const member = memberOf(set, open + fret)
            if (!member) continue
            const cx = centerX(fret)
            const isRoot = set.root === member.chroma
            root.appendChild(
                svg(doc, 'circle', {
                    class: `mn-dot${isRoot ? ' mn-root' : ''}`,
                    cx,
                    cy: y(row),
                    r: 8
                })
            )
            const text = labelOf(member, label)
            if (text) {
                root.appendChild(
                    svgText(doc, text, {
                        'class': 'mn-dot-text',
                        'x': cx,
                        'y': y(row) + 4,
                        'text-anchor': 'middle'
                    })
                )
            }
        }
    }
    return root
}
