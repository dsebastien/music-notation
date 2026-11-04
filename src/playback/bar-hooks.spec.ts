import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import type { NotationLanguage } from '../blocks/renderers.js'
import type { NotePlayer } from './player.js'
import type { TimedBar } from './controls.js'

const host = () => document.body.appendChild(document.createElement('div'))
const player: NotePlayer = { play: () => ({ stop() {} }) }

/** Renders a block and collects the timed bars handed to the app. */
function bars(language: NotationLanguage, source: string) {
    const h = host()
    const seen: TimedBar[] = []
    const result = renderBlock(language, source, h, {
        play: { player, timedBar: (bar) => void seen.push(bar) }
    })
    return { h, seen, result }
}

const tempoSlider = (bar: TimedBar) =>
    bar.element.querySelector<HTMLInputElement>('input[aria-label="Tempo (BPM)"]')!

const slide = (input: HTMLInputElement, value: number) => {
    input.value = String(value)
    input.dispatchEvent(new Event('input'))
}

describe('timed play bars for apps (#77)', () => {
    it('hands each strum bar to the app with its kind, drawing and tempo', () => {
        const { seen, h } = bars('strum', 'D DU UDU\ntempo: 100')
        expect(seen).toHaveLength(1)
        const bar = seen[0]!
        expect(bar.kind).toBe('strum')
        expect(bar.element).toBe(h.querySelector<HTMLElement>('.mn-strum-playable .mn-play')!)
        expect(bar.drawing).toBe(h.querySelector('svg[data-mn-strum]')!)
        expect(bar.tempo()).toBe(100)
        expect(bar.compound).toBe(false)
    })

    it('tells the tempo set on the bar, and each change to listeners until they stop', () => {
        const { seen } = bars('strum', 'D DU UDU\ntempo: 100')
        const bar = seen[0]!
        const heard: number[] = []
        const stop = bar.onTempo((bpm) => heard.push(bpm))
        slide(tempoSlider(bar), 120)
        expect(bar.tempo()).toBe(120)
        expect(heard).toEqual([120])
        stop()
        slide(tempoSlider(bar), 90)
        expect(bar.tempo()).toBe(90)
        expect(heard).toEqual([120])
    })

    it('counts dotted beats in compound time', () => {
        const { seen } = bars('strum', 'D DU D DU\ntime: 6/8\ntempo: 60')
        expect(seen[0]!.compound).toBe(true)
        expect(seen[0]!.tempo()).toBe(60)
    })

    it('hands picking, progression and chart bars too, each with its kind', () => {
        expect(
            bars('picking', 'pattern: travis\nchord: C\ntempo: 70').seen.map((b) => b.kind)
        ).toEqual(['picking'])
        const progression = bars('progression', 'key: G\nI V vi IV\ntempo: 96').seen
        expect(progression.map((b) => b.kind)).toEqual(['progression'])
        expect(progression[0]!.tempo()).toBe(96)
        const chart = bars('chords', '{tempo: 84}\n[G]Hello [C]world').seen
        expect(chart.map((b) => b.kind)).toEqual(['chart'])
        expect(chart[0]!.tempo()).toBe(84)
    })

    it("puts the app's controls after the bar's own, in their own slot", () => {
        const { seen } = bars('picking', 'pattern: travis\nchord: C')
        const bar = seen[0]!
        const button = document.createElement('button')
        button.textContent = 'Save BPM'
        bar.add(button)
        const slot = bar.element.lastElementChild!
        expect(slot.classList.contains('mn-play-app')).toBe(true)
        expect(slot.lastElementChild).toBe(button)
        // Focus order: play first, the app's controls last.
        const focusable = [...bar.element.querySelectorAll('button, input, select')]
        expect(focusable[0]!.classList.contains('mn-play-toggle')).toBe(true)
        expect(focusable.at(-1)).toBe(button)
    })

    it('calls what the app returns when the block is destroyed', () => {
        const h = host()
        let freed = 0
        const result = renderBlock('progression', 'key: C\nI IV V I', h, {
            play: { player, timedBar: () => () => void freed++ }
        })
        expect(freed).toBe(0)
        result.destroy()
        expect(freed).toBe(1)
    })

    it('keeps the bar when the app throws, and changes nothing without a hook', () => {
        const h = host()
        const result = renderBlock('strum', 'D DU UDU', h, {
            play: {
                player,
                timedBar: () => {
                    throw new Error('app bug')
                }
            }
        })
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-strum-playable .mn-play .mn-play-toggle')).not.toBeNull()
        const plain = host()
        renderBlock('strum', 'D DU UDU', plain, { play: { player } })
        expect(plain.querySelector('.mn-play-app')).toBeNull()
    })
})
