/**
 * Full screen for a block (#113): a button on the block's bar makes the block fill the screen. A
 * tab or a score is laid out again at the screen's width (many more bars a line on a wide screen)
 * and scrolls in an area of its own, by hand and with the music; other blocks (diagrams, charts,
 * patterns, progressions, the circle of fifths) grow to fill the screen (`blockFullScreen`). The bar
 * stays at the bottom.
 *
 * The browser's own full screen is asked for; when it refuses (an embedded page, an iPhone) or
 * doesn't have it, the block covers the window instead, with the same style (`mn-fullscreen`).
 * Nothing here knows alphaTab: `follow` turns the score's following on and off.
 */
import { icon, iconButton } from './bar-parts.js'

export interface FullScreen {
    /** The bar's button. */
    button: HTMLButtonElement
    /** Whether the block fills the screen. */
    active(): boolean
    /** Tells the control that the music plays: the score follows it again in full screen. */
    playing(): void
    /** Tells the control that the score was drawn (again): out of full screen, at its own size. */
    drawn(): void
    /** Leaves full screen and stops listening to the page. */
    destroy(): void
}

/** Keys that scroll the score by hand. */
const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])

/** The first background that shows behind `el`: its page's, as the reader sees it. */
function backgroundBehind(el: HTMLElement): string {
    const win = el.ownerDocument.defaultView
    if (!win) return ''
    for (let node = el.parentElement; node; node = node.parentElement) {
        const color = win.getComputedStyle(node).backgroundColor
        if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) return color
    }
    return ''
}

export interface FullScreenOptions {
    /**
     * Whether the block is drawn again at its own size after full screen (a score: true, the
     * default). It then keeps its height until `drawn()`, so the page doesn't move.
     */
    redraws?: boolean
    /** Called after the block entered (true) or left (false) full screen. */
    changed?: (on: boolean) => void
}

/**
 * The full screen control of a block. `block` fills the screen and `surface` (a score's drawing,
 * or the block itself) becomes its scroll area. `follow(true)` is called when the score may follow the music (in full
 * screen, where only its own area scrolls), `follow(false)` when it must not: out of full screen
 * (the page never moves, #89), and after a scroll by hand, until the music plays again.
 */
