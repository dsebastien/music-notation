import { describe, expect, it } from 'bun:test'
import { Window as HappyWindow } from 'happy-dom'
import {
    lengthOf,
    pianoTone,
    pluckedString,
    scaleRun,
    sequenceOf,
    type NoteEvent,
    type NotePlayer
} from './player.js'
import { renderBlock } from '../render/render-block.js'
import { strumsOf } from './controls.js'

describe('sequenceOf', () => {
    it('strums a chord low to high, then lets it ring', () => {
        const events = sequenceOf('chord', [40, 45, 52], { bpm: 90, strum: 50 })
        expect(events.map((e) => e.midi)).toEqual([40, 45, 52])
        expect(events.map((e) => e.time)).toEqual([0, 0.05, 0.1])
        // Every string stops together.
        expect(new Set(events.map((e) => +(e.time + e.duration).toFixed(6))).size).toBe(1)
    })

    it('plays a scale up and back down, one beat per note, legato', () => {
        const events = sequenceOf('scale', [64, 60, 62], { bpm: 120, strum: 40 })
        expect(events.map((e) => e.midi)).toEqual([60, 62, 64, 62, 60])
        expect(events[1]!.time).toBe(0.5)
        // Each note lasts until the next (no hard stop before it).
        expect(events.every((e) => e.duration === 0.5)).toBe(true)
        expect(lengthOf(events)).toBeCloseTo(5 * 0.5)
    })

    it('runs a scale from its tonic: up to the top, down to the bottom, back to the tonic', () => {
        // D dorian drawn from C4 to D5.
        const drawn = [60, 62, 64, 65, 67, 69, 71, 72, 74]
        expect(scaleRun(drawn, 2)).toEqual([
            62, 64, 65, 67, 69, 71, 72, 74, 72, 71, 69, 67, 65, 64, 62, 60, 62
        ])
        // Tonic at the bottom: up and back down; no tonic drawn, or none given: from the bottom.
        expect(scaleRun([60, 64, 67, 72], 0)).toEqual([60, 64, 67, 72, 67, 64, 60])
        expect(scaleRun([60, 64, 67], 2)).toEqual([60, 64, 67, 64, 60])
        expect(scaleRun([67, 60, 64])).toEqual([60, 64, 67, 64, 60])
        expect(scaleRun([62], 2)).toEqual([62])
        expect(sequenceOf('scale', drawn, { bpm: 60, strum: 0, root: 2 })[0]!.midi).toBe(62)
    })

    it('shapes the touch: a guitar strum leans on the bass, a piano sings its top note (#59)', () => {
        const strum = sequenceOf('chord', [40, 45, 50, 55, 59, 64], { bpm: 90, strum: 12 })
        expect(strum.map((e) => e.velocity)).toEqual([100, 98, 96, 94, 92, 90])
        const block = sequenceOf('chord', [48, 64, 67, 72], { bpm: 90, strum: 0, sound: 'piano' })
        expect(block.map((e) => e.velocity)).toEqual([92, 84, 84, 100])
        expect(sequenceOf('chord', [60], { bpm: 90, strum: 0 })[0]!.velocity).toBe(100)
    })

    it('accents the first note and the tonics of a run, softer passing notes (#59)', () => {
        const run = sequenceOf('scale', [60, 62, 64, 65, 67, 69, 71, 72], {
            bpm: 90,
            strum: 0,
            root: 0
        })
        expect(run.map((e) => e.velocity)).toEqual([
            100, 86, 86, 86, 86, 86, 86, 94, 86, 86, 86, 86, 86, 86, 94
        ])
        // C major over a G chord: chord tones 90, passing notes 80.
        const over = sequenceOf('scale', [60, 62, 64, 65, 67, 69, 71], {
            bpm: 90,
            strum: 0,
            root: 0,
            tones: [7, 11, 2]
        })
        expect(over.slice(0, 7).map((e) => e.velocity)).toEqual([100, 90, 80, 80, 90, 80, 90])
    })

    it('plays nothing without notes', () => {
        expect(sequenceOf('chord', [])).toEqual([])
    })
})

