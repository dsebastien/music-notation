import { describe, expect, it } from 'bun:test'
import type { NotePlayer, PlayHandle } from './player.js'
import { runPasses } from '../strum/play.js'
import { renderBlock } from '../render/render-block.js'
import { volumeChanged } from './live-volume.js'
import * as alphaTab from '@coderline/alphatab'
import { soundfontPlayer } from '../tab/index.js'

/** #85: a volume change is heard in what is playing, not only from the next play or pass. */

/** A player whose handles record each live volume they are given. */
function recorder() {
    const handles: { volumes: number[]; stopped: boolean; onEnd?: () => void }[] = []
    const player: NotePlayer = {
        play(_events, options) {
            const h = { volumes: [] as number[], stopped: false, onEnd: options.onEnd }
            handles.push(h)
            const handle: PlayHandle = {
                stop: () => {
                    h.stopped = true
                },
                setVolume: (v: number) => h.volumes.push(v)
            }
            return handle
        }
    }
    return { player, handles }
}

const timers = {
    setTimeout: () => 0,
    clearTimeout: () => {}
} as unknown as Pick<Window, 'setTimeout' | 'clearTimeout'>

describe('volumeChanged (#85)', () => {
    it('gives a pass that plays the new volume of its settings, once, until it stops', () => {
        const { player, handles } = recorder()
        const live = { bpm: 120, countIn: false, loop: true, sound: 'guitar' as const, volume: 0.8 }
        const run = runPasses(
            () => ({ events: [{ midi: 60, time: 0, duration: 1 }], length: 2, strums: [] }),
            () => player,
            () => live,
            timers
        )
        volumeChanged()
        // Unchanged: nothing to do.
        expect(handles[0]!.volumes).toEqual([])
        live.volume = 0.3
        volumeChanged()
        volumeChanged()
        expect(handles[0]!.volumes).toEqual([0.3])
        run.stop()
        live.volume = 1
        volumeChanged()
        expect(handles[0]!.volumes).toEqual([0.3])
    })

    it('gives a diagram that plays the volume the app reads now', () => {
        const { player, handles } = recorder()
        let volume = 0.8
        const h = document.body.appendChild(document.createElement('div'))
        const { el } = renderBlock('chord', 'A x02220', h, {
            play: { player, volume: () => volume }
        })
        el.querySelector('.mn-playable svg')!.dispatchEvent(new Event('click', { bubbles: true }))
        expect(handles).toHaveLength(1)
        volume = 0.25
        volumeChanged()
        expect(handles[0]!.volumes).toEqual([0.25])
        // Over: the diagram no longer listens.
        handles[0]!.onEnd?.()
        volume = 0.5
        volumeChanged()
        expect(handles[0]!.volumes).toEqual([0.25])
        h.remove()
    })

    it('keeps the volume between 0 and 1', () => {
        const { player, handles } = recorder()
        let volume = 0.5
        const h = document.body.appendChild(document.createElement('div'))
        const { el } = renderBlock('chord', 'A x02220', h, {
            play: { player, volume: () => volume }
        })
        el.querySelector('.mn-playable svg')!.dispatchEvent(new Event('click', { bubbles: true }))
        volume = 3
        volumeChanged()
        expect(handles[0]!.volumes).toEqual([1])
        h.remove()
    })
})

describe('players change the level of the notes that play (#85)', () => {
    it('the light player ramps its gain to the new level', async () => {
        const gains: { value: number; targets: number[] }[] = []
        const param = () => {
            const p = { value: 1, targets: [] as number[] }
            gains.push(p)
            return Object.assign(p, {
                setValueAtTime() {},
                linearRampToValueAtTime() {},
                exponentialRampToValueAtTime() {},
                setTargetAtTime(v: number) {
                    p.targets.push(v)
                }
            })
        }
        const node = () => ({ connect() {}, disconnect() {} })
        class Ctx {
            currentTime = 0
            sampleRate = 8000
            outputLatency = 0
            destination = {}
            resume = () => Promise.resolve()
            createGain = () => ({ ...node(), gain: param() })
            createBuffer = (_c: number, n: number) => ({
                getChannelData: () => new Float32Array(n)
            })
            createBufferSource = () => ({
                ...node(),
                buffer: null,
                playbackRate: { value: 1 },
                start() {},
                stop() {}
            })
        }
        const win = {
            AudioContext: Ctx,
            setTimeout: () => 0,
            clearTimeout: () => {}
        } as unknown as Window
        const { lightPlayer } = await import('./player.js')
        const handle = lightPlayer(win, () => 0.5).play([{ midi: 60, time: 0, duration: 1 }], {
            sound: 'guitar',
            volume: 0.8
        })
        const master = gains[0]!
        expect(master.value).toBe(0.8)
        handle.setVolume!(0.2)
        expect(master.targets).toEqual([0.2])
    })

    it('a soundfont player passes the new level to the synthesizer while it plays', () => {
        const api = {
            masterVolume: 1,
            playbackSpeed: 1,
            player: { playOneTimeMidiFile() {}, stop() {} }
        }
        const player = soundfontPlayer(alphaTab, () => api as never)
        const handle = player.play([{ midi: 60, time: 0, duration: 1 }], {
            sound: 'piano',
            volume: 0.8
        })
        expect(api.masterVolume).toBe(0.8)
        handle.setVolume!(0.3)
        expect(api.masterVolume).toBe(0.3)
        handle.stop()
        // A stopped play no longer sets the level (another play may own the synthesizer).
        handle.setVolume!(0.9)
        expect(api.masterVolume).toBe(0.3)
    })
})

describe('one volume for every bundle (#82, #85)', () => {
    it('reaches plays registered by another copy of the library (the /tab entry is its own bundle)', () => {
        // Another bundle's copy keeps its listeners in the same global registry.
        const registry = (globalThis as Record<symbol, Set<() => void> | undefined>)[
            Symbol.for('@dsebastien/music-notation/volume')
        ]
        expect(registry).toBeInstanceOf(Set)
        let heard = 0
        const other = () => heard++
        registry!.add(other)
        volumeChanged()
        registry!.delete(other)
        expect(heard).toBe(1)
    })
})
