import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import { createSoundfontPlayer, renderTab, type AlphaTabModule } from './index.js'
import type { InstrumentSource } from './instruments.js'

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const bytes = (value: string) => new TextEncoder().encode(value)
const tick = () => new Promise((r) => setTimeout(r, 0))

interface Made {
    loads: [string, boolean][]
    plays: number
    oneTime: number
    settings: { player: Record<string, unknown> }
}

/**
 * A fake alphaTab whose player takes soundfonts as the real one does: each `loadSoundFont` is one
 * `soundFontLoaded`, and the player is ready once it has a soundfont and a song.
 */
function fake(): { mod: AlphaTabModule; made: Made[] } {
    const made: Made[] = []
    const emitter = () => {
        const handlers: ((e: unknown) => void)[] = []
        return {
            on: (h: (e: unknown) => void) => handlers.push(h),
            fire: (e?: unknown) => handlers.forEach((h) => h(e))
        }
    }
    class Api implements Made {
        renderFinished = emitter()
        error = emitter()
        playerStateChanged = emitter()
        playerPositionChanged = emitter()
        soundFontLoaded = emitter()
        playerReady = emitter()
        scoreLoaded = emitter()
        renderer = { partialRenderFinished: emitter() }
        settings = { player: {} as Record<string, unknown> }
        masterVolume = 1
        playbackSpeed = 1
        score: alphaTab.model.Score | null = null
        loads: [string, boolean][] = []
        plays = 0
        oneTime = 0
        player = {
            playOneTimeMidiFile: () => {
                this.oneTime++
            },
            stop() {}
        }
        constructor() {
            made.push(this)
        }
        updateSettings() {}
        playPause() {
            this.plays++
        }
        tex(source: string) {
            queueMicrotask(() => {
                this.score = alphaTab.importer.ScoreLoader.loadAlphaTex(source)
                this.scoreLoaded.fire(this.score)
                this.renderFinished.fire()
            })
        }
        loadSoundFont(data: Uint8Array, append: boolean) {
            this.loads.push([text(data), append])
            queueMicrotask(() => {
                this.soundFontLoaded.fire()
                this.playerReady.fire()
            })
            return true
        }
        destroy() {}
    }
    const mod = {
        AlphaTabApi: Api,
        FontFileFormat: { Woff2: 3 },
        LogLevel: { Warning: 2 },
        PlayerMode: { Disabled: 0, EnabledSynthesizer: 2 },
        ScrollMode: { Off: 0, Continuous: 1, OffScreen: 2 },
        midi: alphaTab.midi
    } as unknown as AlphaTabModule
    return { mod, made }
}

/** A folder of instrument files in memory. */
function folder(lacking: string[] = []): { source: InstrumentSource; asked: string[] } {
    const index = {
        programs: Object.fromEntries(
            [0, 25, 28, 30].map((p) => [String(p), { file: `p${String(p).padStart(3, '0')}.sf3` }])
        ),
        drums: { file: 'drums.sf3' },
        click: { file: 'click.sf3' }
    }
    const asked: string[] = []
    return {
        asked,
        source: (file) => {
            asked.push(file)
            if (lacking.includes(file)) return Promise.resolve(null)
            return Promise.resolve(bytes(file === 'index.json' ? JSON.stringify(index) : file))
        }
    }
}

const font = 'data:font/woff2;base64,'
const whole = bytes('whole soundfont')
const play = (host: HTMLElement) =>
    host.querySelector<HTMLButtonElement>('.mn-tab-bar button[aria-label="Play"]')!.click()

