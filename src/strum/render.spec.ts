import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { describeBlock, formatDiagram } from '../cli/describe.js'

const host = () => document.body.appendChild(document.createElement('div'))
const draw = (source: string) => {
    const h = host()
    return { h, result: renderBlock('strum', source, h) }
}

describe('strum blocks', () => {
    it('draws a beat grid: a slot per subdivision with its count, arrows, bar lines', () => {
        const { h, result } = draw('D DU UDU')
        expect(result.ok).toBe(true)
        const svg = h.querySelector('svg.mn-strum')!
        expect(svg.getAttribute('data-mn-strum')).toBe('D - D U - U D U')
        expect(svg.getAttribute('aria-label')).toBe('Strumming pattern D - D U - U D U, 4/4, 8ths')
        const slots = [...svg.querySelectorAll('[data-mn-beat]')]
        expect(slots.map((s) => s.getAttribute('data-mn-beat'))).toEqual([
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7'
        ])
        expect(slots.map((s) => s.getAttribute('data-mn-stroke'))).toEqual([
            'down',
            'rest',
            'down',
            'up',
            'rest',
            'up',
            'down',
            'up'
        ])
        expect(
            [...svg.querySelectorAll('.mn-strum-count')].map((c) => c.textContent).join(' ')
        ).toBe('1 & 2 & 3 & 4 &')
        expect(svg.querySelectorAll('.mn-strum-head')).toHaveLength(6)
        expect(svg.querySelectorAll('.mn-strum-bar')).toHaveLength(2)
        // Every slot has a box a highlight can light, rests too.
        expect(slots.every((s) => s.querySelector('.mn-strum-cell'))).toBe(true)
    })

    it('marks accents, ghost strums and muted strums', () => {
        const { h } = draw('D> (U) X U D U X U')
        const slot = (i: number) => h.querySelector(`[data-mn-beat="${i}"]`)!
        expect(slot(0).getAttribute('data-mn-accent')).toBe('true')
        expect(slot(0).querySelector('.mn-strum-accent')).not.toBeNull()
        expect(slot(0).querySelector('.mn-strum-arrow.mn-strum-accented')).not.toBeNull()
        expect(slot(1).getAttribute('data-mn-ghost')).toBe('true')
        expect([...slot(1).querySelectorAll('.mn-strum-paren')].map((p) => p.textContent)).toEqual([
            '(',
            ')'
        ])
        expect(slot(2).querySelectorAll('.mn-strum-mute')).toHaveLength(2)
    })

    it('writes chords over the slot they start on, with the notes they sound', () => {
        const { h } = draw('G   C\nD DU UDU\ntitle: Old faithful')
        const svg = h.querySelector('svg')!
        expect(svg.querySelector('.mn-title')?.textContent).toBe('Old faithful')
        const chords = [...svg.querySelectorAll('.mn-strum-chord')]
        expect(chords.map((c) => c.textContent)).toEqual(['G', 'C'])
        expect(h.querySelector('[data-mn-beat="4"]')!.getAttribute('data-mn-chord')).toBe('C')
        expect(h.querySelector('[data-mn-beat="4"]')!.getAttribute('data-mn-voicing')).toBe(
            '48 52 55 60 64'
        )
        // The first strums: the chord the pattern ends on, as when it repeats.
        expect(svg.getAttribute('data-mn-strum-chord')).toBe('C')
    })

    it('draws chord: over the first slot, and E minor plays without a chord', () => {
        expect(draw('chord: Am\nD-DU-UDU').h.querySelector('.mn-strum-chord')?.textContent).toBe(
            'Am'
        )
        const { h } = draw('D-DU-UDU')
        expect(h.querySelector('.mn-strum-chord')).toBeNull()
        expect(h.querySelector('svg')!.getAttribute('data-mn-voicing')).toBe('40 47 52 55 59 64')
    })

    it('wraps long patterns into rows of bars and widens for long chord names', () => {
        const { h } = draw('D-DU-UDU | D-DU-UDU | D-DU-UDU | [Cmaj7#11]D-DU-UDU')
        const svg = h.querySelector('svg')!
        // Two bars a row: 2 rows, 3 bar lines each.
        expect(svg.querySelectorAll('.mn-strum-bar')).toHaveLength(6)
        expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(24 + 16 * 28)
    })

    it('widens for a long title and centers the grid under it', () => {
        const { h } = draw('D - D U - U\ntime: 6/8\ntitle: A rather long title for six eight')
        const svg = h.querySelector('svg')!
        expect(Number(svg.getAttribute('width'))).toBeGreaterThan(24 + 6 * 28)
        expect(svg.querySelector('g[transform]')?.getAttribute('transform')).toMatch(/^translate\(/)
    })

    it('shows a mistake inline and draws nothing for an empty block', () => {
        const { h, result } = draw('D - D U')
        expect(result.ok).toBe(false)
        expect(h.querySelector('.mn-error-message')?.textContent).toContain(
            'strum: 4/4 in 8ths has 8 slots a bar'
        )
        expect(draw('  \n').result.ok).toBe(true)
        expect(draw('tuning: banjo\nD').result.error).toContain('Unknown tuning "banjo"')
    })

    it('is described by the check command', () => {
        const { h } = draw('G   C\nD DU UDU\ntempo: 100')
        expect(describeBlock(h)).toEqual([
            {
                type: 'strum',
                title: null,
                pattern: '[G]D - D U [C]- U D U',
                time: '4/4',
                subdivision: '8ths',
                tempo: 100,
                chords: [
                    { beat: 0, chord: 'G' },
                    { beat: 4, chord: 'C' }
                ]
            }
        ])
        expect(formatDiagram(describeBlock(h)[0]!, 1)).toEqual([
            '1. strumming pattern, 4/4, 8ths, tempo 100',
            '   [G]D - D U [C]- U D U'
        ])
    })
})
