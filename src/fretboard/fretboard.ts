/**
 * Fretboards with the notes of a scale, chord or list, as SVG. Horizontal by default, high string
 * on top like tabs; vertical has the nut on top, like a chord diagram.
 */
import { shown } from '../theory/naming.js'
import { dotLabel, playableMark, svg, svgLabel, svgLine, svgRoot, svgText } from '../render/dom.js'
import {
    drawTitle,
    neckFrame,
    titleLines,
    titleWidth,
    TITLE_LINE,
    type Hand,
    type NeckLayout,
    type Orientation
} from '../render/layout.js'
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
import { STANDARD_TUNING, chartNoteName } from '../chord/guitar.js'
import { pickGroup, pickTarget } from '../render/pick.js'

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
    /**
     * A capo on this fret: drawn as a bar, the strings sound from it (their names too), and a
     * caption says "Capo N". `frets` and `cells` count from the capo unless `fretsFrom` is `nut`.
     */
    capo?: number
    /**
     * `capo` (default): frets count from the capo, which sits where the nut is drawn (inlays stay
     * on the real neck's frets). `nut`: frets count from the nut, the capo is drawn on its fret
     * and nothing behind it is shown.
     */
    fretsFrom?: 'capo' | 'nut'
    /**
     * The pick layer (Music Practice #73): every string × fret shown is a target with its string,
     * fret, note and pitch, drawn above the dots; `attachPick` makes it live. Off by default.
     */
    pick?: boolean
}

const STRING_GAP = 20
const FRET_W = 44
const OPEN_W = 30
/** Room beyond the low string, for the fret numbers. */
const NUMBERS = 30
const TITLE = 22
/** Room under the neck for the caption (the capo). */
const CAPTION = 18
const SINGLE_INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
const INLAY_R = 4
const DOT_R = 8