describe('synthesized sound', () => {
    it('plucks softer or brighter, at the pick position given, within range', () => {
        const seeded = () => {
            let seed = 3
            return () => (seed = (seed * 16807) % 2147483647) / 2147483647
        }
        const bright = pluckedString(57, 8000, 0.5, seeded())
        const dark = pluckedString(57, 8000, 0.5, seeded(), { brightness: 0.3, pick: 0.15 })
        expect(Math.max(...dark.map(Math.abs))).toBeLessThanOrEqual(0.5)
        // A darker pluck changes less from one sample to the next.
        const roughness = (data: Float32Array) =>
            data.slice(1, 400).reduce((sum, v, i) => sum + Math.abs(v - data[i]!), 0)
        expect(roughness(dark)).toBeLessThan(roughness(bright))
    })

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

    it('plays the mark around a clicked hit area (#69)', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player } })
        // Inside the open A string's circle, where only its hit area is.
        const open = h.querySelector('.mn-open[data-midi="45"]')!
        const hit = open.closest('.mn-mark')!.querySelector('.mn-hit')!
        hit.dispatchEvent(new Event('click', { bubbles: true }))
        expect(calls[0]!.events).toEqual([{ midi: 45, time: 0, duration: 1.5 }])
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
        // Box 2 starts on C3, below its first A (A3): the run starts on A3, goes up to the top
        // D5, down to C3, and back up to A3. Its 12 dots all play.
        const up = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74]
        expect(midis).toEqual([...up.slice(4), ...up.slice(0, -1).reverse(), 50, 52, 55, 57])
        expect(new Set(midis).size).toBe(12)
    })

    it('starts a keyboard scale on its tonic, and every mode on its own (#61)', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('keyboard', 'D dorian', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const midis = calls[0]!.events.map((e) => e.midi)
        // Drawn tonic to tonic, D4 to D6: up to D6 and back down to D4.
        expect(midis[0]).toBe(62)
        expect(midis.at(-1)).toBe(62)
        expect(Math.max(...midis)).toBe(86)
        expect(Math.min(...midis)).toBe(62)
        expect(midis).toHaveLength(15 + 14)
        // A black key tonic: F# major drawn from F4, played F#4 up to F#6 and back (no E#4).
        const f = host()
        renderBlock('keyboard', 'F# major', f, { play: { player } })
        ;(f.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const run = calls.at(-1)!.events.map((e) => e.midi)
        expect([run[0], Math.max(...run), Math.min(...run), run.at(-1)]).toEqual([66, 90, 66, 66])
        const m = host()
        renderBlock('keyboard', 'modes: C major\nrange: C4-B4', m, { play: { player } })
        const firsts = [...m.querySelectorAll('.mn-play-toggle')].map((button) => {
            ;(button as HTMLButtonElement).click()
            const events = calls.at(-1)!.events
            return [events[0]!.midi, events.at(-1)!.midi, events.length]
        })
        // C ionian, D dorian, E phrygian… each from its own tonic, back to it, all 7 notes.
        expect(firsts.map(([first]) => first)).toEqual([60, 62, 64, 65, 67, 69, 71])
        expect(firsts.every(([first, last]) => first === last)).toBe(true)
        expect(new Set(calls.at(-1)!.events.map((e) => e.midi)).size).toBe(7)
    })

    it('plays one voicing of a keyboard chord, the keys it lights (#61)', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('keyboard', 'chord: G7', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        // Root position from G4, not the 8 lit keys from D4.
        expect(calls[0]!.events.map((e) => e.midi)).toEqual([67, 71, 74, 77])
        // A fingered chord plays its fingered keys.
        const f = host()
        renderBlock('keyboard', 'chord: C\nrange: C4-B5\nfingering: 1 2 4', f, { play: { player } })
        ;(f.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls.at(-1)!.events.map((e) => e.midi)).toEqual([60, 64, 67])
        // A slash chord in a narrow range keeps every chord tone: the lit keys.
        for (const [range, keys] of [
            ['C4-C5', [60, 64, 67, 72]],
            ['C4-B4', [60, 64, 67]]
        ] as const) {
            const s = host()
            renderBlock('keyboard', `chord: C/G\nrange: ${range}`, s, { play: { player } })
            ;(s.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
            expect(calls.at(-1)!.events.map((e) => e.midi)).toEqual([...keys])
        }
        // Every lit key still plays on a click.
        h.querySelector('[data-midi="62"]')!.dispatchEvent(new Event('click', { bubbles: true }))
        expect(calls.at(-1)!.events.map((e) => e.midi)).toEqual([62])
    })

    it('strums a guitar chord about 12 ms a string, strikes a piano chord as a block (#59)', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        expect(calls[0]!.events.map((e) => +(e.time * 1000).toFixed(3))).toEqual([
            0, 12, 24, 36, 48
        ])
        const strum = h.querySelector('input[aria-label^="Strum"]') as HTMLInputElement
        expect(strum.value).toBe('12')
        // Piano: a block; back on guitar, the strum again.
        const select = h.querySelector('.mn-play-sound') as HTMLSelectElement
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        expect(strum.value).toBe('0')
        toggle.click()
        expect(new Set(calls[1]!.events.map((e) => e.time))).toEqual(new Set([0]))
        select.value = 'guitar'
        select.dispatchEvent(new Event('change'))
        expect(strum.value).toBe('12')
        // The slider sets the strum of the sound chosen; each instrument keeps its own.
        strum.value = '30'
        strum.dispatchEvent(new Event('input'))
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        expect(strum.value).toBe('0')
        strum.value = '25'
        strum.dispatchEvent(new Event('input'))
        select.value = 'guitar'
        select.dispatchEvent(new Event('change'))
        expect(strum.value).toBe('30')
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        expect(strum.value).toBe('25')
        toggle.click()
        expect(calls.at(-1)!.events.map((e) => +(e.time * 1000).toFixed(3))).toEqual([
            0, 25, 50, 75, 100
        ])
        const k = host()
        renderBlock('keyboard', 'chord: C', k, { play: { player } })
        ;(k.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls.at(-1)!.events.map((e) => e.time)).toEqual([0, 0, 0])
    })

    it("applies an app's plain strum to guitar only; { guitar, piano } sets each", () => {
        const { player, calls } = recorder()
        const times = () => calls.at(-1)!.events.map((e) => +(e.time * 1000).toFixed(3))
        const k = host()
        renderBlock('keyboard', 'chord: C', k, { play: { player, strum: 40 } })
        ;(k.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        // A piano chord stays a block.
        expect(times()).toEqual([0, 0, 0])
        const g = host()
        renderBlock('chord', 'A x02220', g, { play: { player, strum: 40 } })
        ;(g.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(times()).toEqual([0, 40, 80, 120, 160])
        // The guitar diagram on piano: a block too.
        const select = g.querySelector('.mn-play-sound') as HTMLSelectElement
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        ;(g.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(new Set(times())).toEqual(new Set([0]))
        const both = host()
        renderBlock('keyboard', 'chord: C', both, {
            play: { player, strum: { guitar: 30, piano: 20 } }
        })
        ;(both.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(times()).toEqual([0, 20, 40])
        expect((both.querySelector('input[aria-label^="Strum"]') as HTMLInputElement).value).toBe(
            '20'
        )
        const pick = both.querySelector('.mn-play-sound') as HTMLSelectElement
        pick.value = 'guitar'
        pick.dispatchEvent(new Event('change'))
        ;(both.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(times()).toEqual([0, 30, 60])
        // Only piano given: guitar keeps its 12 ms.
        expect(strumsOf({ piano: 500 })).toEqual({ guitar: 12, piano: 200 })
        expect(strumsOf(Number.NaN)).toEqual({ guitar: 12, piano: 0 })
    })

    it('plays chord tones over a scale a little louder than passing notes', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('keyboard', 'scale: C major\nchord: G7\nrange: C4-B4', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const touch = new Map(calls[0]!.events.slice(1, 7).map((e) => [e.midi, e.velocity]))
        expect([touch.get(62), touch.get(65), touch.get(67), touch.get(71)]).toEqual([
            90, 90, 90, 90
        ])
        expect([touch.get(64), touch.get(69)]).toEqual([80, 80])
    })

    it('runs an arpeggio from its root', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('keyboard', 'arpeggio: G7\nrange: C4-B5', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        const midis = calls[0]!.events.map((e) => e.midi)
        expect(midis.slice(0, 3)).toEqual([67, 71, 74])
        expect(midis.at(-1)).toBe(67)
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

describe('light player velocity', () => {
    /** An audio context that records each note's envelope levels. */
    function fakeWindow() {
        const levels: number[][] = []
        const sources: { buffer: unknown; playbackRate: { value: number } }[] = []
        class Param {
            value = 1
            readonly set: number[] = []
            setValueAtTime(v: number) {
                this.set.push(v)
            }
            linearRampToValueAtTime(v: number) {
                this.set.push(v)
            }
            exponentialRampToValueAtTime(v: number) {
                this.set.push(v)
            }
            setTargetAtTime(v: number) {
                this.set.push(v)
            }
        }
        const node = () => ({ connect() {}, disconnect() {} })
        class FakeContext {
            currentTime = 0
            sampleRate = 8000
            destination = node()
            resume = () => Promise.resolve()
            createGain() {
                const gain = new Param()
                levels.push(gain.set)
                return { ...node(), gain }
            }
            createBuffer(_c: number, length: number) {
                return { getChannelData: () => new Float32Array(length) }
            }
            createBufferSource() {
                const source = {
                    ...node(),
                    buffer: null,
                    playbackRate: new Param(),
                    start() {},
                    stop() {}
                }
                sources.push(source)
                return source
            }
        }
        const win = {
            AudioContext: FakeContext,
            setTimeout: () => 0,
            clearTimeout() {}
        } as unknown as Window
        return { win, levels, sources }
    }

    it('scales each note by its velocity (100 is the computed level)', async () => {
        const { lightPlayer } = await import('./player.js')
        const { win, levels } = fakeWindow()
        // A random source in the middle: no variation.
        lightPlayer(win, () => 0.5).play(
            [
                { midi: 60, time: 0, duration: 0.5 },
                { midi: 64, time: 0, duration: 0.5, velocity: 50 },
                { midi: 67, time: 0, duration: 0.5, velocity: 120 }
            ],
            { sound: 'guitar', volume: 1 }
        )
        // The first gain is the master volume; then one envelope a note.
        expect(levels.slice(1).map((set) => set[0])).toEqual([1, 0.5, 1.2])
    })

    it('varies repeated notes a little: pluck, pitch and level (#59)', async () => {
        const { lightPlayer } = await import('./player.js')
        const { win, levels, sources } = fakeWindow()
        let seed = 7
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
        const notes = Array.from({ length: 8 }, (_, i) => ({ midi: 60, time: i, duration: 0.5 }))
        lightPlayer(win, random).play(notes, { sound: 'guitar', volume: 1 })
        const rates = sources.map((s) => s.playbackRate.value)
        // A few cents either way, never the same twice.
        expect(rates.every((r) => Math.abs(1200 * Math.log2(r)) <= 4)).toBe(true)
        expect(new Set(rates).size).toBe(8)
        const peaks = levels.slice(1).map((set) => set[0]!)
        expect(peaks.every((v) => v >= 0.93 && v <= 1.07)).toBe(true)
        expect(new Set(peaks).size).toBe(8)
        // Several plucks of the string, not one recording.
        expect(new Set(sources.map((s) => s.buffer)).size).toBeGreaterThan(1)
    })
})

describe('light player release (#59)', () => {
    /** An audio context that records what each note and the volume are told, with times. */
    function timedWindow() {
        const calls: string[][] = []
        const timers: { ms: number; run: () => void }[] = []
        const param = (name: string) => {
            const log: string[] = []
            calls.push(log)
            const at =
                (kind: string) =>
                (...args: number[]) =>
                    log.push(`${name} ${kind} ${args.map((n) => +n.toFixed(4)).join(' ')}`)
            return {
                value: 1,
                setValueAtTime: at('set'),
                linearRampToValueAtTime: at('ramp'),
                exponentialRampToValueAtTime: at('exp'),
                setTargetAtTime: at('target')
            }
        }
        const node = () => ({ connect() {}, disconnect() {} })
        const stops: number[] = []
        class Ctx {
            currentTime = 1
            sampleRate = 8000
            destination = node()
            resume = () => Promise.resolve()
            createGain = () => ({ ...node(), gain: param('gain') })
            createBuffer = (_: number, length: number) => ({
                getChannelData: () => new Float32Array(length)
            })
            createBufferSource = () => ({
                ...node(),
                buffer: null,
                playbackRate: param('rate'),
                start() {},
                stop: (t: number) => stops.push(+t.toFixed(4))
            })
            createOscillator = () => ({
                ...node(),
                frequency: param('frequency'),
                detune: param('detune'),
                setPeriodicWave() {},
                start() {},
                stop: (t: number) => stops.push(+t.toFixed(4))
            })
            createPeriodicWave = () => ({})
        }
        const win = {
            AudioContext: Ctx,
            setTimeout: (run: () => void, ms: number) => timers.push({ ms, run }),
            clearTimeout: (t: number) => {
                if (timers[t - 1]) timers[t - 1]!.ms = -1
            }
        } as unknown as Window
        return { win, calls, stops, timers }
    }

    it('lets a guitar note fade after its end, not stop dead', async () => {
        const { lightPlayer } = await import('./player.js')
        const { win, calls, stops, timers } = timedWindow()
        let ended = 0
        lightPlayer(win, () => 0.5).play([{ midi: 60, time: 0, duration: 1 }], {
            sound: 'guitar',
            volume: 1,
            onEnd: () => ended++
        })
        // Starts at 1.05 on the audio clock, ends at 2.05, fades over 0.15 s.
        expect(calls.flat()).toContain('gain target 0 2.05 0.0375')
        expect(stops).toEqual([2.2])
        // The end (a loop's next pass) comes at the notes' end; the sound is let go after the tail.
        expect(timers.map((t) => Math.round(t.ms))).toEqual([1150, 1300])
        timers[0]!.run()
        expect(ended).toBe(1)
    })

    it('decays a piano note at its own pace, then releases it', async () => {
        const { lightPlayer, releaseOf } = await import('./player.js')
        const { win, calls, stops } = timedWindow()
        lightPlayer(win, () => 0.5).play(
            [
                { midi: 60, time: 0, duration: 1 },
                { midi: 36, time: 0, duration: 0.04 }
            ],
            { sound: 'piano', volume: 1 }
        )
        const flat = calls.flat()
        // Middle C falls to about a third in 1 s; C2 rings longer.
        expect(flat).toContain('gain target 0 1.055 1')
        expect(flat).toContain('gain target 0 1.055 2')
        // The damper: 0.3 s for a long note, half a short one (at least 30 ms).
        expect(flat).toContain('gain target 0 2.05 0.075')
        expect(releaseOf('piano', 0.04)).toBe(0.03)
        expect(stops).toEqual([2.35, 1.12])
    })

    it('fades quickly on stop', async () => {
        const { lightPlayer } = await import('./player.js')
        const { win, calls, stops, timers } = timedWindow()
        const handle = lightPlayer(win, () => 0.5).play([{ midi: 60, time: 0, duration: 2 }], {
            sound: 'guitar',
            volume: 1
        })
        handle.stop()
        // The volume (the first gain) falls in about 10 ms; the notes stop 50 ms later.
        expect(calls[0]).toEqual(['gain target 0 1 0.01'])
        expect(stops.slice(-1)).toEqual([1.05])
        expect(timers.filter((t) => t.ms >= 0).map((t) => t.ms)).toEqual([80])
    })
})

describe('following the notes (#41)', () => {
    const host = () => document.body.appendChild(document.createElement('div'))
    const lit = (h: Element) =>
        [...h.querySelectorAll('.mn-playing')].map((el) => Number(el.getAttribute('data-midi')))
    /** A player that says when it starts, and hands the test its callbacks. */
    function reporter() {
        const starts: (() => void)[] = []
        const player: NotePlayer = {
            reportsStart: true,
            play(_events, options) {
                if (options.onStart) starts.push(options.onStart)
                return { stop() {} }
            }
        }
        return { player, starts }
    }
    const click = (el: Element) => el.dispatchEvent(new Event('click', { bubbles: true }))

    it('lights each note when the player says it sounds, and Stop clears it', () => {
        const { player, starts } = reporter()
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        // The soundfont may still be loading: nothing lights before the sound.
        expect(lit(h)).toEqual([])
        starts[0]!()
        expect(lit(h)).toEqual([60])
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(lit(h)).toEqual([])
        h.remove()
    })

    it('lights a strummed guitar chord low to high', async () => {
        const { player, starts } = reporter()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player, strum: 30 } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        starts[0]!()
        expect(lit(h)).toEqual([45])
        await new Promise((r) => setTimeout(r, 200))
        expect(lit(h)).toEqual([45, 52, 57, 61, 64])
        h.remove()
    })

    it('clears the lit notes when the sound changes', () => {
        const { player, starts } = reporter()
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        starts[0]!()
        expect(lit(h)).toEqual([45])
        const select = h.querySelector('.mn-play-sound') as HTMLSelectElement
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        select.value = 'guitar'
        select.dispatchEvent(new Event('change'))
        expect(lit(h)).toEqual([])
        h.remove()
    })

    it('lights the notes of the redrawn diagram, and only the clicked one on a click', () => {
        const { player, starts } = reporter()
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nposition: 1', h, {
            play: { player, sound: 'piano' }
        })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        starts[0]!()
        expect(h.querySelector('.mn-keyboard .mn-playing')?.getAttribute('data-midi')).toBe('45')
        const f = host()
        renderBlock('fretboard', 'C major\nfrets: 0-12', f, { play: { player } })
        const e4 = f.querySelector('[data-midi="64"][data-mn-string="2"]')!
        click(e4)
        starts[1]!()
        expect([...f.querySelectorAll('.mn-playing')]).toEqual([e4])
        h.remove()
        f.remove()
    })

    it('follows a player that never says it started, from shortly after the play', async () => {
        const { player } = recorder()
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h, { play: { player } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(lit(h)).toEqual([])
        await new Promise((r) => setTimeout(r, 400))
        expect(lit(h)).toEqual([60])
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(lit(h)).toEqual([])
        h.remove()
    })

    it('waits for a player once it has seen it say when it starts', async () => {
        const starts: (() => void)[] = []
        // No reportsStart: an app's wrapper around a soundfont player.
        const player: NotePlayer = {
            play(_events, options) {
                if (options.onStart) starts.push(options.onStart)
                return { stop() {} }
            }
        }
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h, { play: { player } })
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        starts[0]!()
        expect(lit(h)).toEqual([60])
        toggle.click()
        toggle.click()
        // No fallback timer this time: it waits for the sound.
        await new Promise((r) => setTimeout(r, 400))
        expect(lit(h)).toEqual([])
        starts[1]!()
        expect(lit(h)).toEqual([60])
        h.remove()
    })

    it('keeps no timers for a diagram removed from the page', async () => {
        const { player, starts } = reporter()
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h, { play: { player, bpm: 240 } })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        starts[0]!()
        const key = h.querySelector('.mn-playing')!
        h.remove()
        await new Promise((r) => setTimeout(r, 300))
        expect(key.classList.contains('mn-playing')).toBe(false)
        expect(h.querySelectorAll('.mn-playing')).toHaveLength(0)
    })
})
