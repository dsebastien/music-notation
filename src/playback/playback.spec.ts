import { describe, expect, it } from 'bun:test'
import {
    lengthOf,
    pianoTone,
    pluckedString,
    sequenceOf,
    type NoteEvent,
    type NotePlayer
} from './player.js'
import { renderBlock } from '../render/render-block.js'

describe('sequenceOf', () => {
    it('strums a chord low to high, then lets it ring', () => {
        const events = sequenceOf('chord', [40, 45, 52], { bpm: 90, strum: 50 })
        expect(events.map((e) => e.midi)).toEqual([40, 45, 52])
        expect(events.map((e) => e.time)).toEqual([0, 0.05, 0.1])
        // Every string stops together.
        expect(new Set(events.map((e) => +(e.time + e.duration).toFixed(6))).size).toBe(1)
    })

    it('plays a scale up and back down, one beat per note', () => {
        const events = sequenceOf('scale', [64, 60, 62], { bpm: 120, strum: 40 })
        expect(events.map((e) => e.midi)).toEqual([60, 62, 64, 62, 60])
        expect(events[1]!.time).toBe(0.5)
        expect(lengthOf(events)).toBeCloseTo(4 * 0.5 + 0.475)
    })

    it('plays nothing without notes', () => {
        expect(sequenceOf('chord', [])).toEqual([])
    })
})

describe('synthesized sound', () => {
    it('plucks a string that fades', () => {
        let seed = 1
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
        const data = pluckedString(45, 8000, 1, random)
        expect(data).toHaveLength(8000)
        const energy = (from: number, to: number) =>
            data.slice(from, to).reduce((sum, v) => sum + v * v, 0)
        expect(energy(0, 800)).toBeGreaterThan(energy(7200, 8000) * 5)
    })

    it('strikes a piano tone that fades and stays in range', () => {
        const data = pianoTone(60, 8000, 1)
        expect(Math.max(...data.map(Math.abs))).toBeLessThanOrEqual(1)
        expect(Math.abs(data[200]!)).toBeGreaterThan(0)
    })
})

/** A player that records what it's asked to play. */
function recorder() {
    const calls: { events: NoteEvent[]; sound: string; volume: number }[] = []
    const player: NotePlayer = {
        play(events, options) {
            calls.push({ events, sound: options.sound, volume: options.volume })
            return { stop() {} }
        }
    }
    return { player, calls }
}

describe('playback bar', () => {
    // On the page: a diagram that isn't stops playing.
    const host = () => document.body.appendChild(document.createElement('div'))

    it('wraps each diagram with a bar: play, loop, speed when several notes, volume, sound', () => {
        const { player } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220\n---\nD xx0232', h, { play: { player } })
        expect(h.querySelectorAll('.mn-playable')).toHaveLength(2)
        const bar = h.querySelector('.mn-play')!
        expect(bar.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe('Play')
        expect(bar.querySelector('.mn-play-loop')).not.toBeNull()
        expect(
            [...bar.querySelectorAll('input[type="range"]')].map((l) =>
                l.getAttribute('aria-label')
            )
        ).toEqual(['Strum (ms between strings)', 'Volume'])
        expect((bar.querySelector('.mn-play-sound') as HTMLSelectElement).value).toBe('guitar')
    })

    it('plays the chord, a scale, and a clicked note', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player, volume: 0.5 } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[0]!.events.map((e) => e.midi)).toEqual([45, 52, 57, 61, 64])
        expect(calls[0]!.volume).toBe(0.5)
        expect(h.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe('Stop')
        const k = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', k, { play: { player } })
        ;(k.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[1]!.sound).toBe('piano')
        expect(calls[1]!.events.map((e) => e.midi)).toEqual([
            60, 62, 64, 65, 67, 69, 71, 69, 67, 65, 64, 62, 60
        ])
        expect(k.querySelector('input[aria-label="Tempo (BPM)"]')).not.toBeNull()
        k.querySelector('[data-midi="64"]')!.dispatchEvent(new Event('click', { bubbles: true }))
        expect(calls[2]!.events).toEqual([{ midi: 64, time: 0, duration: 1.5 }])
    })

    it('plays a fretboard as a scale, from root to root', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const midis = calls[0]!.events.map((e) => e.midi)
        // From the lowest A to the highest A of the box, and back.
        expect(midis[0]).toBe(45)
        expect(Math.max(...midis)).toBe(69)
        expect(midis.length).toBe(21)
    })

    it('uses a player given later through a function', () => {
        const { player, calls } = recorder()
        let ready: NotePlayer | null = null
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player: () => ready } })
        ready = player
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls).toHaveLength(1)
    })

    it('adds no bar without the option', () => {
        const h = host()
        renderBlock('chord', 'A x02220', h)
        expect(h.querySelector('.mn-play')).toBeNull()
    })

    it('stops looping once the diagram is gone from the page', async () => {
        const { player, calls } = recorder()
        const looping: NotePlayer = {
            play(events, options) {
                const handle = player.play(events, options)
                queueMicrotask(() => options.onEnd?.())
                return handle
            }
        }
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player: looping } })
        ;(h.querySelector('.mn-play-loop') as HTMLButtonElement).click()
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        h.remove()
        await new Promise((r) => setTimeout(r, 10))
        expect(calls.length).toBeLessThanOrEqual(2)
    })

    it('falls back to the light synthesizer when the player fails', () => {
        const failing: NotePlayer = {
            play() {
                throw new Error('no soundfont')
            }
        }
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player: failing } })
        expect(() =>
            (h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        ).not.toThrow()
    })

    it('ignores values that are not numbers', () => {
        const events = sequenceOf('scale', [60, 62], { bpm: Number.NaN, strum: Number.NaN })
        expect(events[1]!.time).toBeCloseTo(60 / 90)
    })
})
