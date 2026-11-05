/**
 * The block bar (#58): one bar per block, below its diagrams; a click on a diagram plays it; play
 * all in turn; no volume on any bar (the app's setting); value labels instead of glyphs; the hand
 * cursor on what plays (#81).
 */
import { describe, expect, it } from 'bun:test'
import { Window as HappyWindow } from 'happy-dom'
import type { NoteEvent, NotePlayer } from './player.js'
import type { PlayOptions } from './controls.js'
import { renderBlock } from '../render/render-block.js'
import { STYLES } from '../styles.js'
import { renderAll } from '../publish/index.js'
import { accessibleName } from '../render/dom.js'

/** A player that records what it's asked to play, and lets a test end each play. */
function recorder() {
    const calls: {
        events: NoteEvent[]
        sound: string
        volume: number
        end: () => void
        stopped: boolean
    }[] = []
    const player: NotePlayer = {
        play(events, options) {
            const call = {
                events,
                sound: options.sound,
                volume: options.volume,
                end: () => options.onEnd?.(),
                stopped: false
            }
            calls.push(call)
            return {
                stop() {
                    call.stopped = true
                }
            }
        }
    }
    return { player, calls }
}

/** Ends each play as soon as it starts. */
function quick() {
    const { player, calls } = recorder()
    const ending: NotePlayer = {
        play(events, options) {
            const handle = player.play(events, options)
            queueMicrotask(() => options.onEnd?.())
            return handle
        }
    }
    return { player: ending, calls }
}

const host = () => document.body.appendChild(document.createElement('div'))
const midis = (events: NoteEvent[]) => events.map((e) => e.midi)
const click = (el: Element) => el.dispatchEvent(new Event('click', { bubbles: true }))
const key = (el: Element, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const row = 'A x02220\n---\nD xx0232\n---\nE 022100'

describe('one bar per block, below it (#58)', () => {
    it('gives a row one bar, after the row, outside the diagrams', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        const bars = el.querySelectorAll('.mn-play')
        expect(bars).toHaveLength(1)
        const bar = bars[0]!
        expect(bar.classList.contains('mn-block-bar')).toBe(true)
        expect(bar.classList.contains('mn-play-static')).toBe(true)
        expect(bar.closest('.mn-playable')).toBeNull()
        expect(el.querySelector('.mn-row')!.nextElementSibling).toBe(bar)
        expect(el.querySelectorAll('.mn-playable')).toHaveLength(3)
        // The first diagram is selected from the start: the one the bar plays.
        expect([...el.querySelectorAll('.mn-selected')]).toEqual([
            el.querySelector('.mn-playable')!
        ])
        h.remove()
    })

    it('gives a single diagram a bar too, below it, without a name or play all', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220', h, { play: { player } })
        const bar = el.querySelector('.mn-play')!
        expect(el.lastElementChild).toBe(bar)
        expect(el.querySelector('.mn-playable')!.nextElementSibling).toBe(bar)
        expect(bar.querySelector('.mn-play-all')).toBeNull()
        expect(bar.querySelector('.mn-play-name')).toBeNull()
        h.remove()
    })

    it('has play, play all, the name, loop, speed and sound; never a volume', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        const bar = el.querySelector('.mn-play')!
        expect(bar.getAttribute('role')).toBe('group')
        expect(bar.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe('Play')
        expect(bar.querySelector('.mn-play-all')?.getAttribute('aria-label')).toBe(
            'Play all in turn'
        )
        expect(bar.querySelector('.mn-play-name')?.textContent).toBe('A')
        expect(bar.querySelector('.mn-play-loop')).not.toBeNull()
        expect(
            [...bar.querySelectorAll('input[type="range"]')]
                .filter((i) => !(i.closest('.mn-play-field') as HTMLElement).hidden)
                .map((i) => i.getAttribute('aria-label'))
        ).toEqual(['Strum (ms between strings)'])
        expect(bar.querySelector('input[aria-label="Volume"]')).toBeNull()
        expect((bar.querySelector('.mn-play-sound') as HTMLSelectElement).value).toBe('guitar')
        h.remove()
    })

    it("plays at the app's volume, read at each play when it's a function", () => {
        const { player, calls } = recorder()
        let volume = 0.2
        const h = host()
        renderBlock('chord', 'A x02220', h, {
            play: { player, volume: () => volume } as PlayOptions
        })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        toggle.click()
        volume = 0.7
        toggle.click()
        expect(calls.map((c) => c.volume)).toEqual([0.2, 0.7])
        const k = host()
        renderBlock('chord', 'A x02220', k, { play: { player, volume: 0.5 } })
        ;(k.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[2]!.volume).toBe(0.5)
        h.remove()
        k.remove()
    })

    it('keeps the volume in range when the function fails or returns nonsense', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, {
            play: {
                player,
                volume: () => {
                    throw new Error('gone')
                }
            } as PlayOptions
        })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const k = host()
        renderBlock('chord', 'A x02220', k, { play: { player, volume: () => 7 } as PlayOptions })
        ;(k.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls.map((c) => c.volume)).toEqual([0.8, 1])
        h.remove()
        k.remove()
    })
})

