import { describe, expect, it } from 'bun:test'
import { followNotes, noteTargets, PLAYING_CLASS, START_WAIT } from './follow.js'
import { lightPlayer, sequenceOf, type NoteEvent, type NotePlayer } from './player.js'
import { renderBlock } from '../render/render-block.js'
import { STYLES } from '../styles.js'

/** A window with a clock the test moves: timers run when their time comes. */
function fakeWindow() {
    let clock = 0
    let id = 0
    const timers = new Map<number, { at: number; run: () => void }>()
    const win = {
        performance: { now: () => clock },
        setTimeout: (run: () => void, ms = 0) => {
            timers.set(++id, { at: clock + ms, run })
            return id
        },
        clearTimeout: (t?: number) => {
            if (t !== undefined) timers.delete(t)
        }
    }
    const advance = (ms: number) => {
        const end = clock + ms
        for (;;) {
            const due = [...timers.entries()]
                .filter(([, t]) => t.at <= end)
                .sort((a, b) => a[1].at - b[1].at)[0]
            if (!due) break
            timers.delete(due[0])
            clock = due[1].at
            due[1].run()
        }
        clock = end
    }
    return { win: win as unknown as Window, advance, pending: () => timers.size }
}

const draw = (language: 'chord' | 'keyboard' | 'fretboard', source: string) => {
    const h = document.body.appendChild(document.createElement('div'))
    renderBlock(language, source, h)
    return h.querySelector('svg')!
}

const litOf = (svg: Element) =>
    [...svg.querySelectorAll(`.${PLAYING_CLASS}`)].map((el) =>
        [el.getAttribute('data-midi'), el.getAttribute('data-mn-string')].join('/')
    )

describe('noteTargets', () => {
    it('lights strings that share a pitch one each, low to high, on a strum', () => {
        // The low E at fret 5 and the open A are both A2 (45).
        const svg = draw('chord', 'A5 50xxxx')
        const events = sequenceOf('chord', [45, 45])
        const targets = noteTargets(svg, events, 'chord')
        expect(targets.map((t) => t.map((el) => el.getAttribute('data-mn-string')))).toEqual([
            ['6'],
            ['5']
        ])
    })

    it('lights every place of a pitch on a fretboard scale', () => {
        const svg = draw('fretboard', 'C major\nfrets: 0-12')
        const targets = noteTargets(svg, [{ midi: 64, time: 0, duration: 1 }], 'scale')
        expect(targets[0]!.map((el) => el.getAttribute('data-mn-string')).sort()).toEqual([
            '1',
            '2',
            '3'
        ])
    })

    it('lights a keyboard key per note', () => {
        const svg = draw('keyboard', 'C major')
        const events = sequenceOf('scale', [60, 62])
        expect(noteTargets(svg, events, 'scale').map((t) => t.length)).toEqual([1, 1, 1])
    })
})

