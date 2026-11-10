/**
 * How a diagram marks its root (#14): by color only (`color`, the default), or by color and shape
 * (`shape`: the root's dots are rounded squares, an open string's ring a square ring, a root key
 * gets a small square), so the root doesn't rest on color alone.
 */
import { svg } from './dom.js'

export type RootMark = 'color' | 'shape'

export const ROOT_MARKS: readonly RootMark[] = ['color', 'shape']

const ROOT_MARK_ERROR = 'root-mark: write color or shape'

/** A root mark given by an app (any value): a valid one, else null. */
export function rootMarkOf(value: unknown): RootMark | null {
    if (typeof value !== 'string') return null
    const text = value.trim().toLowerCase()
    if (text === 'color' || text === 'colour') return 'color'
    if (text === 'shape') return 'shape'
    return null
}

/** A block's `root-mark:` value; throws what to write otherwise. */
export function parseRootMark(text: string): RootMark {
    const mark = rootMarkOf(text)
    if (!mark) throw new Error(`${ROOT_MARK_ERROR}, got "${text.trim()}"`)
    return mark
}

const ROOT_MARK_LINE = /^\s*root-mark\s*:\s*(.*)$/i

/** Languages whose blocks read a `root-mark:` line. */
const MARKED_LANGUAGES = new Set(['chord', 'keyboard', 'fretboard', 'progression'])

/**
 * A block's `root-mark:` line (the last one wins), taken out of its source so the diagrams never
 * see it; null mark without one. Throws what to write for a wrong value.
 */
export function rootMarkInBlock(
    language: string,
    text: string
): { text: string; mark: RootMark | null } {
    if (!MARKED_LANGUAGES.has(language)) return { text, mark: null }
    let mark: RootMark | null = null
    const lines: string[] = []
    for (const line of text.split('\n')) {
        const own = ROOT_MARK_LINE.exec(line)
        if (!own) lines.push(line)
        else mark = parseRootMark(own[1]!)
    }
    return { text: mark === null ? text : lines.join('\n'), mark }
}

let current: RootMark = 'color'

/** Draws under a root mark: the renderers called inside `draw` use it. Color again after. */
export function withRootMark<T>(mark: RootMark, draw: () => T): T {
    const before = current
    current = mark
    try {
        return draw()
    } finally {
        current = before
    }
}

/** True while drawing roots as shapes. */
export const rootAsShape = (): boolean => current === 'shape'

type Attributes = Record<string, string | number | undefined>

/**
 * A note mark: a circle, or (a root, drawing roots as shapes) a rounded square of the circle's
 * area, with the same classes and data attributes plus `mn-root-shape`.
 */
export function noteMark(
    doc: Document,
    root: boolean,
    { cx, cy, r, class: cls, ...rest }: Attributes & { cx: number; cy: number; r: number }
): SVGElement {
    if (!root || current !== 'shape') return svg(doc, 'circle', { class: cls, cx, cy, r, ...rest })
    // About the circle's area (sides 1.8 r), so a square root looks no bigger than a dot.
    const half = Math.round(0.9 * r * 10) / 10
    return svg(doc, 'rect', {
        class: `${cls ?? ''} mn-root-shape`.trim(),
        x: cx - half,
        y: cy - half,
        width: 2 * half,
        height: 2 * half,
        rx: Math.round((r / 4) * 10) / 10,
        ...rest
    })
}
