import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import {
    alphaTabCdn,
    ALPHATAB_VERSION,
    exportGp7,
    exportMidi,
    parseTabSource,
    renderTab,
    scoreToAlphaTex,
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
        expect(h.querySelector('.mn-tab-time')?.textContent).toBe('0:00 / 0:00')
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
