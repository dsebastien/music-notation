/**
 * The pick layer (Music Practice #73): every string × fret of a fretboard and every key of a
 * keyboard as a target that a click or the keyboard picks, and marks for right and wrong picks.
 * Renderers draw it with the `pick` option (`pickTarget`); `attachPick` makes it live.
 */
import { svg, uniqueId } from './dom.js'
import { playerFor, type PlayOptions } from '../playback/controls.js'
import { volumeOf } from '../playback/bar-parts.js'
import type { PlayHandle, Sound } from '../playback/player.js'

/** A target as the app sees it: where it is and what it sounds. */
export interface Pick {
    /** 1 is the highest string, as on the dots; null on keyboards. */
    string: number | null
    fret: number | null
    /** The pitch class as the drawing spells it ("C", "Bb"). */
    note: string
    /** MIDI. */
    pitch: number
    /** The target (`rect.mn-pick`). */
    element: SVGElement
    /** A click, or Space or Enter on the focused target. */
    via: 'pointer' | 'keyboard'
}

/**
 * A target by its place on a fretboard, or every target of a pitch. A pick may be passed as it is:
 * its place wins (its own target), and on keyboards its pitch is its key.
 */
export type PickAt =
    | { string: number; fret: number }
    | { pitch: number; string?: number | null; fret?: number | null }

export type PickResult = 'right' | 'wrong'

export interface PickOptions {
    /** Called with each pick and the layer (to mark it). A handler that throws is ignored. */
    onPick?: (pick: Pick, layer: PickLayer) => void
    /**
     * Plays each pick's note for 1.5 s (off by default): the play options' player, volume
     * (read at each pick) and sound (guitar on fretboards, piano on keyboards by default). A new
     * pick stops the note before. Through `renderBlock`, `true` uses the block's `play` options.
     */
    play?: boolean | PlayOptions
}

/** How long a picked note sounds, in seconds (as a click on a note of a playable diagram). */
export const PICK_NOTE = 1.5

export interface PickLayer {
    /** The diagram. */
    readonly element: Element
    /** Every target, in document order (the highest string's frets first; white keys, then black). */
    targets(): Pick[]
    /** Marks the target(s) at `at` right or wrong (replacing a mark); false when none is there. */
    mark(at: PickAt, result: PickResult): boolean
    /** Takes the mark(s) at `at` away; false when none was there. */
    unmark(at: PickAt): boolean
    /** Takes every mark away. */
    clear(): void
    /** Focuses the target at `at` (the first one there), else the layer's tab stop. */
    focus(at?: PickAt): boolean
    /** Stops picking: listeners off, marks, names and tab stops removed. */
    destroy(): void
}

export interface PickTargetData {
    pitch: number
    note: string
    /** 1 is the highest string (fretboards). */
    string?: number
    fret?: number
    /** The place, for screen readers ("String 5, fret 3"): never the note, so it gives no answer away. */
    name: string
    /** Where a mark goes, and its radius. */
    mark: [number, number]
    radius: number
}

/** The layer's group, drawn last (above the dots and labels). */
export function pickGroup(doc: Document): SVGElement {
    return svg(doc, 'g', { class: 'mn-picks' })
}

/** One target: a transparent rectangle that takes clicks, without the stylesheet too. */
export function pickTarget(
    doc: Document,
    area: { x: number; y: number; width: number; height: number },
    data: PickTargetData
): SVGElement {
    return svg(doc, 'rect', {
        'class': 'mn-pick',
        'x': area.x,
        'y': area.y,
        'width': area.width,
        'height': area.height,
        'fill': 'transparent',
        'pointer-events': 'all',
        'data-mn-pitch': data.pitch,
        'data-mn-note': data.note,
        'data-mn-string': data.string,
        'data-mn-fret': data.fret,
        'data-mn-pick-name': data.name,
        'data-mn-mark-x': data.mark[0],
        'data-mn-mark-y': data.mark[1],
        'data-mn-mark-r': data.radius
    })
}

const NAV_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Enter',
    ' '
])
const DIRECTIONS: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
}
const RESULT_CLASS = { right: 'mn-pick-right', wrong: 'mn-pick-wrong' } as const

