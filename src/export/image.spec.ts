/**
 * Export as SVG and PNG (#11): a standalone SVG with every style inlined, laid out as the page
 * lays it out (a fake measure here), the bars and hidden parts left out, HTML text as SVG text.
 */
import { describe, expect, it } from 'bun:test'
import {
    composeSvg,
    fitScale,
    MAX_SIDE,
    paints,
    THEME_VARIABLES,
    toSvgString,
    withGenericFamily,
    type Box,
    type Measure,
    type TextLine
} from './image.js'
import { renderBlock } from '../render/render-block.js'

const NS = 'http://www.w3.org/2000/svg'

/** A layout given by hand: boxes, styles and text lines per node. */
function fakeMeasure(given: {
    boxes?: Map<Element, Box>
    styles?: Map<Element, Record<string, string>>
    lines?: Map<Text, TextLine[]>
    ascent?: number
}): Measure {
    const zero = { x: 0, y: 0, width: 0, height: 0 }
    return {
        box: (el) => given.boxes?.get(el) ?? zero,
        style: (el) => ({ get: (name) => given.styles?.get(el)?.[name] ?? '' }),
        lines: (text) => given.lines?.get(text) ?? [],
        ascent: () => given.ascent ?? 0.8
    }
}

const svgEl = (tag: string, attrs: Record<string, string> = {}) => {
    const el = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    return el
}
const htmlEl = (tag: string, cls = '', text?: string) => {
    const el = document.createElement(tag)
    if (cls) el.className = cls
    if (text !== undefined) el.textContent = text
    return el
}
const serialize = (el: Element) => new XMLSerializer().serializeToString(el)

/** A small drawing: a dot, a hit area that draws nothing, a hidden group and a label. */
function drawing() {
    const root = svgEl('svg', {
        'class': 'mn-svg mn-guitar-chord',
        'viewBox': '0 0 100 120',
        'role': 'img',
        'data-mn-pitches': '45 52',
        'aria-labelledby': 'x1',
        'tabindex': '0'
    })
    const dot = svgEl('circle', { class: 'mn-dot mn-root', cx: '10', cy: '10', r: '6' })
    const hit = svgEl('rect', { class: 'mn-hit', x: '0', y: '0', width: '20', height: '20' })
    const hidden = svgEl('g', { class: 'mn-pick' })
    hidden.appendChild(svgEl('circle', { cx: '1', cy: '1', r: '1' }))
    const label = svgEl('text', { class: 'mn-dot-text', x: '10', y: '14' })
    label.textContent = '1'
    root.append(dot, hit, hidden, label)
    const styles = new Map<Element, Record<string, string>>([
        [root, { 'fill': 'rgb(34, 34, 34)', 'font-family': 'Inter', 'font-size': '11px' }],
        [dot, { 'fill': 'rgb(194, 65, 12)', 'font-family': 'Inter', 'font-size': '11px' }],
        [hit, { fill: 'none', stroke: 'none' }],
        [hidden, { display: 'none' }],
        [label, { 'fill': 'rgb(255, 255, 255)', 'font-family': 'Inter', 'font-size': '11px' }]
    ])
    return { root, dot, hit, label, styles }
}

describe('a drawing as a standalone SVG (#11)', () => {
    it('inlines the computed styles and leaves out classes, data and hit areas', () => {
        const { root, styles } = drawing()
        const boxes = new Map([[root, { x: 30, y: 40, width: 100, height: 120 }]])
        const { svg, width, height } = composeSvg(
            root,
            fakeMeasure({ boxes, styles }),
            undefined,
            0
        )
        const text = serialize(svg)
        expect([width, height]).toEqual([100, 120])
        expect(svg.getAttribute('viewBox')).toBe('0 0 100 120')
        expect(text).toContain('xmlns="http://www.w3.org/2000/svg"')
        expect(text).not.toContain('class=')
        expect(text).not.toContain('data-')
        expect(text).not.toContain('tabindex')
        expect(text).not.toContain('var(')
        // The dot's root color is written; the hit area and the hidden group are gone.
        expect(text).toContain('fill:rgb(194, 65, 12)')
        expect(svg.querySelectorAll('rect').length).toBe(0)
        expect(svg.querySelectorAll('circle').length).toBe(1)
        // The drawing is placed at the image's origin, at its size on the page.
        const nested = svg.querySelector('svg')!
        expect(nested.getAttribute('x')).toBe('0')
        expect(nested.getAttribute('width')).toBe('100')
        expect(nested.getAttribute('viewBox')).toBe('0 0 100 120')
    })

    it('writes an inherited property only where it changes', () => {
        const { root, styles } = drawing()
        const { svg } = composeSvg(root, fakeMeasure({ styles }))
        const circle = svg.querySelector('circle')!
        // Same font as the drawing: not written again.
        expect(circle.getAttribute('style')).toBe('fill:rgb(194, 65, 12)')
        // A family list without a generic family gets one (an SVG image can't load web fonts).
        expect(svg.querySelector('svg')!.getAttribute('style')).toContain(
            'font-family:Inter, sans-serif'
        )
    })

    it('takes its size from its viewBox when the page lays nothing out', () => {
        const { root, styles } = drawing()
        const { width, height } = composeSvg(root, fakeMeasure({ styles }), undefined, 0)
        expect([width, height]).toEqual([100, 120])
    })

    it('is named after the drawing, with a background only when asked', () => {
        const { root, styles } = drawing()
        const name = svgEl('title', { id: 'x1' })
        name.textContent = 'A chord diagram'
        const defs = svgEl('defs')
        defs.appendChild(name)
        root.prepend(defs)
        document.body.appendChild(root)
        const plain = composeSvg(root, fakeMeasure({ styles })).svg
        expect(plain.querySelector(':scope > title')!.textContent).toBe('A chord diagram')
        expect(plain.querySelector(':scope > rect')).toBeNull()
        const dark = composeSvg(root, fakeMeasure({ styles }), '#1e1e1e').svg
        expect(dark.querySelector(':scope > rect')!.getAttribute('fill')).toBe('#1e1e1e')
        root.remove()
    })
})