describe('followNotes', () => {
    const svg = () => draw('chord', 'C x32010')
    const strum = (s: Element) => {
        const events = sequenceOf('chord', [48, 52, 55, 60, 64], { bpm: 90, strum: 100 })
        return { events, targets: noteTargets(s, events, 'chord') }
    }

    it('lights nothing until the notes sound, then each string as the strum reaches it', () => {
        const { win, advance, pending } = fakeWindow()
        const s = svg()
        const { events, targets } = strum(s)
        const follower = followNotes(win, s, targets, events, Infinity)
        advance(5000)
        expect(litOf(s)).toEqual([])
        expect(pending()).toBe(0)
        follower.heard()
        expect(litOf(s)).toEqual(['48/5'])
        advance(150)
        expect(litOf(s)).toEqual(['48/5', '52/4'])
        advance(300)
        expect(litOf(s)).toHaveLength(5)
        // The chord rings 2.5 s past its last string, then every light goes out.
        advance(2600)
        expect(litOf(s)).toEqual([])
        expect(pending()).toBe(0)
    })

    it('lights one note at a time on a scale, and stop clears it', () => {
        const { win, advance } = fakeWindow()
        const s = draw('keyboard', 'C major')
        const events = sequenceOf('scale', [60, 62, 64], { bpm: 60, strum: 40 })
        const follower = followNotes(win, s, noteTargets(s, events, 'scale'), events, Infinity)
        follower.heard()
        expect(litOf(s)).toEqual(['60/'])
        advance(1005)
        expect(litOf(s)).toEqual(['62/'])
        advance(1000)
        expect(litOf(s)).toEqual(['64/'])
        follower.stop()
        expect(litOf(s)).toEqual([])
        // A late start from the player changes nothing once stopped.
        follower.heard()
        expect(litOf(s)).toEqual([])
    })

    it('follows from the play call when the player never says it started', () => {
        const { win, advance } = fakeWindow()
        const s = draw('keyboard', 'C major')
        const events = sequenceOf('scale', [60, 62], { bpm: 60, strum: 40 })
        followNotes(win, s, noteTargets(s, events, 'scale'), events)
        advance(START_WAIT - 1)
        expect(litOf(s)).toEqual([])
        advance(1)
        expect(litOf(s)).toEqual(['60/'])
        advance(1005 - START_WAIT)
        expect(litOf(s)).toEqual(['62/'])
    })

    it('starts again from a late start report, and only from the first', () => {
        const { win, advance } = fakeWindow()
        const s = draw('keyboard', 'C major')
        const events = sequenceOf('scale', [60, 62], { bpm: 60, strum: 40 })
        const follower = followNotes(win, s, noteTargets(s, events, 'scale'), events)
        advance(1500)
        expect(litOf(s)).toEqual(['62/'])
        follower.heard()
        expect(litOf(s)).toEqual(['60/'])
        advance(500)
        follower.heard()
        expect(litOf(s)).toEqual(['60/'])
    })

    it('stops and clears once the diagram leaves the page', () => {
        const { win, advance, pending } = fakeWindow()
        const s = draw('keyboard', 'C major')
        const events = sequenceOf('scale', [60, 62, 64], { bpm: 60, strum: 40 })
        followNotes(win, s, noteTargets(s, events, 'scale'), events, Infinity).heard()
        s.closest('div')!.remove()
        advance(1000)
        expect(litOf(s)).toEqual([])
        expect(pending()).toBe(0)
    })
})

describe('the light player says when its notes start', () => {
    /** Just enough of an AudioContext for the light player. */
    function audioWindow(resume: Promise<void>) {
        const param = () => ({
            value: 0,
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {}
        })
        const node = () => ({ gain: param(), connect() {}, disconnect() {} })
        class Ctx {
            currentTime = 10
            sampleRate = 8000
            outputLatency = 0.02
            destination = {}
            resume = () => resume
            createGain = node
            createBuffer = (_: number, length: number) => ({
                getChannelData: () => new Float32Array(length)
            })
            createBufferSource = () => ({ ...node(), buffer: null, start() {}, stop() {} })
        }
        const timers: { ms: number; run: () => void }[] = []
        const win = {
            AudioContext: Ctx,
            setTimeout: (run: () => void, ms: number) => timers.push({ ms, run }),
            clearTimeout: (t: number) => {
                timers[t - 1] = { ms: -1, run() {} }
            }
        }
        return { win: win as unknown as Window, timers }
    }
    const note: NoteEvent[] = [{ midi: 60, time: 0, duration: 0.5 }]

    it('calls onStart once the context runs, at the first note plus the output latency', async () => {
        const { win, timers } = audioWindow(Promise.resolve())
        const player: NotePlayer = lightPlayer(win)
        expect(player.reportsStart).toBe(true)
        let started = 0
        player.play(note, { sound: 'guitar', volume: 1, onStart: () => started++ })
        await Promise.resolve()
        await Promise.resolve()
        const start = timers.find((t) => Math.abs(t.ms - 70) < 1)
        expect(start).toBeDefined()
        start!.run()
        expect(started).toBe(1)
    })

    it('does not call onStart after stop', async () => {
        const { win, timers } = audioWindow(Promise.resolve())
        let started = 0
        const handle = lightPlayer(win).play(note, {
            sound: 'guitar',
            volume: 1,
            onStart: () => started++
        })
        handle.stop()
        await Promise.resolve()
        await Promise.resolve()
        for (const t of timers) t.run()
        expect(started).toBe(0)
    })
})

describe('styles', () => {
    it('style the sounding notes and alphaTab cursor', () => {
        expect(STYLES).toContain('.mn-playing')
        expect(STYLES).toContain('.mn-tab .at-cursor-beat')
        expect(STYLES).toContain('.mn-tab .at-highlight')
    })
})