export function renderFretboard(
    doc: Document,
    set: NoteSet,
    options: FretboardOptions = {}
): SVGElement {
    const given = options.tuning ?? STANDARD_TUNING
    const capo = options.capo && options.capo > 0 ? options.capo : 0
    // From the nut, the frets are the real neck's; from the capo, the strings sound from it.
    const fromNut = capo > 0 && options.fretsFrom === 'nut'
    const tuning = capo && !fromNut ? given.map((p) => p + capo) : given
    // Every string's name is what it sounds with the capo on.
    const names = given.map((p) => p + capo)
    // Inlays sit on the real neck's frets.
    const real = (fret: number) => fret + (fromNut ? 0 : capo)
    const caption = capo ? `Capo ${capo}` : undefined
    const cells = options.cells
    const played = cells ? new Set(cells.map((c) => `${c.string}:${c.fret}`)) : null
    const [from, to] = cells?.length
        ? [Math.min(...cells.map((c) => c.fret)), Math.max(...cells.map((c) => c.fret))]
        : (options.frets ?? (fromNut ? [capo, capo + 12] : [0, 12]))
    const first = Math.max(from, 1)
    const strings = tuning.length
    const label = options.label ?? 'notes'
    const orientation = options.orientation ?? 'horizontal'
    const vertical = orientation === 'vertical'
    const openW = from === 0 ? OPEN_W : 0
    const acrossLength = (strings - 1) * STRING_GAP
    const layout: NeckLayout = {
        orientation,
        hand: options.hand ?? 'right',
        across: acrossLength,
        along: openW + (to - first + 1) * FRET_W,
        // Room for the string names before the neck.
        before: vertical ? 20 : 24,
        after: 8,
        low: NUMBERS,
        high: 12,
        top: 0,
        minWidth: titleWidth(caption)
    }
    // The title never widens the diagram (#74): it wraps onto more lines instead.
    const lines = options.title ? titleLines(shown(options.title), neckFrame(layout).width) : []
    const frame = neckFrame({
        ...layout,
        top: lines.length ? TITLE + (lines.length - 1) * TITLE_LINE : 0
    })
    // Neck coordinates: strings across (lowest first), from the open strings along.
    const across = (string: number) => string * STRING_GAP
    const wire = (fret: number) => openW + (fret - first + 1) * FRET_W
    const center = (fret: number) => (fret === 0 ? OPEN_W / 2 : wire(fret) - FRET_W / 2)

    const height = frame.height + (caption ? CAPTION : 0)
    const root = svgRoot(
        doc,
        frame.width,
        height,
        'mn-fretboard',
        `${options.title ?? `Fretboard: ${set.title}`}${caption ? `, ${caption.toLowerCase()}` : ''}${describeMarks(set, options.marks)}`
    )
    if (caption) {
        root.appendChild(
            svgText(doc, caption, {
                'class': 'mn-caption',
                'x': frame.width / 2,
                'y': height - 6,
                'text-anchor': 'middle'
            })
        )
        root.setAttribute('data-mn-capo', String(capo))
        root.setAttribute('data-mn-frets-from', fromNut ? 'nut' : 'capo')
    }
    if (lines.length) drawTitle(doc, root, lines, frame.width / 2, 15)

    // What each string shows at each fret: a note dot, a faint ring (a compared scale's note
    // missing here), or nothing.
    const markOf = (s: number, fret: number): 'dot' | 'ghost' | null => {
        const pitch = tuning[s]! + fret
        const member = memberOf(set, pitch)
        // Nothing sounds behind the capo.
        const hidden =
            (options.strings !== undefined && !options.strings.includes(s)) ||
            (fromNut && fret < capo)
        if (hidden) return null
        if (member) return played && !played.has(`${s}:${fret}`) ? null : 'dot'
        return options.marks?.ghosts?.has(pitch % 12) ? 'ghost' : null
    }
    const inlay = (a: number, fret: number) => {
        // A dot over part of an inlay leaves a grey sliver: the inlay is left out there.
        for (let s = 0; s < strings; s++) {
            if (Math.abs(across(s) - a) < INLAY_R + DOT_R && markOf(s, fret)) return
        }
        const [cx, cy] = frame.at(a, center(fret))
        root.appendChild(svg(doc, 'circle', { class: 'mn-inlay', cx, cy, r: INLAY_R }))
    }
    // The 12th fret's pair sits between the 2nd and 3rd strings from each edge (between the
    // outer two on 4 strings or fewer).
    const pair = (strings > 4 ? 1.5 : 0.5) * STRING_GAP
    for (let fret = first; fret <= to; fret++) {
        if (SINGLE_INLAYS.has(real(fret))) inlay(acrossLength / 2, fret)
        if (real(fret) % 12 === 0) {
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
            first === 1 && (!capo || fromNut) ? 'mn-nut' : 'mn-fret'
        )
    )
    for (let fret = first; fret <= to; fret++) {
        root.appendChild(
            svgLine(doc, frame.at(acrossLength, wire(fret)), frame.at(0, wire(fret)), 'mn-fret')
        )
    }
    // The capo: where the nut is drawn (frets from the capo), or on its fret (from the nut).
    const capoAt = fromNut
        ? capo >= first && capo <= to
            ? center(capo)
            : null
        : first === 1
          ? openW
          : null
    if (capo && capoAt !== null) {
        root.appendChild(
            svg(doc, 'rect', {
                class: 'mn-capo',
                ...frame.box(-8, capoAt - 4, acrossLength + 8, capoAt + 4),
                rx: 3
            })
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
        const name = shown(nameOf(names[s]!, set.preferFlats))
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
            const shown = markOf(s, fret)
            if (!shown) continue
            const chroma = (open + fret) % 12
            if (shown === 'ghost') {
                // A parent scale's note missing here: a faint ring.
                root.appendChild(
                    svg(doc, 'circle', {
                        'class': 'mn-ghost',
                        cx,
                        cy,
                        'r': 7,
                        'data-mn-ghost-string': strings - s,
                        'data-mn-fret': fret,
                        'data-mn-note':
                            options.marks?.ghostNames?.get(chroma) ??
                            nameOf(chroma, set.preferFlats),
                        // Not data-midi: a ghost isn't a note to click and play.
                        'data-mn-pitch': open + fret
                    })
                )
                continue
            }
            const member = memberOf(set, open + fret)!
            const cls = `mn-dot${markClasses(set, member.chroma, options.marks)}`
            // Note names as guitar charts write them (G, not F##).
            const text = chartNoteName(labelOf(member, label))
            // The hit area (#69): the note's own cell, its string's lane and its fret.
            const [start, end] = fret === 0 ? [0, OPEN_W] : [wire(fret) - FRET_W, wire(fret)]
            const area = frame.box(
                across(s) - STRING_GAP / 2,
                start,
                across(s) + STRING_GAP / 2,
                end
            )
            root.appendChild(
                playableMark(
                    doc,
                    area,
                    svg(doc, 'circle', {
                        'class': cls,
                        cx,
                        cy,
                        'r': DOT_R,
                        'data-midi': open + fret,
                        'data-mn-string': strings - s,
                        'data-mn-fret': fret,
                        'data-mn-note': member.name
                    }),
                    ...(text ? [dotLabel(doc, text, point, DOT_R)] : [])
                )
            )
            sounding.add(open + fret)
        }
    }
    if (options.pick) {
        // Above everything: the highest string's frets first, so the first tab stop is top left.
        const layer = pickGroup(doc)
        for (let s = strings - 1; s >= 0; s--) {
            for (let fret = from; fret <= to; fret++) {
                // Nothing sounds behind the capo.
                if (fromNut && fret < capo) continue
                const pitch = tuning[s]! + fret
                const [start, end] = fret === 0 ? [0, OPEN_W] : [wire(fret) - FRET_W, wire(fret)]
                const string = strings - s
                layer.appendChild(
                    pickTarget(
                        doc,
                        frame.box(
                            across(s) - STRING_GAP / 2,
                            start,
                            across(s) + STRING_GAP / 2,
                            end
                        ),
                        {
                            pitch,
                            note: memberOf(set, pitch)?.name ?? nameOf(pitch % 12, set.preferFlats),
                            string,
                            fret,
                            name: `String ${string}, ${fret === 0 ? 'open' : `fret ${fret}`}`,
                            mark: frame.at(across(s), center(fret)),
                            radius: DOT_R
                        }
                    )
                )
            }
        }
        root.appendChild(layer)
        root.setAttribute('data-mn-pick', '')
    }
    root.setAttribute('data-mn-pitches', [...sounding].sort((a, b) => a - b).join(' '))
    root.setAttribute('data-mn-play', 'scale')
    root.setAttribute('data-mn-sound', 'guitar')
    // What the diagram shows, for tools that read diagrams.
    root.setAttribute('data-mn-set', set.title)
    root.setAttribute('data-mn-labels', label)
    root.setAttribute('data-mn-orientation', orientation)
    root.setAttribute('data-mn-hand', options.hand ?? 'right')
    root.setAttribute('data-mn-frets', `${from}-${to}`)
    return root
}
