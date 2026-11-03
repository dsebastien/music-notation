import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

/** Each keyboard's first and last key, and its first and last played key, as MIDI numbers. */
const spans = (h: HTMLElement) =>
    [...h.querySelectorAll('svg.mn-keyboard')].map((svg) => {
        const keys = [...svg.querySelectorAll('[data-midi]')].map((k) =>
            Number(k.getAttribute('data-midi'))
        )
        const played = svg.getAttribute('data-mn-pitches')!.split(' ').map(Number)
        return [Math.min(...keys), Math.max(...keys), played[0], played.at(-1)]
    })

describe('keyboard scales without a range: two octaves, tonic to tonic', () => {
    it('draws C major from C4 to C6 and A minor pentatonic from A3 to A5', () => {
        const h = host()
        renderBlock('keyboard', 'C major', h)
        expect(spans(h)).toEqual([[60, 84, 60, 84]])
        const a = host()
        renderBlock('keyboard', 'A minor pentatonic', a)
        expect(spans(a)).toEqual([[57, 81, 57, 81]])
    })

    it('keeps the range when one is given, and chords and lists keep C4 to B5', () => {
        const h = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', h)
        expect(spans(h)[0]!.slice(0, 2)).toEqual([60, 71])
        const chord = host()
        renderBlock('keyboard', 'chord: Cmaj7', chord)
        expect(spans(chord)[0]!.slice(0, 2)).toEqual([60, 83])
        const list = host()
        renderBlock('keyboard', 'notes: C E G', list)
        expect(spans(list)[0]!.slice(0, 2)).toEqual([60, 83])
    })

    it('gives each keyboard of a modes row its own tonic', () => {
        const h = host()
        expect(renderBlock('keyboard', 'modes: C major', h).error).toBeNull()
        expect(spans(h).map(([, , first, last]) => [first, last])).toEqual([
            [60, 84],
            [62, 86],
            [64, 88],
            [65, 89],
            [55, 79],
            [57, 81],
            [59, 83]
        ])
    })

    it('draws a chord over a scale, a compared scale and a found scale tonic to tonic', () => {
        const over = host()
        renderBlock('keyboard', 'scale: G major\nchord: D7', over)
        expect(spans(over)).toEqual([[55, 79, 55, 79]])
        const compared = host()
        renderBlock('keyboard', 'C lydian\ncompare: major', compared)
        expect(spans(compared)).toEqual([[60, 84, 60, 84]])
        // The compared scale's F stays faint inside the two octaves.
        expect(compared.querySelectorAll('.mn-ghost')).toHaveLength(2)
        const found = host()
        renderBlock('keyboard', 'scales-for: G D Em C', found)
        expect(spans(found)).toEqual([[55, 79, 55, 79]])
    })

    it('fingers both octaves of a scale with written fingers', () => {
        const h = host()
        renderBlock('keyboard', 'D dorian\nfingering: 1 2 3 1 2 3 4 5', h)
        expect(spans(h)).toEqual([[62, 86, 62, 86]])
        expect([...h.querySelectorAll('.mn-key-label')].map((l) => l.textContent).join(' ')).toBe(
            '1 2 3 1 2 3 4 1 2 3 1 2 3 4 5'
        )
    })
})
