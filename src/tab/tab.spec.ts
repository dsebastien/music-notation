import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import { volumeChanged } from '../playback/live-volume.js'
import {
    alphaTabCdn,
    ALPHATAB_VERSION,
    createSoundfontPlayer,
    exportGp7,
    exportMidi,
    hideDefaultDynamics,
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
            stavesWritten: false,
            file: null,
            tracks: null,
            engine: null,
            layout: 'page',
            tex: ':4 3.3 0.2',
            texLine: 0,
            fromText: false
        })
        const parsed = parseTabSource('score', 'staves: both\ntracks: 1 2\n\n:4 3.3')
        expect(parsed).toMatchObject({
            staves: 'both',
            stavesWritten: true,
            tracks: [1, 2],
            tex: ':4 3.3',
            texLine: 3
        })
        expect(parseTabSource('tab', 'file: [[Songs/Blues.gp|Blues]]').file).toBe('Songs/Blues.gp')
    })

    it('reads a text tab pasted from the web as the tab it shows (#71)', () => {
        // Before: alphaTab's "No alphaTex data found".
        const parsed = parseTabSource(
            'tab',
            'staves: both\n\ne|--0--3--|\nB|--1--0--|\nG|--0--0--|\nD|--2--0--|'
        )
        expect(parsed).toMatchObject({
            staves: 'both',
            tex: ':2 (0.1 1.2 0.3 2.4) (3.1 0.2 0.3 0.4)',
            fromText: true
        })
        // alphaTex stays as written.
        expect(parseTabSource('tab', ':4 0.6 2.5 | 3.4').fromText).toBe(false)
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
    const at = alphaTab
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
        expect(tex).toBe(':8 2.4 0.3 1.2 0.1 1.2 r :4 r |\n:8 3.6 0.4 0.3 0.2 0.3 3.1 :4 r')
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
        postRenderFinished = emitter()
        error = emitter()
        playerStateChanged = emitter()
        playerPositionChanged = emitter()
        soundFontLoaded = emitter()
        playerReady = emitter()
        scoreLoaded = emitter()
        renderer = { partialRenderFinished: emitter() }
        settings = { player: {} as Record<string, unknown> }
        masterVolume = 1
        player: unknown = null
        updateSettings() {}
        playPause() {}
        loaded: unknown = null
        /** The score alphaTab would draw, after the scoreLoaded handlers ran. */
        score: alphaTab.model.Score | null = null
        tex(text: string, tracks?: number[] | 'all') {
            this.loaded = text
            queueMicrotask(() => {
                if (error) return this.error.fire(error)
                this.show(alphaTab.importer.ScoreLoader.loadAlphaTex(text), tracks)
            })
        }
        load(bytes: Uint8Array, tracks?: number[]) {
            this.loaded = bytes
            queueMicrotask(() => {
                // Not a real score file in most tests (no zip): only the drawing is faked then.
                const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
                this.show(
                    zip ? alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes) : null,
                    tracks
                )
            })
            return true
        }
        show(score: alphaTab.model.Score | null, tracks?: number[] | 'all') {
            if (score) {
                // Like alphaTab: scoreLoaded fires before the drawing.
                this.score = score
                this.scoreLoaded.fire(score)
            }
            void tracks
            this.renderFinished.fire()
        }
        /** Redraws asked for after the first drawing (the view control). */
        renders = 0
        render() {
            this.renders++
            queueMicrotask(() => this.renderFinished.fire())
        }
        loadSoundFont() {}
        destroy() {}
    }
    return {
        AlphaTabApi: Api,
        FontFileFormat: { Woff2: 3 },
        LogLevel: { Warning: 2 },
        PlayerMode: { Disabled: 0, EnabledSynthesizer: 2 },
        ScrollMode: { Off: 0, Continuous: 1, OffScreen: 2 }
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
        const real = alphaTab
        const score = real.importer.ScoreLoader.loadAlphaTex(tex)
        expect(score.tracks.map((t) => t.playbackInfo.program).sort((a, b) => a - b)).toEqual([
            0, 25, 28
        ])
    })
    // Its cursor follows what plays, and alphaTab scrolls the page to its cursor unless told not
    // to: the hidden host sits at the end of the page, so a click on a diagram scrolled the docs
    // page to the bottom (tens of thousands of pixels).
    it('never scrolls the page: its hidden instance has scrolling and the cursor off', () => {
        const mod = fakeAlphaTab()
        const settings: unknown[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => object
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                settings.push(args[1])
            }
        }
        const assets = { scriptFile: null, font: 'data:font/woff2;base64,', soundFont: 'sf.sf2' }
        createSoundfontPlayer(mod, assets, document).play([{ midi: 60, time: 0, duration: 1 }], {
            sound: 'guitar',
            volume: 1
        })
        const player = (settings[0] as { player: { scrollMode?: unknown; enableCursor?: unknown } })
            .player
        expect(player.scrollMode).toBe(mod.ScrollMode.Off)
        expect(player.enableCursor).toBe(false)
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
        const player = soundfontPlayer(alphaTab, () => api as never)
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
        const labels = [...h.querySelectorAll('.mn-tab-bar button')].map(
            (b) => b.getAttribute('aria-label') ?? b.textContent
        )
        // Then the view control (#83).
        expect(labels).toEqual([
            'Play',
            'Stop',
            'Loop',
            'Metronome',
            'Count-in',
            // The tempo (#114).
            'Slower',
            'Show the speed in percent',
            'Faster',
            'Back to 100 %',
            'Tab',
            'Score',
            'Both',
            // Follow the music (#97).
            'Follow the music',
            // And full screen (#113).
            'Full screen'
        ])
        expect(h.querySelector('.mn-tab-time')?.textContent).toBe('')
    })

    it('never scrolls the page while it plays', async () => {
        // alphaTab's default (Continuous) scrolled the docs page by 200-500 px at each Play;
        // OffScreen jumped tens of thousands of pixels.
        const mod = fakeAlphaTab()
        const made: unknown[][] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => object
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                made.push(args)
            }
        }
        const result = renderTab('tab', ':4 3.3', host(), { alphaTab: mod, assets })
        await result.ready
        const settings = made[0]![1] as { player: { scrollMode?: number } }
        expect(settings.player.scrollMode).toBe(0)
    })

    it('tells the speed set on its bar, before the player starts too (Music Practice #70)', async () => {
        const h = host()
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: fakeAlphaTab(), assets })
        await result.ready
        expect(result.speed()).toBe(1)
        // The tempo control (#114), in percent here.
        const unit = h.querySelector<HTMLButtonElement>('.mn-tab-bar .mn-tempo-unit')!
        if (unit.textContent === 'BPM') unit.click()
        const speed = h.querySelector<HTMLInputElement>('.mn-tab-bar .mn-tempo-value')!
        speed.value = '125'
        speed.dispatchEvent(new Event('change'))
        // The player starts at the first Play: alphaTab's playbackSpeed is still 1.
        expect(result.speed()).toBe(1.25)
        result.destroy()
        expect(result.speed()).toBe(1.25)
    })

    it('tells a speed of 1 when it has no player bar', async () => {
        const result = renderTab('tab', ':4 3.3', host(), {
            alphaTab: fakeAlphaTab(),
            assets,
            player: false
        })
        await result.ready
        expect(result.speed()).toBe(1)
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

    it('draws every part right away, not only once an observer sees it (#82)', async () => {
        // Lazy loading drew a part only when an IntersectionObserver saw it: on a page that
        // isn't painted (an Obsidian window on another desktop, a PDF export) every part
        // stayed empty, with no error.
        for (const scriptFile of [null, 'blob:alphaTab']) {
            const mod = fakeAlphaTab()
            let core: Record<string, unknown> = {}
            const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => object
            ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
                constructor(...args: unknown[]) {
                    super(...args)
                    core = (args[1] as { core: Record<string, unknown> }).core
                }
            }
            await renderTab('tab', ':8 0.6 0.3 0.2 0.1', host(), {
                alphaTab: mod,
                assets: { ...assets, scriptFile }
            }).ready
            expect(core['useWorkers']).toBe(Boolean(scriptFile))
            expect(core['enableLazyLoading']).toBe(false)
        }
    })
})

