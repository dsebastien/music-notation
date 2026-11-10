/**
 * Diagrams out of the page (#11): a standalone SVG of a drawing or of a whole block (its drawings,
 * titles and captions as the page lays them out), and a PNG drawn from it. Every style is inlined
 * from the computed style, so the image needs no stylesheet; HTML text becomes SVG text (never a
 * `<foreignObject>`: a canvas that draws one is tainted, and `toBlob` throws).
 */
import { accessibleName, SVG_NS } from '../render/dom.js'

/** The colors of the image: the page's, or the library's for a light or a dark theme. */
export type ExportTheme = 'inherit' | 'light' | 'dark'

export interface SvgExportOptions {
    /** `inherit` (default): the page's colors; `light` or `dark`: the library's for that theme. */
    theme?: ExportTheme
    /** A CSS color under everything; none by default (transparent). */
    background?: string
    /** Room around what is drawn, in CSS pixels; 8 by default. */
    padding?: number
}

export interface PngExportOptions extends Omit<SvgExportOptions, 'background'> {
    /** Pixels per CSS pixel, 2 by default (lowered so no side passes 16384 px). */
    scale?: number
    /** By default the page's background behind the element (white when it has none). */
    background?: string
}

/** A box in CSS pixels. */
export interface Box {
    x: number
    y: number
    width: number
    height: number
}

/** A line of text as the page lays it out. */
export interface TextLine {
    text: string
    box: Box
}

/** A computed style, read by property name. */
export interface StyleOf {
    get(name: string): string
}

/** What the composition reads from the page: the browser's layout, or a fake one in specs. */
export interface Measure {
    box(el: Element): Box
    /** The lines of a text node; `pre` keeps its spaces. */
    lines(text: Text, pre: boolean): TextLine[]
    style(el: Element): StyleOf
    /** The share of a line box above the baseline, for a CSS font shorthand. */
    ascent(font: string): number
}

/**
 * The variables the library's colors come from, with the values of Obsidian's default light and
 * dark themes (so `light` and `dark` look like a default vault). Set around a copy of the element,
 * they win over the page's.
 */
export const THEME_VARIABLES: Record<'light' | 'dark', Record<string, string>> = {
    light: {
        '--text-normal': '#222222',
        '--text-muted': '#5c5c5c',
        '--text-on-accent': '#ffffff',
        '--text-error': '#e93147',
        '--background-primary': '#ffffff',
        '--background-modifier-border': '#e0e0e0',
        '--interactive-accent': '#8a5cf5'
    },
    dark: {
        '--text-normal': '#dadada',
        '--text-muted': '#b3b3b3',
        '--text-on-accent': '#ffffff',
        '--text-error': '#fb464c',
        '--background-primary': '#1e1e1e',
        '--background-modifier-border': '#363636',
        '--interactive-accent': '#8a5cf5'
    }
}

/** The background of a PNG in a light or a dark theme. */
export const THEME_BACKGROUND = { light: '#ffffff', dark: '#1e1e1e' } as const

/** The page variables carried onto the copy with `inherit` (the copy sits elsewhere in the page). */
const HOST_VARIABLES = [
    ...Object.keys(THEME_VARIABLES.light),
    '--font-interface',
    '--font-monospace'
] as const

/** Never in an image: the bars, hidden names, tabs and scores (alphaTab draws them), controls. */
const LEFT_OUT = [
    '.mn-play',
    '.mn-playable-name',
    '.mn-tab',
    '.mn-tab-holder',
    '.mn-tab-surface',
    '.mn-exercise-tab',
    'script',
    'style',
    'button',
    'input',
    'select',
    'textarea',
    'template'
].join(', ')

/** Drawn only while something plays or is chosen: the image shows the drawing at rest. */
const TRANSIENT = ['mn-playing', 'mn-selected', 'mn-right', 'mn-wrong']

/** Inherited SVG properties: written where they differ from the parent's. */
const INHERITED = [
    'fill',
    'fill-opacity',
    'fill-rule',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'text-anchor',
    'dominant-baseline',
    'paint-order'
] as const

