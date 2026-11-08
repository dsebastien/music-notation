/**
 * Orientation and hand of diagrams, and the frame that maps a neck (guitar diagram, fretboard)
 * to x/y. Renderers place things along the neck and across the strings, never in x/y directly,
 * so text stays upright in every orientation (nothing is rotated or mirrored).
 */
import { shown } from '../theory/naming.js'

export type Orientation = 'vertical' | 'horizontal'
export type Hand = 'left' | 'right'

/** Defaults used when a block doesn't say (Music Practice settings, a Publish site's options). */
export interface LayoutDefaults {
    /** Per block language; piano chords (`chord` blocks for piano) follow `keyboard`. */
    orientation?: Partial<Record<'chord' | 'keyboard' | 'fretboard', Orientation>>
    /** Left-handed guitar diagrams and fretboards. Keyboards ignore it. */
    hand?: Hand
}

export function parseOrientation(text: string): Orientation {
    const value = text.trim().toLowerCase()
    if (value === 'vertical' || value === 'horizontal') return value
    throw new Error(`Unknown orientation "${text}": use vertical or horizontal`)
}

export function parseHand(text: string): Hand {
    const value = text.trim().toLowerCase()
    if (value === 'left' || value === 'right') return value
    throw new Error(`Unknown hand "${text}": use left or right`)
}

/** Keeps only valid layout defaults from untrusted input (a page's `window.musicNotationOptions`). */
export function layoutDefaults(value: unknown): LayoutDefaults {
    const result: LayoutDefaults = {}
    if (!value || typeof value !== 'object') return result
    const word = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : undefined)
    try {
        const { orientation, hand } = value as Record<string, unknown>
        const h = word(hand)
        if (h === 'left' || h === 'right') result.hand = h
        if (orientation && typeof orientation === 'object') {
            for (const language of ['chord', 'keyboard', 'fretboard'] as const) {
                const o = word((orientation as Record<string, unknown>)[language])
                if (o === 'vertical' || o === 'horizontal')
                    (result.orientation ??= {})[language] = o
            }
        }
    } catch {
        // A page's object with a throwing getter: no defaults rather than no rendering.
    }
    return result
}

