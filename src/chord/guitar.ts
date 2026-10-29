/** Guitar (and any fretted instrument) chord diagrams, as SVG. */
import { svg, svgLabel, svgLine, svgRoot, svgText } from '../render/dom.js'
import { neckFrame, titleWidth, type Hand, type Orientation } from '../render/layout.js'

/** Standard tuning, lowest string first. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]

export interface FrettedVoicing {
    /** Absolute frets, lowest string first: null = muted, 0 = open. */
    frets: (number | null)[]
    /** Finger per string ("1".."4", "T"); null = none. */
    fingers: (string | null)[]
    /** First fret shown; computed when absent. */
    baseFret?: number
}

export interface GuitarDiagramOptions {
    title?: string
    /** Chroma of the chord's root: its dots are marked. */
    root?: number | null
    /** Open-string pitches (MIDI), lowest first. */
    tuning?: number[]
    /** Vertical (default): the nut on top. Horizontal: the high string on top, the nut on the left. */
    orientation?: Orientation
    /** Left-handed: mirrored (the low string on the right, or the nut on the right). */
    hand?: Hand
    /** Text in each string's dot instead of its finger (intervals, note names); null for none. */
    labels?: (string | null)[]
    /** Chord transitions: fingers that stay (anchor) or slide (guide), per string. */
    marks?: ('anchor' | 'guide' | null)[]
}

/** "x02220", "x-10-12-12-11-10", "x 10 12 12 11 10" → frets; null when invalid. */
export function parseFrets(text: string): (number | null)[] | null {
    const trimmed = text.trim()
    const tokens = /[\s,-]/.test(trimmed) ? trimmed.split(/[\s,-]+/) : [...trimmed]
    const frets = tokens
        .filter(Boolean)
        .map((t) => (/^[xX]$/.test(t) ? null : /^\d+$/.test(t) ? Number(t) : NaN))
    return frets.length >= 2 && frets.every((f) => f === null || (Number.isInteger(f) && f <= 36))
        ? frets
        : null
}

/** "x01230", "x-1-3-4-2-1", "x 1 3 4 2 1" → fingers; 0 and x mean no finger. */
export function parseFingers(text: string): (string | null)[] {
    const trimmed = text.trim()
    const tokens =
        /[\s,]/.test(trimmed) || trimmed.includes('-', 1) ? trimmed.split(/[\s,-]+/) : [...trimmed]
    return tokens.filter(Boolean).map((t) => (/^[0xX]$/.test(t) ? null : t.toUpperCase()))
}

/** The first fret shown: 1 when the chord fits in the first 4 frets, else its lowest fretted fret. */
export function baseFretOf(frets: (number | null)[]): number {
    const fretted = frets.filter((f): f is number => f !== null && f > 0)
    if (!fretted.length || Math.max(...fretted) <= 4) return 1
    return Math.min(...fretted)
}

interface Barre {
    fret: number
    from: number
    to: number
    finger: string
}

/** Strings held by the same finger on the same fret, across at least two strings. */
function barresOf(voicing: FrettedVoicing): Barre[] {
    const byKey = new Map<string, number[]>()
    voicing.frets.forEach((fret, string) => {
        const finger = voicing.fingers[string]
        if (fret === null || fret === 0 || !finger) return
        const key = `${finger}@${fret}`
        byKey.set(key, [...(byKey.get(key) ?? []), string])
    })
    const barres: Barre[] = []
    for (const [key, strings] of byKey) {
        if (strings.length < 2) continue
        const [finger, fret] = key.split('@')
        barres.push({
            fret: Number(fret),
            from: Math.min(...strings),
            to: Math.max(...strings),
            finger: finger!
        })
    }
    return barres
}

/** Between two strings. */
const SPACING = 18
/** One fret. */
const ROW = 20
/** Room for the open and muted marks before the nut. */
const MARKERS = 16
/** Room beyond the low string, for the base fret. */
const BASE = 30
const TITLE = 22