describe('the speed shows its value, not a glyph', () => {
    it('labels the tempo of a scale "90 BPM" and follows the slider', () => {
        const { player } = recorder()
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h, { play: { player } })
        const input = h.querySelector('input[aria-label="Tempo (BPM)"]') as HTMLInputElement
        const value = input.closest('.mn-play-field')!.querySelector('.mn-play-value')!
        expect(value.textContent).toBe('90 BPM')
        expect(input.getAttribute('aria-valuetext')).toBe('90 BPM')
        input.value = '120'
        input.dispatchEvent(new Event('input'))
        expect(value.textContent).toBe('120 BPM')
        expect(input.getAttribute('aria-valuetext')).toBe('120 BPM')
        h.remove()
    })

    it('labels the strum of a chord "12 ms"', () => {
        const { player } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player } })
        const input = h.querySelector('input[aria-label^="Strum"]') as HTMLInputElement
        expect(input.closest('.mn-play-field')!.querySelector('.mn-play-value')!.textContent).toBe(
            '12 ms'
        )
        h.remove()
    })

    it('draws no ♩ or ≋ glyph in any bar', () => {
        const { player } = recorder()
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h, { play: { player } })
        renderBlock('chord', 'A x02220', h, { play: { player } })
        renderBlock('strum', 'D DU UDU', h, { play: { player } })
        renderBlock('strum', 'time: 6/8\nD DU D DU', h, { play: { player } })
        renderBlock('picking', 'pattern: travis\nchords: C Am F G', h, { play: { player } })
        renderBlock('progression', 'key: C\nI IV V', h, { play: { player } })
        renderBlock('chords', '[C]Hello [G]world', h, { play: { player } })
        const bars = [...h.querySelectorAll('.mn-play')]
        expect(bars.length).toBe(7)
        for (const bar of bars) {
            expect(bar.textContent).not.toMatch(/[♩≋]/)
            for (const input of bar.querySelectorAll('input[type="range"]'))
                expect(input.getAttribute('aria-valuetext')).toMatch(/^\d+ (BPM|ms)$/)
        }
        h.remove()
    })
})

