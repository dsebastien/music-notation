import { describe, expect, it } from 'bun:test'
import { parseChordPro } from './chordpro.js'
import { renderChart } from './chart.js'
import { chordsUsed } from './chart-diagrams.js'
import { lookupGuitarVoicing } from '../voicings/index.js'
import { renderBlock } from '../render/render-block.js'
import { describeBlock } from '../cli/describe.js'

const voicings = lookupGuitarVoicing

/** The row's diagrams: their chord, frets (guitar) or keys (piano). */
const rowOf = (el: Element) =>
    [...el.querySelectorAll('.mn-chart-diagrams svg.mn-svg')].map((svg) =>
        svg.getAttribute('data-mn-chord')
    )

/** A guitar diagram's frets as drawn ("320033"). */
const fretsOf = (svg: Element | null | undefined) => {
    const diagram = svg?.parentElement ? describeBlock(svg.parentElement)[0] : undefined
    return diagram?.type === 'guitar-chord' ? diagram.frets : null
}

describe('chordsUsed', () => {
    it('lists chords in order of first appearance, without repeats or non-chords', () => {
        const song = parseChordPro(
            '[G]a [D]b [G]c\n{soc}\n[Em]d [N.C.]e [*Coda]f [%]\n{eoc}\n{sot}\n[A]\n{eot}'
        )
        expect(chordsUsed(song)).toEqual(['G', 'D', 'Em'])
    })
})

describe('parseChordPro directives for diagrams', () => {
    it('reads {define}, {chord}, {diagrams} and {instrument}', () => {
        const song = parseChordPro(
            '{define: Am frets x 0 2 2 1 0}\n{diagrams: bottom}\n{instrument: keyboard}\n{chord: Am}\n[Am]x'
        )
        expect(song.definitions.map((d) => d.name)).toEqual(['Am'])
        expect(song.diagrams).toBe('bottom')
        expect(song.instrument).toBe('piano')
        // A known chord by name takes the song's shape.
        expect(song.sections[0]!.lines[0]).toMatchObject({
            kind: 'chord',
            definition: { name: 'Am', frets: [null, 0, 2, 2, 1, 0] }
        })
        expect(parseChordPro('{diagrams}').diagrams).toBe('top')
        expect(parseChordPro('{diagrams: on}').diagrams).toBe('top')
        expect(parseChordPro('{diagrams: off}').diagrams).toBe('off')
        expect(parseChordPro('{diagrams: constructor}').warnings[0]).toContain('use on, off, top')
        expect(parseChordPro('{instrument: banjo}').warnings[0]).toContain('use guitar or piano')
    })
})

