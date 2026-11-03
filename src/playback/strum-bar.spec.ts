import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import type { NoteEvent, NotePlayer } from './player.js'

const host = () => document.body.appendChild(document.createElement('div'))

/** A player that records what it plays. */
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

describe('strum playback bar', () => {
    it('has play, loop, count-in, tempo, volume and sound', () => {
        const h = host()
        renderBlock('strum', 'D DU UDU\ntempo: 100', h, { play: { player: recorder().player } })
        const bar = h.querySelector('.mn-strum-playable .mn-play')!
        expect(bar.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe('Play')
        expect(bar.querySelector('.mn-play-loop')).not.toBeNull()
        expect(bar.querySelector('.mn-play-count')?.getAttribute('aria-label')).toBe('Count-in')
        const sliders = [...bar.querySelectorAll('input[type="range"]')] as HTMLInputElement[]
        expect(sliders.map((s) => s.getAttribute('aria-label'))).toEqual(['Tempo (BPM)', 'Volume'])
        expect(sliders[0]!.value).toBe('100')
        expect(bar.querySelector('.mn-play-sound')).not.toBeNull()
    })

    it('plays the drawn pattern over its chords, with the count-in when asked', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('strum', '[G]D - - - - - - -\ntempo: 60', h, { play: { player, volume: 0.5 } })
        ;(h.querySelector('.mn-play-count') as HTMLButtonElement).click()
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const { events, volume } = calls[0]!
        expect(volume).toBe(0.5)
        // Four clicks at 60 BPM, then G strummed low to high on beat 1.
        expect(events.slice(0, 4).map((e) => e.time)).toEqual([0, 1, 2, 3])
        expect(events.slice(4).map((e) => e.midi)).toEqual([43, 47, 50, 55, 59, 67])
        expect(events[4]!.time).toBe(4)
        expect(h.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe('Stop')
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(h.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe('Play')
    })

    it('takes the app tempo when the pattern has none', () => {
        const h = host()
        renderBlock('strum', 'D DU UDU', h, { play: { player: recorder().player, bpm: 72 } })
        expect((h.querySelector('input[aria-label="Tempo (BPM)"]') as HTMLInputElement).value).toBe(
            '72'
        )
    })

    it('lights the slot that plays, and unlights it on stop', () => {
        let start: (() => void) | undefined
        const player: NotePlayer = {
            reportsStart: true,
            play(_events, options) {
                start = options.onStart
                return { stop() {} }
            }
        }
        const h = host()
        renderBlock('strum', 'D - D U - U D U\ntempo: 60', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const lit = () =>
            [...h.querySelectorAll('.mn-playing')].map((el) => el.getAttribute('data-mn-beat'))
        // Not before the notes are heard.
        expect(lit()).toEqual([])
        start!()
        expect(lit()).toEqual(['0'])
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(lit()).toEqual([])
    })
})