describe('a click on a diagram plays it (#58)', () => {
    it('selects the clicked diagram and plays it at once; a second click stops it', () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        const [, d] = [...el.querySelectorAll('.mn-playable')]
        click(d!.querySelector('svg')!)
        expect(midis(calls[0]!.events)).toEqual([50, 57, 62, 66])
        expect(d!.classList.contains('mn-selected')).toBe(true)
        expect(d!.getAttribute('aria-current')).toBe('true')
        expect(el.querySelectorAll('.mn-selected')).toHaveLength(1)
        expect(el.querySelector('.mn-play-name')!.textContent).toBe('D')
        const toggle = el.querySelector('.mn-play-toggle')!
        expect(toggle.getAttribute('aria-label')).toBe('Stop')
        click(d!.querySelector('svg')!)
        expect(calls[0]!.stopped).toBe(true)
        expect(calls).toHaveLength(1)
        expect(toggle.getAttribute('aria-label')).toBe('Play')
        h.remove()
    })

    it("plays a dot's note only, and selects its diagram", () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        const e = el.querySelectorAll('.mn-playable')[2]!
        click(e.querySelector('[data-midi="47"]')!)
        expect(calls).toHaveLength(1)
        expect(calls[0]!.events).toEqual([{ midi: 47, time: 0, duration: 1.5 }])
        expect(e.classList.contains('mn-selected')).toBe(true)
        h.remove()
    })

    it('plays the selected diagram from the bar (the first at the start)', async () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        const toggle = el.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        expect(midis(calls[0]!.events)).toEqual([45, 52, 57, 61, 64])
        toggle.click()
        click(el.querySelectorAll('.mn-playable')[1]!.querySelector('svg')!)
        calls[1]!.end()
        // The end is handled once the player's call returned.
        await Promise.resolve()
        toggle.click()
        expect(midis(calls[2]!.events)).toEqual([50, 57, 62, 66])
        h.remove()
    })

    it('plays one thing per block: a new play stops the one before', () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        ;(el.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        click(el.querySelectorAll('.mn-playable')[1]!.querySelector('svg')!)
        expect(calls[0]!.stopped).toBe(true)
        click(el.querySelectorAll('.mn-playable')[2]!.querySelector('[data-midi="47"]')!)
        expect(calls[1]!.stopped).toBe(true)
        h.remove()
    })

    it('makes each diagram a button: Space or Enter plays it, Escape stops', () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        const wraps = [...el.querySelectorAll('.mn-playable')]
        for (const w of wraps) {
            expect(w.getAttribute('tabindex')).toBe('0')
            expect(w.getAttribute('role')).toBe('button')
        }
        expect(accessibleName(wraps[1]!)).toMatch(/^Play D/)
        key(wraps[1]!, 'Enter')
        expect(midis(calls[0]!.events)).toEqual([50, 57, 62, 66])
        key(wraps[1]!, 'Escape')
        expect(calls[0]!.stopped).toBe(true)
        key(wraps[2]!, ' ')
        expect(midis(calls[1]!.events)).toEqual([40, 47, 52, 56, 59, 64])
        expect(wraps[2]!.classList.contains('mn-selected')).toBe(true)
        // Other keys are the page's.
        expect(key(wraps[0]!, 'a')).toBe(true)
        h.remove()
    })

    it('keeps a press on a diagram or on the bar from the page (live preview opens the source)', () => {
        const { player } = recorder()
        const h = host()
        let reached = 0
        h.addEventListener('mousedown', () => reached++)
        renderBlock('chord', row, h, { play: { player } })
        h.querySelector('svg')!.dispatchEvent(new Event('mousedown', { bubbles: true }))
        h.querySelector('.mn-play-toggle')!.dispatchEvent(new Event('mousedown', { bubbles: true }))
        expect(reached).toBe(0)
        h.remove()
    })

    it('selects nothing in a block of one diagram (the outline is for rows)', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220', h, { play: { player } })
        click(el.querySelector('svg')!)
        expect(el.querySelector('.mn-selected')).toBeNull()
        h.remove()
    })
})

describe('play all in turn (#58)', () => {
    it('plays each diagram once, a beat apart, then stops; the selection follows', async () => {
        const { player, calls } = quick()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220\n---\nD xx0232', h, {
            play: { player, bpm: 240 }
        })
        const all = el.querySelector('.mn-play-all') as HTMLButtonElement
        const t0 = performance.now()
        all.click()
        expect(calls).toHaveLength(1)
        expect(midis(calls[0]!.events)).toEqual([45, 52, 57, 61, 64])
        expect(el.querySelector('.mn-play-toggle')!.getAttribute('aria-label')).toBe('Stop')
        await wait(150)
        // The pause: one beat at 240 BPM is 250 ms.
        expect(calls).toHaveLength(1)
        await wait(200)
        expect(calls).toHaveLength(2)
        expect(performance.now() - t0).toBeGreaterThanOrEqual(240)
        expect(midis(calls[1]!.events)).toEqual([50, 57, 62, 66])
        expect(el.querySelectorAll('.mn-playable')[1]!.classList.contains('mn-selected')).toBe(true)
        await wait(400)
        expect(calls).toHaveLength(2)
        expect(el.querySelector('.mn-play-toggle')!.getAttribute('aria-label')).toBe('Play')
        h.remove()
    })

    it('starts over after the last with loop on, until stopped', async () => {
        const { player, calls } = quick()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220\n---\nD xx0232', h, {
            play: { player, bpm: 240 }
        })
        ;(el.querySelector('.mn-play-loop') as HTMLButtonElement).click()
        ;(el.querySelector('.mn-play-all') as HTMLButtonElement).click()
        await wait(600)
        expect(calls.length).toBeGreaterThanOrEqual(3)
        expect(midis(calls[2]!.events)).toEqual([45, 52, 57, 61, 64])
        ;(el.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const count = calls.length
        await wait(400)
        expect(calls.length).toBe(count)
        h.remove()
    })

    it('stops once the block leaves the page', async () => {
        const { player, calls } = quick()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220\n---\nD xx0232', h, {
            play: { player, bpm: 240 }
        })
        ;(el.querySelector('.mn-play-all') as HTMLButtonElement).click()
        h.remove()
        await wait(400)
        expect(calls).toHaveLength(1)
    })

    it('stops on destroy', async () => {
        const { player, calls } = quick()
        const h = host()
        const result = renderBlock('chord', 'A x02220\n---\nD xx0232', h, {
            play: { player, bpm: 240 }
        })
        ;(result.el.querySelector('.mn-play-all') as HTMLButtonElement).click()
        result.destroy()
        await wait(400)
        expect(calls).toHaveLength(1)
        h.remove()
    })
})

