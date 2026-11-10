import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'
import { descriptionOf } from './dom.js'
import { renderChart } from '../chords/chart.js'
import { parseChordPro } from '../chords/chordpro.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

/** #14: every diagram says what it shows, for screen readers. */
const described = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const r = renderBlock(language, source, host, options)
    return [...r.el.querySelectorAll('svg.mn-svg')].map((svg) => descriptionOf(svg))
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('diagram descriptions', () => {
    it('describes a chord diagram with its fingering in words and its roots', () => {
        expect(described('chord', 'A x02220 x01230')).toEqual([
            'Strum from the 5th string (A). Index on the D string, 2nd fret. Middle on the G string, 2nd fret. Ring on the B string, 2nd fret. The A and high E strings ring open. The root is on strings 5 and 3.'
        ])
    })

    it('is a desc in the defs, pointed at by aria-describedby, never an aria-label', () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const svg = renderBlock('chord', 'A x02220', host).el.querySelector('svg')!
        const id = svg.getAttribute('aria-describedby')!
        const desc = svg.querySelector('defs > desc.mn-desc')!
        expect(desc.getAttribute('id')).toBe(id)
        expect(svg.hasAttribute('aria-label')).toBe(false)
        // The name stays the title.
        expect(svg.getAttribute('aria-labelledby')).not.toBe(id)
    })

    it('describes a keyboard: the lit keys low to high, the root and fingers', () => {
        expect(described('keyboard', 'notes: C4 E4 G4\nroot: C\nfingering: 1 3 5')).toEqual([
            'Keys: C4 (root, finger 1), E4 (finger 3), G4 (finger 5).'
        ])
        expect(described('chord', 'C\ninstrument: piano')).toEqual(['Keys: C4 (root), E4, G4.'])
    })

    it('describes a fretboard string by string, low string first', () => {
        const [text] = described('fretboard', 'C major\nfrets: 0-3\nstrings: 5-6')
        expect(text).toBe(
            'String 6 (E): E open, F at fret 1, G at fret 3. String 5 (A): A open, B at fret 2, C at fret 3 (root).'
        )
    })

    it('says the names in the block’s naming', () => {
        expect(described('keyboard', 'C major\nrange: C4-E4\nnaming: solfege')).toEqual([
            'Keys: Do4 (root), Ré4, Mi4.'
        ])
    })

    it('adds nothing to a diagram without notes', () => {
        const host = document.createElement('div')
        const svg = renderBlock('fretboard', 'notes: \nfrets: 0-3', host).el.querySelector('svg')
        if (svg) expect(svg.hasAttribute('aria-describedby')).toBe(false)
    })
})

describe('charts in reading order', () => {
    it('puts each chord before the lyrics it sits over', () => {
        const chart = renderChart(document, parseChordPro('[Am]Hello [G]world'))
        const seg = chart.querySelector('.mn-seg')!
        expect([...seg.children].map((c) => c.className)).toEqual(['mn-chord', 'mn-lyric'])
        expect(chart.querySelector('.mn-line')?.textContent).toBe('AmHello Gworld')
    })
})
