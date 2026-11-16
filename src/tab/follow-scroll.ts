/**
 * Follow the music (#97): while a tab or a score plays, keep the system that plays in view. Off
 * by default: the page never moves unless the reader asks (#89). What scrolls is the nearest box
 * that scrolls (a block with a height of its own, an app's reading pane), else the page, by the
 * smallest move that shows the playing system and the one after it. A scroll by hand pauses it,
 * until the next Play or a click on the button. Nothing here knows alphaTab.
 */

/** A vertical span on the screen, in pixels. */
export interface Span {
    top: number
    bottom: number
}

/**
 * The smallest vertical move (pixels, down is positive) of a scroll area that shows `target` in
 * `view`, with `margin` around it: 0 when it shows already. A target taller than the view has its
 * top at the top.
 */
export function moveToShow(view: Span, target: Span, margin = 0): number {
    const top = view.top + margin
    const bottom = view.bottom - margin
    if (target.bottom - target.top >= bottom - top) return Math.round(target.top - top)
    if (target.top < top) return Math.round(target.top - top)
    if (target.bottom > bottom) return Math.round(target.bottom - bottom)
    return 0
}

/**
 * What to show for a playing system: the system and the one after it (the reader looks ahead),
 * or the system alone when both don't fit the view.
 */
export function spanToShow(system: Span, view: Span, margin = 0): Span {
    const height = system.bottom - system.top
    const both = { top: system.top, bottom: system.bottom + height }
    return both.bottom - both.top <= view.bottom - view.top - 2 * margin ? both : system
}

const SCROLLS = new Set(['auto', 'scroll', 'overlay'])

/**
 * The nearest element around `el` (itself included) that scrolls up and down and has more than
 * it shows; null when that is the page.
 */
export function scrollerOf(el: Element): HTMLElement | null {
    const win = el.ownerDocument.defaultView
    if (!win) return null
    const root = el.ownerDocument.scrollingElement ?? el.ownerDocument.documentElement
    for (let node: Element | null = el; node; node = node.parentElement) {
        if (node === root || node === el.ownerDocument.body) return null
        if (!(node instanceof win.HTMLElement)) continue
        if (
            SCROLLS.has(win.getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight + 1
        )
            return node
    }
    return null
}

/** Keys that scroll by hand. */
const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])

export interface Follow {
    /** Whether the reader asked for it. */
    on(): boolean
    /** Whether it follows now: asked for, and not paused by a scroll by hand. */
    active(): boolean
    /** Asks for it or not. */
    set(on: boolean): void
    /** The button's click: follows again when paused, else turns it on or off. */
    press(): void
    /** The music plays (again): a pause ends. */
    playing(): void
    /**
     * Shows a span of the screen (the playing system), when it follows: scrolls the nearest
     * scroll area of the score, or the page. `covered` is the height hidden at the bottom of the
     * view (a bar that stays there).
     */
    show(system: Span, covered?: number): void
    /** Stops listening to the page. */
    destroy(): void
}

export interface FollowOptions {
    /** Whether it starts on (default false). */
    on?: boolean
    /** Called when `on` or `active` changes. */
    changed?: (state: { on: boolean; active: boolean }) => void
    /** Room kept around the system (default 16). */
    margin?: number
}

/**
 * The follow state of the score `el`, and its scrolling. A wheel or a touch move on the score or
 * on what holds it (its pane, the page), or a scroll key, pauses it: the reader's hand wins. A
 * scroll somewhere else (another pane) doesn't.
 */
export function followScroll(el: Element, options: FollowOptions = {}): Follow {
    const doc = el.ownerDocument
    const win = doc.defaultView
    const margin = options.margin ?? 16
    let on = options.on === true
    let paused = false
    /** The system last scrolled for (its place in its scroll area): one move per system. */
    let last: number | null = null
    const tell = () => options.changed?.({ on, active: on && !paused })
    const pause = () => {
        if (!on || paused) return
        paused = true
        tell()
    }
    const byHand = (event: Event) => {
        const target = event.target as Node | null
        if (!target || typeof target.contains !== 'function') return
        if (target.contains(el) || el.contains(target)) pause()
    }
    const key = (event: KeyboardEvent) => {
        if (SCROLL_KEYS.has(event.key)) byHand(event)
    }
    doc.addEventListener('wheel', byHand, { passive: true, capture: true })
    doc.addEventListener('touchmove', byHand, { passive: true, capture: true })
    doc.addEventListener('keydown', key, true)
    return {
        on: () => on,
        active: () => on && !paused,
        set(next) {
            if (on === next && !paused) return
            on = next
            paused = false
            last = null
            tell()
        },
        press() {
            if (on && paused) paused = false
            else on = !on
            last = null
            tell()
        },
        playing() {
            last = null
            if (!paused) return
            paused = false
            tell()
        },
        show(system, covered = 0) {
            if (!on || paused || !win) return
            if (system.bottom <= system.top) return
            const scroller = scrollerOf(el)
            const box = scroller?.getBoundingClientRect()
            const view: Span = {
                top: Math.max(0, box?.top ?? 0),
                bottom: Math.min(win.innerHeight, box?.bottom ?? win.innerHeight) - covered
            }
            if (view.bottom - view.top <= 2 * margin) return
            const at = Math.round(system.top + (scroller ? scroller.scrollTop : win.scrollY))
            if (last !== null && Math.abs(at - last) < 2) return
            last = at
            const move = moveToShow(view, spanToShow(system, view, margin), margin)
            if (!move) return
            const how: ScrollToOptions = { top: move, behavior: 'smooth' }
            if (scroller) scroller.scrollBy(how)
            else win.scrollBy(how)
        },
        destroy() {
            doc.removeEventListener('wheel', byHand, true)
            doc.removeEventListener('touchmove', byHand, true)
            doc.removeEventListener('keydown', key, true)
        }
    }
}
