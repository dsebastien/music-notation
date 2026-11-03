import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
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
        error = emitter()
        playerStateChanged = emitter()
        playerPositionChanged = emitter()
        soundFontLoaded = emitter()
        playerReady = emitter()
        scoreLoaded = emitter()
        renderer = { partialRenderFinished: emitter() }
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
            0, 25, 28
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
            'Tab',
            'Score',
            'Both'
        ])
        expect(h.querySelector('.mn-tab-time')?.textContent).toBe('')
    })

    it('tells the speed set on its bar, before the player starts too (Music Practice #70)', async () => {
        const h = host()
        const result = renderTab('tab', ':4 3.3', h, { alphaTab: fakeAlphaTab(), assets })
        await result.ready
        expect(result.speed()).toBe(1)
        const speed = h.querySelector<HTMLInputElement>('.mn-tab-bar input[aria-label="Speed"]')!
        speed.value = '125'
        speed.dispatchEvent(new Event('input'))
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
    const at = alphaTab as unknown as AlphaTabModule
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

    it('lets the last notes ring: the song ends half a second after them (#59)', () => {
        type Event = { tick: number; constructor: { name: string } }
        let played: { division: number; tracks: { events: Event[] }[] } | null = null
        const api = {
            masterVolume: 1,
            playbackSpeed: 1,
            player: { playOneTimeMidiFile: (midi: typeof played) => (played = midi), stop() {} }
        }
        const player = soundfontPlayer(alphaTab as AlphaTabModule, () => api as never)
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
        const gp = exportGp7(alphaTab as unknown as AlphaTabModule, band)
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
