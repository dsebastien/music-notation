/**
 * The Sound menu of the play bars (#103): the four guitars then the piano, the guitar in effect
 * selected, and a guitar chosen there before the block's line and the app's choice.
 */
import { describe, expect, it } from 'bun:test'
import type { NoteEvent, NotePlayer } from './player.js'
import type { GuitarTone } from './guitar-tone.js'
import { chooseGuitar, guitarChoice } from './guitar-tone.js'
import { guitarFor } from './controls.js'
import { renderBlock } from '../render/render-block.js'

/** A player that keeps the sound and the guitar each play asked for, and never ends a play. */
function recorder() {
    const plays: string[] = []
    let stops = 0
    const player: NotePlayer = {
        reportsStart: true,
        play(_events: NoteEvent[], options) {
            plays.push(options.sound === 'piano' ? 'piano' : (options.guitar ?? 'none'))
            return {
                stop() {
                    stops++
                }
            }
        }
    }
    return { player, plays, stopped: () => stops }
}

const host = () => document.body.appendChild(document.createElement('div'))
const toggle = (h: Element) => (h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()
const menu = (h: Element) => h.querySelector('.mn-play-sound') as HTMLSelectElement
const choose = (h: Element, value: string) => {
    const select = menu(h)
    select.value = value
    select.dispatchEvent(new Event('change'))
}
const entries = (h: Element) =>
    [...menu(h).querySelectorAll('option')].map((o) => [o.value, o.textContent])

describe('the Sound menu lists the four guitars, then the piano', () => {
    it('on the bar of diagrams, with short names', () => {
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: {} })
        expect(entries(h)).toEqual([
            ['steel', 'Guitar (steel)'],
            ['nylon', 'Guitar (nylon)'],
            ['clean', 'Guitar (clean)'],
            ['overdrive', 'Guitar (overdrive)'],
            ['piano', 'Piano']
        ])
        expect(menu(h).getAttribute('aria-label')).toBe('Sound')
    })

    it('in French', () => {
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: {}, language: 'fr' })
        expect(entries(h).map(([, name]) => name)).toEqual([
            'Guitare (folk)',
            'Guitare (classique)',
            'Guitare (son clair)',
            'Guitare (son saturé)',
            'Piano'
        ])
        expect(menu(h).getAttribute('aria-label')).toBe('Son')
    })

    it('on the bars of strumming patterns, picking patterns, progressions and charts', () => {
        for (const [language, source] of [
            ['strum', 'D DU UDU'],
            ['picking', 'pattern: travis\nchords: C Am F G'],
            ['progression', 'I V vi IV\nkey: G'],
            ['chords', '[C]Hello [G]world']
        ] as const) {
            const h = host()
            renderBlock(language, source, h, { play: {} })
            expect(entries(h).map(([value]) => value)).toEqual([
                'steel',
                'nylon',
                'clean',
                'overdrive',
                'piano'
            ])
        }
    })
})

describe('the entry selected is what plays', () => {
    it('the steel string when nothing names a guitar, the piano for a keyboard', () => {
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: {} })
        expect(menu(h).value).toBe('steel')
        const k = host()
        renderBlock('keyboard', 'C major', k, { play: { guitar: 'nylon' } })
        expect(menu(k).value).toBe('piano')
    })

    it("the block's line, else the app's or the page's guitar", () => {
        const line = host()
        renderBlock('chord', 'A x02220\nguitar: nylon', line, { play: { guitar: 'overdrive' } })
        expect(menu(line).value).toBe('nylon')
        const app = host()
        renderBlock('strum', 'D DU UDU', app, { play: { guitar: 'clean' } })
        expect(menu(app).value).toBe('clean')
    })

    it("follows an app's setting that changed: before the menu opens, and at a play", () => {
        const { player } = recorder()
        let setting: GuitarTone = 'nylon'
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player, guitar: () => setting } })
        expect(menu(h).value).toBe('nylon')
        setting = 'clean'
        menu(h).dispatchEvent(new Event('pointerdown'))
        expect(menu(h).value).toBe('clean')
        setting = 'overdrive'
        menu(h).dispatchEvent(new Event('focus'))
        expect(menu(h).value).toBe('overdrive')
        setting = 'steel'
        toggle(h)
        expect(menu(h).value).toBe('steel')
    })
})

