/** Piano keyboards with highlighted notes, as SVG. */
import { shown } from '../theory/naming.js'
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
import { chordVoicingIn } from './play-voicing.js'
import { pickGroup, pickTarget } from '../render/pick.js'

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
    /** Which hand plays each key (MIDI → left or right): a bracket and LH or RH under each hand's keys. */
    hands?: Map<number, 'left' | 'right'>
    /**
     * The pick layer (Music Practice #73): every key is a target with its note and pitch, drawn
     * above the keys and labels; `attachPick` makes it live. Off by default.
     */
    pick?: boolean
}

const BLACK = new Set([1, 3, 6, 8, 10])
const WHITE_W = 22
const WHITE_H = 104
const BLACK_W = 14
const BLACK_H = 64
const TITLE = 22
/** The row of finger numbers past the keys' near end, when the keys show other labels. */
const FINGER_ROW = 16
/** The row of hands (a bracket and LH or RH under each hand's keys) past the keys and fingers. */
const HAND_ROW = 22
/** The least distance between the centers of the LH and RH labels. */
const HAND_LABEL_GAP = 26

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

/**
 * Where a scale or mode drawn without a range starts: its tonic, from G3 up to F#4, so its two
 * octaves sit nearest middle C's (C major C4-C6, A minor pentatonic A3-A5, F# major F#4-F#6).
 * `octave: -1` for the left hand, an octave lower. Null for anything else than a scale of pitch
 * classes (chords, lists, exact pitches).
 */
export function scaleTonicOf(set: NoteSet, octave = 0): number | null {
    if (set.pitches || set.list || !set.scaleType || set.root === null) return null
    return tonicNearMiddleC(set.root, octave)
}

/** A pitch class from G3 up to F#4 (MIDI), `octave` octaves up or down: where a scale or an
 * arpeggio drawn without a range starts. */
export function tonicNearMiddleC(chroma: number, octave = 0): number {
    return 55 + ((((chroma - 7) % 12) + 12) % 12) + 12 * octave
}

/** A scale's keys over two octaves, from its tonic up to the tonic two octaves above. */
export function scaleKeysFrom(set: NoteSet, tonic: number): number[] {
    const chromas = new Set(set.members.map((m) => m.chroma))
    const keys: number[] = []
    for (let midi = tonic; midi <= tonic + 24; midi++) if (chromas.has(midi % 12)) keys.push(midi)
    return keys
}

/**
 * The keys shown by default: a scale's two octaves from tonic to tonic (see `scaleTonicOf`);
 * whole octaves around exact pitches; two octaves from C4 for other pitch classes.
 */
