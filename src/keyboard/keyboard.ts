/** Piano keyboards with highlighted notes, as SVG. */
import { svg, svgLabel, svgRoot, svgText } from '../render/dom.js'
import { titleWidth, type Orientation } from '../render/layout.js'
import {
    labelOf,
    describeMarks,
    markClasses,
    memberOf,
    type NoteLabel,
    type NoteMarks,
    type NoteSet
} from '../theory/note-set.js'
import { midiOf, nameOf } from '../theory/pitch.js'

export interface KeyboardOptions {
    /** Lowest and highest MIDI pitch shown; computed from the notes when absent. */
    range?: [number, number]
    label?: NoteLabel
    /** Finger per highlighted pitch (MIDI → "1".."5"). */
    fingers?: Map<number, string>
    title?: string
    /** Horizontal (default) or vertical: low notes at the bottom, black keys on the left. */
    orientation?: Orientation
    marks?: NoteMarks
    /** How playback plays the highlighted keys: together (a chord) or one by one (a scale). */
    playAs?: 'chord' | 'scale'
}

const BLACK = new Set([1, 3, 6, 8, 10])
const WHITE_W = 22
const WHITE_H = 104
const BLACK_W = 14
const BLACK_H = 64
const TITLE = 22
/** The row of finger numbers past the keys' near end, when the keys show other labels. */
const FINGER_ROW = 16

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
    const label = options.label ?? 'notes'
    // Fingering and labels together: the labels stay on the keys, the fingers get their own row.
    const fingerRow =
        label !== 'fingers' &&
        [...(options.fingers?.keys() ?? [])].some((midi) => midi >= from && midi <= to)
            ? FINGER_ROW
            : 0
    const depth = WHITE_H + fingerRow
    const content = (vertical ? depth : length) + 2
    const width = Math.max(content, titleWidth(options.title))
    const shift = (width - content) / 2
    const height = top + (vertical ? length : depth) + 2
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
    const root = svgRoot(
        doc,
        width,
        height,
        'mn-keyboard',
        `${options.title ?? `Keyboard: ${set.title}`}${describeMarks(set, options.marks)}`
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
        const chroma = ((midi % 12) + 12) % 12
        const base = black ? 'mn-key-black' : 'mn-key-white'
        if (member) return `${base} mn-on${markClasses(set, member.chroma, options.marks)}`
        return options.marks?.ghosts?.has(chroma) ? `${base} mn-ghost` : base
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
                'class': keyClass(midi, false),
                ...key(along, WHITE_W, WHITE_H),
                'rx': 2,
                'data-midi': midi,
                'data-mn-note':
                    memberOf(set, midi)?.name ??
                    (options.marks?.ghosts?.has(((midi % 12) + 12) % 12)
                        ? (options.marks?.ghostNames?.get(((midi % 12) + 12) % 12) ??
                          nameOf(midi, set.preferFlats))
                        : undefined)
            })
        )
        caption(midi, at(along + WHITE_W / 2, WHITE_H - 13), false)
    })
    whites.forEach((midi, i) => {
        const black = midi + 1
        if (black > to || !isBlack(black)) return
        const along = (i + 1) * WHITE_W - BLACK_W / 2
        root.appendChild(
            svg(doc, 'rect', {
                'class': keyClass(black, true),
                ...key(along, BLACK_W, BLACK_H),
                'rx': 2,
                'data-midi': black,
                'data-mn-note':
                    memberOf(set, black)?.name ??
                    (options.marks?.ghosts?.has(((black % 12) + 12) % 12)
                        ? (options.marks?.ghostNames?.get(((black % 12) + 12) % 12) ??
                          nameOf(black, set.preferFlats))
                        : undefined)
            })
        )
        caption(black, at(along + BLACK_W / 2, BLACK_H - 13), true)
    })
    if (fingerRow) {
        for (const [midi, finger] of options.fingers!) {
            if (midi < from || midi > to) continue
            // A key's middle along the keyboard: a white key's center, or the edge a black key sits on.
            const whitesBelow = whites.filter((w) => w < midi).length
            const along = isBlack(midi)
                ? whitesBelow * WHITE_W
                : whitesBelow * WHITE_W + WHITE_W / 2
            const label = svgLabel(
                doc,
                finger,
                at(along, WHITE_H + FINGER_ROW / 2 - 1),
                'mn-key-finger'
            )
            label.setAttribute('data-mn-key', String(midi))
            root.appendChild(label)
        }
    }
    // What playback plays: the highlighted keys, low to high.
    const played: number[] = []
    for (let midi = from; midi <= to; midi++) if (memberOf(set, midi)) played.push(midi)
    root.setAttribute('data-mn-pitches', played.join(' '))
    root.setAttribute('data-mn-play', options.playAs ?? 'scale')
    root.setAttribute('data-mn-sound', 'piano')
    root.setAttribute('data-mn-set', set.title)
    root.setAttribute('data-mn-labels', label)
    root.setAttribute('data-mn-orientation', vertical ? 'vertical' : 'horizontal')
    // Playback runs a scale from root to root; a list (even with a root) plays every note written.
    if (set.root !== null && !set.list) root.setAttribute('data-mn-root', String(set.root))
    return root
}