describe('a block as one image (#11)', () => {
    /** A captioned chord and the bar below it. */
    function block() {
        const el = htmlEl('div', 'mn-block')
        const figure = htmlEl('figure', 'mn-captioned')
        const wrap = htmlEl('div', 'mn-playable')
        const name = htmlEl('span', 'mn-playable-name', 'Play A chord diagram')
        name.hidden = true
        const { root, styles } = drawing()
        wrap.append(name, root)
        const caption = htmlEl('figcaption', 'mn-fingering', 'Index on the D string, 2nd fret')
        figure.append(wrap, caption)
        const bar = htmlEl('div', 'mn-play mn-block-bar')
        bar.appendChild(htmlEl('button', 'mn-play-toggle', 'Play'))
        bar.appendChild(htmlEl('span', 'mn-play-name', 'Bar text'))
        el.append(figure, bar)
        const textNode = caption.firstChild as Text
        const boxes = new Map<Element, Box>([
            [el, { x: 10, y: 20, width: 200, height: 170 }],
            [root, { x: 10, y: 20, width: 100, height: 120 }],
            [bar, { x: 10, y: 160, width: 200, height: 30 }]
        ])
        styles.set(caption, {
            'color': 'rgb(34, 34, 34)',
            'font-family': 'Inter',
            'font-size': '14px',
            'font-weight': '400',
            'font-style': 'normal'
        })
        const lines = new Map<Text, TextLine[]>([
            [
                textNode,
                [
                    {
                        text: 'Index on the D string,',
                        box: { x: 10, y: 142, width: 150, height: 15 }
                    },
                    { text: '2nd fret', box: { x: 10, y: 157, width: 60, height: 15 } }
                ]
            ]
        ])
        return { el, measure: fakeMeasure({ boxes, styles, lines }) }
    }

    it('places the drawing and writes the caption line by line, where the page wraps it', () => {
        const { el, measure } = block()
        const { svg, width, height } = composeSvg(el, measure, undefined, 0)
        // Cropped to what it draws: the drawing and the caption's widest line (the bar is left out).
        expect([width, height]).toEqual([150, 152])
        const texts = [...svg.querySelectorAll('g > text')]
        expect(texts.map((t) => t.textContent)).toEqual(['Index on the D string,', '2nd fret'])
        expect(texts[0]!.getAttribute('x')).toBe('0')
        // The baseline: the line's top plus its ascent (0.8 of 15 px).
        expect(texts[0]!.getAttribute('y')).toBe('134')
        expect(texts[0]!.getAttribute('textLength')).toBe('150')
        expect(texts[0]!.getAttribute('fill')).toBe('rgb(34, 34, 34)')
        expect(texts[0]!.getAttribute('style')).toContain('font-size:14px')
    })

    it('leaves out the bar and the hidden name of a playable diagram', () => {
        const { el, measure } = block()
        const text = serialize(composeSvg(el, measure).svg)
        expect(text).not.toContain('Bar text')
        expect(text).not.toContain('Play A chord diagram')
        expect(text).not.toContain('foreignObject')
    })

    it('draws HTML backgrounds and borders as rectangles', () => {
        const el = htmlEl('div', 'mn-block')
        const pill = htmlEl('span', 'mn-chord')
        el.appendChild(pill)
        const boxes = new Map<Element, Box>([
            [el, { x: 0, y: 0, width: 100, height: 40 }],
            [pill, { x: 10, y: 5, width: 30, height: 20 }]
        ])
        const styles = new Map<Element, Record<string, string>>([
            [
                pill,
                {
                    'background-color': 'rgb(124, 58, 237)',
                    'border-top-left-radius': '4px',
                    'border-bottom-width': '2px',
                    'border-bottom-style': 'solid',
                    'border-bottom-color': 'rgb(0, 0, 0)'
                }
            ]
        ])
        const { svg } = composeSvg(el, fakeMeasure({ boxes, styles }), undefined, 0)
        const rects = [...svg.querySelectorAll('g > rect')]
        expect(rects.length).toBe(2)
        expect(rects[0]!.getAttribute('fill')).toBe('rgb(124, 58, 237)')
        expect(rects[0]!.getAttribute('rx')).toBe('4')
        // Cropped to the pill: its bottom border 18 px below its top.
        expect(rects[1]!.getAttribute('y')).toBe('23')
        expect(svg.querySelector('g')!.getAttribute('transform')).toBe('translate(-10 -5)')
        expect(rects[1]!.getAttribute('height')).toBe('2')
    })

    it('keeps room around what it draws (8 px by default)', () => {
        const { root, styles } = drawing()
        const { svg, width, height } = composeSvg(root, fakeMeasure({ styles }))
        expect([width, height]).toEqual([116, 136])
        expect(svg.querySelector('g')!.getAttribute('transform')).toBe('translate(8 8)')
    })

    it('keeps the spaces of pre text', () => {
        const el = htmlEl('pre', 'mn-tab-section', 'e|--0--|')
        const textNode = el.firstChild as Text
        const styles = new Map([[el, { 'color': 'rgb(0, 0, 0)', 'white-space': 'pre' }]])
        const lines = new Map([
            [textNode, [{ text: 'e|--0--|', box: { x: 0, y: 0, width: 64, height: 16 } }]]
        ])
        const { svg } = composeSvg(el, fakeMeasure({ styles, lines }))
        const text = svg.querySelector('text')!
        expect(text.getAttribute('style')).toContain('white-space:pre')
        expect(serialize(svg)).toContain('xml:space="preserve"')
    })

    it('is cropped to what it draws, also past the block (a row wider than the page scrolls)', () => {
        const el = htmlEl('div', 'mn-block')
        const { root, styles } = drawing()
        el.appendChild(root)
        const boxes = new Map<Element, Box>([
            [el, { x: 0, y: 0, width: 100, height: 120 }],
            [root, { x: 60, y: 0, width: 100, height: 120 }]
        ])
        const { width } = composeSvg(el, fakeMeasure({ boxes, styles }), undefined, 0)
        expect(width).toBe(100)
    })
})

