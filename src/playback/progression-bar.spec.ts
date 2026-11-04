import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import type { NoteEvent, NotePlayer } from './player.js'
import { strumVoicing } from '../strum/voicing.js'

const host = () => document.body.appendChild(document.createElement('div'))

/** A player that records what it plays, and says when it starts. */
function recorder() {
    const calls: { events: NoteEvent[]; sound: string; onStart?: () => void }[] = []
    const player: NotePlayer = {
        reportsStart: true,
        play(events, options) {
            calls.push({ events, sound: options.sound, onStart: options.onStart })
            return { stop() {} }
        }
    }
    return { player, calls }
}

const notes = (events: NoteEvent[]) => events.filter((e) => e.kind !== 'click')
const click = (h: HTMLElement, cls: string) =>
    (h.querySelector(`.mn-progression-play .${cls}`) as HTMLButtonElement).click()

describe('progression play bar (#46)', () => {
    it('has play, loop, count-in, click, tempo, volume, strum and sound, above the chords', () => {
        const h = host()
        renderBlock('progression', 'key: G\nI V vi IV\ntempo: 100', h, {
            play: { player: recorder().player }
        })
        const block = h.querySelector('.mn-progression')!
        const bar = block.querySelector('.mn-progression-play')!
        expect(block.firstElementChild).toBe(bar)
        expect(bar.querySelector('.mn-play-toggle')?.getAttribute('aria-label')).toBe(
            'Play in time'
        )
        expect(bar.querySelector('.mn-play-click')?.getAttribute('aria-pressed')).toBe('true')
        expect(bar.querySelector('.mn-play-count')?.getAttribute('aria-pressed')).toBe('false')
        const sliders = [...bar.querySelectorAll('input[type="range"]')] as HTMLInputElement[]
        expect(sliders.map((s) => s.value)).toEqual(['100', '80'])
        const strum = bar.querySelector('.mn-play-strum') as HTMLSelectElement
        expect([...strum.options].map((o) => o.value)).toEqual(['beats', 'bar', 'arpeggio'])
    })

    it('plays one chord a bar, the diagrams notes, and lights the chord playing', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('progression', 'key: G\nI IV\ntempo: 60', h, { play: { player } })
        const cells = [...h.querySelectorAll('.mn-progression-chord')]
        expect(cells.map((c) => c.getAttribute('data-mn-bar'))).toEqual(['0', '1'])
        click(h, 'mn-play-toggle')
        const events = notes(calls[0]!.events)
        // Bar 1 is the G diagram's notes; bar 2 (from 4 s) the C diagram's.
        const g = cells[0]!.querySelector('svg[data-mn-pitches]')!.getAttribute('data-mn-pitches')!
        const c = cells[1]!.querySelector('svg[data-mn-pitches]')!.getAttribute('data-mn-pitches')!
        expect(
            events
                .filter((e) => e.time < 0.5)
                .map((e) => e.midi)
                .join(' ')
        ).toBe(g)
        expect(
            events
                .filter((e) => e.time >= 4 && e.time < 4.5)
                .map((e) => e.midi)
                .join(' ')
        ).toBe(c)
        // Lit from the moment the player starts.
        calls[0]!.onStart?.()
        expect(cells[0]!.classList.contains('mn-playing')).toBe(true)
        expect(cells[1]!.classList.contains('mn-playing')).toBe(false)
        click(h, 'mn-play-toggle')
        expect(cells[0]!.classList.contains('mn-playing')).toBe(false)
    })

    it('reads time, tempo and a strumming pattern, and says what to write instead', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('progression', 'G C\ntime: 3/4\ntempo: 60\nstrum: D - D U D U', h, {
            play: { player }
        })
        const strum = h.querySelector('.mn-play-strum') as HTMLSelectElement
        expect(strum.value).toBe('pattern')
        click(h, 'mn-play-toggle')
        // A bar of 3/4 at 60 is 3 s: C starts at 3.
        const c = notes(calls[0]!.events).find((e) => e.time >= 3)!
        expect(c.time).toBe(3)
        expect(c.midi).toBe(strumVoicing('C')[0]!)
        const bad = host()
        expect(renderBlock('progression', 'G C\ntempo: 400', bad).error).toContain(
            'tempo: write beats a minute from 20 to 240'
        )
        expect(renderBlock('progression', 'G C\nstrum: Q', host()).error).toContain(
            'strum: write beats, bar, arpeggio or a strumming pattern'
        )
        expect(renderBlock('progression', 'G C\ntime: 5/7', host()).error).toContain('Invalid time')
    })

    it('plays piano progressions on piano', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('progression', 'key: C\nI V\ninstrument: piano', h, { play: { player } })
        click(h, 'mn-play-toggle')
        expect(calls[0]!.sound).toBe('piano')
    })
})