describe('the chords used row', () => {
    const SONG =
        '{define: G base-fret 1 frets 3 2 0 0 3 3 fingers 2 1 0 0 3 4}\n[G]Hello [C]little [G]world [D/F#]x'

    it('is off by default, and on with {diagrams} or the option', () => {
        expect(
            renderChart(document, parseChordPro(SONG), { voicings }).querySelector(
                '.mn-chart-diagrams'
            )
        ).toBeNull()
        const top = renderChart(document, parseChordPro(`{diagrams: on}\n${SONG}`), { voicings })
        expect(top.children[0]?.classList.contains('mn-chart-diagrams')).toBe(true)
        const option = renderChart(document, parseChordPro(SONG), { voicings, diagrams: 'bottom' })
        expect(option.lastElementChild?.classList.contains('mn-chart-diagrams')).toBe(true)
        // The song's own directive wins over the option.
        const off = renderChart(document, parseChordPro(`{diagrams: off}\n${SONG}`), {
            voicings,
            diagrams: 'top'
        })
        expect(off.querySelector('.mn-chart-diagrams')).toBeNull()
        // Values from untrusted options are checked.
        const bad = renderChart(document, parseChordPro(SONG), {
            voicings,
            diagrams: 'sideways' as 'top'
        })
        expect(bad.querySelector('.mn-chart-diagrams')).toBeNull()
    })

    it('draws every chord once, the defined shape first, then the voicing database', () => {
        const el = renderChart(document, parseChordPro(`{diagrams}\n${SONG}`), { voicings })
        expect(rowOf(el)).toEqual(['G', 'C', 'D/F#'])
        const svgs = el.querySelectorAll('.mn-chart-row svg')
        expect(fretsOf(svgs[0])).toBe('320033')
        expect(fretsOf(svgs[1])).toBe('x32010')
        expect(el.querySelectorAll('.mn-chart-row .mn-cell')).toHaveLength(3)
    })

    it('skips chords defined with diagram off, and says which chords have no shape', () => {
        const el = renderChart(
            document,
            parseChordPro('{diagrams}\n{define: C diagram off}\n[G]a [C]b [Hm]c [Xyz]'),
            { voicings }
        )
        expect(rowOf(el)).toEqual(['G'])
        // Without the voicing database, only defined chords draw.
        const bare = renderChart(document, parseChordPro(`{diagrams}\n${SONG}`))
        expect(rowOf(bare)).toEqual(['G'])
        expect(bare.querySelector('.mn-chart-diagrams-note')?.textContent).toContain(
            'No diagram for C, D/F#: give the shape with {define: C base-fret 1 frets …}'
        )
    })

    it('transposes: names move, movable defined shapes with them', () => {
        const el = renderChart(document, parseChordPro(`{diagrams}\n{transpose: 2}\n${SONG}`), {
            voicings
        })
        expect(rowOf(el)).toEqual(['A', 'D', 'E/G#'])
        // An open shape isn't moved: the database's A.
        expect(fretsOf(el.querySelector('.mn-chart-row svg'))).toBe('x02220')
        const barre = (transpose: number) =>
            renderChart(
                document,
                parseChordPro(
                    '{diagrams}\n{define: F base-fret 1 frets 1 3 3 2 1 1 fingers 1 3 4 2 1 1}\n[F]x'
                ),
                { voicings, transpose }
            ).querySelector('.mn-chart-row svg')
        expect(barre(2)?.getAttribute('data-mn-chord')).toBe('G')
        expect(fretsOf(barre(2))).toBe('355433')
        // Down when it fits (the lowest fret stays at 1 or above), else up.
        expect(fretsOf(barre(-2))).toBe('11-13-13-12-11-11')
        expect(fretsOf(barre(5))).toBe('688766')
        expect(fretsOf(barre(-12))).toBe('133211')
    })

    it('with a capo, shows the shapes as played and says the capo', () => {
        const el = renderChart(document, parseChordPro(`{diagrams}\n{capo: 2}\n${SONG}`), {
            voicings
        })
        expect(el.querySelector('.mn-chart-diagrams-caption')?.textContent).toBe('Capo 2')
        expect(rowOf(el)).toEqual(['G', 'C', 'D/F#'])
        const piano = renderChart(document, parseChordPro(`{diagrams}\n{capo: 2}\n${SONG}`), {
            instrument: 'piano'
        })
        expect(piano.querySelector('.mn-chart-diagrams-caption')).toBeNull()
    })

    it('draws piano chords, with keys from definitions counted from the root', () => {
        const el = renderChart(
            document,
            parseChordPro(
                '{diagrams}\n{instrument: piano}\n{define: Am keys 0 3 7 12}\n[Am]a [F]b'
            ),
            { transpose: 2 }
        )
        expect(rowOf(el)).toEqual(['Bm', 'G'])
        expect(el.querySelectorAll('.mn-chart-row .mn-keyboard')).toHaveLength(2)
        const pitches = el.querySelector('.mn-chart-row svg')?.getAttribute('data-mn-pitches')
        expect(pitches).toBe('71 74 78 83')
    })

    it('follows the orientation and hand defaults', () => {
        const el = renderChart(document, parseChordPro(`{diagrams}\n${SONG}`), {
            voicings,
            orientation: { chord: 'horizontal' },
            hand: 'left'
        })
        const [, , width, height] = el
            .querySelector('.mn-chart-row svg')!
            .getAttribute('viewBox')!
            .split(' ')
            .map(Number)
        expect(width).toBeLessThan(height!)
    })
})

describe('{chord} in place', () => {
    it('draws a defined or known chord where it is, transposed only in brackets', () => {
        const el = renderChart(
            document,
            parseChordPro(
                '{chord: Bes base-fret 1 frets 1 1 3 3 3 1 fingers 1 1 2 3 4 1}\n{chord: [Am]}\n{chord: Am}\n{chord: Qq}'
            ),
            { voicings, transpose: 2 }
        )
        const inline = [...el.querySelectorAll('.mn-chart-chord')]
        expect(inline).toHaveLength(4)
        expect(inline[0]!.querySelector('svg')?.getAttribute('data-mn-chord')).toBe('Bes')
        expect(fretsOf(inline[0]!.querySelector('svg'))).toBe('113331')
        expect(inline[1]!.querySelector('svg')?.getAttribute('data-mn-chord')).toBe('Bm')
        expect(inline[2]!.querySelector('svg')?.getAttribute('data-mn-chord')).toBe('Am')
        expect(inline[3]!.querySelector('.mn-error-message')?.textContent).toContain(
            'No diagram for Qq'
        )
    })
})

describe('renderBlock with a chart', () => {
    it('passes the options and reads the instrument from the tags', () => {
        const host = document.createElement('div')
        const result = renderBlock('chords', '[C]x [G]y', host, {
            voicings,
            chartDiagrams: 'top',
            properties: () => ({ tags: ['type/music/piano/song'] })
        })
        expect(result.ok).toBe(true)
        expect(result.el.querySelectorAll('.mn-chart-row .mn-keyboard')).toHaveLength(2)
    })

    it('is not ok when a directive has a mistake, and still draws the chart', () => {
        const host = document.createElement('div')
        const result = renderBlock('chords', '{define: Am frets x 0 2 a 1 0}\n[Am]x', host)
        expect(result.ok).toBe(false)
        expect(result.error).toContain('frets takes one value per string')
        expect(result.el.querySelector('.mn-chord')?.textContent).toBe('Am')
    })
})