describe('tab blocks draw only what was written (#66)', () => {
    const at = alphaTab
    const hidden = (tex: string, file = false) => {
        const score = at.importer.ScoreLoader.loadAlphaTex(tex)
        hideDefaultDynamics(score, file ? null : tex)
        return score.stylesheet.hideDynamics
    }

    it('hides the forte alphaTab gives every beat, and keeps written dynamics', () => {
        expect(hidden(':4 3.3 0.2 1.2 0.1')).toBe(true)
        expect(hidden(':4 3.3{dy p} 0.2 1.2{dy f} 0.1')).toBe(false)
        // Written forte, or asked for.
        expect(hidden(':4 3.3{dy f} 0.2')).toBe(false)
        expect(hidden('\\showDynamics\n:4 3.3 0.2')).toBe(false)
        // A file: only its dynamics tell.
        expect(hidden(':4 3.3 0.2', true)).toBe(true)
        expect(hidden(':4 3.3{dy pp} 0.2', true)).toBe(false)
    })

    it('hides the "rendered by alphaTab" line, and shows a reused part again', async () => {
        const mod = fakeAlphaTab()
        let api: { renderer: { partialRenderFinished: { fire(e: unknown): void } } } | null = null
        const h = document.createElement('div')
        const result = renderTab('score', ':4 3.3', h, {
            alphaTab: mod,
            assets: {
                scriptFile: null,
                font: 'data:font/woff2;base64,',
                soundFont: new Uint8Array()
            },
            onApi: (a) => (api = a as never)
        })
        await result.ready
        expect(
            (api as unknown as { score: alphaTab.model.Score }).score.stylesheet.hideDynamics
        ).toBe(true)
        // alphaTab's drawing: one element per part, in .at-surface.
        const surface = h.querySelector('.mn-tab-surface')!
        const parts = surface.appendChild(document.createElement('div'))
        parts.className = 'at-surface'
        const part = parts.appendChild(document.createElement('div'))
        Object.assign(part, { layoutResultId: 'p1' })
        api!.renderer.partialRenderFinished.fire({
            id: 'p1',
            renderResult: '<svg><text>rendered by alphaTab</text></svg>'
        })
        expect(part.style.visibility).toBe('hidden')
        Object.assign(part, { layoutResultId: 'p2' })
        api!.renderer.partialRenderFinished.fire({ id: 'p2', renderResult: '<svg><g/></svg>' })
        expect(part.style.visibility).toBe('')
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
        const player = soundfontPlayer(alphaTab, () => api as never)
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

    it('lets the last notes ring: the song ends half a second after them (#59)', () => {
        type Event = { tick: number; constructor: { name: string } }
        let played: { division: number; tracks: { events: Event[] }[] } | null = null
        const api = {
            masterVolume: 1,
            playbackSpeed: 1,
            player: { playOneTimeMidiFile: (midi: typeof played) => (played = midi), stop() {} }
        }
        const player = soundfontPlayer(alphaTab, () => api as never)
        player.play([{ midi: 60, time: 0, duration: 1 }], { sound: 'piano', volume: 1 }).stop()
        const events = played!.tracks.flatMap((t) => t.events)
        const last = Math.max(...events.map((e) => e.tick))
        const noteOff = events.find((e) => e.constructor.name === 'NoteOffEvent')!
        expect(noteOff.tick).toBe(played!.division)
        expect(last).toBe(played!.division * 1.5)
    })
})

describe('renderTab, drums (#37)', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    /** The stave profile renderTab asks alphaTab for, and what each staff shows. */
    async function stavesOf(language: 'tab' | 'score', source: string, bytes?: Uint8Array) {
        const mod = fakeAlphaTab()
        let profile: unknown
        const made: { score: alphaTab.model.Score | null }[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => {
            score: alphaTab.model.Score | null
        }
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                profile = (args[1] as { display: { staveProfile: unknown } }).display.staveProfile
                made.push(this)
            }
        }
        const h = document.createElement('div')
        document.body.appendChild(h)
        await renderTab(language, source, h, {
            alphaTab: mod,
            assets,
            resolveFile: () => Promise.resolve(bytes ?? null)
        }).ready
        h.remove()
        const staves = made[0]!.score!.tracks.map((t) =>
            t.staves
                .map((s) =>
                    [
                        s.showStandardNotation ? 'score' : '',
                        s.showTablature ? 'tab' : '',
                        s.showSlash ? 'slash' : '',
                        s.showNumbered ? 'numbered' : ''
                    ]
                        .filter(Boolean)
                        .join('+')
                )
                .join(' ')
        )
        const clefs = made[0]!.score!.tracks.map((t) => t.staves[0]!.bars.map((b) => b.clef))
        return { profile, staves, clefs }
    }

    const drums = textTabToAlphaTex('HH|x-x-x-x-|\nS |--o---o-|\nB |o---o---|')!
    const band = `\\track "Guitar"\n:4 3.3 0.2 1.2 0.1\n\\track "Drums"\n${drums}`

    it('draws drums as notation in a tab block, staff by staff: drums have no tablature', async () => {
        expect(await stavesOf('tab', drums)).toMatchObject({
            profile: 'Default',
            staves: ['score']
        })
        expect((await stavesOf('tab', ':8 0.1 3.1')).staves).toEqual(['tab'])
        // The guitar keeps its tablature only; the drums get notation.
        expect((await stavesOf('tab', band)).staves).toEqual(['tab', 'score'])
        expect((await stavesOf('score', band)).staves).toEqual(['score', 'score'])
        expect((await stavesOf('tab', `staves: both\n${band}`)).staves).toEqual([
            'score+tab',
            'score'
        ])
    })

    it('gives drums the percussion clef, and leaves the guitar its own', async () => {
        const { clefs } = await stavesOf('tab', band)
        expect(clefs[1]!.every((c) => c === alphaTab.model.Clef.Neutral)).toBe(true)
        expect(clefs[0]!.every((c) => c !== alphaTab.model.Clef.Neutral)).toBe(true)
    })

    it('chooses the staves of a score file too (Guitar Pro drums in a tab block)', async () => {
        const gp = exportGp7(alphaTab, band)
        expect((await stavesOf('tab', 'file: [[Band.gp]]', gp)).staves).toEqual(['tab', 'score'])
        expect((await stavesOf('score', 'file: [[Band.gp]]', gp)).staves).toEqual([
            'score',
            'score'
        ])
    })
})