describe('the sound switch redraws the whole block', () => {
    const choose = (h: Element, value: 'guitar' | 'piano') => {
        const select = h.querySelector('.mn-play-sound') as HTMLSelectElement
        select.value = value
        select.dispatchEvent(new Event('change'))
    }

    it('draws every diagram of a row for piano, and back for guitar', () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        choose(el, 'piano')
        expect(el.querySelectorAll('.mn-keyboard')).toHaveLength(3)
        expect(el.querySelectorAll('.mn-guitar-chord')).toHaveLength(0)
        click(el.querySelectorAll('.mn-playable')[1]!.querySelector('svg')!)
        expect(calls[0]!.sound).toBe('piano')
        choose(el, 'guitar')
        expect(el.querySelectorAll('.mn-guitar-chord')).toHaveLength(3)
        h.remove()
    })

    it('shows the speed of the selected diagram in a mixed row', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('keyboard', 'chord: C\n---\nscale: C major', h, {
            play: { player }
        })
        const shown = () =>
            [...el.querySelectorAll('.mn-play-field')]
                .filter((f) => !(f as HTMLElement).hidden)
                .map((f) => f.querySelector('input')!.getAttribute('aria-label'))
        expect(shown()).toEqual(['Strum (ms between strings)'])
        click(el.querySelectorAll('.mn-playable')[1]!.querySelector('svg')!)
        expect(shown()).toEqual(['Tempo (BPM)'])
        h.remove()
    })
})

describe('the other bars sit below and have no volume', () => {
    it('puts a strumming pattern’s bar below it, always shown', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('strum', 'D DU UDU', h, { play: { player } })
        const bar = el.querySelector('.mn-play')!
        expect(bar.classList.contains('mn-play-static')).toBe(true)
        expect(el.querySelector('svg.mn-strum')!.nextElementSibling).toBe(bar)
        expect(bar.querySelector('input[aria-label="Volume"]')).toBeNull()
        h.remove()
    })

    it('puts a picking pattern’s bar below it', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('picking', 'pattern: travis\nchords: C Am F G', h, {
            play: { player }
        })
        const bar = el.querySelector('.mn-play')!
        expect(bar.classList.contains('mn-play-static')).toBe(true)
        expect(el.querySelector('svg.mn-picking')!.nextElementSibling).toBe(bar)
        expect(bar.querySelector('input[aria-label="Volume"]')).toBeNull()
        h.remove()
    })

    it('gives a progression one bar, below its chords; its diagrams play on a click', () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('progression', 'key: C\nI IV V', h, { play: { player } })
        const bars = el.querySelectorAll('.mn-play')
        expect(bars).toHaveLength(1)
        const drawing = el.querySelector('[data-mn-progression-play]')!
        expect(drawing.lastElementChild).toBe(bars[0]!)
        expect(bars[0]!.querySelector('input[aria-label="Volume"]')).toBeNull()
        const second = el.querySelectorAll('.mn-playable')[1]!
        expect(second.getAttribute('role')).toBe('button')
        click(second.querySelector('svg')!)
        expect(midis(calls[0]!.events)).toEqual([41, 48, 53, 57, 60, 65])
        h.remove()
    })

    it("plays a progression's diagrams on the sound its bar chose", () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('progression', 'key: C\nI IV V', h, { play: { player } })
        const select = el.querySelector('.mn-play-sound') as HTMLSelectElement
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        click(el.querySelectorAll('.mn-playable')[0]!.querySelector('svg')!)
        expect(calls[0]!.sound).toBe('piano')
        // Not redrawn: a progression's cells keep the block's drawing.
        expect(el.querySelectorAll('.mn-guitar-chord')).toHaveLength(3)
        // No selection either: no bar plays a selected diagram in a progression.
        expect(el.querySelector('.mn-selected, [aria-current]')).toBeNull()
        h.remove()
    })

    it("puts a chart's bar below its chords", () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('chords', '[C]Hello [G]world', h, { play: { player } })
        const chart = el.querySelector('.mn-chart')!
        expect(chart.lastElementChild!.classList.contains('mn-play')).toBe(true)
        h.remove()
    })

    it('plays the strum and the progression at the app volume', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('strum', 'D DU UDU', h, { play: { player, volume: 0.3 } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[0]!.volume).toBeCloseTo(0.3)
        h.remove()
    })
})

