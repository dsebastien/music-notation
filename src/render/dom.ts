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
