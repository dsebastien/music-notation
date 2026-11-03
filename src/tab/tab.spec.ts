import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import {
    alphaTabCdn,
    ALPHATAB_VERSION,
    createSoundfontPlayer,
    exportGp7,
    exportMidi,
    parseTabSource,
    renderTab,
    scoreToAlphaTex,
    soundfontPlayer,
    type AlphaTabModule
} from './index.js'
import { textTabToAlphaTex } from '../convert/text-tab.js'
import { chordSheetToChordPro } from '../convert/chord-sheet.js'

describe('parseTabSource', () => {
    it('reads the settings on top, then the alphaTex', () => {
        expect(parseTabSource('tab', ':4 3.3 0.2')).toEqual({
            staves: 'tab',
            file: null,
            tracks: null,
            tex: ':4 3.3 0.2',
            texLine: 0
        })
        const parsed = parseTabSource('score', 'staves: both\ntracks: 1 2\n\n:4 3.3')
        expect(parsed).toMatchObject({ staves: 'both', tracks: [1, 2], tex: ':4 3.3', texLine: 3 })
        expect(parseTabSource('tab', 'file: [[Songs/Blues.gp|Blues]]').file).toBe('Songs/Blues.gp')
    })

    it('says what to write', () => {
        expect(() => parseTabSource('tab', '')).toThrow('Write the music in alphaTex')
        expect(() => parseTabSource('tab', 'staves: piano')).toThrow(
            'staves: use tab, score or both'
        )
        expect(() => parseTabSource('tab', 'tracks: 0\n:4 3.3')).toThrow('tracks:')
    })
})

describe('import and export', () => {
    const at = alphaTab as unknown as AlphaTabModule
    it('exports Guitar Pro 7 and MIDI, and reads a score file back as alphaTex', () => {
        const gp = exportGp7(at, ':4 3.3 0.2 1.2 0.1')
        expect(String.fromCharCode(gp[0]!, gp[1]!)).toBe('PK')
        const midi = exportMidi(at, ':4 3.3 0.2 1.2 0.1')
        expect(String.fromCharCode(...midi.slice(0, 4))).toBe('MThd')
        const tex = scoreToAlphaTex(at, gp)
        expect(tex).toContain('\\tuning')
        expect(tex).toContain('3.3')
    })

    it('turns a text tab into alphaTex that alphaTab reads', () => {
        const tex = textTabToAlphaTex(
            [
                'e|-----0---|---------3-|',
                'B|---1---1-|-----0----|',
                'G|-0-------|---0---0--|',
                'D|2--------|-0--------|',
                'A|---------|----------|',
                'E|---------|3---------|'
            ].join('\n')
        )!
        expect(tex).toBe(':8 2.4 0.3 1.2 0.1 1.2 |\n3.6 0.4 0.3 0.2 0.3 3.1')
        const score = at.importer.ScoreLoader.loadAlphaTex(tex)
        expect(score.tracks[0]!.staves[0]!.bars).toHaveLength(2)
        expect(textTabToAlphaTex('no tab here')).toBeNull()
        expect(
            textTabToAlphaTex('e|--12--(10)--|\nB|-----------|\nG|-----------|\nD|-----------|')
        ).toContain('12.1')
    })

    it('turns a chord sheet into ChordPro', () => {
        expect(
            chordSheetToChordPro(
                '[Chorus]\nG         D/F#        Em\nHello there little world\nC   G\n'
            )
        ).toBe('{comment: Chorus}\n[G]Hello ther[D/F#]e little wor[Em]ld\n[C] [G]')
        expect(chordSheetToChordPro('Just words\nAnd more')).toBe('Just words\nAnd more')
    })

    it('knows where web pages load alphaTab from', () => {
        expect(alphaTabCdn().script).toContain(`@coderline/alphatab@${ALPHATAB_VERSION}/`)
    })
})

