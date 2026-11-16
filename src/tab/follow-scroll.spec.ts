import { afterEach, describe, expect, it } from 'bun:test'
import { followScroll, moveToShow, scrollerOf, spanToShow } from './follow-scroll.js'

describe('moveToShow', () => {
    const view = { top: 0, bottom: 600 }
    it('does not move for what shows already', () => {
        expect(moveToShow(view, { top: 100, bottom: 300 })).toBe(0)
        expect(moveToShow(view, { top: 16, bottom: 584 }, 16)).toBe(0)
    })
    it('moves down by the least that shows the bottom', () => {
        expect(moveToShow(view, { top: 500, bottom: 700 })).toBe(100)
        expect(moveToShow(view, { top: 500, bottom: 700 }, 16)).toBe(116)
    })
    it('moves up by the least that shows the top', () => {
        expect(moveToShow(view, { top: -80, bottom: 120 })).toBe(-80)
        expect(moveToShow(view, { top: -80, bottom: 120 }, 16)).toBe(-96)
    })
    it('puts the top of a target taller than the view at the top', () => {
        expect(moveToShow(view, { top: 300, bottom: 1200 })).toBe(300)
        expect(moveToShow(view, { top: 300, bottom: 1200 }, 16)).toBe(284)
    })
    it('works in a view that is not at the top of the screen', () => {
        expect(moveToShow({ top: 200, bottom: 500 }, { top: 450, bottom: 560 })).toBe(60)
    })
})

describe('spanToShow', () => {
    it('adds the next system when both fit the view', () => {
        expect(spanToShow({ top: 100, bottom: 250 }, { top: 0, bottom: 600 })).toEqual({
            top: 100,
            bottom: 400
        })
    })
    it('keeps the system alone when two do not fit', () => {
        const system = { top: 100, bottom: 420 }
        expect(spanToShow(system, { top: 0, bottom: 600 })).toBe(system)
        expect(spanToShow({ top: 0, bottom: 290 }, { top: 0, bottom: 600 }, 16)).toEqual({
            top: 0,
            bottom: 290
        })
    })
})

/** A box that scrolls, with a score in it, on the page. */
function scene(scrolls = true) {
    const box = document.createElement('div')
    if (scrolls) box.style.overflowY = 'auto'
    Object.defineProperty(box, 'scrollHeight', { value: 3000 })
    Object.defineProperty(box, 'clientHeight', { value: 600 })
    box.getBoundingClientRect = () => ({ top: 0, bottom: 600 }) as DOMRect
    const moves: number[] = []
    box.scrollBy = ((options: ScrollToOptions) => {
        moves.push(options.top ?? 0)
        box.scrollTop += options.top ?? 0
    }) as typeof box.scrollBy
    const score = document.createElement('div')
    box.appendChild(score)
    document.body.appendChild(box)
    return { box, score, moves }
}

describe('scrollerOf', () => {
    afterEach(() => document.body.replaceChildren())
    it('finds the nearest box that scrolls and has more than it shows', () => {
        const { box, score } = scene()
        expect(scrollerOf(score)).toBe(box)
    })
    it('is null when only the page scrolls', () => {
        const { score } = scene(false)
        expect(scrollerOf(score)).toBeNull()
    })
})

describe('followScroll', () => {
    afterEach(() => document.body.replaceChildren())

    it('is off at first: nothing scrolls', () => {
        const { score, moves } = scene()
        const follow = followScroll(score)
        expect(follow.on()).toBe(false)
        follow.show({ top: 900, bottom: 1000 })
        expect(moves).toEqual([])
        follow.destroy()
    })

    it('scrolls its box by the least that shows the system and the next one', () => {
        const { score, moves } = scene()
        const follow = followScroll(score, { on: true, margin: 0 })
        // In view with the next system: no move.
        follow.show({ top: 100, bottom: 200 })
        expect(moves).toEqual([])
        // The next system is below the view.
        follow.show({ top: 450, bottom: 550 })
        expect(moves).toEqual([50])
        follow.destroy()
    })

    it('moves once for a system, not at each position it hears', () => {
        const { box, score, moves } = scene()
        const follow = followScroll(score, { on: true, margin: 0 })
        follow.show({ top: 550, bottom: 650 })
        expect(moves).toEqual([150])
        // The same system, still on its way up (a smooth scroll): its place in the box is the same.
        box.scrollTop = 60
        follow.show({ top: 490, bottom: 590 })
        expect(moves).toEqual([150])
        follow.destroy()
    })

    it('leaves room for a bar that covers the bottom of the view', () => {
        const { score, moves } = scene()
        const follow = followScroll(score, { on: true, margin: 0 })
        follow.show({ top: 380, bottom: 480 }, 60)
        expect(moves).toEqual([40])
        follow.destroy()
    })

    it('a scroll by hand pauses it, until the music plays again', () => {
        const { box, score, moves } = scene()
        const states: { on: boolean; active: boolean }[] = []
        const follow = followScroll(score, { on: true, margin: 0, changed: (s) => states.push(s) })
        box.dispatchEvent(new Event('wheel', { bubbles: true }))
        expect(follow.on()).toBe(true)
        expect(follow.active()).toBe(false)
        follow.show({ top: 900, bottom: 1000 })
        expect(moves).toEqual([])
        follow.playing()
        expect(follow.active()).toBe(true)
        follow.show({ top: 900, bottom: 1000 })
        expect(moves).toHaveLength(1)
        expect(states).toEqual([
            { on: true, active: false },
            { on: true, active: true }
        ])
        follow.destroy()
    })

    it('a scroll key and a touch move pause it too; another key does not', () => {
        const { score } = scene()
        const follow = followScroll(score, { on: true })
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
        expect(follow.active()).toBe(true)
        document.body.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })
        )
        expect(follow.active()).toBe(false)
        follow.playing()
        score.dispatchEvent(new Event('touchmove', { bubbles: true }))
        expect(follow.active()).toBe(false)
        follow.destroy()
    })

    it('a scroll somewhere else (another pane) does not pause it', () => {
        const { score } = scene()
        const other = document.body.appendChild(document.createElement('div'))
        const follow = followScroll(score, { on: true })
        other.dispatchEvent(new Event('wheel', { bubbles: true }))
        expect(follow.active()).toBe(true)
        follow.destroy()
    })

    it('the button follows again when paused, else turns it on or off', () => {
        const { box, score } = scene()
        const follow = followScroll(score)
        follow.press()
        expect(follow.on()).toBe(true)
        box.dispatchEvent(new Event('wheel', { bubbles: true }))
        expect(follow.active()).toBe(false)
        follow.press()
        expect([follow.on(), follow.active()]).toEqual([true, true])
        follow.press()
        expect(follow.on()).toBe(false)
        follow.destroy()
    })

    it('stops listening once destroyed', () => {
        const { box, score } = scene()
        const follow = followScroll(score, { on: true })
        follow.destroy()
        box.dispatchEvent(new Event('wheel', { bubbles: true }))
        expect(follow.active()).toBe(true)
    })
})