describe('the fretboard exercise keeps its tab after the bar', () => {
    it('puts the bar between the fretboard and the tab', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nposition: 1\nexercise: up-down',
            h,
            { play: { player } }
        )
        const bar = el.querySelector('.mn-block-bar')!
        expect(bar.previousElementSibling!.classList.contains('mn-playable')).toBe(true)
        expect(bar.nextElementSibling!.matches('pre.mn-exercise')).toBe(true)
        h.remove()
    })
})

describe('the hand cursor (#81)', () => {
    /** The stylesheet's rules that set a cursor, as [selector, value]. */
    const cursorRules = () =>
        [...STYLES.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
            .map(([, selector, body]) => [selector!.trim(), body!] as const)
            .filter(([, body]) => /\bcursor\s*:/.test(body))
            .map(([selector, body]) => [selector, /\bcursor\s*:\s*([^;]+)/.exec(body)![1]!.trim()])

    it('sets the hand without !important, under .mn-block so it outranks host rules', () => {
        expect(STYLES.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('!important')
        const pointers = cursorRules().filter(([, value]) => value === 'pointer')
        expect(pointers.length).toBeGreaterThan(0)
        for (const [selector] of pointers)
            for (const one of selector!.split(','))
                expect(one.trim()).toMatch(/^(\.mn-block )?\.mn-(playable|play)\b/)
    })

    it('covers diagrams, notes, buttons, selects and sliders', () => {
        const selectors = cursorRules()
            .filter(([, value]) => value === 'pointer')
            .flatMap(([selector]) => selector!.split(',').map((s) => s.trim()))
        for (const wanted of [
            '.mn-block .mn-playable',
            '.mn-playable',
            '.mn-play button',
            '.mn-block .mn-play button',
            '.mn-block .mn-play select',
            ".mn-block .mn-play input[type='range']"
        ])
            expect(selectors).toContain(wanted)
    })

    it('leaves diagrams without playback to the arrow (no .mn-playable)', () => {
        const h = host()
        const { el } = renderBlock('chord', row, h)
        expect(el.querySelector('.mn-playable')).toBeNull()
        expect(el.querySelector('[role="button"]')).toBeNull()
        h.remove()
    })
})

describe('Publish draws a block with its bar once', () => {
    it("doesn't redraw a block for its bar", () => {
        const page = host()
        page.innerHTML = `<pre><code class="language-chord">${row}</code></pre>`
        expect(renderAll(page, { play: {} })).toBe(1)
        const pre = page.querySelector('pre')!
        const block = pre.nextElementSibling!
        expect(block.classList.contains('mn-block')).toBe(true)
        expect(block.querySelectorAll('.mn-block-bar')).toHaveLength(1)
        expect(renderAll(page, { play: {} })).toBe(0)
        expect(pre.nextElementSibling).toBe(block)
        page.remove()
    })
})

describe('review findings (#58)', () => {
    /** The CSS declarations of the rule with exactly this selector. */
    const ruleOf = (selector: string) => {
        const css = STYLES.replace(/\/\*[\s\S]*?\*\//g, '')
        for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
            if (sel!.split(',').some((s) => s.trim() === selector)) return body!
        return ''
    }

    it('draws the focus ring as an outline over the drawing, kept in forced colors', () => {
        expect(ruleOf('.mn-playable:focus-visible')).toMatch(/outline:\s*2px solid/)
        expect(ruleOf('.mn-playable:focus-visible')).toMatch(/outline-offset:\s*-2px/)
        expect(ruleOf('.mn-playable')).not.toMatch(/outline:\s*none/)
        expect(ruleOf('.mn-playable.mn-selected')).toMatch(/outline:/)
        expect(ruleOf('.mn-playable.mn-selected')).not.toMatch(/box-shadow/)
    })

    it('stops the progression on Escape on one of its diagrams', () => {
        const { player, calls } = recorder()
        const h = host()
        const { el } = renderBlock('progression', 'key: C\nI IV V', h, { play: { player } })
        const toggle = el.querySelector('.mn-progression-play .mn-play-toggle')!
        ;(toggle as HTMLButtonElement).click()
        expect(toggle.getAttribute('aria-label')).toBe('Stop')
        const handles = calls.length
        expect(handles).toBeGreaterThan(0)
        const wrap = el.querySelector('.mn-playable')!
        expect(key(wrap, 'Escape')).toBe(false)
        expect(toggle.getAttribute('aria-label')).toBe('Play in time')
        h.remove()
    })

    it('names each diagram without aria-label (Obsidian shows a tooltip for one)', () => {
        const { player } = recorder()
        const h = host()
        const { el } = renderBlock('chord', row, h, { play: { player } })
        for (const wrap of el.querySelectorAll('.mn-playable')) {
            expect(wrap.hasAttribute('aria-label')).toBe(false)
            const id = wrap.getAttribute('aria-labelledby')!
            const name = [...wrap.querySelectorAll('[id]')].find((n) => n.id === id)
            expect(name?.textContent).toMatch(/^Play /)
            expect((name as HTMLElement).hidden).toBe(true)
        }
        const ids = [...el.querySelectorAll('.mn-playable')].map((w) =>
            w.getAttribute('aria-labelledby')
        )
        expect(new Set(ids).size).toBe(3)
        h.remove()
    })

    it('plays no note once destroyed, as it plays no diagram', () => {
        const { player, calls } = recorder()
        const h = host()
        const result = renderBlock('chord', 'A x02220', h, { play: { player } })
        const el = result.el
        result.destroy()
        h.appendChild(el)
        click(el.querySelector('[data-midi="57"]')!)
        click(el.querySelector('svg')!)
        expect(calls).toHaveLength(0)
        h.remove()
    })

    it('keeps its state with a player that ends inside play()', async () => {
        const calls: number[] = []
        const sync: NotePlayer = {
            play(events, options) {
                calls.push(events.length)
                options.onEnd?.()
                return { stop() {} }
            }
        }
        const h = host()
        const { el } = renderBlock('chord', 'A x02220', h, { play: { player: sync } })
        const toggle = el.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        await wait(5)
        // It ended: the toggle says Play again, not a stuck Stop.
        expect(toggle.getAttribute('aria-label')).toBe('Play')
        // With loop on, each pass waits for the page: no runaway recursion.
        ;(el.querySelector('.mn-play-loop') as HTMLButtonElement).click()
        toggle.click()
        expect(calls.length).toBe(2)
        await wait(30)
        expect(toggle.getAttribute('aria-label')).toBe('Stop')
        toggle.click()
        const count = calls.length
        await wait(30)
        expect(calls.length).toBe(count)
        h.remove()
    })

    it('waits between diagrams on the window the diagram is in now', async () => {
        const { player, calls } = quick()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220\n---\nD xx0232', h, {
            play: { player, bpm: 240 }
        })
        // Another window: its own timers (a popout).
        const other = new HappyWindow() as unknown as Window
        const timers: number[] = []
        const setTimeoutOf = other.setTimeout.bind(other)
        other.setTimeout = ((fn: () => void, ms: number) => {
            timers.push(ms)
            return setTimeoutOf(fn, ms)
        }) as typeof other.setTimeout
        const moved = other.document.body.appendChild(other.document.adoptNode(el))
        ;(moved.querySelector('.mn-play-all') as HTMLButtonElement).click()
        await wait(20)
        expect(timers).toContain(250)
        await wait(350)
        expect(calls).toHaveLength(2)
        ;(moved.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        h.remove()
    })
})
