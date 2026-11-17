import { describe, expect, it } from 'bun:test'
import type { NoteEvent, NotePlayer } from './player.js'
import { pluckedString } from './player.js'
import {
    DEFAULT_GUITAR_TONE,
    GUITAR_PROGRAMS,
    GUITAR_TONES,
    blockGuitar,
    guitarToneOf,
    guitarWish,
    pageGuitar,
    type GuitarTone
} from './guitar-tone.js'
import { guitarFor, playerFor, toned } from './controls.js'
import { renderBlock } from '../render/render-block.js'

/** A player that keeps the guitar each play asked for (`none` when it named none). */
function recorder() {
    const guitars: (GuitarTone | 'none')[] = []
    const sounds: string[] = []
    const player: NotePlayer = {
        reportsStart: true,
        play(_events: NoteEvent[], options) {
            guitars.push(options.guitar ?? 'none')
            sounds.push(options.sound)
            return { stop() {} }
        }
    }
    return { player, guitars, sounds }
}

const host = () => document.body.appendChild(document.createElement('div'))
const play = (h: HTMLElement) => (h.querySelector('.mn-play-toggle') as HTMLButtonElement).click()

describe('the guitars (#103)', () => {
    it('are four, the steel-string acoustic first, each with its General MIDI program', () => {
        expect([...GUITAR_TONES]).toEqual(['steel', 'nylon', 'clean', 'overdrive'])
        expect(DEFAULT_GUITAR_TONE).toBe('steel')
        expect(GUITAR_PROGRAMS).toEqual({ steel: 25, nylon: 24, clean: 27, overdrive: 29 })
    })

    it('are read from a setting or a line, in any case, with the words people use', () => {
        expect(guitarToneOf('nylon')).toBe('nylon')
        expect(guitarToneOf('  Overdrive ')).toBe('overdrive')
        expect(guitarToneOf('acoustic')).toBe('steel')
        expect(guitarToneOf('Steel string')).toBe('steel')
        expect(guitarToneOf('classical')).toBe('nylon')
        expect(guitarToneOf('electric')).toBe('clean')
        expect(guitarToneOf('overdriven')).toBe('overdrive')
        for (const other of ['', 'piano', 'banjo', 25, null, undefined, {}])
            expect(guitarToneOf(other)).toBeNull()
    })

    it("a page's guitar is `play: { guitar }` in its options", () => {
        expect(pageGuitar({ play: { guitar: 'nylon' } })).toBe('nylon')
        expect(pageGuitar({ play: { guitar: 'harp' } })).toBeUndefined()
        expect(pageGuitar({ play: false })).toBeUndefined()
        expect(pageGuitar({})).toBeUndefined()
        expect(pageGuitar(null)).toBeUndefined()
    })
})

describe("a block's guitar: line", () => {
    it('is taken out of the source, the last one wins', () => {
        expect(blockGuitar('A x02220\nguitar: nylon')).toEqual({
            guitar: 'nylon',
            source: 'A x02220\n'
        })
        expect(blockGuitar('Guitar: clean\nA x02220\n  guitar :  overdrive  \n')).toEqual({
            guitar: 'overdrive',
            source: 'A x02220\n'
        })
        expect(blockGuitar('A x02220')).toEqual({ guitar: null, source: 'A x02220' })
    })

    it('leaves the other lines that name a guitar alone', () => {
        const source = 'instrument: guitar\nsymbol: A\nfrets: x02220'
        expect(blockGuitar(source)).toEqual({ guitar: null, source })
    })

    it('is a directive in a chord chart, where a line without braces is lyrics', () => {
        expect(blockGuitar('{guitar: nylon}\n[Am]Hello', true)).toEqual({
            guitar: 'nylon',
            source: '[Am]Hello'
        })
        const lyrics = 'guitar: nylon\n[Am]Hello'
        expect(blockGuitar(lyrics, true)).toEqual({ guitar: null, source: lyrics })
    })

    it('says what to write when the value is not a guitar', () => {
        expect(() => blockGuitar('guitar: banjo')).toThrow(
            'guitar: use steel, nylon, clean or overdrive, got "banjo"'
        )
    })

    it('shows that message in the block, in French too', () => {
        const english = renderBlock('chord', 'A x02220\nguitar: banjo', host())
        expect(english.ok).toBe(false)
        expect(english.el.textContent).toContain('guitar: use steel, nylon, clean or overdrive')
        const french = renderBlock('chord', 'A x02220\nguitar: banjo', host(), { language: 'fr' })
        expect(french.el.textContent).toContain(
            'guitar: utilisez steel, nylon, clean ou overdrive, reçu « banjo »'
        )
    })

    it('is kept on the block and not drawn', () => {
        const h = host()
        const result = renderBlock('chord', 'guitar: nylon\nA x02220', h, { play: {} })
        expect(result.ok).toBe(true)
        expect(result.el.getAttribute('data-mn-guitar')).toBe('nylon')
        expect(guitarWish(result.el.querySelector('.mn-playable'))).toBe('nylon')
        expect(h.querySelectorAll('.mn-playable')).toHaveLength(1)
        expect(result.el.textContent).not.toContain('nylon')
    })
})