const num = (el: Element, name: string) => Number(el.getAttribute(name))
const optional = (el: Element, name: string) => (el.hasAttribute(name) ? num(el, name) : null)
const centerOf = (el: Element): [number, number] => [
    num(el, 'x') + num(el, 'width') / 2,
    num(el, 'y') + num(el, 'height') / 2
]
// A place (string and fret) wins over a pitch, so a pick passed back marks its own target, not
// every target of its pitch.
const matches = (el: Element, at: PickAt) => {
    const place = at as { string?: number | null; fret?: number | null }
    if (typeof place.string === 'number' && typeof place.fret === 'number')
        return (
            optional(el, 'data-mn-string') === place.string &&
            optional(el, 'data-mn-fret') === place.fret
        )
    return 'pitch' in at && num(el, 'data-mn-pitch') === at.pitch
}

/** The live layer of each diagram: attaching again returns it, so nothing doubles. */
const LIVE = new WeakMap<Element, PickLayer>()

// Not `instanceof Element`: nodes of a popout window have that window's Element.
const asElement = (node: unknown): Element | null =>
    typeof (node as Partial<Element> | null)?.closest === 'function' ? (node as Element) : null

/**
 * Makes a diagram's pick layer live (see `PickLayer`). A diagram without one gets a layer with no
 * targets; a diagram whose layer is live gets that layer (its first options).
 */
