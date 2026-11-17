/** The Simplify switch on a chart's bar (#45): easier chords on a click, the written ones back. */
import { describe, expect, it } from 'bun:test'
import type { NoteEvent, NotePlayer } from './player.js'
import { renderBlock } from '../render/render-block.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

function recorder() {
    const calls: NoteEvent[][] = []
    let stops = 0
    const player: NotePlayer = {
        play(events) {
            calls.push(events)
            return {
                stop() {
                    stops++
                }
            }
        }
    }
    return { player, calls, stopped: () => stops }
}

const host = () => document.body.appendChild(document.createElement('div'))
const SONG = '[Cmaj9]Hello [G5]world [Am7]again [E9]end'
const chords = (h: Element) =>
    [...h.querySelectorAll('.mn-chord')].map((c) => c.textContent).filter((c) => c)
const button = (h: Element) => h.querySelector<HTMLButtonElement>('.mn-play-simplify')
const meta = (h: Element) => h.querySelector('.mn-chart-meta')?.textContent ?? ''

describe('the Simplify switch of a chart (#45)', () => {
    it('shows easier chords on a click and the written chords on the next one', () => {
        const h = host()
        renderBlock('chords', SONG, h, { play: {} })
        const chart = h.querySelector('.mn-chart')!
        const bar = h.querySelector('.mn-progression-play')!
        const simplify = button(h)!
        expect(simplify.textContent).toBe('Simplify')
        expect(simplify.title).toBe('Show easier chords')
        expect(simplify.getAttribute('aria-pressed')).toBe('false')
        expect(chords(h)).toEqual(['Cmaj9', 'G5', 'Am7', 'E9'])

        simplify.click()
        expect(chords(h)).toEqual(['Cmaj7', 'G', 'Am7', 'E7'])
        expect(simplify.textContent).toBe('Simplified')
        expect(simplify.title).toBe('Show the chords as written')
        expect(simplify.getAttribute('aria-pressed')).toBe('true')
        expect(simplify.classList.contains('mn-on')).toBe(true)
        expect(meta(h)).toContain('Easier chords')
        expect(chart.hasAttribute('data-mn-simplified')).toBe(true)
        // The same chart, the same bar, the same button: only the chart's content changed.
        expect(h.querySelector('.mn-chart')).toBe(chart)
        expect(h.querySelector('.mn-progression-play')).toBe(bar)
        expect(chart.lastElementChild).toBe(bar)
        expect(button(h)).toBe(simplify)
        expect(h.querySelectorAll('.mn-progression-play')).toHaveLength(1)

        simplify.click()
        expect(chords(h)).toEqual(['Cmaj9', 'G5', 'Am7', 'E9'])
        expect(simplify.textContent).toBe('Simplify')
        expect(simplify.getAttribute('aria-pressed')).toBe('false')
        expect(meta(h)).not.toContain('Easier chords')
        expect(chart.hasAttribute('data-mn-simplified')).toBe(false)
    })

    it('starts on when the chart says {simplify}', () => {
        const h = host()
        renderBlock('chords', `{simplify}\n${SONG}`, h, { play: {} })
        const simplify = button(h)!
        expect(simplify.textContent).toBe('Simplified')
        expect(simplify.getAttribute('aria-pressed')).toBe('true')
        expect(chords(h)).toEqual(['Cmaj7', 'G', 'Am7', 'E7'])
        simplify.click()
        expect(chords(h)).toEqual(['Cmaj9', 'G5', 'Am7', 'E9'])
        expect(simplify.textContent).toBe('Simplify')
    })

    it('is not there when no chord gets easier, on a piano chart, or on a progression', () => {
        const same = host()
        renderBlock('chords', '[G]Hello [C]world [Em]end', same, { play: {} })
        expect(button(same)).toBeNull()
        const piano = host()
        renderBlock('chords', `{instrument: piano}\n${SONG}`, piano, { play: {} })
        expect(button(piano)).toBeNull()
        const progression = host()
        renderBlock('progression', 'key: G\nI V vi IV', progression, { play: {} })
        expect(button(progression)).toBeNull()
    })

    it('stops what plays, then plays the chords now shown', () => {
        const { player, calls, stopped } = recorder()
        const h = host()
        renderBlock('chords', SONG, h, { play: { player } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        expect(calls).toHaveLength(1)
        button(h)!.click()
        expect(stopped()).toBe(1)
        expect(
            [...h.querySelectorAll('[data-mn-bar]')].map((b) => b.getAttribute('data-mn-chord'))
        ).toEqual(['Cmaj7', 'G', 'Am7', 'E7'])
        toggle.click()
        expect(calls).toHaveLength(2)
        // The first bar's notes are the easier chord's: Cmaj7 has no D, Cmaj9 has one.
        const first = h.querySelector('[data-mn-bar]')!
        const voicing = new Set(first.getAttribute('data-mn-voicing')!.split(' ').map(Number))
        const start = calls[1]!.filter((e) => e.kind !== 'click' && e.time < 0.5)
        expect(start.length).toBeGreaterThan(0)
        for (const e of start) expect(voicing.has(e.midi)).toBe(true)
        expect([...voicing].some((midi) => midi % 12 === 2)).toBe(false)
    })

    it('keeps what the bar is set to: the tempo, the sound, the loop', () => {
        const h = host()
        renderBlock('chords', SONG, h, { play: {} })
        const tempo = h.querySelector(
            '.mn-progression-play input[type="range"]'
        ) as HTMLInputElement
        tempo.value = '77'
        tempo.dispatchEvent(new Event('input'))
        const sound = h.querySelector('.mn-play-sound') as HTMLSelectElement
        sound.value = 'nylon'
        sound.dispatchEvent(new Event('change'))
        const loop = h.querySelector('.mn-play-loop') as HTMLButtonElement
        loop.click()
        button(h)!.click()
        expect(tempo.isConnected).toBe(true)
        expect(tempo.value).toBe('77')
        expect(sound.value).toBe('nylon')
        expect(loop.getAttribute('aria-pressed')).toBe('true')
    })

    it('draws the diagram row again, and its diagrams still play on a click', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chords', `{diagrams}\n${SONG}`, h, {
            play: { player },
            voicings: lookupGuitarVoicing
        })
        const titles = () =>
            [...h.querySelectorAll('.mn-chart-diagrams .mn-title')].map((t) => t.textContent)
        expect(titles()).toEqual(['Cmaj9', 'G5', 'Am7', 'E9'])
        button(h)!.click()
        expect(titles()).toEqual(['Cmaj7', 'G', 'Am7', 'E7'])
        const diagram = h.querySelector('.mn-chart-diagrams svg[data-mn-pitches]')!
        diagram.dispatchEvent(new Event('click', { bubbles: true }))
        expect(calls).toHaveLength(1)
        expect(calls[0]!.map((e) => e.midi).join(' ')).toBe(
            diagram.getAttribute('data-mn-pitches')!
        )
    })

    it('speaks French', () => {
        const h = host()
        renderBlock('chords', SONG, h, { play: {}, language: 'fr' })
        const simplify = button(h)!
        expect(simplify.textContent).toBe('Simplifier')
        simplify.click()
        expect(simplify.textContent).toBe('Simplifié')
        expect(meta(h)).toContain('Accords simplifiés')
    })
})