describe('ChordPro chart play bar (#46)', () => {
    it('plays each chord above the lyrics a bar, at the song tempo, lit as it plays', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chords', '{tempo: 60}\n{time: 3/4}\n[G]Hello [C]world, [N.C.]and [G]more', h, {
            play: { player }
        })
        const marks = [...h.querySelectorAll('.mn-chart .mn-chord[data-mn-bar]')]
        expect(marks.map((m) => m.textContent)).toEqual(['G', 'C', 'G'])
        const bar = h.querySelector('.mn-chart > .mn-progression-play')!
        expect((bar.querySelector('input') as HTMLInputElement).value).toBe('60')
        click(h, 'mn-play-toggle')
        const events = notes(calls[0]!.events)
        expect(events.filter((e) => e.time < 0.5).map((e) => e.midi)).toEqual(strumVoicing('G'))
        // 3/4 at 60: C at 3 s, G again at 6 s.
        expect(events.find((e) => e.time >= 3 && e.time < 3.5)!.midi).toBe(strumVoicing('C')[0]!)
        expect(events.some((e) => e.time >= 6 && e.time < 6.5)).toBe(true)
        calls[0]!.onStart?.()
        expect(marks[0]!.classList.contains('mn-playing')).toBe(true)
    })

    it('plays the shape under a capo where it sounds', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chords', '{capo: 2}\n[G]Hello', h, { play: { player } })
        click(h, 'mn-play-toggle')
        expect(notes(calls[0]!.events)[0]!.midi).toBe(strumVoicing('G')[0]! + 2)
    })

    it('reads bar lines: chords between two share the bar, an empty bar holds the chord (#75)', () => {
        const { player, calls } = recorder()
        const h = host()
        renderBlock('chords', '{tempo: 60}\n[G] | [C] [D] | | [Em] |\n| | [A]', h, {
            play: { player }
        })
        const marks = [...h.querySelectorAll('.mn-chart .mn-chord[data-mn-bar]')]
        expect(marks.map((m) => [m.textContent, m.getAttribute('data-mn-beats')])).toEqual([
            ['G', '4'],
            ['C', '2'],
            ['D', '6'],
            ['Em', '8'],
            ['A', '4']
        ])
        click(h, 'mn-play-toggle')
        const events = notes(calls[0]!.events)
        const first = (t: number) => events.find((e) => e.time >= t && e.time < t + 0.5)!.midi
        // 4/4 at 60: C at 4 s, D at 6 s (held through the empty bar), Em at 12 s for two bars.
        expect(first(4)).toBe(strumVoicing('C')[0]!)
        expect(first(6)).toBe(strumVoicing('D')[0]!)
        expect(first(12)).toBe(strumVoicing('Em')[0]!)
        expect(first(20)).toBe(strumVoicing('A')[0]!)
    })

    it('reads beat slashes in a bar: each slash a beat more for the chord before it (#75)', () => {
        const h = host()
        renderBlock('chords', '{time: 3/4}\n| [G] / [C] | [D] / / |', h, { play: true })
        const marks = [...h.querySelectorAll('.mn-chart .mn-chord[data-mn-bar]')]
        expect(marks.map((m) => m.getAttribute('data-mn-beats'))).toEqual(['2', '1', '3'])
    })

    it('keeps one chord a bar on lines without bar lines, and draws them as before', () => {
        const h = host()
        renderBlock('chords', '[G]Hello [C]world', h, { play: true })
        const marks = [...h.querySelectorAll('.mn-chart .mn-chord[data-mn-bar]')]
        expect(marks.map((m) => m.hasAttribute('data-mn-beats'))).toEqual([false, false])
        // The bar lines stay in the lyrics as written.
        const ruled = host()
        renderBlock('chords', '[G] | [C] |', ruled)
        expect(ruled.querySelector('.mn-line')!.textContent).toBe('G | C |')
    })

    it('has no bar without playback', () => {
        const h = host()
        renderBlock('chords', '[G]Hello', h)
        expect(h.querySelector('.mn-progression-play')).toBeNull()
    })
})