describe('the guitar a play asks for', () => {
    it("names none without a line or an option: an app's player is reached as it is", () => {
        const { player, guitars } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player } })
        play(h)
        expect(guitars).toEqual(['none'])
        expect(playerFor(window, { player }, h)).toBe(player)
        expect(guitarFor({ player }, h)).toBeNull()
    })

    it("is the app's or the page's choice", () => {
        const { player, guitars } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: { player, guitar: 'clean' } })
        play(h)
        expect(guitars).toEqual(['clean'])
    })

    it('is read at each play when the choice is a function (a setting)', () => {
        const { player, guitars } = recorder()
        const h = host()
        let setting: GuitarTone | null = 'nylon'
        renderBlock('chord', 'A x02220', h, { play: { player, guitar: () => setting } })
        play(h)
        play(h) // stops
        setting = 'overdrive'
        play(h)
        play(h)
        setting = null
        play(h)
        expect(guitars).toEqual(['nylon', 'overdrive', 'none'])
    })

    it("a block's line comes before the app's choice", () => {
        const { player, guitars } = recorder()
        const h = host()
        renderBlock('chord', 'A x02220\nguitar: nylon', h, {
            play: { player, guitar: 'overdrive' }
        })
        play(h)
        expect(guitars).toEqual(['nylon'])
    })

    it('goes with the engines too, and with a strumming pattern', () => {
        const { player, guitars } = recorder()
        const h = host()
        renderBlock('strum', 'guitar: clean\nD DU UDU', h, {
            play: { engines: { generaluser: player } }
        })
        play(h)
        play(h)
        expect(guitars[0]).toBe('clean')
    })

    it('changes nothing for a piano: the choice rides along and the sound stays piano', () => {
        const { player, guitars, sounds } = recorder()
        const h = host()
        renderBlock('keyboard', 'C major', h, { play: { player, guitar: 'nylon' } })
        play(h)
        expect(sounds).toEqual(['piano'])
        expect(guitars).toEqual(['nylon'])
    })

    it('gives a bar the same player each time, so what it learned about it stays', () => {
        const { player } = recorder()
        const options = { player, guitar: 'nylon' as const }
        const first = playerFor(window, options)
        expect(first).not.toBe(player)
        expect(playerFor(window, options)).toBe(first)
        expect(first.reportsStart).toBe(true)
        expect(toned(player, { guitar: 'clean' })).not.toBe(first)
        // A play that names its own guitar keeps it.
        const { player: other, guitars } = recorder()
        toned(other, { guitar: 'nylon' }).play([], { sound: 'guitar', volume: 1, guitar: 'clean' })
        expect(guitars).toEqual(['clean'])
    })

    it('ignores a choice that throws or is not a guitar', () => {
        const { player } = recorder()
        expect(
            guitarFor({
                player,
                guitar: () => {
                    throw new Error('no settings yet')
                }
            })
        ).toBeNull()
        expect(guitarFor({ player, guitar: 'banjo' as GuitarTone })).toBeNull()
    })
})

describe('the light synthesizer plays each guitar (#103)', () => {
    /** A random source that repeats, so two strings start from the same burst. */
    const seeded = () => {
        let seed = 7
        return () => (seed = (seed * 16807) % 2147483647) / 2147483647
    }
    const rms = (wave: Float32Array, from: number, to: number) =>
        Math.sqrt(wave.slice(from, to).reduce((sum, v) => sum + v * v, 0) / (to - from))

    it('an overdriven string holds its level while a plain string fades', () => {
        const rate = 8000
        const plain = pluckedString(52, rate, 2, seeded())
        const driven = pluckedString(52, rate, 2, seeded(), { drive: 5 })
        const fade = (wave: Float32Array) => rms(wave, rate, rate + 2000) / rms(wave, 0, 2000)
        expect(fade(driven)).toBeGreaterThan(fade(plain) * 1.5)
        // Never louder than a plain string at its loudest.
        const peak = (wave: Float32Array) => wave.reduce((max, v) => Math.max(max, Math.abs(v)), 0)
        expect(peak(driven)).toBeLessThanOrEqual(peak(plain))
        expect(peak(driven)).toBeLessThanOrEqual(0.18)
        // And as loud as a plain string when it starts (within 2 dB), not louder.
        const start = (wave: Float32Array) => rms(wave, 0, rate / 10)
        expect(Math.abs(20 * Math.log10(start(driven) / start(plain)))).toBeLessThan(2)
    })

    it('without drive a string is the one it always was', () => {
        const a = pluckedString(52, 8000, 0.5, seeded(), { brightness: 0.8, pick: 0.1 })
        const b = pluckedString(52, 8000, 0.5, seeded(), { brightness: 0.8, pick: 0.1, drive: 0 })
        expect(Array.from(b)).toEqual(Array.from(a))
    })

    it('a faster fade makes a shorter note (nylon), a slower one a longer note (electric)', () => {
        const rate = 8000
        const of = (damping: number) => {
            const wave = pluckedString(52, rate, 2, seeded(), { damping })
            return rms(wave, rate, rate + 2000)
        }
        expect(of(2.5)).toBeLessThan(of(1))
        expect(of(0.65)).toBeGreaterThan(of(1))
    })
})
