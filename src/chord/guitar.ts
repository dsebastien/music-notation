/** Guitar (and any fretted instrument) chord diagrams, as SVG. */
import { svg, svgRoot, svgText } from '../render/dom.js'

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

const SPACING = 18
const ROW = 20
const LEFT = 30
const TITLE = 22
const MARKERS = 16

export function renderGuitarDiagram(
    doc: Document,
    voicing: FrettedVoicing,
    options: GuitarDiagramOptions = {}
): SVGElement {
    const strings = voicing.frets.length
    const base = voicing.baseFret ?? baseFretOf(voicing.frets)
    const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0)
    const rows = Math.max(4, fretted.length ? Math.max(...fretted) - base + 1 : 0)
    const top = (options.title ? TITLE : 4) + MARKERS
    const width = LEFT + (strings - 1) * SPACING + 14
    const height = top + rows * ROW + 10
    const x = (string: number) => LEFT + string * SPACING
    const y = (row: number) => top + row * ROW

    const label = options.title ? `${options.title} chord diagram` : 'Chord diagram'
    const root = svgRoot(doc, width, height, 'mn-guitar-chord', label)
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

    for (let row = 0; row <= rows; row++) {
        root.appendChild(
            svg(doc, 'line', {
                class: row === 0 && base === 1 ? 'mn-nut' : 'mn-fret',
                x1: x(0),
                x2: x(strings - 1),
                y1: y(row),
                y2: y(row)
            })
        )
    }
    for (let s = 0; s < strings; s++) {
        root.appendChild(
            svg(doc, 'line', { class: 'mn-string', x1: x(s), x2: x(s), y1: y(0), y2: y(rows) })
        )
    }
    if (base > 1) {
        root.appendChild(
            svgText(doc, `${base}fr`, {
                'class': 'mn-base-fret',
                'x': LEFT - 10,
                'y': y(0.5) + 4,
                'text-anchor': 'end'
            })
        )
    }

    for (const barre of barresOf(voicing)) {
        const cy = y(barre.fret - base + 0.5)
        root.appendChild(
            svg(doc, 'rect', {
                class: 'mn-barre',
                x: x(barre.from) - 7,
                y: cy - 7,
                width: x(barre.to) - x(barre.from) + 14,
                height: 14,
                rx: 7
            })
        )
    }

    const tuning = options.tuning ?? (strings === 6 ? STANDARD_TUNING : undefined)
    voicing.frets.forEach((fret, s) => {
        const cx = x(s)
        if (fret === null) {
            root.appendChild(
                svgText(doc, '×', {
                    'class': 'mn-muted',
                    'x': cx,
                    'y': top - 4,
                    'text-anchor': 'middle'
                })
            )
            return
        }
        const open = tuning?.[s]
        const isRoot =
            options.root !== undefined &&
            options.root !== null &&
            open !== undefined &&
            (open + fret) % 12 === options.root
        if (fret === 0) {
            root.appendChild(
                svg(doc, 'circle', {
                    class: `mn-open${isRoot ? ' mn-root' : ''}`,
                    cx,
                    cy: top - 8,
                    r: 4
                })
            )
            return
        }
        const cy = y(fret - base + 0.5)
        root.appendChild(
            svg(doc, 'circle', { class: `mn-dot${isRoot ? ' mn-root' : ''}`, cx, cy, r: 7 })
        )
        const finger = voicing.fingers[s]
        if (finger) {
            root.appendChild(
                svgText(doc, finger, {
                    'class': 'mn-dot-text',
                    'x': cx,
                    'y': cy + 4,
                    'text-anchor': 'middle'
                })
            )
        }
    })
    return root
}