/** SVG's initial values: not written on a drawing's root, which inherits nothing in the image. */
const INITIAL: Partial<Record<(typeof INHERITED)[number], string>> = {
    'fill-opacity': '1',
    'fill-rule': 'nonzero',
    'stroke': 'none',
    'stroke-width': '1px',
    'stroke-opacity': '1',
    'stroke-dasharray': 'none',
    'stroke-dashoffset': '0px',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': '4',
    'font-style': 'normal',
    'letter-spacing': 'normal',
    'text-anchor': 'start',
    'dominant-baseline': 'auto',
    'paint-order': 'normal'
}

/** Shapes: left out when they draw nothing (hit areas). */
const SHAPES = new Set(['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline'])

const GENERIC_FAMILIES =
    /(^|,)\s*(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|math|emoji)\s*$/i

/** A font family list that ends with a generic family (an SVG image can't load web fonts). */
export function withGenericFamily(family: string, generic = 'sans-serif'): string {
    const list = family.trim()
    if (!list) return generic
    return GENERIC_FAMILIES.test(list) ? list : `${list}, ${generic}`
}

/** Whether a computed color paints anything. */
export function paints(color: string): boolean {
    const c = color.trim().toLowerCase()
    if (!c || c === 'none' || c === 'transparent') return false
    // rgba(r, g, b, 0), rgb(r g b / 0), color(srgb r g b / 0)
    if (/,\s*0(\.0+)?\s*\)$/.test(c) && c.startsWith('rgba')) return false
    if (/\/\s*0(\.0+)?%?\s*\)$/.test(c)) return false
    return true
}

const px = (value: string): number => {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
}

const round = (n: number): number => Math.round(n * 100) / 100

const isSvg = (el: Element): boolean => el.namespaceURI === SVG_NS
const tagOf = (el: Element): string => el.localName.toLowerCase()

/** An SVG's own size, from its attributes or its viewBox, for pages that lay nothing out. */
function ownSize(el: Element): { width: number; height: number } {
    const box = (el.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
    const width = px(el.getAttribute('width') ?? '') || (box.length === 4 ? box[2]! : 0)
    const height = px(el.getAttribute('height') ?? '') || (box.length === 4 ? box[3]! : 0)
    return { width, height }
}

/** The layout of the page the element is in. */
export function pageMeasure(doc: Document): Measure {
    const win = doc.defaultView
    const styles = new WeakMap<Element, CSSStyleDeclaration>()
    const ascents = new Map<string, number>()
    let context: CanvasRenderingContext2D | null | undefined
    const rect = (r: DOMRect | DOMRectReadOnly): Box => ({
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height
    })
    return {
        box: (el) => rect(el.getBoundingClientRect()),
        style(el) {
            let style = styles.get(el)
            if (!style && win) {
                style = win.getComputedStyle(el)
                styles.set(el, style)
            }
            return { get: (name) => style?.getPropertyValue(name) ?? '' }
        },
        lines(text, pre) {
            const range = doc.createRange()
            const lines: TextLine[] = []
            let line: { text: string; box: Box } | null = null
            let gap = ''
            const add = (start: number, end: number, token: string) => {
                range.setStart(text, start)
                range.setEnd(text, end)
                const r = range.getClientRects()[0]
                if (!r || (r.width === 0 && r.height === 0)) return
                const right = line ? line.box.x + line.box.width : 0
                if (line && Math.abs(r.top - line.box.y) < 2 && r.left >= right - 1) {
                    line.text += gap + token
                    line.box.width = r.right - line.box.x
                } else {
                    line = { text: token, box: rect(r) }
                    lines.push(line)
                }
                gap = ''
            }
            let offset = 0
            const segments = pre ? text.data.split('\n') : [text.data]
            segments.forEach((segment, i) => {
                if (i > 0) {
                    // A new line of a pre text, even when the page draws it at the same place.
                    line = null
                    gap = ''
                }
                for (const token of segment.split(/(\s+)/)) {
                    if (!token) continue
                    if (/^\s+$/.test(token)) {
                        if (pre) {
                            if (line) gap += token
                            else add(offset, offset + token.length, token)
                        } else if (line) gap = ' '
                    } else add(offset, offset + token.length, token)
                    offset += token.length
                }
                offset += 1
            })
            range.detach?.()
            return lines
        },
        ascent(font) {
            const known = ascents.get(font)
            if (known !== undefined) return known
            if (context === undefined) {
                try {
                    context = doc.createElement('canvas').getContext('2d')
                } catch {
                    context = null
                }
            }
            let share = 0.8
            if (context) {
                context.font = font
                const m = context.measureText('Hg')
                const up = m.fontBoundingBoxAscent
                const down = m.fontBoundingBoxDescent
                if (up > 0 && down >= 0 && Number.isFinite(up + down)) share = up / (up + down)
            }
            ascents.set(font, share)
            return share
        }
    }
}

/** The image being composed: elements placed in the root's box. */
interface Composition {
    doc: Document
    measure: Measure
    origin: Box
    out: SVGElement
    names: string[]
    left: number
    top: number
    right: number
    bottom: number
}

const place = (c: Composition, box: Box): Box => {
    const placed = {
        x: round(box.x - c.origin.x),
        y: round(box.y - c.origin.y),
        width: round(box.width),
        height: round(box.height)
    }
    c.left = Math.min(c.left, placed.x)
    c.top = Math.min(c.top, placed.y)
    c.right = Math.max(c.right, placed.x + placed.width)
    c.bottom = Math.max(c.bottom, placed.y + placed.height)
    return placed
}

const node = (doc: Document, tag: string, attrs: Record<string, string | number>): SVGElement => {
    const el = doc.createElementNS(SVG_NS, tag)
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value))
    return el
}

