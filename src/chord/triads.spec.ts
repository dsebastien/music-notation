import { describe, expect, it } from 'bun:test'
import { inversionName, keyTriads, parseKey, triadVoicings } from './triads.js'
import { renderBlock } from '../render/render-block.js'

const show = (f: (number | null)[]) => {
    const dashed = f.some((n) => n !== null && n > 9)
    return f.map((n) => (n === null ? 'x' : n)).join(dashed ? '-' : '')
}

describe('triadVoicings', () => {
    it('finds the three inversions of a triad on a string set, up the neck', () => {
        const g = triadVoicings('G', { strings: [1, 2, 3] })
        expect(g.map((t) => show(t.frets))).toEqual(['xxx433', 'xxx787', 'x-x-x-12-12-10'])
        expect(g.map((t) => t.inversion)).toEqual([1, 2, 0])
        expect(g.map((t) => t.top)).toEqual(['R', '3', '5'])
    })

    it('keeps the shapes close and plays each chord tone once', () => {
        for (const symbol of ['C', 'Am', 'Bdim', 'Faug', 'Dsus4', 'Esus2']) {
            for (const strings of [
                [1, 2, 3],
                [2, 3, 4],
                [3, 4, 5],
                [4, 5, 6]
            ]) {
                for (const t of triadVoicings(symbol, { strings })) {
                    const played = t.frets.filter((f): f is number => f !== null)
                    expect(played).toHaveLength(3)
                    expect(Math.max(...played) - Math.min(...played)).toBeLessThanOrEqual(3)
                }
            }
        }
    })

    it('picks one inversion', () => {
        const first = triadVoicings('C', { strings: [2, 3, 4], inversion: 1 })
        expect(first.length).toBeGreaterThan(0)
        expect(first.every((t) => t.inversion === 1)).toBe(true)
    })

    it('refuses chords that are not triads, and strings that are not a set', () => {
        expect(triadVoicings('C7', { strings: [1, 2, 3] })).toEqual([])
        expect(triadVoicings('C', { strings: [1, 2, 4] })).toEqual([])
        expect(triadVoicings('C', { strings: [1, 2] })).toEqual([])
    })

    it('names inversions', () => {
        expect([0, 1, 2].map(inversionName)).toEqual([
            'root position',
            '1st inversion',
            '2nd inversion'
        ])
    })
})

describe('keyTriads', () => {
    it("draws a key's seven triads with their numerals, up the neck", () => {
        const g = keyTriads('G major', { strings: [1, 2, 3] })!
        expect(g.map((t) => `${t.numeral} ${t.symbol}`)).toEqual([
            'I G',
            'ii Am',
            'iii Bm',
            'IV C',
            'V D',
            'vi Em',
            'vii° F#dim'
        ])
        expect(g.every((t) => t.triad.inversion === 0)).toBe(true)
        const e = keyTriads('E minor', { strings: [2, 3, 4], inversion: 1 })!
        expect(e.map((t) => t.numeral)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'])
    })

    it('reads keys', () => {
        expect(parseKey('g Major')).toEqual({ tonic: 'G', minor: false })
        expect(parseKey('F# minor')).toEqual({ tonic: 'F#', minor: true })
        expect(parseKey('G')).toBeNull()
        expect(keyTriads('H major', { strings: [1, 2, 3] })).toBeNull()
    })
})

describe('triads blocks', () => {
    const host = () => document.createElement('div')
    const titles = (h: HTMLElement) =>
        [...h.querySelectorAll('.mn-title')].map((t) => t.textContent)
    const dots = (h: HTMLElement) =>
        [...h.querySelectorAll('.mn-cell')].map((c) =>
            [...c.querySelectorAll('.mn-dot-text')].map((t) => t.textContent).join(' ')
        )

    it("draws a chord's triads with interval labels", () => {
        const h = host()
        expect(renderBlock('chord', 'G\ntriads: 1-3', h).ok).toBe(true)
        expect(titles(h)).toEqual(['G, 1st inversion', 'G, 2nd inversion', 'G, root position'])
        expect(dots(h)[0]).toBe('3 5 R')
    })

    it("draws a key's triads, and keeps the labels asked for", () => {
        const h = host()
        expect(renderBlock('chord', 'key: C major\ntriads: 2-4\nlabels: fingers', h).ok).toBe(true)
        expect(titles(h)[0]).toBe('I · C')
        expect(titles(h)).toHaveLength(7)
    })

    it('says what to change', () => {
        const error = (source: string) => renderBlock('chord', source, host()).error
        expect(error('G\ntriads: 1 2 4')).toContain('three strings next to each other')
        expect(error('G7\ntriads: 1-3')).toContain("isn't a triad")
        expect(error('key: H major\ntriads: 1-3')).toContain('Unknown key')
        expect(error('key: G major\ntriads: 1-3\ninversion: any')).toContain('pick one inversion')
        expect(error('G\ntriads: 1-3\ninversion: 3')).toContain('inversion:')
        expect(error('G\ntriads: 1-3\nfrets: x02220')).toContain('remove "frets"')
    })
})

describe('labels and strings', () => {
    const host = () => document.createElement('div')
    it('labels guitar dots with intervals or note names', () => {
        const h = host()
        expect(renderBlock('chord', 'A x02220\nlabels: intervals', h).ok).toBe(true)
        expect([...h.querySelectorAll('.mn-dot-text')].map((t) => t.textContent)).toEqual([
            '5',
            'R',
            '3'
        ])
        const n = host()
        renderBlock('chord', 'A x02220\nlabels: notes', n)
        expect([...n.querySelectorAll('.mn-dot-text')].map((t) => t.textContent)).toEqual([
            'E',
            'A',
            'C#'
        ])
        expect(renderBlock('chord', 'x02220\nlabels: degrees', host()).error).toContain(
            'Unknown labels'
        )
    })

    it('shows only some strings on a fretboard', () => {
        const all = host()
        renderBlock('fretboard', 'chord: G\nfrets: 0-5', all)
        const top = host()
        renderBlock('fretboard', 'chord: G\nfrets: 0-5\nstrings: 1-3', top)
        const count = (h: HTMLElement) => h.querySelectorAll('.mn-dot').length
        expect(count(top)).toBeGreaterThan(0)
        expect(count(top)).toBeLessThan(count(all))
        expect(renderBlock('fretboard', 'chord: G\nstrings: 0-3', host()).error).toContain(
            'strings:'
        )
    })
})