export function renderGuitarDiagram(
    doc: Document,
    voicing: FrettedVoicing,
    options: GuitarDiagramOptions = {}
): SVGElement {
    const strings = voicing.frets.length
    const base = voicing.baseFret ?? baseFretOf(voicing.frets)
    const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0)
    const rows = Math.max(4, fretted.length ? Math.max(...fretted) - base + 1 : 0)
    const orientation = options.orientation ?? 'vertical'
    const vertical = orientation === 'vertical'
    const frame = neckFrame({
        orientation,
        hand: options.hand ?? 'right',
        across: (strings - 1) * SPACING,
        along: rows * ROW,
        before: MARKERS,
        after: 10,
        low: vertical || base > 1 ? BASE : 10,
        high: vertical ? 14 : 10,
        top: options.title ? TITLE : 4,
        minWidth: titleWidth(options.title)
    })
    // Neck coordinates: strings across (lowest first), fret rows along.
    const across = (string: number) => string * SPACING
    const along = (row: number) => row * ROW
    const at = (string: number, row: number) => frame.at(across(string), along(row))

    const label = options.title ? `${options.title} chord diagram` : 'Chord diagram'
    const root = svgRoot(doc, frame.width, frame.height, 'mn-guitar-chord', label)
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

    for (let row = 0; row <= rows; row++) {
        const cls = row === 0 && base === 1 ? 'mn-nut' : 'mn-fret'
        root.appendChild(svgLine(doc, at(0, row), at(strings - 1, row), cls))
    }
    for (let s = 0; s < strings; s++) {
        root.appendChild(svgLine(doc, at(s, 0), at(s, rows), 'mn-string'))
    }
    if (base > 1) {
        // Beyond the low string, level with the first fret: ending next to the neck when
        // vertical, under it when horizontal.
        const label = `${base}fr`
        root.appendChild(
            vertical
                ? svgLabel(
                      doc,
                      label,
                      frame.at(-10, along(0.5)),
                      'mn-base-fret',
                      options.hand === 'left' ? 'start' : 'end'
                  )
                : svgLabel(doc, label, frame.at(-16, along(0.5)), 'mn-base-fret')
        )
    }

    for (const barre of barresOf(voicing)) {
        const middle = along(barre.fret - base + 0.5)
        root.appendChild(
            svg(doc, 'rect', {
                class: 'mn-barre',
                ...frame.box(across(barre.from) - 7, middle - 7, across(barre.to) + 7, middle + 7),
                rx: 7
            })
        )
    }

    const tuning = options.tuning ?? (strings === 6 ? STANDARD_TUNING : undefined)
    voicing.frets.forEach((fret, s) => {
        // Open and muted marks sit just before the nut.
        const mark = frame.at(across(s), -8)
        if (fret === null) {
            root.appendChild(svgLabel(doc, '×', mark, 'mn-muted'))
            return
        }
        const open = tuning?.[s]
        const isRoot =
            options.root !== undefined &&
            options.root !== null &&
            open !== undefined &&
            (open + fret) % 12 === options.root
        const midi = open !== undefined ? { 'data-midi': open + fret } : {}
        if (fret === 0) {
            const [cx, cy] = mark
            root.appendChild(
                svg(doc, 'circle', {
                    class: `mn-open${isRoot ? ' mn-root' : ''}`,
                    cx,
                    cy,
                    r: 4,
                    ...midi
                })
            )
            return
        }
        const center = at(s, fret - base + 0.5)
        const [cx, cy] = center
        root.appendChild(
            svg(doc, 'circle', {
                class: `mn-dot${isRoot ? ' mn-root' : ''}${options.marks?.[s] ? ` mn-${options.marks[s]}` : ''}`,
                cx,
                cy,
                r: 7,
                ...midi
            })
        )
        const text = options.labels ? options.labels[s] : voicing.fingers[s]
        if (text) root.appendChild(svgLabel(doc, text, center, 'mn-dot-text'))
    })
    // What playback plays: the sounding strings, low to high (when the tuning is known).
    if (tuning) {
        const pitches = voicing.frets.flatMap((f, s) => (f === null ? [] : [tuning[s]! + f]))
        root.setAttribute('data-mn-pitches', pitches.join(' '))
        root.setAttribute('data-mn-play', 'chord')
        root.setAttribute('data-mn-sound', 'guitar')
    }
    return root
}