const hiddenBy = (style: StyleOf): boolean =>
    style.get('display') === 'none' ||
    style.get('visibility') === 'hidden' ||
    style.get('visibility') === 'collapse'

/** A copy of a drawing with its computed styles written on each element. */
function inlined(c: Composition, original: Element, parent: StyleOf | null): Element | null {
    const style = c.measure.style(original)
    if (hiddenBy(style) || (original as HTMLElement).hidden) return null
    const tag = tagOf(original)
    if (SHAPES.has(tag) && !paints(style.get('fill')) && !paints(style.get('stroke'))) return null
    const copy = c.doc.createElementNS(SVG_NS, original.localName)
    for (const attr of [...original.attributes]) {
        const name = attr.name
        if (
            name === 'class' ||
            name === 'style' ||
            name === 'id' ||
            name === 'role' ||
            name === 'tabindex' ||
            name === 'focusable' ||
            name.startsWith('data-') ||
            name.startsWith('aria-') ||
            name.startsWith('on')
        )
            continue
        if (attr.namespaceURI) copy.setAttributeNS(attr.namespaceURI, name, attr.value)
        else copy.setAttribute(name, attr.value)
    }
    const declarations: string[] = []
    for (const prop of INHERITED) {
        let value = style.get(prop)
        if (!value) continue
        if (prop === 'font-family') value = withGenericFamily(value)
        if (
            parent &&
            value ===
                (prop === 'font-family' ? withGenericFamily(parent.get(prop)) : parent.get(prop))
        )
            continue
        if (!parent && INITIAL[prop] === value) continue
        declarations.push(`${prop}:${value}`)
    }
    const opacity = style.get('opacity')
    if (opacity && opacity !== '1') declarations.push(`opacity:${opacity}`)
    if (declarations.length) copy.setAttribute('style', declarations.join(';'))
    for (const child of [...original.childNodes]) {
        if (child.nodeType === 3) copy.appendChild(c.doc.createTextNode(child.textContent ?? ''))
        else if (child.nodeType === 1) {
            const made = inlined(c, child as Element, style)
            if (made) copy.appendChild(made)
        }
    }
    return copy
}

