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

/** A root <svg> sized by its viewBox, scaling with the container up to its natural width. */
export function svgRoot(
    doc: Document,
    width: number,
    height: number,
    cls: string,
    label: string
): SVGElement {
    return svg(doc, 'svg', {
        'xmlns': SVG_NS,
        'viewBox': `0 0 ${width} ${height}`,
        'width': width,
        'class': `mn-svg ${cls}`,
        'role': 'img',
        'aria-label': label
    })
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