/** Width a title needs (14px semi-bold), so a narrow diagram doesn't clip it. Errs on the wide side. */
export function titleWidth(given?: string): number {
    if (!given) return 0
    // As the drawing shows it (#12): solfège names are longer.
    const title = shown(given)
    let width = 8
    for (const ch of title) {
        // Wide scripts (CJK, emoji), capitals and digits, then narrow letters and punctuation.
        width += ch.codePointAt(0)! > 0x24f ? 15 : /[A-Z0-9#♯♭]/.test(ch) ? 10.5 : 8
    }
    return Math.ceil(width)
}

/** Most lines a diagram's title takes (#74); a longer title squeezes its last line. */
export const MAX_TITLE_LINES = 3
/** Distance between two lines of a title. */
export const TITLE_LINE = 17

export interface TitleLine {
    text: string
    /** Set when the line is wider than the diagram even alone: squeeze it to this length. */
    textLength: number | null
}

/**
 * The width of a line of a title at 14px semibold, closer than `titleWidth` (spaces and punctuation
 * are narrow), with the same 8 of padding; for line breaks (#74).
 */
export function titleLineWidth(text: string): number {
    if (!text) return 0
    let width = 8
    for (const ch of text) {
        const code = ch.codePointAt(0)!
        width +=
            code > 0x24f
                ? 15
                : ch === ' ' || ".,:;'!|".includes(ch)
                  ? 4
                  : '()[]-/'.includes(ch) || 'iljfrt'.includes(ch)
                    ? 5
                    : 'mwMW'.includes(ch)
                      ? 12
                      : /[A-Z0-9#♯♭]/.test(ch)
                        ? 9.5
                        : 7.8
    }
    return Math.ceil(width)
}

/**
 * A title's lines on a diagram `width` units wide (#74): the title never widens the diagram. It
 * stays on one line when it fits (`titleLineWidth`); else it wraps into lines that fit, at most
 * `MAX_TITLE_LINES`, breaking first after a comma or before a parenthesis, then at spaces; a word
 * wider than the diagram, or the rest of a title that needs more lines, is squeezed (`textLength`,
 * the padding left out).
 */
export function titleLines(given: string, width: number): TitleLine[] {
    // The title as the drawing shows it (#12), wrapped by its shown width.
    const title = shown(given)
    const fits = (text: string) => titleLineWidth(text) <= width
    const squeeze = (text: string): TitleLine => ({
        text,
        textLength: fits(text) ? null : Math.max(1, width - 8)
    })
    if (fits(title)) return [{ text: title, textLength: null }]
    // Phrases: "F#m7b5," "Drop 3" "(strings 2-4, 6)"; a phrase too wide splits at its spaces.
    const phrases = title
        .split(/(?<=,)\s+|\s+(?=\()/)
        .flatMap((phrase) => (fits(phrase) ? [phrase] : phrase.split(/\s+/)))
        .filter(Boolean)
    const lines: string[] = []
    let line = ''
    for (const phrase of phrases) {
        const next = line ? `${line} ${phrase}` : phrase
        if (!line || fits(next)) line = next
        else {
            lines.push(line)
            line = phrase
        }
    }
    if (line) lines.push(line)
    if (lines.length > MAX_TITLE_LINES) {
        const kept = lines.slice(0, MAX_TITLE_LINES - 1)
        kept.push(lines.slice(MAX_TITLE_LINES - 1).join(' '))
        return kept.map(squeeze)
    }
    return lines.map(squeeze)
}

/**
 * Draws a diagram's title centered at `x`, its first baseline at `y` (#74): one `<text class=
 * "mn-title">`, a `<tspan>` per line when it wraps (lines after the first start with a space, so
 * the text reads as the title). Sets `data-mn-title-lines` on `root` for `alignTitleLines`.
 */
export function drawTitle(
    doc: Document,
    root: Element,
    lines: TitleLine[],
    x: number,
    y: number
): Element {
    const NS = 'http://www.w3.org/2000/svg'
    const text = doc.createElementNS(NS, 'text')
    text.setAttribute('class', 'mn-title')
    text.setAttribute('x', String(x))
    text.setAttribute('y', String(y))
    text.setAttribute('text-anchor', 'middle')
    const squeeze = (el: Element, line: TitleLine) => {
        if (line.textLength === null) return
        el.setAttribute('textLength', String(line.textLength))
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs')
    }
    if (lines.length === 1) {
        text.textContent = lines[0]!.text
        squeeze(text, lines[0]!)
    } else {
        lines.forEach((line, i) => {
            const span = doc.createElementNS(NS, 'tspan')
            span.setAttribute('x', String(x))
            if (i > 0) span.setAttribute('dy', String(TITLE_LINE))
            span.textContent = i > 0 ? ` ${line.text}` : line.text
            squeeze(span, line)
            text.appendChild(span)
        })
    }
    root.setAttribute('data-mn-title-lines', String(lines.length))
    root.appendChild(text)
    return text
}

/**
 * Gives every diagram of a set the room of the set's longest title (#74), so their necks line up
 * in a row: a diagram whose title takes fewer lines moves down by the missing lines (its content
 * in a `<g class="mn-title-pad">`, its viewBox and height grown). Diagrams without
 * `data-mn-title-lines` (no title) count as one line when another one has a title.
 */
export function alignTitleLines(diagrams: Iterable<Element>): void {
    const list = [...diagrams].filter((d) => d.hasAttribute('data-mn-title-lines'))
    const most = Math.max(0, ...list.map((d) => Number(d.getAttribute('data-mn-title-lines'))))
    for (const d of list) {
        const missing = most - Number(d.getAttribute('data-mn-title-lines'))
        if (missing <= 0) continue
        const shift = missing * TITLE_LINE
        const doc = d.ownerDocument
        const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.setAttribute('class', 'mn-title-pad')
        g.setAttribute('transform', `translate(0 ${shift})`)
        for (const child of [...d.children]) {
            if (child.tagName.toLowerCase() !== 'defs') g.appendChild(child)
        }
        d.appendChild(g)
        const [x, y, w, h] = (d.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number)
        d.setAttribute('viewBox', `${x} ${y} ${w} ${h! + shift}`)
        if (d.hasAttribute('height'))
            d.setAttribute('height', String(Number(d.getAttribute('height')) + shift))
        d.setAttribute('data-mn-title-lines', String(most))
    }
}

export interface NeckLayout {
    orientation: Orientation
    hand: Hand
    /** Distance from the low string to the high string. */
    across: number
    /** Length of the neck shown, from its start (the nut side) to its end. */
    along: number
    /** Margins: before the start of the neck, after its end, beyond the low and the high string. */
    before: number
    after: number
    low: number
    high: number
    /** Space above everything, for the title. */
    top: number
    /** The diagram is widened (and centered) to at least this width. */
    minWidth?: number
}

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export interface NeckFrame {
    width: number
    height: number
    /** x/y of the point `across` from the low string towards the high one, `along` from the neck's start. */
    at(across: number, along: number): [number, number]
    /** The rectangle between two opposite corners, given in neck coordinates. */
    box(across1: number, along1: number, across2: number, along2: number): Box
}

/**
 * Vertical: the nut on top, the low string on the left (on the right when left-handed), as chord
 * diagrams are drawn. Horizontal: the high string on top, as in tabs, the nut on the left (on the
 * right when left-handed).
 */
export function neckFrame(n: NeckLayout): NeckFrame {
    const vertical = n.orientation === 'vertical'
    const left = n.hand === 'left'
    const content = vertical ? n.low + n.across + n.high : n.before + n.along + n.after
    const shift = n.minWidth && n.minWidth > content ? (n.minWidth - content) / 2 : 0
    const height = n.top + (vertical ? n.before + n.along + n.after : n.high + n.across + n.low)
    const at = (across: number, along: number): [number, number] => {
        if (vertical) {
            const x = left ? n.high + (n.across - across) : n.low + across
            return [shift + x, n.top + n.before + along]
        }
        const x = left ? content - n.before - along : n.before + along
        return [shift + x, n.top + n.high + (n.across - across)]
    }
    const box = (a1: number, l1: number, a2: number, l2: number): Box => {
        const [x1, y1] = at(a1, l1)
        const [x2, y2] = at(a2, l2)
        return {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1)
        }
    }
    return { width: content + 2 * shift, height, at, box }
}