/** A drawing placed at its box, with its own viewBox. */
function addDrawing(c: Composition, el: Element): void {
    const made = inlined(c, el, null)
    if (!made) return
    let box = c.measure.box(el)
    if (box.width === 0 || box.height === 0) {
        const own = ownSize(el)
        box = { x: c.origin.x, y: c.origin.y, width: own.width, height: own.height }
    }
    const at = place(c, box)
    made.setAttribute('x', String(at.x))
    made.setAttribute('y', String(at.y))
    made.setAttribute('width', String(at.width))
    made.setAttribute('height', String(at.height))
    c.out.appendChild(made)
    const name = accessibleName(el)
    if (name) c.names.push(name)
}

/** An HTML element's background and borders, as rectangles. */
function addBox(c: Composition, el: Element, style: StyleOf, opacity: number): void {
    const background = style.get('background-color')
    const sides = (['top', 'right', 'bottom', 'left'] as const).map((side) => ({
        side,
        width: px(style.get(`border-${side}-width`)),
        color: style.get(`border-${side}-color`),
        line: style.get(`border-${side}-style`)
    }))
    const borders = sides.filter(
        (s) => s.width > 0 && paints(s.color) && s.line !== 'none' && s.line !== 'hidden'
    )
    if (!paints(background) && !borders.length) return
    const box = c.measure.box(el)
    if (box.width === 0 || box.height === 0) return
    const at = place(c, box)
    const faded: Record<string, number> = opacity < 1 ? { opacity: round(opacity) } : {}
    if (paints(background)) {
        const radius = px(style.get('border-top-left-radius'))
        c.out.appendChild(
            node(c.doc, 'rect', {
                x: at.x,
                y: at.y,
                width: at.width,
                height: at.height,
                ...(radius ? { rx: round(radius) } : {}),
                fill: background,
                ...faded
            })
        )
    }
    for (const b of borders) {
        const strip =
            b.side === 'top'
                ? { x: at.x, y: at.y, width: at.width, height: b.width }
                : b.side === 'bottom'
                  ? { x: at.x, y: at.y + at.height - b.width, width: at.width, height: b.width }
                  : b.side === 'left'
                    ? { x: at.x, y: at.y, width: b.width, height: at.height }
                    : { x: at.x + at.width - b.width, y: at.y, width: b.width, height: at.height }
        c.out.appendChild(node(c.doc, 'rect', { ...strip, fill: b.color, ...faded }))
    }
}

/** The CSS font shorthand of a style, for measuring. */
const fontOf = (style: StyleOf): string =>
    [
        style.get('font-style') || 'normal',
        style.get('font-weight') || '400',
        style.get('font-size') || '16px',
        style.get('font-family') || 'sans-serif'
    ].join(' ')

/** A text node's lines as SVG text, where the page draws them. */
function addText(c: Composition, text: Text, style: StyleOf, opacity: number): void {
    const space = style.get('white-space') || 'normal'
    const pre = space.startsWith('pre') || space === 'break-spaces'
    if (!pre && !text.data.trim()) return
    const color = style.get('color')
    if (!paints(color)) return
    const share = c.measure.ascent(fontOf(style))
    const letterSpacing = style.get('letter-spacing')
    for (const line of c.measure.lines(text, pre)) {
        const content = pre ? line.text : line.text.trim()
        if (!content || line.box.width === 0) continue
        const at = place(c, line.box)
        const declarations = [
            `font-family:${withGenericFamily(style.get('font-family'))}`,
            `font-size:${style.get('font-size') || '16px'}`,
            `font-weight:${style.get('font-weight') || '400'}`,
            `font-style:${style.get('font-style') || 'normal'}`,
            ...(letterSpacing && letterSpacing !== 'normal'
                ? [`letter-spacing:${letterSpacing}`]
                : []),
            ...(pre ? ['white-space:pre'] : [])
        ]
        const el = node(c.doc, 'text', {
            x: at.x,
            y: round(at.y + at.height * share),
            fill: color,
            textLength: at.width,
            lengthAdjust: 'spacing',
            style: declarations.join(';'),
            ...(opacity < 1 ? { opacity: round(opacity) } : {})
        })
        if (pre) el.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
        el.textContent = content
        c.out.appendChild(el)
    }
}

