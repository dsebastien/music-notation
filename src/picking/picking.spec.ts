import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { blockFromProperties } from '../blocks/properties.js'
import { describeBlock, formatDiagram } from '../cli/describe.js'
import type { NoteEvent, NotePlayer } from '../playback/player.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import { formatPicking, namedPicking, parsePicking } from './pattern.js'
import { pickingFrets, pluckNote } from './voicing.js'
import { pickingEvents, pickingScore, playPicking, PICKING_VELOCITY } from './play.js'

const host = () => document.body.appendChild(document.createElement('div'))

/** "string:fret" of each pluck over a grip, strings counted from the highest (1). */
const on = (chord: string, frets: (number | null)[], token: string) => {
    const pattern = parsePicking(token.padEnd(1) + ' -'.repeat(7))
    return pattern.slots[0]!.plucks.map((p) => {
        const note = pluckNote(p, frets, STANDARD_TUNING, chord)
        return note ? `${6 - note.string}:${note.fret}` : null
    })
}

describe('parsePicking', () => {
    it('reads PIMA letters, the alternate bass, string numbers, pinches and rests', () => {
        const p = parsePicking("p i m a p' - 5+1 pa | p - - - - - - -")
        expect(p.bars).toBe(2)
        expect(p.slotsPerBar).toBe(8)
        expect(formatPicking(p)).toBe("p i m a p' - 5+1 p+a | p - - - - - - -")
        expect(p.slots[4]!.plucks).toEqual([{ finger: 'p', alternate: true }])
        expect(p.slots[6]!.plucks).toEqual([{ string: 5 }, { string: 1 }])
    })

    it('fills a bar with a named pattern, in any time', () => {
        expect(formatPicking(parsePicking('pattern: travis'))).toBe("p m p' i p m p' i")
        expect(formatPicking(parsePicking('pattern: Alternating bass\ntime: 3/4'))).toBe(
            "p i m i p' i"
        )
        expect(formatPicking(parsePicking('pattern: arpeggio'))).toBe('p i m a p i m a')
        expect(namedPicking('Travis picking')).toBe('travis')
        expect(parsePicking('pattern: 1-2-3-4').name).toBe('1-2-3-4')
    })

    it('reads time, subdivision, chords, tempo, and skips count lines', () => {
        const p = parsePicking(
            'p i m a p i m a p i m a\n1 & a 2 & a 3 & a 4 & a\ntime: 4/4\nsubdivision: triplets\nchords: C, Am | F G\ntempo: 70'
        )
        expect(p.slotsPerBeat).toBe(3)
        expect(p.chords).toEqual(['C', 'Am', 'F', 'G'])
        expect(p.tempo).toBe(70)
        expect(parsePicking('p - - p - -\ntime: 6/8\nsubdivision: 8ths').compound).toBe(true)
        expect(parsePicking('pattern: travis\nprogression: G D').chords).toEqual(['G', 'D'])
    })

    it('says what to write instead', () => {
        expect(() => parsePicking('p i m')).toThrow('A bar of 4/4 in 8ths has 8 slots, found 3')
        expect(() => parsePicking('p q m a p i m a')).toThrow('Didn\'t understand "q"')
        expect(() => parsePicking('p 7 m a p i m a')).toThrow("String 7 doesn't exist")
        expect(() => parsePicking('pattern: travis\np i m a p i m a')).toThrow(
            'Write the pattern once'
        )
        expect(() => parsePicking('strum: D')).toThrow('Unknown key "strum"')
        expect(() => parsePicking('chord: C')).toThrow('Write a pattern')
        expect(() => parsePicking('pattern: travis\ntempo: 500')).toThrow('Invalid tempo')
    })
})

describe('pluckNote', () => {
    it('puts the thumb on the bass and the alternate bass on the fifth next to it', () => {
        const C = [null, 3, 2, 0, 1, 0]
        const G = [3, 2, 0, 0, 0, 3]
        const D = [null, null, 0, 2, 3, 2]
        const Am = [null, 0, 2, 2, 1, 0]
        expect(on('C', C, 'p')).toEqual(['5:3'])
        // The fifth G fretted on the muted low E string.
        expect(on('C', C, "p'")).toEqual(['6:3'])
        expect(on('G', G, "p'")).toEqual(['4:0'])
        expect(on('D', D, "p'")).toEqual(['5:0'])
        expect(on('Am', Am, "p'")).toEqual(['4:2'])
    })

    it('puts i m a on strings 3 2 1, and a numbered string on its fret', () => {
        const C = [null, 3, 2, 0, 1, 0]
        expect(on('C', C, 'i+m+a')).toEqual(['3:0', '2:1', '1:0'])
        expect(on('C', C, '4')).toEqual(['4:2'])
        // A string the grip mutes: a chord tone fretted on it (C's root is too high: its fifth).
        expect(on('C', C, '6')).toEqual(['6:3'])
        // A finger whose string is muted: the nearest sounding string above the bass.
        const power = [3, 5, 5, null, null, null]
        expect(on('G5', power, 'a')).toEqual(['4:5'])
    })

    it('finds a grip for the chord, E minor without one', () => {
        expect(pickingFrets(null)).toEqual([0, 2, 2, 0, 0, 0])
        expect(pickingFrets('C')).toEqual([null, 3, 2, 0, 1, 0])
        expect(() => pickingFrets('Hm')).toThrow('Didn\'t recognize the chord "Hm"')
    })
})

