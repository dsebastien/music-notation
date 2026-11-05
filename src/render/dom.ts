/** DOM and SVG helpers. Everything is created in the host's document (popout windows, Publish). */

export const SVG_NS = 'http://www.w3.org/2000/svg'

type Attributes = Record<string, string | number | undefined>

const apply = (el: Element, attrs: Attributes) => {
    for (const [name, value] of Object.entries(attrs)) {
        if (value !== undefined) el.setAttribute(name, String(value))
    }
}

/** An SVG element with attributes and children. */
export function svg(
    doc: Document,
    tag: string,
    attrs: Attributes = {},
    children: (Element | null)[] = []
): SVGElement {
    const el = doc.createElementNS(SVG_NS, tag)
    apply(el, attrs)
    for (const child of children) if (child) el.appendChild(child)
    return el
}

/** An SVG <text>. */
export function svgText(doc: Document, text: string, attrs: Attributes = {}): SVGElement {
    const el = svg(doc, 'text', attrs)
    el.textContent = text
    return el
}

/** A <text> vertically centered on (x, y), for the 10–11px labels of diagrams. */
export function svgLabel(
    doc: Document,
    text: string,
    [x, y]: [number, number],
    cls: string,
    anchor: 'start' | 'middle' | 'end' = 'middle'
): SVGElement {
    return svgText(doc, text, { 'class': cls, x, 'y': y + 4, 'text-anchor': anchor })
}

/**
 * The text in a note dot of radius `r`: a label of three characters or more (bb7, #11, b13) is
 * smaller and squeezed to the dot's inner width, so it never passes the dot's edge (#73).
 */
export function dotLabel(
    doc: Document,
    text: string,
    point: [number, number],
    r: number
): SVGElement {
    const label = svgLabel(doc, text, point, 'mn-dot-text')
    if ([...text].length >= 3) {
        label.classList.add('mn-dot-text-long')
        label.setAttribute('textLength', String(2 * r - 2))
        label.setAttribute('lengthAdjust', 'spacingAndGlyphs')
    }
    return label
}

/** A <line> between two points. */
export function svgLine(
    doc: Document,
    [x1, y1]: [number, number],
    [x2, y2]: [number, number],
    cls: string
): SVGElement {
    return svg(doc, 'line', { class: cls, x1, y1, x2, y2 })
}

/** An HTML element with a class and optional text. */
export function html<K extends keyof HTMLElementTagNameMap>(
    doc: Document,
    tag: K,
    cls?: string,
    text?: string
): HTMLElementTagNameMap[K] {
    const el = doc.createElement(tag)
    if (cls) el.className = cls
    if (text !== undefined) el.textContent = text
    return el
}

// Ids of diagram names: a counter, behind a prefix drawn once per copy of the library, so two
// copies on one page (two plugins bundling it) never hand out the same id.
const NAME_PREFIX = `mn-name-${Math.random().toString(36).slice(2, 8)}-`
let names = 0

/** An id unique on the page (a counter behind this copy's random prefix). */
export const uniqueId = (): string => `${NAME_PREFIX}${++names}`

/**
 * A root <svg> sized by its viewBox, scaling with the container up to its natural width.
 *
 * Its name for screen readers (`label`) is a `<title>` inside `<defs>`, pointed at by
 * `aria-labelledby` (role="img"). Never `aria-label` on SVG: Obsidian shows a tooltip for every
 * element with one and calls HTMLElement-only methods on it, which throw on SVG elements. The
 * title sits in `<defs>` (never drawn, never the parent of what the pointer is over) so browsers
 * show no hover tooltip for it: the diagram's visible title already says what it is.
 */
export function svgRoot(
    doc: Document,
    width: number,
    height: number,
    cls: string,
    label: string
): SVGElement {
    const id = `${NAME_PREFIX}${++names}`
    const title = svg(doc, 'title', { class: 'mn-name', id })
    title.textContent = label
    return svg(
        doc,
        'svg',
        {
            'xmlns': SVG_NS,
            'viewBox': `0 0 ${width} ${height}`,
            'width': width,
            'class': `mn-svg ${cls}`,
            'role': 'img',
            'aria-labelledby': id
        },
        [svg(doc, 'defs', {}, [title])]
    )
}

// The element holding a diagram's name: looked up inside the diagram, so it works before the
// diagram is on the page.
const nameElement = (el: Element): Element | null => {
    const id = el.getAttribute('aria-labelledby')
    if (!id) return null
    for (const candidate of el.querySelectorAll('[id]')) {
        if (candidate.getAttribute('id') === id) return candidate
    }
    return el.ownerDocument.getElementById(id)
}

/** A diagram's name for screen readers (its `aria-labelledby` text, else its `aria-label`). */
export function accessibleName(el: Element): string | null {
    const named = nameElement(el)
    if (named) return named.textContent
    return el.getAttribute('aria-label')
}

/** Renames a diagram made by `svgRoot` (or any element named with `aria-label`). */
export function setAccessibleName(el: Element, name: string): void {
    const named = nameElement(el)
    if (named) named.textContent = name
    else el.setAttribute('aria-label', name)
}

/**
 * A playable mark (a dot, an open-string circle) with its invisible hit area under it (#69), in one
 * `.mn-mark` group: a click anywhere in the area plays the mark (the click handler looks up the
 * group's `data-midi` element). The area is centered on the mark; renderers size it to the mark's
 * own cell (its string's lane, its fret) so neighbors never share one.
 */
export function playableMark(
    doc: Document,
    area: { x: number; y: number; width: number; height: number },
    ...children: Element[]
): SVGElement {
    const hit = svg(doc, 'rect', {
        'class': 'mn-hit',
        'x': area.x,
        'y': area.y,
        'width': area.width,
        'height': area.height,
        // Painted (so it takes clicks) but invisible, even without the stylesheet.
        'fill': 'transparent',
        'pointer-events': 'all'
    })
    return svg(doc, 'g', { class: 'mn-mark' }, [hit, ...children])
}
