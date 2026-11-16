import { describe, expect, it } from 'bun:test'
import type { NoteEvent, NotePlayer } from './player.js'
import type { Engine } from './engine.js'
import { renderBlock } from '../render/render-block.js'
import { engineAssets, parseTabSource, tabEngine, type TabAssets } from '../tab/index.js'

/** A host with a recording player per engine; `null` engines are the ones it lacks. */
function hostWith(names: Engine[]) {
    const played: Engine[] = []
    const of = (engine: Engine): NotePlayer => ({
        play(_events: NoteEvent[]) {
            played.push(engine)
            return { stop() {} }
        }
    })
    const engines = Object.fromEntries(names.map((name) => [name, () => of(name)]))
    return { played, engines }
}

const host = () => document.body.appendChild(document.createElement('div'))
const play = (h: HTMLElement) => (h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()

describe('the engine a block plays through (#124)', () => {
    it('plays the best engine the host has, without a wish', () => {
        const { played, engines } = hostWith(['generaluser', 'sonivox', 'light'])
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { engines } })
        play(h)
        expect(played).toEqual(['generaluser'])
    })

    it("plays the host's choice", () => {
        const { played, engines } = hostWith(['generaluser', 'sonivox', 'light'])
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { engines, engine: 'sonivox' } })
        play(h)
        expect(played).toEqual(['sonivox'])
    })

    it("a block's engine: line comes before the host's choice, and is not drawn", () => {
        const { played, engines } = hostWith(['generaluser', 'sonivox', 'light'])
        const h = host()
        const result = renderBlock('chord', 'engine: light\nA x02220', h, {
            play: { engines, engine: 'sonivox' }
        })
        expect(result.ok).toBe(true)
        expect(result.el.getAttribute('data-mn-engine')).toBe('light')
        expect(h.querySelectorAll('.mn-playable')).toHaveLength(1)
        play(h)
        expect(played).toEqual(['light'])
    })

    it('a wish the host cannot give falls back, and nothing breaks', () => {
        const { played, engines } = hostWith(['generaluser'])
        const h = host()
        renderBlock('chord', 'A x02220\nengine: sonivox', h, { play: { engines } })
        play(h)
        expect(played).toEqual(['generaluser'])
    })

    it('an engine that is not there yet (null) is skipped at each play', () => {
        const { played, engines } = hostWith(['light'])
        let loaded = false
        const sonivox: NotePlayer = {
            play() {
                played.push('sonivox')
                return { stop() {} }
            }
        }
        const h = host()
        renderBlock('chord', 'A x02220', h, {
            play: { engines: { ...engines, sonivox: () => (loaded ? sonivox : null) } }
        })
        play(h)
        play(h)
        loaded = true
        play(h)
        expect(played).toEqual(['light', 'sonivox'])
    })

    it('without any engine of the host, the light synthesizer plays (no error)', () => {
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { engines: {} } })
        expect(() => play(h)).not.toThrow()
    })

    it('without engines, the player option plays as before', () => {
        const calls: number[] = []
        const player: NotePlayer = {
            play(events) {
                calls.push(events.length)
                return { stop() {} }
            }
        }
        const h = host()
        renderBlock('chord', 'engine: sonivox\nA x02220', h, { play: { player } })
        play(h)
        expect(calls).toEqual([5])
    })

    it('the bars that play in time follow the wish too (strum, progression)', () => {
        for (const [language, source] of [
            ['strum', 'engine: sonivox\nD DU UDU'],
            ['progression', 'engine: sonivox\nkey: C\nI V vi IV']
        ] as const) {
            const { played, engines } = hostWith(['generaluser', 'sonivox', 'light'])
            const h = host()
            renderBlock(language, source, h, { play: { engines } })
            play(h)
            expect([language, played[0]]).toEqual([language, 'sonivox'])
            play(h)
        }
    })

    it('a wrong engine is a message that says what to write', () => {
        const h = host()
        const result = renderBlock('chord', 'engine: loud\nA x02220', h)
        expect(result.ok).toBe(false)
        expect(result.error).toBe('engine: use generaluser, sonivox or light, got "loud"')
    })

    it('every block type takes the line', () => {
        const sources: [Parameters<typeof renderBlock>[0], string][] = [
            ['chord', 'engine: light\nAm x02210'],
            ['keyboard', 'C major\nengine: light'],
            ['fretboard', 'engine: light\nA minor pentatonic'],
            ['strum', 'engine: light\nD DU UDU'],
            ['picking', 'engine: light\npattern: p i m a p i m a'],
            ['progression', 'engine: light\nkey: C\nI V vi IV'],
            ['circle', 'engine: light\nkey: G'],
            ['chords', '{engine: light}\n[Am]Hello [C]there']
        ]
        for (const [language, source] of sources) {
            const h = host()
            const result = renderBlock(language, source, h, { play: {} })
            expect([language, result.error]).toEqual([language, null])
            expect(result.el.getAttribute('data-mn-engine')).toBe('light')
        }
    })

    it('in a chart, a lyric line that starts with "engine:" stays a lyric', () => {
        const h = host()
        const result = renderBlock('chords', '[Am]La la\nEngine: running', h)
        expect(result.ok).toBe(true)
        expect(result.el.hasAttribute('data-mn-engine')).toBe(false)
        expect(h.textContent).toContain('Engine: running')
    })
})

describe('the engine a tab plays through (#124)', () => {
    const whole: TabAssets = { font: 'font.woff2', soundFont: 'sonivox.sf3' }
    const both: TabAssets = { ...whole, instruments: 'https://example.org/generaluser' }

    it('reads the engine: line among the settings on top', () => {
        const parsed = parseTabSource('tab', 'staves: both\nengine: Sonivox\n:4 3.3')
        expect(parsed.engine).toBe('sonivox')
        expect(parsed.tex).toBe(':4 3.3')
        expect(parseTabSource('tab', ':4 3.3').engine).toBeNull()
        expect(() => parseTabSource('tab', 'engine: loud\n:4 3.3')).toThrow(
            'engine: use generaluser, sonivox or light, got "loud"'
        )
    })

    it('the instrument files when the assets have them, else the whole soundfont', () => {
        expect(tabEngine(both)).toBe('generaluser')
        expect(tabEngine(whole)).toBe('sonivox')
        expect(tabEngine(whole, 'generaluser')).toBe('sonivox')
    })

    it('sonivox as a wish plays the whole soundfont', () => {
        expect(tabEngine(both, 'sonivox')).toBe('sonivox')
        expect(engineAssets(both, 'sonivox')).toEqual(whole)
        expect(engineAssets(both, 'generaluser')).toBe(both)
        expect(engineAssets(both)).toBe(both)
        expect(engineAssets(whole, 'sonivox')).toBe(whole)
    })

    it('the light synthesizer cannot play a score: the best sound there is', () => {
        expect(tabEngine(both, 'light')).toBe('generaluser')
        expect(tabEngine(whole, 'light')).toBe('sonivox')
        expect(engineAssets(both, 'light')).toBe(both)
    })
})
