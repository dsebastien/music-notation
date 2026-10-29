import { describe, expect, it } from 'bun:test'
import { smoothProgression, transition } from './transitions.js'
import { renderBlock } from '../render/render-block.js'

const frets = (text: string) =>
    (/-/.test(text) ? text.split('-') : [...text]).map((t) => (t === 'x' ? null : Number(t)))
const show = (f: (number | null)[]) => {
    const dashed = f.some((n) => n !== null && n > 9)
    return f.map((n) => (n === null ? 'x' : n)).join(dashed ? '-' : '')
}

describe('transition', () => {
    it('keeps the fingers that can stay: C to Am, Em to C', () => {
        const am = transition(frets('x32010'), 'Am')[0]!
        expect(show(am.voicing.frets)).toBe('x02210')
        expect(am.anchors.sort()).toEqual([2, 4])
        expect(am.tips).toContain("Keep your middle finger on the D string's 2nd fret.")
        const c = transition(frets('022000'), 'C')[0]!
        expect(show(c.voicing.frets)).toBe('x32010')
        expect(c.anchors).toEqual([2])
    })

    it('slides a finger along its string: A to D', () => {
        const d = transition(frets('x02220'), 'D')[0]!
        expect(show(d.voicing.frets)).toBe('xx0232')
        expect(d.guides).toEqual([4])
        expect(d.tips[0]).toBe('Slide your ring finger along the B string from fret 2 to 3.')
    })

    it('says how far the hand moves', () => {
        const steps = transition(frets('x02220'), 'C')
        const far = steps.find((s) => s.shift >= 2)
        expect(far?.tips.some((t) => /Move your hand (up|down) \d+ frets\./.test(t))).toBe(true)
    })

    it('names the low and high E strings apart', () => {
        const g = transition(frets('320003'), 'G').find((s) => show(s.voicing.frets) === '320003')!
        expect(g.anchors.length).toBe(3)
        expect(g.tips.some((t) => t.includes('high E string'))).toBe(true)
    })

    it('returns nothing for an unknown chord or a mismatched tuning', () => {
        expect(transition(frets('x32010'), 'Hm')).toEqual([])
        expect(transition(frets('0003'), 'C')).toEqual([])
    })
})

describe('smoothProgression', () => {
    it('picks the open shapes for G D Em C and C Am F G', () => {
        expect(smoothProgression(['G', 'D', 'Em', 'C']).map((s) => show(s.voicing.frets))).toEqual([
            '320033',
            'xx0232',
            '022000',
            'x32010'
        ])
        const steps = smoothProgression(['C', 'Am', 'F', 'G'])
        expect(steps.map((s) => s.chord)).toEqual(['C', 'Am', 'F', 'G'])
        expect(steps[0]!.anchors).toBeUndefined()
        expect(steps[1]!.anchors?.length).toBe(2)
    })

    it('returns nothing when a chord is unknown', () => {
        expect(smoothProgression(['C', 'Hm'])).toEqual([])
        expect(smoothProgression([])).toEqual([])
    })
})

describe('transition blocks', () => {
    const host = () => document.createElement('div')
    const titles = (h: HTMLElement) =>
        [...h.querySelectorAll('.mn-title')].map((t) => t.textContent)

    it('draws the held chord and the easiest next ones, anchors marked', () => {
        const h = host()
        expect(renderBlock('chord', 'from: C x32010\nto: Am', h).ok).toBe(true)
        expect(titles(h)).toEqual(['C', 'Am, 1', 'Am, 2', 'Am, 3'])
        expect(h.querySelectorAll('.mn-cell')[1]!.querySelectorAll('.mn-anchor')).toHaveLength(2)
        const one = host()
        renderBlock('chord', 'from: A\nto: D\ncount: 1', one)
        expect(titles(one)).toEqual(['A', 'D'])
        expect(one.querySelectorAll('.mn-guide').length).toBeGreaterThan(0)
    })

    it('draws a smooth progression', () => {
        const h = host()
        expect(renderBlock('chord', 'progression: G D Em C\ncolumns: 4', h).ok).toBe(true)
        expect(titles(h)).toEqual(['G', 'D', 'Em', 'C'])
        expect(renderBlock('chord', 'progression: C, A Minor, F', host()).ok).toBe(true)
    })

    it('says what to change', () => {
        const error = (source: string) => renderBlock('chord', source, host()).error
        expect(error('from: A')).toBe('Add the next chord: to: D')
        expect(error('progression: G')).toContain('two chords or more')
        expect(error('from: A\nto: Hm')).toContain("Didn't recognize")
        expect(error('from: A\nto: D\ncount: 0')).toContain('count:')
        expect(error('from: A\nto: D\nprogression: G C')).toContain('not both')
        expect(error('from: A\nto: D\nvoicings: all')).toContain("can't be used")
    })
})
