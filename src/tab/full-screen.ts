/**
 * Full screen for a tab or a score (#113): a button on the player bar makes the block fill the
 * screen, so the score is laid out again at the screen's width (many more bars a line on a wide
 * screen) and several lines show at once. The score scrolls in an area of its own there, by hand
 * and with the music, and the bar stays at the bottom.
 *
 * The browser's own full screen is asked for; when it refuses (an embedded page, an iPhone) or
 * doesn't have it, the block covers the window instead, with the same style (`mn-fullscreen`).
 * Nothing here knows alphaTab: `follow` turns the score's following on and off.
 */
import { icon, iconButton } from '../playback/bar-parts.js'

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
const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '])

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

/**
 * The full screen control of a tab block. `block` fills the screen and `surface` (the score)
 * becomes its scroll area. `follow(true)` is called when the score may follow the music (in full
 * screen, where only its own area scrolls), `follow(false)` when it must not: out of full screen
 * (the page never moves, #89), and after a scroll by hand, until the music plays again.
 */
export function fullScreenControl(
    doc: Document,
    block: HTMLElement,
    surface: HTMLElement,
    follow: (on: boolean) => void
): FullScreen {
    const win = doc.defaultView
    const button = iconButton(doc, 'mn-tab-full', 'Full screen', 'full')
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
            block.style.minHeight = place.style.height
            held = true
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
        }
    }
}