describe('a guitar chosen in the menu', () => {
    it("plays, before the block's line and the app's choice", () => {
        const { player, plays } = recorder()
        const h = host()
        const { el } = renderBlock('chord', 'A x02220\nguitar: nylon', h, {
            play: { player, guitar: 'clean' }
        })
        toggle(h)
        toggle(h) // stops
        choose(h, 'overdrive')
        expect(el.getAttribute('data-mn-guitar-choice')).toBe('overdrive')
        expect(guitarFor({ guitar: 'clean' }, el.querySelector('.mn-playable'))).toBe('overdrive')
        toggle(h)
        expect(plays).toEqual(['nylon', 'overdrive'])
        expect(menu(h).value).toBe('overdrive')
        // The line and the app's choice are as they were.
        expect(el.getAttribute('data-mn-guitar')).toBe('nylon')
    })

    it('keeps the drawing and what plays: another guitar is heard at the next play', () => {
        const { player, plays, stopped } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player } })
        const drawing = h.querySelector('.mn-playable svg')
        toggle(h)
        choose(h, 'nylon')
        expect(stopped()).toBe(0)
        expect(h.querySelector('.mn-playable svg')).toBe(drawing)
        toggle(h) // stops
        toggle(h)
        expect(plays).toEqual(['none', 'nylon'])
    })

    it('goes to the piano and back to a guitar, with the diagram redrawn each way', () => {
        const { player, plays } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player } })
        choose(h, 'piano')
        expect(h.querySelector('.mn-keyboard')).not.toBeNull()
        toggle(h)
        toggle(h)
        choose(h, 'clean')
        expect(h.querySelector('.mn-keyboard')).toBeNull()
        expect(menu(h).value).toBe('clean')
        toggle(h)
        expect(plays).toEqual(['piano', 'clean'])
    })

    it('plays a keyboard on that guitar, redrawn as a fretboard', () => {
        const { player, plays } = recorder()
        const h = host()
        renderBlock('keyboard', 'C major', h, { play: { player } })
        choose(h, 'nylon')
        expect(h.querySelector('.mn-fretboard')).not.toBeNull()
        toggle(h)
        expect(plays).toEqual(['nylon'])
    })

    it('plays on the bars in time: a strumming pattern, a picking pattern, a progression', () => {
        for (const [language, source] of [
            ['strum', 'D DU UDU'],
            ['picking', 'pattern: travis\nchords: C Am F G'],
            ['progression', 'I V vi IV\nkey: G']
        ] as const) {
            const { player, plays } = recorder()
            const h = host()
            renderBlock(language, source, h, { play: { player, guitar: 'steel' } })
            choose(h, 'overdrive')
            toggle(h)
            expect([language, plays[0]]).toEqual([language, 'overdrive'])
            toggle(h)
        }
    })

    it("reaches the diagrams of a progression too: the block's bar and diagrams play it", () => {
        const { player, plays } = recorder()
        const h = host()
        const { el } = renderBlock('progression', 'key: G\nI IV', h, { play: { player } })
        choose(h, 'nylon')
        const diagram = el.querySelector('.mn-progression-chord svg[data-mn-pitches]')!
        expect(guitarChoice(diagram)).toBe('nylon')
        diagram.dispatchEvent(new Event('click', { bubbles: true }))
        expect(plays).toEqual(['nylon'])
    })

    it('stays in its block: the next block keeps its own guitar', () => {
        const h = host()
        const other = host()
        renderBlock('chord', 'A x02220', h, { play: {} })
        renderBlock('chord', 'E 022100', other, { play: {} })
        choose(h, 'clean')
        expect(menu(h).value).toBe('clean')
        menu(other).dispatchEvent(new Event('pointerdown'))
        expect(menu(other).value).toBe('steel')
    })

    it('is kept on the element itself when it is in no block', () => {
        const lone = document.createElement('div')
        const inner = lone.appendChild(document.createElement('span'))
        expect(guitarChoice(inner)).toBeNull()
        chooseGuitar(lone, 'nylon')
        expect(lone.getAttribute('data-mn-guitar-choice')).toBe('nylon')
        expect(guitarChoice(inner)).toBe('nylon')
    })

    it('ignores a value that is no entry of the menu', () => {
        const { player, plays } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player, guitar: 'nylon' } })
        choose(h, 'banjo')
        expect(menu(h).value).toBe('nylon')
        expect(h.querySelector('.mn-keyboard')).toBeNull()
        toggle(h)
        expect(plays).toEqual(['nylon'])
    })
})