describe('export helpers (#11)', () => {
    it('tells colors that paint from those that do not', () => {
        expect(paints('rgb(0, 0, 0)')).toBe(true)
        expect(paints('rgba(0, 0, 0, 0.5)')).toBe(true)
        expect(paints('rgba(0, 0, 0, 0)')).toBe(false)
        expect(paints('rgb(0 0 0 / 0)')).toBe(false)
        expect(paints('transparent')).toBe(false)
        expect(paints('none')).toBe(false)
        expect(paints('')).toBe(false)
    })

    it('adds a generic family only when the list has none', () => {
        expect(withGenericFamily('Inter')).toBe('Inter, sans-serif')
        expect(withGenericFamily('"Inter", system-ui')).toBe('"Inter", system-ui')
        expect(withGenericFamily('Menlo, monospace')).toBe('Menlo, monospace')
        expect(withGenericFamily('')).toBe('sans-serif')
    })

    it('lowers the scale so no side passes the canvas limit', () => {
        expect(fitScale(300, 200)).toBe(2)
        expect(fitScale(300, 200, 3)).toBe(3)
        expect(fitScale(10000, 200, 2)).toBe(MAX_SIDE / 10000)
        expect(fitScale(300, 200, Number.NaN)).toBe(2)
    })

    it('has the colors of both themes for every variable the styles read', () => {
        expect(Object.keys(THEME_VARIABLES.light)).toEqual(Object.keys(THEME_VARIABLES.dark))
        expect(THEME_VARIABLES.dark['--background-primary']).toBe('#1e1e1e')
    })
})

describe('toSvgString on a rendered block (#11)', () => {
    it('works on a copy and leaves the page as it was', () => {
        const host = document.body.appendChild(document.createElement('div'))
        const { el } = renderBlock('chord', 'A x02220\ncaption: fingering', host, { play: {} })
        const before = document.body.innerHTML
        for (const theme of ['inherit', 'light', 'dark'] as const) {
            const text = toSvgString(el, { theme })
            expect(text.startsWith('<svg')).toBe(true)
            expect(text).not.toContain('foreignObject')
            expect(text).not.toContain('mn-play')
        }
        expect(document.body.innerHTML).toBe(before)
        host.remove()
    })

    it('draws a lit note at rest', () => {
        const host = document.body.appendChild(document.createElement('div'))
        const { el } = renderBlock('chord', 'A x02220', host, {})
        const svg = el.querySelector('svg')!
        svg.querySelector('[data-midi]')!.classList.add('mn-playing')
        // The page keeps its lit note; the copy had it removed (no class is written anyway).
        toSvgString(svg)
        expect(svg.querySelector('.mn-playing')).not.toBeNull()
        host.remove()
    })
})