describe('renderTab, the view control (Music Practice #83)', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    type Made = { score: alphaTab.model.Score | null; renders: number }
    async function draw(
        language: 'tab' | 'score',
        source: string,
        options: Partial<Parameters<typeof renderTab>[3]> = {}
    ) {
        const mod = fakeAlphaTab()
        const made: Made[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => Made
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                made.push(this)
            }
        }
        const h = document.createElement('div')
        const result = renderTab(language, source, h, { alphaTab: mod, assets, ...options })
        await result.ready
        const api = made[0]!
        const buttons = () =>
            [...h.querySelectorAll<HTMLButtonElement>('.mn-tab-views .mn-tab-view')].map(
                (b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`
            )
        const click = (label: string) =>
            [...h.querySelectorAll<HTMLButtonElement>('.mn-tab-views button')]
                .find((b) => b.textContent === label)!
                .click()
        const keep = () => h.querySelector<HTMLButtonElement>('.mn-tab-keep')
        const staves = () =>
            api.score!.tracks.map((t) =>
                t.staves
                    .map((s) =>
                        [s.showStandardNotation ? 'score' : '', s.showTablature ? 'tab' : '']
                            .filter(Boolean)
                            .join('+')
                    )
                    .join(' ')
            )
        return { h, api, buttons, click, keep, staves }
    }

    const drums = textTabToAlphaTex('HH|x-x-x-x-|\nS |--o---o-|\nB |o---o---|')!
    const band = `\\track "Guitar"\n:4 3.3 0.2 1.2 0.1\n\\track "Drums"\n${drums}`

    it('shows Tab, Score and Both in the bar, the view drawn pressed', async () => {
        const tab = await draw('tab', ':4 3.3 0.2')
        expect(tab.buttons()).toEqual(['Tab*', 'Score', 'Both'])
        // No staves: line: the pressed button says it's the default.
        const title = tab.h.querySelector<HTMLButtonElement>('[data-staves="tab"]')!.title
        expect(title).toContain('the default')
        expect((await draw('score', ':4 3.3 0.2')).buttons()).toEqual(['Tab', 'Score*', 'Both'])
        const both = await draw('tab', 'staves: both\n:4 3.3 0.2')
        expect(both.buttons()).toEqual(['Tab', 'Score', 'Both*'])
        expect(both.h.querySelector<HTMLButtonElement>('[data-staves="both"]')!.title).toContain(
            "this block's staves: line"
        )
    })

    it('draws the loaded score again in the view clicked, without loading it again', async () => {
        const { api, buttons, click, staves } = await draw('tab', ':4 3.3 0.2')
        const score = api.score
        click('Score')
        expect(buttons()).toEqual(['Tab', 'Score*', 'Both'])
        expect(staves()).toEqual(['score'])
        expect(api.renders).toBe(1)
        expect(api.score).toBe(score)
        click('Both')
        expect(staves()).toEqual(['score+tab'])
        click('Both')
        expect(api.renders).toBe(2)
    })

    it('shows slash staves again in Both after another view hid them', async () => {
        const { api, click } = await draw('tab', 'staves: both\n\\staff {slash tabs}\n:4 3.3 0.2')
        const staff = () => api.score!.tracks[0]!.staves[0]!
        expect(staff().showSlash).toBe(true)
        click('Tab')
        expect(staff().showSlash).toBe(false)
        click('Both')
        expect(staff().showSlash).toBe(true)
    })

    it('has no view control for drums or piano alone, and keeps it for a band', async () => {
        expect((await draw('tab', drums)).buttons()).toEqual([])
        expect((await draw('score', ':4 C4 E4 G4')).buttons()).toEqual([])
        // Only the drums drawn (tracks: 2): one view.
        expect((await draw('tab', `tracks: 2\n${band}`)).buttons()).toEqual([])
        const mixed = await draw('score', band)
        expect(mixed.buttons()).toEqual(['Tab', 'Score*', 'Both'])
        mixed.click('Tab')
        expect(mixed.staves()).toEqual(['tab', 'score'])
    })

    it('offers Keep this view only with onKeepView, once the view differs', async () => {
        expect((await draw('tab', ':4 3.3')).keep()).toBeNull()
        const kept: string[] = []
        const block = await draw('tab', ':4 3.3', { onKeepView: (s) => kept.push(s) })
        expect(block.keep()!.hidden).toBe(true)
        block.click('Score')
        expect(block.keep()!.hidden).toBe(false)
        block.keep()!.click()
        expect(kept).toEqual(['score'])
        block.click('Tab')
        expect(block.keep()!.hidden).toBe(true)
    })

    it('leaves the control out with views: false, and takes the app default view', async () => {
        expect((await draw('tab', ':4 3.3', { views: false })).buttons()).toEqual([])
        const text = await draw('score', ':4 3.3', { defaultStaves: 'tab' })
        expect(text.buttons()).toEqual(['Tab*', 'Score', 'Both'])
        expect(text.staves()).toEqual(['tab'])
        // A staves: line wins over the app default.
        const written = await draw('score', 'staves: score\n:4 3.3', { defaultStaves: 'tab' })
        expect(written.buttons()).toEqual(['Tab', 'Score*', 'Both'])
    })
})

describe('the tab and score bar looks and works like the other bars (#82)', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    const host = () => document.createElement('div')

    it('is a play bar below the score, always shown, with the shared icons and parts', async () => {
        const h = host()
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: fakeAlphaTab(), assets })
        await result.ready
        const bar = h.querySelector('.mn-tab-bar')!
        expect(bar.classList.contains('mn-play')).toBe(true)
        expect(bar.classList.contains('mn-play-static')).toBe(true)
        expect(bar.getAttribute('aria-label')).toBe('Playback')
        const iconOf = (label: string) =>
            bar.querySelector(`button[aria-label="${label}"] svg`)!.getAttribute('class')
        expect(iconOf('Count-in')).toContain('mn-play-icon-count')
        expect(iconOf('Metronome')).toContain('mn-play-icon-click')
        expect(iconOf('Loop')).toContain('mn-play-icon-loop')
        // The tempo shows in BPM, with the speed in percent next to it (#114).
        expect(bar.querySelector<HTMLInputElement>('.mn-tempo-value')?.value).toBe(
            String(Math.round(result.api!.score!.tempo))
        )
        expect(bar.querySelector('.mn-tempo-unit')?.textContent).toBe('BPM')
        expect(bar.querySelector('.mn-tempo-other')?.textContent).toBe('· 100 %')
        // No volume on the bar: it is the app's.
        expect(bar.querySelector('input[aria-label="Volume"]')).toBeNull()
        result.destroy()
    })

    it("plays at the app's volume, and follows it while it plays", async () => {
        const mod = fakeAlphaTab()
        const made: { masterVolume: number; player: unknown; playerReady: { fire(): void } }[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => (typeof made)[0]
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            constructor(...args: unknown[]) {
                super(...args)
                made.push(this)
            }
        }
        let volume = 0.3
        const h = host()
        const result = renderTab('tab', ':4 3.3', h, {
            alphaTab: mod,
            assets,
            volume: () => volume
        })
        await result.ready
        h.querySelector<HTMLButtonElement>('.mn-tab-bar button[aria-label="Play"]')!.click()
        // alphaTab has its player once it is ready.
        made[0]!.player = {}
        made[0]!.playerReady.fire()
        await new Promise((r) => setTimeout(r, 0))
        expect(made[0]!.masterVolume).toBe(0.3)
        volume = 0.6
        volumeChanged()
        expect(made[0]!.masterVolume).toBe(0.6)
        result.destroy()
        volume = 0.1
        volumeChanged()
        expect(made[0]!.masterVolume).toBe(0.6)
    })
})

describe('renderTab, full screen (#113)', () => {
    const assets = {
        scriptFile: null,
        font: 'data:font/woff2;base64,',
        soundFont: new Uint8Array()
    }
    type Made = {
        settings: { player: Record<string, unknown> }
        playerStateChanged: { fire(e: unknown): void }
        playerPositionChanged: { fire(e: unknown): void }
        updates: number
        options: { player: Record<string, unknown> }
    }
    /** A fake alphaTab that keeps the APIs it makes, the settings they got, and their updates. */
    const tracked = () => {
        const mod = fakeAlphaTab()
        const made: Made[] = []
        const Base = mod.AlphaTabApi as unknown as new (...args: unknown[]) => Made
        ;(mod as { AlphaTabApi: unknown }).AlphaTabApi = class extends Base {
            override updates = 0
            override options: Made['options']
            constructor(...args: unknown[]) {
                super(...args)
                this.options = args[1] as Made['options']
                made.push(this)
            }
            updateSettings() {
                this.updates++
            }
        }
        ;(mod as unknown as { synth: unknown }).synth = { PlayerState: { Paused: 0, Playing: 1 } }
        return { mod, made }
    }
    const full = (h: HTMLElement) =>
        h.querySelector<HTMLButtonElement>('.mn-tab-bar button[aria-label="Full screen"]')

    it('has a Full screen button at the end of the bar, unless the app turns it off', async () => {
        const h = document.createElement('div')
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: fakeAlphaTab(), assets })
        await result.ready
        const buttons = [...h.querySelectorAll('.mn-tab-bar button')]
        expect(buttons.at(-1)).toBe(full(h)!)
        result.destroy()
        const off = document.createElement('div')
        const none = renderTab('tab', ':4 3.3', off, {
            alphaTab: fakeAlphaTab(),
            assets,
            fullScreen: false
        })
        await none.ready
        expect(full(off)).toBeNull()
        none.destroy()
    })

    it("scrolls only the score's own area, and only in full screen", async () => {
        const { mod, made } = tracked()
        const h = document.createElement('div')
        document.body.appendChild(h)
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: mod, assets })
        await result.ready
        const api = made[0]!
        const surface = h.querySelector('.mn-tab-surface')!
        // The page is never what alphaTab scrolls (its default), and nothing follows at first (#89).
        expect(api.settings.player['scrollElement']).toBe(surface)
        // Not among the settings alphaTab starts with: those go to its workers, and an element
        // there broke the drawing's width.
        expect(api.options.player['scrollElement']).toBeUndefined()
        expect(api.options.player['scrollMode']).toBe(0)
        full(h)!.click()
        expect(result.el.classList.contains('mn-fullscreen')).toBe(true)
        expect(api.settings.player['scrollMode']).toBe(2)
        expect(api.updates).toBe(1)
        // A scroll by hand stops it; the music playing starts it again.
        surface.dispatchEvent(new Event('wheel'))
        expect(api.settings.player['scrollMode']).toBe(0)
        api.playerStateChanged.fire({ state: 0 })
        expect(api.settings.player['scrollMode']).toBe(0)
        api.playerStateChanged.fire({ state: 1 })
        expect(api.settings.player['scrollMode']).toBe(2)
        full(h)!.click()
        expect(result.el.classList.contains('mn-fullscreen')).toBe(false)
        expect(api.settings.player['scrollMode']).toBe(0)
        // Out of full screen, playing never turns it on.
        api.playerStateChanged.fire({ state: 1 })
        expect(api.settings.player['scrollMode']).toBe(0)
        result.destroy()
        h.remove()
    })

    const followOf = (h: HTMLElement) =>
        h.querySelector<HTMLButtonElement>('.mn-tab-bar .mn-tab-follow')!

    it('Follow is off at first, and never makes alphaTab scroll the page (#97, #89)', async () => {
        const { mod, made } = tracked()
        const h = document.createElement('div')
        document.body.appendChild(h)
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: mod, assets })
        await result.ready
        const api = made[0]!
        const follow = followOf(h)
        expect(follow.getAttribute('aria-pressed')).toBe('false')
        expect(api.updates).toBe(0)
        follow.click()
        expect(follow.getAttribute('aria-pressed')).toBe('true')
        expect(follow.classList.contains('mn-on')).toBe(true)
        // The page is scrolled by the library's own steps: alphaTab's scrolling stays off.
        api.playerStateChanged.fire({ state: 1 })
        expect(api.settings.player['scrollMode'] ?? 0).toBe(0)
        // A scroll by hand pauses it; Play follows again.
        h.dispatchEvent(new Event('wheel', { bubbles: true }))
        expect(follow.classList.contains('mn-follow-paused')).toBe(true)
        expect(follow.getAttribute('aria-pressed')).toBe('true')
        expect(follow.title).toContain('paused')
        api.playerStateChanged.fire({ state: 1 })
        expect(follow.classList.contains('mn-follow-paused')).toBe(false)
        expect(follow.title).toBe('Follow the music')
        // A click while paused follows again; the next one turns it off.
        h.dispatchEvent(new Event('wheel', { bubbles: true }))
        follow.click()
        expect(follow.classList.contains('mn-follow-paused')).toBe(false)
        expect(follow.getAttribute('aria-pressed')).toBe('true')
        follow.click()
        expect(follow.getAttribute('aria-pressed')).toBe('false')
        result.destroy()
        h.remove()
    })

    it('with Follow on, the page moves by the least that shows the system that plays', async () => {
        const { mod, made } = tracked()
        const h = document.createElement('div')
        document.body.appendChild(h)
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: mod, assets })
        await result.ready
        const api = made[0]!
        const surface = h.querySelector<HTMLElement>('.mn-tab-surface')!
        const cursor = document.createElement('div')
        cursor.className = 'at-cursor-bar'
        let top = 100
        cursor.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect
        surface.appendChild(cursor)
        const win = h.ownerDocument.defaultView!
        const moves: number[] = []
        const scrollBy = win.scrollBy.bind(win)
        win.scrollBy = ((options: ScrollToOptions) => {
            moves.push(options.top ?? 0)
        }) as typeof win.scrollBy
        try {
            // Off: nothing moves.
            top = 5000
            api.playerPositionChanged.fire({ currentTime: 0, endTime: 1000, currentTick: 0 })
            expect(moves).toEqual([])
            followOf(h).click()
            api.playerPositionChanged.fire({ currentTime: 0, endTime: 1000, currentTick: 0 })
            expect(moves).toHaveLength(1)
            expect(moves[0]).toBeGreaterThan(0)
            // In view: no move.
            top = 100
            api.playerPositionChanged.fire({ currentTime: 0, endTime: 1000, currentTick: 0 })
            expect(moves).toHaveLength(1)
        } finally {
            win.scrollBy = scrollBy
        }
        result.destroy()
        h.remove()
    })

    it('in full screen it follows by default; the button turns that off and on there', async () => {
        const { mod, made } = tracked()
        const h = document.createElement('div')
        document.body.appendChild(h)
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: mod, assets })
        await result.ready
        const api = made[0]!
        const follow = followOf(h)
        full(h)!.click()
        expect(follow.getAttribute('aria-pressed')).toBe('true')
        expect(api.settings.player['scrollMode']).toBe(2)
        follow.click()
        expect(follow.getAttribute('aria-pressed')).toBe('false')
        expect(api.settings.player['scrollMode']).toBe(0)
        // Off by the reader's choice: the music playing doesn't turn it on again.
        api.playerStateChanged.fire({ state: 1 })
        expect(api.settings.player['scrollMode']).toBe(0)
        follow.click()
        expect(api.settings.player['scrollMode']).toBe(2)
        // Paused by a scroll there: a click follows again.
        h.querySelector('.mn-tab-surface')!.dispatchEvent(new Event('wheel'))
        expect(api.settings.player['scrollMode']).toBe(0)
        expect(follow.classList.contains('mn-follow-paused')).toBe(true)
        follow.click()
        expect(api.settings.player['scrollMode']).toBe(2)
        expect(follow.classList.contains('mn-follow-paused')).toBe(false)
        // Out of full screen: the button shows the page's own choice again (off).
        full(h)!.click()
        expect(follow.getAttribute('aria-pressed')).toBe('false')
        expect(api.settings.player['scrollMode']).toBe(0)
        result.destroy()
        h.remove()
    })

    it('layout: line draws one line that follows the music in its own area', async () => {
        const { mod, made } = tracked()
        ;(mod as unknown as { LayoutMode: unknown }).LayoutMode = { Page: 0, Horizontal: 1 }
        const h = document.createElement('div')
        document.body.appendChild(h)
        const result = renderTab('tab', 'layout: line\n:4 3.3', h, { alphaTab: mod, assets })
        await result.ready
        const api = made[0]!
        expect(result.el.classList.contains('mn-tab-line')).toBe(true)
        expect(
            (api.options as unknown as { display: { layoutMode?: number } }).display.layoutMode
        ).toBe(1)
        // Only the score's own area scrolls (sideways): on from the start.
        expect(api.settings.player['scrollElement']).toBe(h.querySelector('.mn-tab-surface')!)
        expect(api.settings.player['scrollMode']).toBe(1)
        const follow = followOf(h)
        expect(follow.getAttribute('aria-pressed')).toBe('true')
        follow.click()
        expect(api.settings.player['scrollMode']).toBe(0)
        result.destroy()
        // The default is the page layout.
        const page = renderTab('tab', ':4 3.3', h, { alphaTab: mod, assets })
        await page.ready
        expect(page.el.classList.contains('mn-tab-line')).toBe(false)
        expect(
            (made[1]!.options as unknown as { display: { layoutMode?: number } }).display.layoutMode
        ).toBeUndefined()
        page.destroy()
        h.remove()
    })

    it('reads layout: among the settings, and says what to write', () => {
        expect(parseTabSource('tab', 'layout: Line\n:4 3.3').layout).toBe('line')
        expect(parseTabSource('tab', ':4 3.3').layout).toBe('page')
        expect(() => parseTabSource('tab', 'layout: wide\n:4 3.3')).toThrow(
            'layout: use page or line, got "wide"'
        )
    })

    it('a block removed in full screen leaves it', async () => {
        const { mod, made } = tracked()
        const h = document.createElement('div')
        document.body.appendChild(h)
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: mod, assets })
        await result.ready
        full(h)!.click()
        const el = result.el
        result.destroy()
        expect(el.classList.contains('mn-fullscreen')).toBe(false)
        expect(made[0]!.settings.player['scrollMode']).toBe(0)
        h.remove()
    })
})
