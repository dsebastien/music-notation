import { afterEach, describe, expect, it } from 'bun:test'
import { addFullScreen, chooseZoom, pageFullScreen } from './full-screen.js'
import { renderBlock } from '../render/render-block.js'

const host = () => document.body.appendChild(document.createElement('div'))
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))

afterEach(() => {
    document.body.replaceChildren()
})

/** Every kind of block that draws, but tabs and scores (they have their own). */
const BLOCKS = [
    ['chord', 'A x02220\n---\nD xx0232'],
    ['keyboard', 'scale: C major'],
    ['fretboard', 'scale: A minor pentatonic'],
    ['strum', 'D DU UDU'],
    ['picking', 'pattern: travis\nchords: C Am'],
    ['progression', 'key: C\nI vi IV V'],
    ['chords', '[C]Hello [G]world'],
    ['circle', 'key: C']
] as const

describe('full screen for every block (#113)', () => {
    it('is the last button of the bar of every block, with playback or without', () => {
        for (const play of [true, false])
            for (const [lang, source] of BLOCKS) {
                const { el } = renderBlock(lang, source, host(), { play })
                const buttons = el.querySelectorAll('.mn-play-full')
                expect(buttons.length).toBe(1)
                const button = buttons[0]!
                expect(button.getAttribute('aria-label')).toBe('Full screen')
                const bar = button.closest('.mn-play')!
                const controls = [...bar.children].filter(
                    (c) => !c.classList.contains('mn-play-said') && !c.closest('.mn-play-app')
                )
                expect(controls.includes(button)).toBe(true)
            }
    })

    it('is left out with fullScreen: false, with or without playback', () => {
        for (const play of [true, false])
            for (const [lang, source] of BLOCKS) {
                const { el } = renderBlock(lang, source, host(), { play, fullScreen: false })
                expect(el.querySelector('.mn-play-full')).toBeNull()
            }
    })

    it('fills the screen with the block, zoomed, and gives it back as it was', () => {
        const { el } = renderBlock('chord', 'A x02220\n---\nD xx0232', host(), { play: true })
        const button = el.querySelector('.mn-play-full')!
        click(button)
        expect(el.classList.contains('mn-fullscreen')).toBe(true)
        expect(el.classList.contains('mn-fullscreen-fit')).toBe(true)
        expect(el.style.getPropertyValue('--mn-zoom')).not.toBe('')
        expect(button.getAttribute('aria-pressed')).toBe('true')
        // Its place in the page is kept while it fills the screen.
        expect(el.previousElementSibling?.classList.contains('mn-fullscreen-place')).toBe(true)
        click(button)
        expect(el.classList.contains('mn-fullscreen')).toBe(false)
        expect(el.classList.contains('mn-fullscreen-fit')).toBe(false)
        expect(el.style.getPropertyValue('--mn-zoom')).toBe('')
        expect(el.previousElementSibling?.classList.contains('mn-fullscreen-place') ?? false).toBe(
            false
        )
        // Nothing is drawn again: the block doesn't keep a height of its own.
        expect(el.style.minHeight).toBe('')
    })

    it('Escape leaves it', () => {
        const { el } = renderBlock('strum', 'D DU UDU', host(), { play: true })
        click(el.querySelector('.mn-play-full')!)
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(el.classList.contains('mn-fullscreen')).toBe(false)
    })

    it('Space plays and pauses in full screen, wherever the focus is, and nowhere else', () => {
        const { el } = renderBlock('chord', 'A x02220', host(), { play: true })
        const toggle = el.querySelector('.mn-play-toggle')!
        let pressed = 0
        toggle.addEventListener('click', () => pressed++)
        const space = (target: EventTarget) => {
            const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
            target.dispatchEvent(down)
            target.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
            return down
        }
        // Out of full screen, Space is the page's.
        expect(space(document.body).defaultPrevented).toBe(false)
        expect(pressed).toBe(0)
        const full = el.querySelector('.mn-play-full')!
        click(full)
        // The focus on the page, on the block, or on a button of the bar.
        expect(space(document.body).defaultPrevented).toBe(true)
        space(el)
        space(full)
        expect(pressed).toBe(3)
        // A field keeps its space.
        const field = el.appendChild(document.createElement('input'))
        expect(space(field).defaultPrevented).toBe(false)
        expect(pressed).toBe(3)
        click(full)
        space(document.body)
        expect(pressed).toBe(3)
    })

    it('a block gone from the page in full screen gives Space back to the page', () => {
        const { el } = renderBlock('chord', 'A x02220', host(), { play: true })
        click(el.querySelector('.mn-play-full')!)
        el.remove()
        const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
        document.body.dispatchEvent(down)
        expect(down.defaultPrevented).toBe(false)
        expect(el.classList.contains('mn-fullscreen')).toBe(false)
    })

    it('one button per block, even when two bars share it', () => {
        const block = host()
        const bar = document.createElement('div')
        block.appendChild(bar)
        addFullScreen(document, bar, block)
        addFullScreen(document, bar, block)
        expect(block.querySelectorAll('.mn-play-full').length).toBe(1)
        expect(addFullScreen(document, bar, null)).toBeFunction()
    })
})

describe('the zoom of a block in full screen (#113)', () => {
    it('is the largest that fits the screen both ways', () => {
        expect(chooseZoom((z) => ({ width: z <= 2.5, height: z <= 3 }))).toBe(2.5)
        expect(chooseZoom(() => ({ width: true, height: true }))).toBe(4)
    })

    it('a block too tall at every zoom gets bigger as long as its width fits, at most 1.5, and scrolls', () => {
        expect(chooseZoom(() => ({ width: true, height: false }))).toBe(1.5)
        expect(chooseZoom((z) => ({ width: z <= 1.25, height: false }))).toBe(1.25)
        expect(chooseZoom(() => ({ width: false, height: false }))).toBe(1)
    })
})

describe('full screen on a web page (#113)', () => {
    it('is on unless the page options say fullScreen: false', () => {
        expect(pageFullScreen(undefined)).toBe(true)
        expect(pageFullScreen({})).toBe(true)
        expect(pageFullScreen({ fullScreen: true })).toBe(true)
        expect(pageFullScreen({ fullScreen: false })).toBe(false)
    })
})