/** An alphaTab stand-in: draws nothing, reports success, or the error it's told to. */
function fakeAlphaTab(error?: unknown): AlphaTabModule {
    const emitter = () => {
        const handlers: ((e: unknown) => void)[] = []
        return {
            on: (h: (e: unknown) => void) => handlers.push(h),
            fire: (e?: unknown) => handlers.forEach((h) => h(e))
        }
    }
    class Api {
        renderFinished = emitter()
        error = emitter()
        playerStateChanged = emitter()
        playerPositionChanged = emitter()
        soundFontLoaded = emitter()
        playerReady = emitter()
        loaded: unknown = null
        tex(text: string) {
            this.loaded = text
            queueMicrotask(() => (error ? this.error.fire(error) : this.renderFinished.fire()))
        }
        load(bytes: Uint8Array) {
            this.loaded = bytes
            queueMicrotask(() => this.renderFinished.fire())
        }
        loadSoundFont() {}
        destroy() {}
    }
    return {
        AlphaTabApi: Api,
        FontFileFormat: { Woff2: 3 },
        LogLevel: { Warning: 2 },
        PlayerMode: { Disabled: 0, EnabledSynthesizer: 2 }
    } as unknown as AlphaTabModule
}

describe('createSoundfontPlayer', () => {
    it('loads a song with every diagram sound, so alphaTab loads the piano preset too', () => {
        const mod = fakeAlphaTab()
        const made: { loaded: unknown }[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => { loaded: unknown }
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                made.push(this)
            }
        }
        const assets = {
            scriptFile: null,
            font: 'data:font/woff2;base64,',
            soundFont: new Uint8Array()
        }
        createSoundfontPlayer(mod, assets, document).play([{ midi: 60, time: 0, duration: 1 }], {
            sound: 'piano',
            volume: 1
        })
        const tex = made[0]!.loaded as string
        const real = alphaTab as unknown as AlphaTabModule
        const score = real.importer.ScoreLoader.loadAlphaTex(tex)
        expect(score.tracks.map((t) => t.playbackInfo.program).sort((a, b) => a - b)).toEqual([
            0, 25
        ])
    })
})

describe('createSoundfontPlayer readiness (review)', () => {
    it('plays only once the soundfont is loaded and the player is ready', async () => {
        const mod = fakeAlphaTab()
        type Fake = { soundFontLoaded: { fire(): void }; playerReady: { fire(): void } }
        const made: Fake[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => Fake
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                made.push(this)
            }
        }
        let fallbackPlays = 0
        const fallback = { play: () => (fallbackPlays++, { stop() {} }) }
        const assets = {
            scriptFile: null,
            font: 'data:font/woff2;base64,',
            soundFont: new Uint8Array()
        }
        createSoundfontPlayer(mod, assets, document, fallback).play(
            [{ midi: 60, time: 0, duration: 1 }],
            {
                sound: 'piano',
                volume: 1
            }
        )
        made[0]!.soundFontLoaded.fire()
        await new Promise((r) => setTimeout(r, 0))
        // The fake has no player, so a play falls back: it must not happen before playerReady.
        expect(fallbackPlays).toBe(0)
        made[0]!.playerReady.fire()
        await new Promise((r) => setTimeout(r, 0))
        expect(fallbackPlays).toBe(1)
    })
})

describe('soundfont players say when their notes start (#41)', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    const note = [{ midi: 60, time: 0, duration: 1 }]

    it('calls onStart right after the synthesizer starts the notes', async () => {
        const order: string[] = []
        const api = {
            masterVolume: 1,
            playbackSpeed: 1,
            player: { playOneTimeMidiFile: () => order.push('play'), stop() {} }
        }
        const player = soundfontPlayer(alphaTab as unknown as AlphaTabModule, () => api as never)
        expect(player.reportsStart).toBe(true)
        player.play(note, { sound: 'guitar', volume: 1, onStart: () => order.push('start') })
        await Promise.resolve()
        expect(order).toEqual(['play', 'start'])
        const stopped = player.play(note, {
            sound: 'guitar',
            volume: 1,
            onStart: () => order.push('late')
        })
        stopped.stop()
        await Promise.resolve()
        expect(order).not.toContain('late')
    })

    it('waits for the soundfont, then lets a fallback that says nothing start now', async () => {
        const mod = fakeAlphaTab()
        type Fake = { soundFontLoaded: { fire(): void }; playerReady: { fire(): void } }
        const made: Fake[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => Fake
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                made.push(this)
            }
        }
        let started = 0
        const player = createSoundfontPlayer(mod, assets, document, { play: () => ({ stop() {} }) })
        expect(player.reportsStart).toBe(true)
        player.play(note, { sound: 'piano', volume: 1, onStart: () => started++ })
        made[0]!.soundFontLoaded.fire()
        await new Promise((r) => setTimeout(r, 0))
        expect(started).toBe(0)
        made[0]!.playerReady.fire()
        await new Promise((r) => setTimeout(r, 0))
        expect(started).toBe(1)
        player.destroy()
    })
})

