/** Piano keyboards with highlighted notes, as SVG. */
import { svg, svgLabel, svgRoot, svgText } from '../render/dom.js'
import { titleWidth, type Orientation } from '../render/layout.js'
import { labelOf, memberOf, type NoteLabel, type NoteSet } from '../theory/note-set.js'
import { midiOf } from '../theory/pitch.js'

export interface KeyboardOptions {
    /** Lowest and highest MIDI pitch shown; computed from the notes when absent. */
    range?: [number, number]
    label?: NoteLabel
    /** Finger per highlighted pitch (MIDI → "1".."5"). */
    fingers?: Map<number, string>
    title?: string
    /** Horizontal (default) or vertical: low notes at the bottom, black keys on the left. */
    orientation?: Orientation
}

const BLACK = new Set([1, 3, 6, 8, 10])
const WHITE_W = 22
const WHITE_H = 104
const BLACK_W = 14
const BLACK_H = 64
const TITLE = 22

const isBlack = (midi: number) => BLACK.has(((midi % 12) + 12) % 12)

/** "C3-B4" → MIDI range; null when invalid. */
export function parseKeyRange(text: string): [number, number] | null {
    const parts = text.split(/\s*-\s*(?=[A-Ga-g])/)
    if (parts.length !== 2) return null
    const [from, to] = parts.map((n) => midiOf(n))
    return from !== undefined && from !== null && to !== undefined && to !== null && from < to
        ? [from, to]
        : null
}

/** Whole octaves around the notes: exact pitches, or two octaves from C4 for pitch classes. */
export function keyRangeOf(set: NoteSet): [number, number] {
    if (!set.pitches?.length) return [60, 83]
    const low = Math.min(...set.pitches)
    const high = Math.max(...set.pitches)
    return [low - (((low % 12) + 12) % 12), high + 11 - (((high % 12) + 12) % 12)]
}

export function renderKeyboard(
    doc: Document,
    set: NoteSet,
    options: KeyboardOptions = {}
): SVGElement {
    let [from, to] = options.range ?? keyRangeOf(set)
    // Start and end on white keys, so the outline stays clean.
    if (isBlack(from)) from--
    if (isBlack(to)) to++
    const whites: number[] = []
    for (let midi = from; midi <= to; midi++) if (!isBlack(midi)) whites.push(midi)

    const vertical = options.orientation === 'vertical'
    const top = options.title ? TITLE : 0
    const length = whites.length * WHITE_W
    const content = (vertical ? WHITE_H : length) + 2
    const width = Math.max(content, titleWidth(options.title))
    const shift = (width - content) / 2
    const height = top + (vertical ? length : WHITE_H) + 2
    // Key coordinates: `along` the keyboard from its low end, `depth` from the far edge, where
    // the black keys start. Horizontal: low notes on the left. Vertical: low notes at the bottom,
    // the far edge on the left (a piano roll).
    const at = (along: number, depth: number): [number, number] =>
        vertical
            ? [shift + 1 + depth, top + 1 + length - along]
            : [shift + 1 + along, top + 1 + depth]
    const key = (along: number, size: number, depth: number) => {
        const [x1, y1] = at(along, 0)
        const [x2, y2] = at(along + size, depth)
        return {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1)
        }
    }
    const label = options.label ?? 'notes'
    const root = svgRoot(
        doc,
        width,
        height,
        'mn-keyboard',
        options.title ?? `Keyboard: ${set.title}`
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

    const keyClass = (midi: number, black: boolean) => {
        const member = memberOf(set, midi)
        const classes = [black ? 'mn-key-black' : 'mn-key-white']
        if (member) classes.push('mn-on')
        if (member && set.root === member.chroma) classes.push('mn-root')
        return classes.join(' ')
    }
    // Labels sit near the player's end of the key.
    const caption = (midi: number, point: [number, number], black: boolean) => {
        const member = memberOf(set, midi)
        if (!member) return
        const text = labelOf(member, label, options.fingers?.get(midi))
        if (!text) return
        root.appendChild(
            svgLabel(doc, text, point, black ? 'mn-key-label mn-key-label-black' : 'mn-key-label')
        )
    }

    whites.forEach((midi, i) => {
        const along = i * WHITE_W
        root.appendChild(
            svg(doc, 'rect', {
                class: keyClass(midi, false),
                ...key(along, WHITE_W, WHITE_H),
                rx: 2
            })
        )
        caption(midi, at(along + WHITE_W / 2, WHITE_H - 12), false)
    })
    whites.forEach((midi, i) => {
        const black = midi + 1
        if (black > to || !isBlack(black)) return
        const along = (i + 1) * WHITE_W - BLACK_W / 2
        root.appendChild(
            svg(doc, 'rect', {
                class: keyClass(black, true),
                ...key(along, BLACK_W, BLACK_H),
                rx: 2
            })
        )
        caption(black, at(along + BLACK_W / 2, BLACK_H - 12), true)
    })
    return root
}
