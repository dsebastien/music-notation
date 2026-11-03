import { describe, expect, it } from 'bun:test'
import { Window as HappyWindow } from 'happy-dom'
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

    it('plays every note of a fretboard box, up and back down', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const midis = calls[0]!.events.map((e) => e.midi)
        // All 12 dots, from A2 to the top C5 (outside the roots), and back.
        const up = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72]
        expect(midis).toEqual([...up, ...up.slice(0, -1).reverse()])
    })

    it('plays the dots outside the roots of a box', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 2', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const midis = calls[0]!.events.map((e) => e.midi)
        // Box 2 has only two As (A3, A4): its 12 dots still all play.
        expect(midis.slice(0, 12)).toEqual([48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74])
        expect(midis.length).toBe(23)
    })

    it('uses a player given later through a function', () => {
        const { player, calls } = recorder()
        let ready: NotePlayer | null = null
        const h = host()
        let asked: Window | null = null
        renderBlock('chord', 'A x02220', h, {
            play: {
                player: (win) => {
                    asked = win
                    return ready
                }
            }
        })
        ready = player
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls).toHaveLength(1)
        // The diagram's window, so popouts get a player of their own.
        expect(asked === h.ownerDocument.defaultView).toBe(true)
    })

    it('asks for the player of the window the diagram is in when it plays (moved to a popout)', () => {
        const popout = new HappyWindow()
        const { player } = recorder()
        const asked: unknown[] = []
        const h = host()
        renderBlock('chord', 'A x02220', h, {
            play: {
                player: (win) => {
                    asked.push(win)
                    return player
                }
            }
        })
        // A host moves the drawn block into another window's document.
        const target = popout.document as unknown as Document
        target.body.appendChild(target.adoptNode(h))
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(asked).toHaveLength(1)
        expect(asked[0] === (popout as unknown)).toBe(true)
        void popout.happyDOM.close()
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

describe('choosing the other instrument redraws the diagram', () => {
    const host = () => document.body.appendChild(document.createElement('div'))
    const choose = (h: HTMLElement, value: 'guitar' | 'piano') => {
        const select = h.querySelector('.mn-play-sound') as HTMLSelectElement
        select.value = value
        select.dispatchEvent(new Event('change'))
    }
    const lit = (h: HTMLElement) =>
        [...h.querySelectorAll('.mn-keyboard .mn-on')].map((k) =>
            Number(k.getAttribute('data-midi'))
        )

    it('stops what plays before it switches', () => {
        let stops = 0
        const player: NotePlayer = {
            play: () => ({ stop: () => void stops++ })
        }
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: { player } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        expect(toggle.getAttribute('aria-label')).toBe('Stop')
        choose(h, 'piano')
        expect(stops).toBe(1)
        expect(toggle.getAttribute('aria-label')).toBe('Play')
        h.remove()
    })

    it('plays again on the new sound after a switch', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: { player } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        choose(h, 'piano')
        toggle.click()
        expect(calls.map((c) => c.sound)).toEqual(['guitar', 'piano'])
        h.remove()
    })

    it('plays the notes the redrawn fretboard shows', () => {
        const { player, calls } = recorder()
        const h = host()
        // C2 and C3 are below a guitar's low E: the fretboard leaves C2 out.
        renderBlock('keyboard', 'notes: C2 E3 G3', h, { play: { player } })
        choose(h, 'guitar')
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[0]!.events.map((e) => e.midi)).toEqual([52, 55, 52])
        choose(h, 'piano')
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[1]!.events.map((e) => e.midi)).toEqual([36, 52, 55, 52, 36])
        h.remove()
    })

    it('draws a fretboard as a keyboard on piano, and back on guitar', () => {
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: {} })
        const pitches = h.querySelector('.mn-fretboard')!.getAttribute('data-mn-pitches')!
        choose(h, 'piano')
        expect(h.querySelector('.mn-fretboard')).toBeNull()
        expect(lit(h).join(' ')).toBe(pitches)
        // The root keeps its color, and the title carries over.
        expect(h.querySelectorAll('.mn-keyboard .mn-root').length).toBeGreaterThan(0)
        choose(h, 'guitar')
        expect(h.querySelector('.mn-keyboard')).toBeNull()
        expect(h.querySelector('.mn-fretboard')).not.toBeNull()
        h.remove()
    })

    it('draws a guitar chord as its keys, with the title and root', () => {
        const h = host()
        renderBlock('chord', 'Am x02210', h, { play: {} })
        choose(h, 'piano')
        expect(lit(h)).toEqual([45, 52, 57, 60, 64])
        expect(h.querySelector('.mn-keyboard .mn-title')?.textContent).toBe('Am')
        expect(
            [...h.querySelectorAll('.mn-keyboard .mn-root')].map((k) => k.getAttribute('data-midi'))
        ).toEqual(['45', '57'])
        h.remove()
    })

    it('draws a keyboard as a fretboard on guitar, and a click there plays its note', () => {
        const h = host()
        const calls: number[] = []
        const player: NotePlayer = {
            play(events) {
                calls.push(...events.map((e) => e.midi))
                return { stop() {} }
            }
        }
        renderBlock('keyboard', 'C4 E4 G4', h, { play: { player } })
        choose(h, 'guitar')
        const dots = [...h.querySelectorAll('.mn-fretboard .mn-dot')]
        expect(new Set(dots.map((d) => d.getAttribute('data-midi')))).toEqual(
            new Set(['60', '64', '67'])
        )
        ;(dots[0] as SVGElement).dispatchEvent(new Event('click', { bubbles: true }))
        expect(calls).toHaveLength(1)
        h.remove()
    })

    it('keeps the chord spelling and labels: Gm is Bb, C9 keeps its 9 (review)', () => {
        const h = host()
        renderBlock('chord', 'Gm 355333', h, { play: {} })
        choose(h, 'piano')
        const names = [...h.querySelectorAll('.mn-keyboard .mn-on')].map((k) =>
            k.getAttribute('data-mn-note')
        )
        expect(names).toContain('Bb')
        expect(names).not.toContain('A#')
        const k = host()
        renderBlock('keyboard', 'chord: C9\nlabels: intervals', k, { play: {} })
        choose(k, 'guitar')
        expect(
            [...k.querySelectorAll('.mn-fretboard .mn-dot-text')].map((t) => t.textContent)
        ).toContain('9')
        h.remove()
        k.remove()
    })

    it('keeps a vertical orientation between fretboards and keyboards, and the name', () => {
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1\norientation: vertical', h, {
            play: {}
        })
        const name = h.querySelector('.mn-fretboard')!.getAttribute('aria-label')
        choose(h, 'piano')
        const keyboard = h.querySelector('.mn-keyboard')!
        expect(keyboard.getAttribute('data-mn-orientation')).toBe('vertical')
        expect(keyboard.getAttribute('aria-label')).toBe(`${name}, drawn for piano`)
        h.remove()
    })

    it('shows the drawing of a starting sound that differs from the diagram', () => {
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: { sound: 'piano' } })
        expect(h.querySelector('.mn-keyboard')).not.toBeNull()
        expect(h.querySelector('.mn-fretboard')).toBeNull()
        h.remove()
    })
})
