import { afterEach, describe, expect, it } from 'bun:test'
import { fullScreenControl } from './full-screen.js'

/** A tab block on the page: the block, its drawing surface, and the calls to `follow`. */
function setup() {
    const page = document.createElement('div')
    const block = document.createElement('div')
    const surface = document.createElement('div')
    block.appendChild(surface)
    page.appendChild(block)
    document.body.appendChild(page)
    const follows: boolean[] = []
    const control = fullScreenControl(document, block, surface, (on) => follows.push(on))
    block.appendChild(control.button)
    return { page, block, surface, follows, control }
}

/** Sets what the page says is in the browser's full screen, and tells the page. */
function browserFullScreen(element: Element | null) {
    Object.defineProperty(document, 'fullscreenElement', { value: element, configurable: true })
    document.dispatchEvent(new Event('fullscreenchange'))
}

afterEach(() => {
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    document.body.replaceChildren()
})

describe('full screen for tabs and scores (#113)', () => {
    it('is a button on the bar, not pressed, with its icon', () => {
        const { control, block } = setup()
        const b = control.button
        expect(b.getAttribute('aria-label')).toBe('Full screen')
        expect(b.title).toBe('Full screen')
        expect(b.getAttribute('aria-pressed')).toBe('false')
        expect(b.querySelector('svg')!.getAttribute('class')).toContain('mn-play-icon-full')
        expect(block.classList.contains('mn-fullscreen')).toBe(false)
        expect(control.active()).toBe(false)
    })

    it('a click fills the screen with the block, its score in a scroll area of its own', () => {
        const { control, block, surface, follows } = setup()
        control.button.click()
        expect(control.active()).toBe(true)
        expect(block.classList.contains('mn-fullscreen')).toBe(true)
        expect(control.button.getAttribute('aria-pressed')).toBe('true')
        expect(control.button.title).toBe('Exit full screen')
        expect(control.button.querySelector('svg')!.getAttribute('class')).toContain(
            'mn-play-icon-exit'
        )
        // The scroll area takes the keys (Page Up, Page Down, Home, End).
        expect(surface.tabIndex).toBe(0)
        // The score follows the music there: it has its own scroll area, the page doesn't move.
        expect(follows).toEqual([true])
    })

    it('a second click leaves it: the block is back in the page, the score at its top', () => {
        const { control, block, surface, follows } = setup()
        control.button.click()
        surface.scrollTop = 240
        control.button.click()
        expect(control.active()).toBe(false)
        expect(block.classList.contains('mn-fullscreen')).toBe(false)
        expect(control.button.getAttribute('aria-pressed')).toBe('false')
        expect(control.button.title).toBe('Full screen')
        expect(surface.hasAttribute('tabindex')).toBe(false)
        expect(surface.scrollTop).toBe(0)
        expect(follows).toEqual([true, false])
    })

    it('Escape leaves it, and the key goes no further', () => {
        const { control, block } = setup()
        control.button.click()
        let heard = 0
        document.body.addEventListener('keydown', () => heard++)
        block.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(control.active()).toBe(false)
        expect(heard).toBe(0)
        // Out of full screen, Escape is the page's.
        block.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(heard).toBe(1)
    })

    it("asks for the browser's full screen, and leaves when the browser leaves it", () => {
        const { control, block } = setup()
        let asked = 0
        block.requestFullscreen = () => {
            asked++
            return Promise.resolve()
        }
        control.button.click()
        expect(asked).toBe(1)
        browserFullScreen(block)
        expect(control.active()).toBe(true)
        // Escape in the browser's full screen: the browser leaves, the page hears no key.
        browserFullScreen(null)
        expect(control.active()).toBe(false)
        expect(block.classList.contains('mn-fullscreen')).toBe(false)
    })

    it("covers the window when the browser refuses its full screen (or doesn't have it)", async () => {
        const { control, block } = setup()
        block.requestFullscreen = () => Promise.reject(new Error('not allowed'))
        control.button.click()
        await new Promise((r) => setTimeout(r, 0))
        expect(control.active()).toBe(true)
        expect(block.classList.contains('mn-fullscreen')).toBe(true)
        // Another element's full screen ending is not ours.
        browserFullScreen(null)
        expect(control.active()).toBe(true)
    })

    it("leaves the browser's full screen when its button is clicked", () => {
        const { control, block } = setup()
        block.requestFullscreen = () => Promise.resolve()
        let exits = 0
        document.exitFullscreen = () => {
            exits++
            return Promise.resolve()
        }
        control.button.click()
        browserFullScreen(block)
        control.button.click()
        expect(exits).toBe(1)
        expect(control.active()).toBe(false)
    })

    it('a manual scroll stops the following, until the music plays again', () => {
        const { control, surface, follows } = setup()
        control.button.click()
        surface.dispatchEvent(new Event('wheel'))
        expect(follows).toEqual([true, false])
        // Once is enough.
        surface.dispatchEvent(new Event('touchmove'))
        surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }))
        expect(follows).toEqual([true, false])
        control.playing()
        expect(follows).toEqual([true, false, true])
        surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }))
        expect(follows).toEqual([true, false, true, false])
        // Other keys are not a scroll.
        control.playing()
        surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
        expect(follows).toEqual([true, false, true, false, true])
    })

    it('never follows out of full screen: the page must not move (#89)', () => {
        const { control, surface, follows } = setup()
        control.playing()
        surface.dispatchEvent(new Event('wheel'))
        expect(follows).toEqual([])
        control.button.click()
        control.button.click()
        control.playing()
        expect(follows).toEqual([true, false])
    })

    it("takes the page's background, since full screen shows nothing behind the block", () => {
        const { control, block, page } = setup()
        page.style.backgroundColor = 'rgb(30, 30, 30)'
        block.style.backgroundColor = 'red'
        control.button.click()
        expect(block.style.backgroundColor).toBe('rgb(30, 30, 30)')
        control.button.click()
        expect(block.style.backgroundColor).toBe('red')
    })

    it("puts the page back where it was (the block leaves the page's flow)", () => {
        const { control } = setup()
        const calls: number[][] = []
        const original = window.scrollTo.bind(window)
        Object.defineProperty(window, 'scrollX', { value: 12, configurable: true })
        Object.defineProperty(window, 'scrollY', { value: 3400, configurable: true })
        window.scrollTo = ((x: number, y: number) => {
            calls.push([x, y])
        }) as unknown as typeof window.scrollTo
        control.button.click()
        control.button.click()
        window.scrollTo = original
        Object.defineProperty(window, 'scrollX', { value: 0, configurable: true })
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
        expect(calls).toEqual([[12, 3400]])
    })

    it("keeps the block's place in the page, so the page doesn't move when it comes back", () => {
        const { control, block, page } = setup()
        Object.defineProperty(block, 'offsetHeight', { value: 4105, configurable: true })
        block.style.minHeight = '10px'
        control.button.click()
        // In full screen the block is out of the page's flow: a block of its height holds its place.
        const place = block.previousElementSibling as HTMLElement
        expect(place.className).toBe('mn-fullscreen-place')
        expect(place.style.height).toBe('4105px')
        expect(page.children.length).toBe(2)
        // Drawn for the screen: nothing to put back yet.
        control.drawn()
        expect(block.style.minHeight).toBe('10px')
        control.button.click()
        // Back in the page, still laid out for the screen: it keeps its old height...
        expect(page.children.length).toBe(1)
        expect(block.style.minHeight).toBe('4105px')
        // ...until its score is drawn again at its own width.
        control.drawn()
        expect(block.style.minHeight).toBe('10px')
        // Into full screen again before that drawing: its own min-height is not lost.
        control.button.click()
        control.button.click()
        control.button.click()
        control.button.click()
        control.drawn()
        expect(block.style.minHeight).toBe('10px')
    })

    it('a block removed in full screen leaves it, and hears the page no more', () => {
        const { control, block, follows } = setup()
        block.requestFullscreen = () => Promise.resolve()
        control.button.click()
        browserFullScreen(block)
        control.destroy()
        expect(control.active()).toBe(false)
        expect(block.classList.contains('mn-fullscreen')).toBe(false)
        expect(follows).toEqual([true, false])
        control.button.click()
        browserFullScreen(block)
        browserFullScreen(null)
        // Still in: the page's event is no longer heard.
        expect(control.active()).toBe(true)
    })
})