describe('renderTab', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    const host = () => document.createElement('div')

    it('draws alphaTex with its player bar', async () => {
        const h = host()
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: fakeAlphaTab(), assets })
        expect(await result.ready).toEqual({ ok: true, error: null })
        const labels = [...h.querySelectorAll('.mn-tab-bar button')].map((b) =>
            b.getAttribute('aria-label')
        )
        expect(labels).toEqual(['Play', 'Stop', 'Loop', 'Metronome', 'Count-in'])
        expect(h.querySelector('.mn-tab-time')?.textContent).toBe('')
    })

    it('draws a file the app finds, and says when it does not', async () => {
        const found = renderTab('score', 'file: [[Blues.gp]]', host(), {
            alphaTab: fakeAlphaTab(),
            assets,
            resolveFile: (link) => Promise.resolve(link === 'Blues.gp' ? new Uint8Array([1]) : null)
        })
        expect((await found.ready).ok).toBe(true)
        const missing = renderTab('score', 'file: [[Nope.gp]]', host(), {
            alphaTab: fakeAlphaTab(),
            assets,
            resolveFile: () => Promise.resolve(null)
        })
        expect(await missing.ready).toEqual({
            ok: false,
            error: `Couldn't find the file "Nope.gp"`
        })
    })

    it("shows alphaTab's first mistake with its place in the block", async () => {
        const cause = {
            parserDiagnostics: {
                items: [{ severity: 2, message: 'Group not closed.', start: { line: 1, col: 4 } }]
            }
        }
        const h = host()
        const result = renderTab('tab', 'staves: both\n:4 (3.3', h, {
            alphaTab: fakeAlphaTab(Object.assign(new Error('Error parsing alphaTex'), { cause })),
            assets
        })
        expect((await result.ready).error).toBe('line 2, column 4: Group not closed.')
        expect(h.querySelector('.mn-error-message')?.textContent).toBe(
            'tab: line 2, column 4: Group not closed.'
        )
    })
})

describe('soundfontPlayer', () => {
    it('plays each note at its velocity, 100 when none is given', () => {
        let played: { tracks: { events: { noteKey?: number; noteVelocity?: number }[] }[] } | null =
            null
        const api = {
            masterVolume: 1,
            playbackSpeed: 1,
            player: { playOneTimeMidiFile: (midi: typeof played) => (played = midi), stop() {} }
        }
        const player = soundfontPlayer(alphaTab as AlphaTabModule, () => api as never)
        player
            .play(
                [
                    { midi: 60, time: 0, duration: 0.5, velocity: 40 },
                    { midi: 64, time: 0, duration: 0.5 },
                    { midi: 67, time: 0, duration: 0.5, velocity: 300 }
                ],
                { sound: 'guitar', volume: 0.5 }
            )
            .stop()
        const noteOns = played!.tracks
            .flatMap((t) => t.events)
            .filter((e) => e.constructor.name === 'NoteOnEvent')
        expect(noteOns.map((e) => [e.noteKey, e.noteVelocity])).toEqual([
            [60, 40],
            [64, 100],
            [67, 127]
        ])
    })
})

describe('renderTab, drums (#37)', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    /** The stave profile renderTab asks alphaTab for. */
    async function profileOf(language: 'tab' | 'score', source: string) {
        const mod = fakeAlphaTab()
        let profile: unknown
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => object
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                profile = (args[1] as { display: { staveProfile: unknown } }).display.staveProfile
            }
        }
        const h = document.createElement('div')
        document.body.appendChild(h)
        await renderTab(language, source, h, { alphaTab: mod, assets }).ready
        h.remove()
        return profile
    }

    it('draws a percussion track as notation in a tab block: drums have no tablature', async () => {
        const drums = textTabToAlphaTex('HH|x-x-x-x-|\nS |--o---o-|\nB |o---o---|')!
        expect(await profileOf('tab', drums)).toBe('ScoreTab')
        expect(await profileOf('tab', ':8 0.1 3.1')).toBe('Tab')
        expect(await profileOf('score', drums)).toBe('Score')
        expect(await profileOf('tab', `staves: both\n${drums}`)).toBe('ScoreTab')
    })
})
