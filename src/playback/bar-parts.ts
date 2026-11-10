/**
 * The parts every play bar shares (#58): the bar itself (below its drawing, always shown), icons
 * drawn like each other, toggle buttons, sliders that show their value ("90 BPM", not a glyph),
 * selects, and the app's volume (a setting, never on the bar).
 */
import { html, svg } from '../render/dom.js'

/** Small icons, drawn on a 16 × 16 grid so they look the same in every font. */
export const ICONS = {
    play: 'M4 2.5v11l9-5.5z',
    pause: 'M4 3h3v10H4zM9 3h3v10H9z',
    stop: 'M4 4h8v8H4z',
    /** Two triangles: every diagram of the block, one after the other. */
    all: 'M1.5 2.5v11l6.5-5.5zM8 2.5v11l6.5-5.5z',
    loop: 'M3 8a5 5 0 0 1 8.5-3.5L13 6V2.5M13 8a5 5 0 0 1-8.5 3.5L3 10v3.5',
    /** A metronome, for the count-in. */
    count: 'M5.5 14h5L9 2.5H7zM8 11.5l4.5-7',
    /** Beats, for the click. */
    click: 'M3 5v6M8 5v6M13 5v6',
    /** A picture: Copy as image (#11). */
    copy: 'M2.5 3.5h11v9h-11zM2.5 11l3.5-3.5 3 3 2-2 2.5 2.5M10.5 6.5h.01'
} as const

export type IconName = keyof typeof ICONS

/** Icons drawn as lines; the others are filled shapes. */
const STROKED = new Set<IconName>(['loop', 'count', 'click', 'copy'])

export function icon(doc: Document, name: IconName): SVGElement {
    const root = svg(doc, 'svg', {
        'class': `mn-play-icon mn-play-icon-${name}${STROKED.has(name) ? ' mn-play-icon-line' : ''}`,
        'viewBox': '0 0 16 16',
        'width': 12,
        'height': 12,
        'aria-hidden': 'true'
    })
    root.appendChild(svg(doc, 'path', { d: ICONS[name] }))
    return root
}

/**
 * A play bar: a group named `label`, always shown, below what it plays. A press in it is the
 * bar's: an editor (Obsidian's live preview) must not take it as a click on the block, which
 * opens its source.
 */
export function playBar(doc: Document, cls: string, label: string): HTMLElement {
    const bar = html(doc, 'div', `mn-play mn-play-static ${cls}`)
    bar.addEventListener('mousedown', (event) => event.stopPropagation())
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', label)
    return bar
}

/**
 * Where the bar goes: below the element of the block that holds its diagrams (a row, a figure
 * with its caption), inside the block (never between a page's source `<pre>` and the block); in
 * a fretboard exercise, between the fretboard and its tab.
 */
export function placeBar(block: Element, last: Element, bar: HTMLElement): void {
    if (last.parentElement?.classList.contains('mn-exercise-block')) {
        last.after(bar)
        return
    }
    let node: Element = last
    while (node.parentElement && node.parentElement !== block) node = node.parentElement
    if (node.parentElement === block) node.after(bar)
    else block.appendChild(bar)
}

/** A button that shows an icon, named for screen readers and in its tooltip. */
export function iconButton(
    doc: Document,
    cls: string,
    label: string,
    name: IconName
): HTMLButtonElement {
    const button = html(doc, 'button', cls)
    button.type = 'button'
    button.appendChild(icon(doc, name))
    button.title = label
    button.setAttribute('aria-label', label)
    return button
}

/** A button that stays pressed (loop, count-in, click); `set` hears each change. */
export function pressedButton(
    doc: Document,
    cls: string,
    label: string,
    name: IconName,
    on: boolean,
    set: (on: boolean) => void
): HTMLButtonElement {
    const button = iconButton(doc, cls, label, name)
    const show = () => {
        button.setAttribute('aria-pressed', String(on))
        button.classList.toggle('mn-on', on)
    }
    button.addEventListener('click', () => {
        on = !on
        set(on)
        show()
    })
    show()
    return button
}

export interface Slider {
    field: HTMLElement
    input: HTMLInputElement
    /** Shows a value set from outside (the strum of the other sound). */
    show(n: number): void
}

/**
 * A slider with its value written after it ("90 BPM", "12 ms"): the readable label every bar
 * shows instead of the glyphs it had (#58). The value is also the slider's `aria-valuetext`; a
 * `hint` (a 6/8 tempo counts dotted quarters) goes to its tooltip and `aria-description`.
 */
export function valueSlider(
    doc: Document,
    label: string,
    unit: string,
    min: number,
    max: number,
    value: number,
    set: (n: number) => void,
    hint?: string
): Slider {
    const field = html(doc, 'label', 'mn-play-field')
    const input = html(doc, 'input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.setAttribute('aria-label', label)
    if (hint) input.setAttribute('aria-description', hint)
    const text = html(doc, 'span', 'mn-play-value')
    text.setAttribute('aria-hidden', 'true')
    const show = (n: number) => {
        input.value = String(n)
        const written = `${n} ${unit}`
        text.textContent = written
        input.setAttribute('aria-valuetext', written)
        field.title = `${label}: ${written}${hint ? ` (${hint})` : ''}`
    }
    input.addEventListener('input', () => {
        const n = Number(input.value)
        set(n)
        show(n)
    })
    show(value)
    field.append(input, text)
    return { field, input, show }
}

/** A select named `label`, with an option per value. */
export function choice<T extends string>(
    doc: Document,
    cls: string,
    label: string,
    values: readonly T[],
    chosen: T,
    names: Record<T, string>,
    set: (value: T) => void
): HTMLSelectElement {
    const el = html(doc, 'select', cls)
    el.setAttribute('aria-label', label)
    el.title = label
    for (const value of values) {
        const option = html(doc, 'option', undefined, names[value])
        option.value = value
        option.selected = value === chosen
        el.appendChild(option)
    }
    el.addEventListener('change', () => set(el.value as T))
    return el
}

/** The volume when the app doesn't give one. */
export const DEFAULT_VOLUME = 0.8

/**
 * The app's volume, 0 to 1: a number, or a function read at each play so a setting changed in
 * the app applies at once (#58: the volume left the bars). Out of range is clamped; anything else
 * (a function that throws, NaN) is the default.
 */
export function volumeOf(volume: number | (() => number) | undefined): number {
    let value: unknown = volume
    if (typeof volume === 'function') {
        try {
            value = volume()
        } catch {
            value = undefined
        }
    }
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : DEFAULT_VOLUME
}