export function attachPick(diagram: Element, options: PickOptions = {}): PickLayer {
    const live = LIVE.get(diagram)
    if (live) return live
    const doc = diagram.ownerDocument
    const targets = [...diagram.querySelectorAll<SVGElement>('.mn-picks > .mn-pick')]
    const keyboard = diagram.classList.contains('mn-keyboard')
    const defs = diagram.querySelector(':scope > defs')
    const names = new Map<Element, SVGElement>()
    const results = new Map<Element, { result: PickResult; mark: SVGElement }>()
    let marks: SVGElement | null = null
    let alive = targets.length > 0
    let stop: SVGElement | undefined = targets[0]
    const role = diagram.getAttribute('role')
    /** What the layer hid from screen readers (the drawing's texts), to show again on destroy. */
    const hidden: Element[] = []

    const pickOf = (el: SVGElement, via: Pick['via']): Pick => ({
        string: optional(el, 'data-mn-string'),
        fret: optional(el, 'data-mn-fret'),
        note: el.getAttribute('data-mn-note') ?? '',
        pitch: num(el, 'data-mn-pitch'),
        element: el,
        via
    })
    const rename = (el: Element) => {
        const title = names.get(el)
        if (!title) return
        const result = results.get(el)?.result
        title.textContent = `${el.getAttribute('data-mn-pick-name') ?? ''}${result ? `, ${result}` : ''}`
    }
    const setStop = (el: SVGElement) => {
        stop?.setAttribute('tabindex', '-1')
        stop = el
        el.setAttribute('tabindex', '0')
    }
    const targetOf = (event: Event): SVGElement | null => {
        const el = asElement(event.target)?.closest('.mn-pick') ?? null
        return el && targets.includes(el as SVGElement) ? (el as SVGElement) : null
    }
    let sounding: PlayHandle | null = null
    const silence = () => {
        try {
            sounding?.stop()
        } catch {
            // The player failed to stop: nothing more to do.
        }
        sounding = null
    }
    const hear = (el: SVGElement) => {
        if (!options.play) return
        const play = options.play === true ? {} : options.play
        // The window the diagram is in now (a popout has its own audio).
        const win = diagram.ownerDocument.defaultView
        if (!win) return
        silence()
        try {
            const sound: Sound =
                play.sound ??
                (diagram.getAttribute('data-mn-sound') === 'piano' ? 'piano' : 'guitar')
            sounding = playerFor(win, play).play(
                [{ midi: num(el, 'data-mn-pitch'), time: 0, duration: PICK_NOTE }],
                { sound, volume: volumeOf(play.volume) }
            )
        } catch {
            // No audio: the pick still counts.
            sounding = null
        }
    }
    const pick = (el: SVGElement, via: Pick['via']) => {
        setStop(el)
        hear(el)
        try {
            options.onPick?.(pickOf(el, via), layer)
        } catch {
            // The app's handler failed: the layer keeps working.
        }
    }
    const move = (from: SVGElement, keyName: string): SVGElement | null => {
        if (keyboard) {
            const byPitch = [...targets].sort(
                (a, b) => num(a, 'data-mn-pitch') - num(b, 'data-mn-pitch')
            )
            const i = byPitch.indexOf(from)
            if (keyName === 'Home') return byPitch[0] ?? null
            if (keyName === 'End') return byPitch.at(-1) ?? null
            const up = keyName === 'ArrowRight' || keyName === 'ArrowUp'
            return byPitch[i + (up ? 1 : -1)] ?? null
        }
        if (keyName === 'Home' || keyName === 'End') {
            const string = from.getAttribute('data-mn-string')
            const same = targets
                .filter((t) => t.getAttribute('data-mn-string') === string)
                .sort((a, b) => num(a, 'data-mn-fret') - num(b, 'data-mn-fret'))
            return (keyName === 'Home' ? same[0] : same.at(-1)) ?? null
        }
        // The next target on the screen in the arrow's direction, on the same line: orientation
        // and hand need no special case.
        const [dx, dy] = DIRECTIONS[keyName]!
        const [x, y] = centerOf(from)
        let best: SVGElement | null = null
        let bestAlong = Infinity
        for (const t of targets) {
            const [tx, ty] = centerOf(t)
            const along = (tx - x) * dx + (ty - y) * dy
            const across = Math.abs((tx - x) * dy - (ty - y) * dx)
            if (along > 0.5 && across < 0.5 && along < bestAlong) {
                best = t
                bestAlong = along
            }
        }
        return best
    }

    // A press anywhere on a live diagram is the layer's: a near miss must not open an editor.
    const onPress = (event: Event) => {
        if (alive) event.stopPropagation()
    }
    const onClick = (event: Event) => {
        if (!alive) return
        event.stopPropagation()
        const el = targetOf(event)
        if (el) pick(el, 'pointer')
    }
    const onKey = (event: KeyboardEvent) => {
        // Keys with Ctrl, Alt or Meta are the host's (its hotkeys).
        if (!alive || !NAV_KEYS.has(event.key) || event.ctrlKey || event.altKey || event.metaKey)
            return
        const el = targetOf(event)
        if (!el) return
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Enter' || event.key === ' ') {
            // One pick per press: a held key repeats nothing.
            if (!event.repeat) pick(el, 'keyboard')
            return
        }
        const next = move(el, event.key)
        if (next) {
            setStop(next)
            next.focus()
        }
    }
    // On each target, never on the diagram or a group: Chromium makes an SVG element with a
    // focus listener a tab stop of its own (the whole diagram took the focus before its targets).
    const onFocus = (event: Event) => {
        if (alive) setStop(event.currentTarget as SVGElement)
    }

    if (alive) {
        diagram.setAttribute('role', 'group')
        for (const el of targets) {
            el.setAttribute('role', 'button')
            el.setAttribute('tabindex', el === stop ? '0' : '-1')
            const id = uniqueId()
            const title = svg(doc, 'title', { class: 'mn-pick-name', id })
            ;(defs ?? diagram).appendChild(title)
            names.set(el, title)
            el.setAttribute('aria-labelledby', id)
            rename(el)
            el.addEventListener('focus', onFocus)
        }
        for (const type of ['pointerdown', 'mousedown']) diagram.addEventListener(type, onPress)
        diagram.addEventListener('click', onClick)
        diagram.addEventListener('keydown', onKey as EventListener)
        // Screen readers get the targets, not the drawing's texts (title, fret numbers, string
        // names, labels) mixed in with them: the diagram's name already says what it is.
        const groups = new Set<Element>(targets.map((t) => t.parentElement!))
        const keep = new Set<Element>()
        for (const group of groups) {
            for (let el: Element | null = group; el && el !== diagram; el = el.parentElement)
                keep.add(el)
        }
        const hide = (parent: Element) => {
            for (const child of parent.children) {
                if (groups.has(child) || child.tagName.toLowerCase() === 'defs') continue
                if (keep.has(child)) hide(child)
                else if (!child.hasAttribute('aria-hidden')) {
                    child.setAttribute('aria-hidden', 'true')
                    hidden.push(child)
                }
            }
        }
        hide(diagram)
    }

    const unmarkOne = (el: Element) => {
        const done = results.get(el)
        if (!done) return false
        done.mark.remove()
        el.classList.remove(RESULT_CLASS[done.result])
        results.delete(el)
        rename(el)
        return true
    }
    const drawMark = (el: Element, result: PickResult): SVGElement => {
        const [x, y] = [num(el, 'data-mn-mark-x'), num(el, 'data-mn-mark-y')]
        const r = num(el, 'data-mn-mark-r') || 8
        const k = (n: number) => Math.round(n * 100) / 100
        const d =
            result === 'right'
                ? `M${k(x - r * 0.45)} ${k(y + r * 0.02)}L${k(x - r * 0.1)} ${k(y + r * 0.38)}L${k(x + r * 0.48)} ${k(y - r * 0.36)}`
                : `M${k(x - r * 0.38)} ${k(y - r * 0.38)}L${k(x + r * 0.38)} ${k(y + r * 0.38)}M${k(x + r * 0.38)} ${k(y - r * 0.38)}L${k(x - r * 0.38)} ${k(y + r * 0.38)}`
        return svg(
            doc,
            'g',
            {
                'class': `mn-pick-mark ${RESULT_CLASS[result]}`,
                'data-mn-pitch': el.getAttribute('data-mn-pitch') ?? undefined,
                'data-mn-string': el.getAttribute('data-mn-string') ?? undefined,
                'data-mn-fret': el.getAttribute('data-mn-fret') ?? undefined
            },
            [
                svg(doc, 'circle', {
                    class: 'mn-pick-disc',
                    cx: x,
                    cy: y,
                    r,
                    fill: result === 'right' ? '#15803d' : '#b91c1c'
                }),
                svg(doc, 'path', {
                    'class': result === 'right' ? 'mn-pick-check' : 'mn-pick-cross',
                    d,
                    'fill': 'none',
                    'stroke': '#fff',
                    'stroke-width': 2,
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round'
                })
            ]
        )
    }

    const layer: PickLayer = {
        element: diagram,
        targets: () => targets.map((el) => pickOf(el, 'pointer')),
        mark(at, result) {
            if (!alive) return false
            const found = targets.filter((el) => matches(el, at))
            for (const el of found) {
                unmarkOne(el)
                if (!marks) {
                    // Next to the layer, so it moves with it (a row's title pad shifts it) and
                    // sits above every target.
                    marks = svg(doc, 'g', { 'class': 'mn-pick-marks', 'pointer-events': 'none' })
                    targets.at(-1)!.parentElement!.after(marks)
                }
                const mark = drawMark(el, result)
                marks.appendChild(mark)
                el.classList.add(RESULT_CLASS[result])
                results.set(el, { result, mark })
                rename(el)
            }
            return found.length > 0
        },
        unmark(at) {
            let any = false
            for (const el of targets) if (matches(el, at) && unmarkOne(el)) any = true
            return any
        },
        clear() {
            for (const el of [...results.keys()]) unmarkOne(el)
        },
        focus(at) {
            if (!alive) return false
            const el = at ? targets.find((t) => matches(t, at)) : stop
            if (!el) return false
            setStop(el)
            el.focus()
            return true
        },
        destroy() {
            if (!alive) return
            layer.clear()
            silence()
            alive = false
            marks?.remove()
            marks = null
            for (const type of ['pointerdown', 'mousedown'])
                diagram.removeEventListener(type, onPress)
            diagram.removeEventListener('click', onClick)
            diagram.removeEventListener('keydown', onKey as EventListener)
            for (const el of targets) {
                el.removeEventListener('focus', onFocus)
                el.removeAttribute('role')
                el.removeAttribute('tabindex')
                el.removeAttribute('aria-labelledby')
            }
            for (const title of names.values()) title.remove()
            names.clear()
            for (const el of hidden) el.removeAttribute('aria-hidden')
            hidden.length = 0
            LIVE.delete(diagram)
            if (role === null) diagram.removeAttribute('role')
            else diagram.setAttribute('role', role)
        }
    }
    if (alive) LIVE.set(diagram, layer)
    return layer
}