/** Walks an HTML element: its boxes, its text, its drawings. */
function walk(c: Composition, el: Element, opacity: number): void {
    if (el.matches(LEFT_OUT) || (el as HTMLElement).hidden) return
    if (isSvg(el)) {
        if (tagOf(el) === 'svg') addDrawing(c, el)
        return
    }
    const style = c.measure.style(el)
    if (hiddenBy(style)) return
    const own = Number(style.get('opacity') || '1')
    const faded = opacity * (Number.isFinite(own) ? own : 1)
    addBox(c, el, style, faded)
    for (const child of [...el.childNodes]) {
        if (child.nodeType === 3) addText(c, child as Text, style, faded)
        else if (child.nodeType === 1) walk(c, child as Element, faded)
    }
}

/** The room around what is drawn, by default. */
export const PADDING = 8

/**
 * The composed image of `el` (a drawing, a block, any element holding drawings) as the page lays
 * it out, through `measure`, cropped to what it draws plus `padding`. Exported for specs and apps
 * with their own layout.
 */
export function composeSvg(
    el: Element,
    measure: Measure,
    background?: string,
    padding = PADDING
): { svg: SVGElement; width: number; height: number } {
    const doc = el.ownerDocument
    const content = node(doc, 'g', {})
    let origin = measure.box(el)
    if (isSvg(el) && (origin.width === 0 || origin.height === 0))
        origin = { x: origin.x, y: origin.y, ...ownSize(el) }
    const c: Composition = {
        doc,
        measure,
        origin,
        out: content,
        names: [],
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity
    }
    if (isSvg(el)) addDrawing(c, el)
    else walk(c, el, 1)
    // Nothing drawn: the element's box.
    if (c.left === Infinity) {
        c.left = 0
        c.top = 0
        c.right = origin.width
        c.bottom = origin.height
    }
    const pad = Number.isFinite(padding) && padding > 0 ? padding : 0
    const width = Math.max(1, Math.ceil(c.right - c.left + 2 * pad))
    const height = Math.max(1, Math.ceil(c.bottom - c.top + 2 * pad))
    const dx = round(pad - c.left)
    const dy = round(pad - c.top)
    if (dx || dy) content.setAttribute('transform', `translate(${dx} ${dy})`)
    const out = node(doc, 'svg', {
        xmlns: SVG_NS,
        width,
        height,
        viewBox: `0 0 ${width} ${height}`,
        role: 'img'
    })
    const title = node(doc, 'title', {})
    title.textContent = c.names.length ? c.names.join(', ') : 'Music notation'
    out.appendChild(title)
    if (background && paints(background))
        out.appendChild(node(doc, 'rect', { x: 0, y: 0, width, height, fill: background }))
    out.appendChild(content)
    return { svg: out, width, height }
}

/** Removes what only shows while something plays or is chosen. */
function atRest(copy: Element): void {
    for (const cls of TRANSIENT) {
        if (copy.classList.contains(cls)) copy.classList.remove(cls)
        for (const lit of [...copy.querySelectorAll(`.${cls}`)]) lit.classList.remove(cls)
    }
}

/**
 * Runs `make` on a copy of `el` placed out of sight in its document, at its width (so text wraps
 * as on the page), in the theme's colors; the copy is removed after.
 */