describe('a score loads only the instruments it plays (#108)', () => {
    it('at the first Play: the files of its programs and the click, then it plays', async () => {
        const { mod, made } = fake()
        const { source, asked } = folder()
        const host = document.createElement('div')
        const result = renderTab('tab', '\\instrument 30\n.\n:4 3.3', host, {
            alphaTab: mod,
            assets: { scriptFile: null, font, soundFont: whole, instruments: source }
        })
        await result.ready
        // Nothing before Play: a page full of tabs costs nothing.
        expect(asked).toEqual([])
        play(host)
        await tick()
        await tick()
        const api = made[0]!
        expect(asked).toEqual(['index.json', 'p030.sf3', 'click.sf3'])
        // The first file replaces what was loaded, the others are added to it.
        expect(api.loads).toEqual([
            ['p030.sf3', false],
            ['click.sf3', true]
        ])
        expect(api.plays).toBe(1)
        result.destroy()
    })

    it('plays the whole soundfont when the folder lacks one of its instruments', async () => {
        const { mod, made } = fake()
        const { source } = folder()
        const host = document.createElement('div')
        // Program 40 (a violin) is not in the folder.
        const result = renderTab('tab', '\\instrument 40\n.\n:4 3.3', host, {
            alphaTab: mod,
            assets: { scriptFile: null, font, soundFont: whole, instruments: source }
        })
        await result.ready
        play(host)
        await tick()
        await tick()
        expect(made[0]!.loads).toEqual([['whole soundfont', false]])
        expect(made[0]!.plays).toBe(1)
        result.destroy()
    })

    it("plays the whole soundfont when a file can't be read", async () => {
        const { mod, made } = fake()
        const { source } = folder(['click.sf3'])
        const host = document.createElement('div')
        const result = renderTab('tab', '\\instrument 30\n.\n:4 3.3', host, {
            alphaTab: mod,
            assets: { scriptFile: null, font, soundFont: whole, instruments: source }
        })
        await result.ready
        play(host)
        await tick()
        await tick()
        // Nothing is half loaded.
        expect(made[0]!.loads).toEqual([['whole soundfont', false]])
        result.destroy()
    })

    it('says so on Play when no sound can be loaded, and the score stays', async () => {
        const { mod, made } = fake()
        const { source } = folder(['index.json'])
        const original = window.fetch.bind(window)
        window.fetch = (() =>
            Promise.resolve(new Response('no', { status: 404 }))) as unknown as typeof window.fetch
        const host = document.createElement('div')
        try {
            // No folder, and the whole soundfont's URL answers 404.
            const result = renderTab('tab', ':4 3.3', host, {
                alphaTab: mod,
                assets: {
                    scriptFile: null,
                    font,
                    soundFont: 'https://sounds.example/whole.sf3',
                    instruments: source
                }
            })
            await result.ready
            play(host)
            await tick()
            await tick()
            const button = host.querySelector<HTMLButtonElement>('.mn-tab-bar .mn-play-toggle')!
            expect(button.disabled).toBe(true)
            expect(button.title).toBe(
                "Can't play: Couldn't load the soundfont (https://sounds.example/whole.sf3)"
            )
            expect(made[0]!.loads).toEqual([])
            expect(made[0]!.plays).toBe(0)
            expect(host.querySelector('.mn-tab-surface')).not.toBeNull()
            result.destroy()
        } finally {
            window.fetch = original
        }
    })

    it('without a folder, the whole soundfont as before', async () => {
        const { mod, made } = fake()
        const host = document.createElement('div')
        const result = renderTab('tab', ':4 3.3', host, {
            alphaTab: mod,
            assets: { scriptFile: null, font, soundFont: whole }
        })
        await result.ready
        play(host)
        await tick()
        expect(made[0]!.loads).toEqual([['whole soundfont', false]])
        expect(made[0]!.plays).toBe(1)
        result.destroy()
    })
})

describe("the diagrams' player loads only its own sounds (#108)", () => {
    const note = [{ midi: 60, time: 0, duration: 0.5 }]

    it('a guitar, a piano, the muted guitar and the click, before the first note', async () => {
        const { mod, made } = fake()
        const { source, asked } = folder()
        const player = createSoundfontPlayer(
            mod,
            { scriptFile: null, font, soundFont: whole, instruments: source },
            document
        )
        expect(made.length).toBe(0)
        player.play(note, { sound: 'guitar', volume: 0.8 })
        await tick()
        await tick()
        expect(asked).toEqual(['index.json', 'p025.sf3', 'p000.sf3', 'p028.sf3', 'click.sf3'])
        expect(made[0]!.loads).toEqual([
            ['p025.sf3', false],
            ['p000.sf3', true],
            ['p028.sf3', true],
            ['click.sf3', true]
        ])
        // The folder's files, not the whole soundfont's URL in alphaTab's settings.
        expect(made[0]!.oneTime).toBe(1)
        player.destroy()
    })

    it('the whole soundfont when the folder is not there', async () => {
        const { mod, made } = fake()
        const { source } = folder(['index.json'])
        const player = createSoundfontPlayer(
            mod,
            { scriptFile: null, font, soundFont: whole, instruments: source },
            document
        )
        player.play(note, { sound: 'piano', volume: 0.8 })
        await tick()
        await tick()
        expect(made[0]!.loads).toEqual([['whole soundfont', false]])
        expect(made[0]!.oneTime).toBe(1)
        player.destroy()
    })
})
