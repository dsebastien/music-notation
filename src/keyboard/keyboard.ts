/** Piano keyboards with highlighted notes, as SVG. */
import { svg, svgRoot, svgText } from '../render/dom'
import { labelOf, memberOf, type NoteLabel, type NoteSet } from '../theory/note-set'
import { midiOf } from '../theory/pitch'

export interface KeyboardOptions {
    /** Lowest and highest MIDI pitch shown; computed from the notes when absent. */
    range?: [number, number]
    label?: NoteLabel
    /** Finger per highlighted pitch (MIDI → "1".."5"). */
    fingers?: Map<number, string>
    title?: string
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
    const [from, to] = text.split(/\s*-\s*(?=[A-Ga-g])/).map((n) => midiOf(n))
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

    const top = options.title ? TITLE : 0
    const width = whites.length * WHITE_W + 2
    const height = top + WHITE_H + 2
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
        return { member, cls: classes.join(' ') }
    }
    const caption = (midi: number, x: number, y: number, black: boolean) => {
        const member = memberOf(set, midi)
        if (!member) return
        const text = labelOf(member, label, options.fingers?.get(midi))
        if (!text) return
        root.appendChild(
            svgText(doc, text, {
                'class': black ? 'mn-key-label mn-key-label-black' : 'mn-key-label',
                'x': x,
                'y': y,
                'text-anchor': 'middle'
            })
        )
    }

    whites.forEach((midi, i) => {
        const x = 1 + i * WHITE_W
        const { cls } = keyClass(midi, false)
        root.appendChild(
            svg(doc, 'rect', { class: cls, x, y: top + 1, width: WHITE_W, height: WHITE_H, rx: 2 })
        )
        caption(midi, x + WHITE_W / 2, top + WHITE_H - 8, false)
    })
    whites.forEach((midi, i) => {
        const black = midi + 1
        if (black > to || !isBlack(black)) return
        const x = 1 + (i + 1) * WHITE_W - BLACK_W / 2
        const { cls } = keyClass(black, true)
        root.appendChild(
            svg(doc, 'rect', { class: cls, x, y: top + 1, width: BLACK_W, height: BLACK_H, rx: 2 })
        )
        caption(black, x + BLACK_W / 2, top + BLACK_H - 8, true)
    })
    return root
}
