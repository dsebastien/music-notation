import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import type { NoteEvent, NotePlayer } from './player.js'
import { START_WAIT } from './follow.js'

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
        // No volume (#58): the app's setting.
        expect(sliders.map((s) => s.getAttribute('aria-label'))).toEqual(['Tempo (BPM)'])
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

    it("reads the app's bpm as quarters, kept at that speed in the beat a pattern counts", () => {
        const value = (src: string, bpm: number) => {
            const h = host()
            renderBlock('strum', src, h, { play: { player: recorder().player, bpm } })
            return (h.querySelector('input[aria-label="Tempo (BPM)"]') as HTMLInputElement).value
        }
        // Music Practice sends its scale tempo, 90: a 6/8 pattern at 60 dotted quarters.
        expect(value('D D U D D U\ntime: 6/8', 90)).toBe('60')
        expect(value('D DU D DU D DU D DU\ntime: 12/8', 120)).toBe('80')
        expect(value('D DU D DU D DU\ntime: 9/8', 100)).toBe('67')
        // In 6/16 the counted beat is a dotted 8th: 90 quarters a minute is 120 of them.
        expect(value('D D U D D U\ntime: 6/16\nsubdivision: 16ths', 90)).toBe('120')
        // Simple time counts its written beat: halves in 2/2, 8ths in 3/8; quarters as they are.
        expect(value('D DU UDU', 90)).toBe('90')
        expect(value('D DU DU\ntime: 3/4', 90)).toBe('90')
        expect(value('D DU UDU\ntime: cut', 90)).toBe('45')
        expect(value('D U D\ntime: 3/8', 90)).toBe('180')
        // Within the slider's range.
        expect(value('D U D\ntime: 3/8', 200)).toBe('240')
        expect(value('D DU UDU\ntime: cut', 30)).toBe('20')
        // A pattern's own tempo counts its beat as written.
        expect(value('D D U D D U\ntime: 6/8\ntempo: 72', 90)).toBe('72')
        const { player, calls } = recorder()
        const h = host()
        renderBlock('strum', 'D D U D D U\ntime: 6/8', h, { play: { player, bpm: 90 } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        // 8ths at 180 a minute, not 270: the second strum comes a third of a second in.
        const second = calls[0]!.events.find((e) => e.time > 0.1)!
        expect(second.time).toBeCloseTo(1 / 3, 6)
    })

    it('counts the tempo in dotted quarters in 6/8 (60 by default) and plays the swing', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('strum', 'D D U D D U\ntime: 6/8', h, { play: { player } })
        const tempo = h.querySelector('input[aria-label="Tempo (BPM)"]') as HTMLInputElement
        expect(tempo.value).toBe('60')
        // The value, not a ♩. glyph (#58); the tooltip says what it counts.
        expect(tempo.nextElementSibling?.textContent).toBe('60 BPM')
        expect(tempo.getAttribute('aria-description')).toBe('counts dotted quarters')
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        // 8ths at 180 a minute: beat 4 at one second.
        const starts = [...new Set(calls[0]!.events.map((e) => Math.round(e.time * 100) / 100))]
        expect(starts.some((t) => Math.abs(t - 1) < 0.001)).toBe(true)
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()

        const swung = recorder()
        const h2 = host()
        renderBlock('strum', 'D U D U D U D U\nswing: yes\ntempo: 60', h2, {
            play: { player: swung.player }
        })
        ;(h2.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        // The up strum (high E first) two thirds into the beat.
        const up = swung.calls[0]!.events.find((e) => e.time > 0.1)!
        expect(up.time).toBeCloseTo(2 / 3)
        ;(h2.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
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

    it('waits for the start of a player seen reporting it, even without reportsStart', async () => {
        let start: (() => void) | undefined
        const player: NotePlayer = {
            play(_events, options) {
                start = options.onStart
                return { stop() {} }
            }
        }
        const h = host()
        renderBlock('strum', 'D - D U - U D U\ntempo: 60', h, { play: { player } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        const lit = () =>
            [...h.querySelectorAll('.mn-playing')].map((el) => el.getAttribute('data-mn-beat'))
        toggle.click()
        start!()
        expect(lit()).toEqual(['0'])
        toggle.click()
        // Played again, nothing lights from the play call: the bar waits for the start report.
        toggle.click()
        await new Promise((resolve) => setTimeout(resolve, START_WAIT + 50))
        expect(lit()).toEqual([])
        start!()
        expect(lit()).toEqual(['0'])
        toggle.click()
    })
})