export function fullScreenControl(
    doc: Document,
    block: HTMLElement,
    surface: HTMLElement,
    follow: (on: boolean) => void = () => {},
    options: FullScreenOptions = {}
): FullScreen {
    const redraws = options.redraws !== false
    const win = doc.defaultView
    const button = iconButton(doc, 'mn-tab-full', 'Full screen', 'full')
    button.classList.add('mn-play-full')
    let on = false
    /** Whether the browser's full screen holds the block (else the block covers the window). */
    let browser = false
    let following = false
    let before: { x: number; y: number; background: string } | null = null
    /**
     * Keeps the block's place in the page while the block fills the screen: without it the page
     * below moves up, and the browser then scrolls it (to keep what it showed) when the block comes
     * back, thousands of pixels for a long score.
     */
    let place: HTMLElement | null = null
    /** Whether the block keeps its old height, until the score is drawn again at its own width. */
    let held = false
    /** The block's own `min-height`, put back then. */
    let ownMinHeight = ''
    const setFollow = (yes: boolean) => {
        if (following === yes) return
        following = yes
        follow(yes)
    }
    const show = () => {
        block.classList.toggle('mn-fullscreen', on)
        button.classList.toggle('mn-on', on)
        button.setAttribute('aria-pressed', String(on))
        button.title = on ? 'Exit full screen' : 'Full screen'
        button.replaceChildren(icon(doc, on ? 'exit' : 'full'))
    }
    const enter = () => {
        if (on) return
        on = true
        before = {
            x: win?.scrollX ?? 0,
            y: win?.scrollY ?? 0,
            background: block.style.backgroundColor
        }
        if (!held) ownMinHeight = block.style.minHeight
        held = false
        place = doc.createElement('div')
        place.className = 'mn-fullscreen-place'
        place.style.height = `${block.offsetHeight}px`
        const margins = win?.getComputedStyle(block)
        if (margins) {
            place.style.marginTop = margins.marginTop
            place.style.marginBottom = margins.marginBottom
        }
        block.before(place)
        // Full screen shows nothing behind the block: it takes the page's background.
        const background = backgroundBehind(block)
        if (background) block.style.backgroundColor = background
        show()
        surface.tabIndex = 0
        surface.focus({ preventScroll: true })
        setFollow(true)
        options.changed?.(true)
        try {
            // Refused or missing: the block covers the window, with the same style.
            void block.requestFullscreen?.().catch(() => {})
        } catch {
            // The same.
        }
    }
    const leave = (focus = true) => {
        if (!on) return
        on = false
        setFollow(false)
        show()
        block.style.backgroundColor = before?.background ?? ''
        // The block comes back as tall as it was, until its score is drawn again at its width
        // (it is still laid out for the screen, a few lines high): the page doesn't move.
        if (place) {
            if (redraws) {
                block.style.minHeight = place.style.height
                held = true
            }
            place.remove()
            place = null
        }
        surface.removeAttribute('tabindex')
        surface.scrollTop = 0
        if (browser && doc.fullscreenElement === block) void doc.exitFullscreen?.().catch(() => {})
        browser = false
        // The block left the page's flow and comes back: the page is where it was.
        if (before && win) win.scrollTo(before.x, before.y)
        before = null
        options.changed?.(false)
        if (focus) button.focus({ preventScroll: true })
    }
    button.addEventListener('click', () => (on ? leave() : enter()))
    block.addEventListener('keydown', (event) => {
        if (!on || event.key !== 'Escape') return
        event.stopPropagation()
        event.preventDefault()
        leave()
    })
    // The reader scrolls: the score stops following, until the music plays again.
    const byHand = () => {
        if (on) setFollow(false)
    }
    surface.addEventListener('wheel', byHand, { passive: true })
    surface.addEventListener('touchmove', byHand, { passive: true })
    surface.addEventListener('keydown', (event) => {
        if (SCROLL_KEYS.has(event.key)) byHand()
    })
    /**
     * Space plays and pauses in full screen, wherever the focus is (the score, a button of the bar,
     * nothing): it presses the bar's Play. Fields that take a space keep it. The key goes no
     * further, so it never scrolls, and a focused button doesn't take it as a click too.
     */
    const space = (event: KeyboardEvent) => {
        if (!on || event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return
        // A block gone from the page (a site navigated away) leaves full screen: the key is the page's.
        if (!block.isConnected) {
            leave(false)
            return
        }
        const target = event.target as HTMLElement | null
        if (target?.closest('input:not([type=range]), textarea, select, [contenteditable=true]'))
            return
        event.preventDefault()
        event.stopPropagation()
        if (event.type !== 'keydown' || event.repeat) return
        block.querySelector<HTMLButtonElement>('.mn-play .mn-play-toggle')?.click()
    }
    doc.addEventListener('keydown', space, true)
    doc.addEventListener('keyup', space, true)
    // Escape in the browser's full screen: the browser leaves it, and the page hears no key.
    const changed = () => {
        if (doc.fullscreenElement === block) browser = true
        else if (browser) leave()
    }
    doc.addEventListener('fullscreenchange', changed)
    show()
    return {
        button,
        active: () => on,
        playing: () => {
            if (on) setFollow(true)
        },
        drawn: () => {
            if (on || !held) return
            held = false
            block.style.minHeight = ownMinHeight
        },
        destroy: () => {
            leave(false)
            doc.removeEventListener('fullscreenchange', changed)
            doc.removeEventListener('keydown', space, true)
            doc.removeEventListener('keyup', space, true)
        }
    }
}

/** The zooms a block may take in full screen, largest first. */
const ZOOMS = [4, 3.5, 3, 2.5, 2.25, 2, 1.75, 1.5, 1.25, 1]
/** The largest zoom of a block too tall for the screen at every zoom: bigger, and it scrolls. */
const TALL_ZOOM = 1.5

/**
 * The zoom of a block in full screen: the largest that fits the screen, both ways. A block that
 * never fits (a long chart) takes the largest zoom up to `TALL_ZOOM` whose width fits, and
 * scrolls. `fits(zoom)` says how the block fits at that zoom.
 */
export function chooseZoom(fits: (zoom: number) => { width: boolean; height: boolean }): number {
    const wide: number[] = []
    for (const zoom of ZOOMS) {
        const fit = fits(zoom)
        if (fit.width && fit.height) return zoom
        if (fit.width) wide.push(zoom)
    }
    return wide.find((zoom) => zoom <= TALL_ZOOM) ?? 1
}

/**
 * Full screen for a block that isn't a score: diagrams, a chart, a pattern, a progression, the
 * circle of fifths. Nothing is drawn again: what the block holds is zoomed (CSS `zoom`, so text
 * wraps again and drawings stay sharp) to the largest size that fits the screen, and again when
 * the screen's size changes. The bar keeps its size, at the bottom.
 */
export function blockFullScreen(doc: Document, block: HTMLElement): FullScreen {
    const win = doc.defaultView
    let frame = 0
    const fit = () => {
        frame = 0
        if (!block.classList.contains('mn-fullscreen')) return
        const zoom = chooseZoom((z) => {
            block.style.setProperty('--mn-zoom', String(z))
            return {
                width: block.scrollWidth <= block.clientWidth + 1,
                height: block.scrollHeight <= block.clientHeight + 1
            }
        })
        block.style.setProperty('--mn-zoom', String(zoom))
        // A bar inside what is zoomed (a chart's) keeps its own size.
        for (const bar of nested()) bar.style.setProperty('zoom', String(1 / zoom))
    }
    const nested = () => [
        ...block.querySelectorAll<HTMLElement>(':scope > :not(.mn-play) .mn-play')
    ]
    /** After the browser laid the block out at the screen's size. */
    const later = () => {
        if (!win || frame) return
        frame = win.requestAnimationFrame(fit)
    }
    const control = fullScreenControl(doc, block, block, undefined, {
        redraws: false,
        changed: (on) => {
            block.classList.toggle('mn-fullscreen-fit', on)
            if (on) {
                fit()
                later()
                win?.addEventListener('resize', later)
            } else {
                win?.removeEventListener('resize', later)
                block.style.removeProperty('--mn-zoom')
                for (const bar of nested()) bar.style.removeProperty('zoom')
            }
        }
    })
    return {
        ...control,
        destroy: () => {
            control.destroy()
            win?.removeEventListener('resize', later)
            if (frame) win?.cancelAnimationFrame(frame)
        }
    }
}

/**
 * Puts the Full screen button at the end of a block's bar (#113), unless `on` is false or the block
 * has one already (a chart's diagrams and its timed bar share the block). Returns a function that
 * frees it.
 */
export function addFullScreen(
    doc: Document,
    bar: HTMLElement,
    block: Element | null,
    on = true
): () => void {
    if (!on || !block || block.querySelector('.mn-play-full')) return () => {}
    const full = blockFullScreen(doc, block as HTMLElement)
    bar.appendChild(full.button)
    return () => full.destroy()
}

/** Full screen on a web page (#113): on unless the page options say `fullScreen: false`. */
export function pageFullScreen(options: unknown): boolean {
    if (!options || typeof options !== 'object') return true
    return (options as Record<string, unknown>)['fullScreen'] !== false
}