function staged<T>(
    el: Element,
    theme: ExportTheme,
    make: (copy: Element, measure: Measure) => T
): T {
    const doc = el.ownerDocument
    const win = doc.defaultView
    const measure = pageMeasure(doc)
    const width = el.getBoundingClientRect().width
    const stage = doc.createElement('div')
    stage.setAttribute('aria-hidden', 'true')
    stage.style.position = 'absolute'
    stage.style.left = '-100000px'
    stage.style.top = '0'
    stage.style.pointerEvents = 'none'
    if (width > 0) stage.style.width = `${width}px`
    const from = el.parentElement
    if (theme === 'inherit') {
        if (from && win) {
            const page = win.getComputedStyle(from)
            for (const name of HOST_VARIABLES) {
                const value = page.getPropertyValue(name)
                if (value) stage.style.setProperty(name, value.trim())
            }
            for (const prop of ['color', 'font-family', 'font-size', 'line-height'])
                stage.style.setProperty(prop, page.getPropertyValue(prop))
        }
    } else {
        for (const [name, value] of Object.entries(THEME_VARIABLES[theme]))
            stage.style.setProperty(name, value)
        stage.style.color = THEME_VARIABLES[theme]['--text-normal']!
        stage.style.colorScheme = theme
        if (from && win) {
            const page = win.getComputedStyle(from)
            for (const prop of ['font-family', 'font-size', 'line-height'])
                stage.style.setProperty(prop, page.getPropertyValue(prop))
        }
    }
    const copy = el.cloneNode(true) as Element
    atRest(copy)
    if (width > 0 && !isSvg(copy)) {
        ;(copy as HTMLElement).style.boxSizing = 'border-box'
        ;(copy as HTMLElement).style.width = `${width}px`
        // Its margins would move it inside the stage: the image is its box.
        ;(copy as HTMLElement).style.margin = '0'
    }
    stage.appendChild(copy)
    ;(doc.body ?? doc.documentElement).appendChild(stage)
    try {
        return make(copy, measure)
    } finally {
        stage.remove()
    }
}

const serialize = (el: Element): string => {
    const Serializer = el.ownerDocument.defaultView?.XMLSerializer
    return Serializer ? new Serializer().serializeToString(el) : el.outerHTML
}

/**
 * A standalone SVG of `el`: a drawing (`svg.mn-svg`) or any element holding drawings and text (a
 * block, a row, a captioned figure, a chart), laid out as on the page, every style inlined.
 */
export function toSvgString(el: Element, options: SvgExportOptions = {}): string {
    return staged(el, options.theme ?? 'inherit', (copy, measure) =>
        serialize(composeSvg(copy, measure, options.background, options.padding).svg)
    )
}

/** The page's background behind `el`: its own or an ancestor's, else white. */
export function backgroundOf(el: Element, theme: ExportTheme = 'inherit'): string {
    if (theme !== 'inherit') return THEME_BACKGROUND[theme]
    const win = el.ownerDocument.defaultView
    for (let at: Element | null = el; at && win; at = at.parentElement) {
        const color = win.getComputedStyle(at).getPropertyValue('background-color')
        if (paints(color)) return color
    }
    return '#ffffff'
}

/** The largest side a canvas takes in every browser. */
export const MAX_SIDE = 16384

/** `scale`, lowered so neither side of the image passes `MAX_SIDE` pixels. */
export function fitScale(width: number, height: number, scale = 2): number {
    const wanted = Number.isFinite(scale) && scale > 0 ? scale : 2
    const side = Math.max(width, height, 1)
    return Math.min(wanted, MAX_SIDE / side)
}

/** A PNG of `el` (see `toSvgString`), at `scale` (2 by default), on the page's background. */
export async function toPng(el: Element, options: PngExportOptions = {}): Promise<Blob> {
    const doc = el.ownerDocument
    const win = doc.defaultView
    if (!win) throw new Error('The element is not in a window')
    const theme = options.theme ?? 'inherit'
    const background = options.background ?? backgroundOf(el, theme)
    const { text, width, height } = staged(el, theme, (copy, measure) => {
        const made = composeSvg(copy, measure, background, options.padding)
        return { text: serialize(made.svg), width: made.width, height: made.height }
    })
    const scale = fitScale(width, height, options.scale)
    const image = new win.Image()
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('The image could not be drawn'))
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
    })
    const canvas = doc.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No canvas to draw the image on')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be made'))),
            'image/png'
        )
    )
}