describe('pickingEvents', () => {
    it('plays each slot in time, the thumb firmer, notes ringing until their string is picked again', () => {
        const score = pickingScore(parsePicking('pattern: travis\nchord: C'))
        const { events, length, strums } = pickingEvents(score, { bpm: 60, tail: 0 })
        expect(length).toBe(4)
        expect(strums.map((s) => s.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
        // C: 48 (string 5 fret 3), 60 (string 2 fret 1), 43 (string 6 fret 3), 55 (string 3).
        expect(events.slice(0, 4).map((e) => e.midi)).toEqual([48, 60, 43, 55])
        // The bass rings until the thumb picks string 5 again (beat 3).
        expect(events[0]!.duration).toBeCloseTo(2)
        expect(events[0]!.velocity!).toBeGreaterThan(events[1]!.velocity!)
        expect(
            Math.abs(events[0]!.velocity! - PICKING_VELOCITY.thumb - PICKING_VELOCITY.first)
        ).toBeLessThanOrEqual(3)
    })

    it('plays one chord a bar, stops the notes where the chord changes, clicks and counts in', () => {
        const score = pickingScore(parsePicking('p - - - - - - -\nchords: C G'))
        const { events, length } = pickingEvents(score, {
            bpm: 60,
            countIn: true,
            click: true,
            tail: 0
        })
        // A bar of count-in, then two bars.
        expect(length).toBe(12)
        const clicks = events.filter((e) => e.kind === 'click').map((e) => e.time)
        expect(clicks).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        const notes = events.filter((e) => e.kind !== 'click')
        expect(notes.map((e) => [e.midi, e.time])).toEqual([
            [48, 4],
            [43, 8]
        ])
        // The C bass stops where G starts.
        expect(notes[0]!.duration).toBeCloseTo(4)
    })
})

describe('playPicking', () => {
    it('plays a pattern over a chord or chords, calling back each bar', () => {
        const calls: { events: NoteEvent[]; onStart?: () => void }[] = []
        const player: NotePlayer = {
            reportsStart: true,
            play(events, options) {
                calls.push({ events, onStart: options.onStart })
                return { stop() {} }
            }
        }
        const pending: { fn: () => void; ms: number }[] = []
        const timers = {
            setTimeout: (fn: () => void, ms: number) => pending.push({ fn, ms }),
            clearTimeout: () => {}
        } as unknown as Window
        const bars: [number, string | null][] = []
        const handle = playPicking('pattern: travis', {
            player,
            window: timers,
            chords: ['G', 'C'],
            bpm: 120,
            onBar: (bar, chord) => bars.push([bar, chord])
        })
        expect(calls[0]!.events[0]!.midi).toBe(43)
        calls[0]!.onStart?.()
        for (const p of pending.filter((p) => p.ms === 0 || p.ms === 2000)) p.fn()
        expect(bars).toEqual([
            [0, 'G'],
            [1, 'C']
        ])
        handle.update({ bpm: 90 })
        handle.stop()
        expect(() => playPicking('p i', { player })).toThrow('has 8 slots')
        expect(() => playPicking('pattern: travis', { player, chord: 'Hm' })).toThrow('Hm')
    })
})

describe('picking block', () => {
    it('draws a tab of the pattern over its chords, with a play bar and a click', () => {
        const h = host()
        const r = renderBlock('picking', 'pattern: travis\nchords: C G', h, {
            play: { player: { play: () => ({ stop() {} }) } }
        })
        expect(r.ok).toBe(true)
        const drawing = h.querySelector('svg.mn-picking')!
        expect(drawing.getAttribute('data-mn-picking')).toBe("p m p' i p m p' i")
        expect(drawing.querySelector('title')?.textContent).toBe(
            "Travis: picking pattern p m p' i p m p' i, 4/4, 8ths, over C G"
        )
        expect(drawing.querySelectorAll('[data-mn-beat]')).toHaveLength(16)
        expect(drawing.querySelectorAll('.mn-picking-string')).toHaveLength(6)
        const bar = h.querySelector('.mn-picking-playable .mn-play')!
        expect(bar.querySelector('.mn-play-click')?.getAttribute('aria-pressed')).toBe('false')
        expect(bar.getAttribute('aria-label')).toBe('Play the picking pattern')
        const described = describeBlock(r.el).flatMap((d, i) => formatDiagram(d, i + 1))
        expect(described[0]).toBe(
            '1. picking pattern, "Travis", 4/4, 8ths, chords C (bar 1) G (bar 2)'
        )
        expect(described[2]).toStartWith('   notes (string:fret) 5:3 2:1 6:3 3:0')
    })

    it('plays what it draws from its bar', () => {
        const calls: NoteEvent[][] = []
        const h = host()
        renderBlock('picking', 'p i m a p i m a\nchord: G\ntempo: 60', h, {
            play: { player: { play: (events) => (calls.push(events), { stop() {} }) } }
        })
        ;(h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
        expect(calls[0]!.slice(0, 4).map((e) => e.midi)).toEqual([43, 55, 59, 67])
        expect(calls[0]![1]!.time).toBe(0.5)
    })

    it("is an error that says what to write, and draws from a note's properties when empty", () => {
        expect(renderBlock('picking', 'p i m', host()).error).toContain('has 8 slots')
        const props = {
            tags: ['type/music/guitar/picking'],
            picking_pattern: 'Travis',
            chord_symbol: 'Am',
            time_signature: '4/4',
            bpm_current: 72
        }
        expect(blockFromProperties('picking', props)).toBe(
            'pattern: Travis\ntime: 4/4\nchord: Am\ntempo: 72'
        )
        expect(
            blockFromProperties('picking', { ...props, picking_pattern: ['p i m a', 'p i m a'] })
        ).toBe('p i m a\np i m a\ntime: 4/4\nchord: Am\ntempo: 72')
        const h = host()
        renderBlock('picking', '', h, { properties: props })
        expect(h.querySelector('svg.mn-picking')?.getAttribute('data-mn-tempo')).toBe('72')
    })
})