export function keyRangeOf(set: NoteSet): [number, number] {
    const tonic = scaleTonicOf(set)
    if (tonic !== null) return [tonic, tonic + 24]
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
    // A scale without a range: lit from its tonic up to the tonic two octaves above, so a black
    // key tonic's white key below (F# major's F) stays unlit and the run goes tonic to tonic.
    const tonic = options.range ? null : scaleTonicOf(set)
    if (tonic !== null) set = { ...set, pitches: scaleKeysFrom(set, tonic) }
    // Start and end on white keys, so the outline stays clean.
    if (isBlack(from)) from--
    if (isBlack(to)) to++
    const whites: number[] = []
    for (let midi = from; midi <= to; midi++) if (!isBlack(midi)) whites.push(midi)
    // A chord without exact keys lights what it plays: its fingered keys, else one voicing (root
    // position from its lowest root key), not its notes in every octave.
    if (options.playAs === 'chord' && !set.pitches) {
        const keys: number[] = []
        for (let midi = from; midi <= to; midi++) if (memberOf(set, midi)) keys.push(midi)
        const fingered = keys.filter((midi) => options.fingers?.has(midi))
        const voicing = fingered.length ? fingered : chordVoicingIn(set, from, to)
        if (voicing?.length) set = { ...set, pitches: voicing }
    }

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
    const handRow = [...(options.hands?.keys() ?? [])].some((midi) => midi >= from && midi <= to)
        ? HAND_ROW
        : 0
    const depth = WHITE_H + fingerRow + handRow
    const content = (vertical ? depth : length) + 2
    const width = Math.max(content, titleWidth(options.title && shown(options.title)))
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
    // Which hand plays what, in words for screen readers: ", left hand: C3, right hand: E4 G4 C5".
    const handWords = (['left', 'right'] as const)
        .map((hand) => {
            const keys = [...(options.hands ?? [])]
                .filter(([midi, h]) => h === hand && midi >= from && midi <= to)
                .map(([midi]) => midi)
                .sort((a, b) => a - b)
            return keys.length
                ? `${hand} hand: ${keys.map((midi) => `${memberOf(set, midi)?.name ?? nameOf(midi, set.preferFlats)}${Math.floor(midi / 12) - 1}`).join(' ')}`
                : ''
        })
        .filter(Boolean)
        .join(', ')
    const root = svgRoot(
        doc,
        width,
        height,
        'mn-keyboard',
        `${options.title ?? `Keyboard: ${set.title}`}${handWords ? `, ${handWords}` : ''}${describeMarks(set, options.marks)}`
    )
    if (options.title) {
        root.appendChild(
            svgText(doc, shown(options.title), {
                'class': 'mn-title',
                'x': width / 2,
                'y': 15,
                'text-anchor': 'middle'
            })
        )
    }

    // Faint notes (a compared scale's, a chord's outside the scale) stay between a scale's first
    // and last drawn keys: nothing past the tonics of a scale drawn tonic to tonic.
    const lit = set.scaleType && !set.list && set.pitches?.length ? set.pitches : null
    const ghostAt = (midi: number) =>
        (options.marks?.ghosts?.has(((midi % 12) + 12) % 12) ?? false) &&
        (!lit || (midi >= Math.min(...lit) && midi <= Math.max(...lit)))
    const keyClass = (midi: number, black: boolean) => {
        const member = memberOf(set, midi)
        const base = black ? 'mn-key-black' : 'mn-key-white'
        const hand = options.hands?.get(midi)
        if (member)
            return `${base} mn-on${markClasses(set, member.chroma, options.marks)}${hand ? ` mn-hand-${hand}` : ''}`
        return ghostAt(midi) ? `${base} mn-ghost` : base
    }
    // Labels sit near the player's end of the key.
    const caption = (midi: number, point: [number, number], black: boolean) => {
        const member = memberOf(set, midi)
        if (!member) return
        const text = labelOf(member, label, options.fingers?.get(midi))
        if (!text) return
        root.appendChild(
            svgLabel(
                doc,
                shown(text),
                point,
                black ? 'mn-key-label mn-key-label-black' : 'mn-key-label'
            )
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
                    (ghostAt(midi)
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
                    (ghostAt(black)
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
    if (handRow) {
        // Each hand once: a bracket under its keys and LH or RH under it, so no mark sits under a
        // single key (where R would read as a root and two marks could touch).
        const middle = (midi: number) => {
            const whitesBelow = whites.filter((w) => w < midi).length
            return isBlack(midi) ? whitesBelow * WHITE_W : whitesBelow * WHITE_W + WHITE_W / 2
        }
        const groups = (['left', 'right'] as const)
            .map((hand) => {
                const keys = [...options.hands!]
                    .filter(([midi, h]) => h === hand && midi >= from && midi <= to)
                    .map(([midi]) => midi)
                    .sort((a, b) => a - b)
                if (!keys.length) return null
                // A lone key's bracket is a little narrower than the key.
                const low = middle(keys[0]!) - (keys.length === 1 ? WHITE_W / 2 - 4 : 0)
                const high =
                    middle(keys[keys.length - 1]!) + (keys.length === 1 ? WHITE_W / 2 - 4 : 0)
                return { hand, keys, low, high, center: (low + high) / 2 }
            })
            .filter((g) => g !== null)
        // Two labels too close (a bass right under the chord): pushed apart.
        if (groups.length === 2 && groups[1]!.center - groups[0]!.center < HAND_LABEL_GAP) {
            const mid = (groups[0]!.center + groups[1]!.center) / 2
            groups[0]!.center = mid - HAND_LABEL_GAP / 2
            groups[1]!.center = mid + HAND_LABEL_GAP / 2
        }
        const line = WHITE_H + fingerRow + 4
        for (const { hand, keys, low, high, center } of groups) {
            const [x1, y1] = at(low, line - 3)
            const [x2, y2] = at(low, line)
            const [x3, y3] = at(high, line)
            const [x4, y4] = at(high, line - 3)
            root.appendChild(
                svg(doc, 'path', {
                    class: `mn-hand-bracket mn-hand-${hand}`,
                    d: `M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}L${x4} ${y4}`,
                    fill: 'none'
                })
            )
            const mark = svgLabel(
                doc,
                hand === 'left' ? 'LH' : 'RH',
                at(center, line + 8),
                `mn-key-hand mn-hand-${hand}`
            )
            mark.setAttribute('data-mn-keys', keys.join(' '))
            root.appendChild(mark)
        }
    }
    if (options.pick) {
        // Named by their place from the low end, never by their note (a drill must not give the
        // answer away).
        const whiteLayer = pickGroup(doc)
        const spelled = (midi: number) =>
            memberOf(set, midi)?.name ?? nameOf(((midi % 12) + 12) % 12, set.preferFlats)
        whites.forEach((midi, i) => {
            const along = i * WHITE_W
            whiteLayer.appendChild(
                pickTarget(doc, key(along, WHITE_W, WHITE_H), {
                    pitch: midi,
                    note: spelled(midi),
                    name: `White key ${i + 1}`,
                    mark: at(along + WHITE_W / 2, WHITE_H - 14),
                    radius: 8
                })
            )
        })
        // White-key targets go under the black keys: their hover and focus look never covers a
        // black key. Black-key targets go last, on top.
        root.insertBefore(whiteLayer, root.querySelector(':scope > .mn-key-black'))
        const layer = pickGroup(doc)
        let blacks = 0
        whites.forEach((midi, i) => {
            const black = midi + 1
            if (black > to || !isBlack(black)) return
            const along = (i + 1) * WHITE_W - BLACK_W / 2
            layer.appendChild(
                pickTarget(doc, key(along, BLACK_W, BLACK_H), {
                    pitch: black,
                    note: spelled(black),
                    name: `Black key ${++blacks}`,
                    mark: at(along + BLACK_W / 2, BLACK_H - 12),
                    radius: 6
                })
            )
        })
        if (layer.childElementCount) root.appendChild(layer)
        root.setAttribute('data-mn-pick', '')
    }
    // What playback plays: the highlighted keys, low to high (a chord: the voicing lit above).
    let played: number[] = []
    for (let midi = from; midi <= to; midi++) if (memberOf(set, midi)) played.push(midi)
    // A list of exact keys (notes: G4 F4 E4, or a fingered list) plays in the order written.
    const written =
        set.list && set.pitches && options.playAs !== 'chord'
            ? set.pitches.filter((midi) => midi >= from && midi <= to)
            : null
    if (written?.length) {
        played = [...new Set(written)]
        root.setAttribute('data-mn-order', 'written')
    }
    root.setAttribute('data-mn-pitches', played.join(' '))
    root.setAttribute('data-mn-play', options.playAs ?? 'scale')
    root.setAttribute('data-mn-sound', 'piano')
    root.setAttribute('data-mn-set', set.title)
    root.setAttribute('data-mn-labels', label)
    root.setAttribute('data-mn-orientation', vertical ? 'vertical' : 'horizontal')
    return root
}
