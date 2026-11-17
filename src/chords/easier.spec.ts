/** Easier charts (#45): `{simplify}` and `{capo: auto}` in a ChordPro chart. */
import { describe, expect, it } from 'bun:test'
import { parseChordPro } from './chordpro.js'
import { chartChords, easierChart } from './chart.js'
import { renderBlock } from '../render/render-block.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

const host = () => document.body.appendChild(document.createElement('div'))
const draw = (source: string, options = {}) => {
    const h = host()
    const result = renderBlock('chords', source, h, options)
    const chart = h.querySelector('.mn-chart')!
    return {
        ok: result.ok,
        chart,
        chords: [...chart.querySelectorAll('.mn-chord')].map((c) => c.textContent).filter((c) => c),
        meta: chart.querySelector('.mn-chart-meta')?.textContent ?? '',
        messages: [...chart.querySelectorAll('.mn-error-message')].map((m) => m.textContent)
    }
}

const SONG = '[Cmaj9]Hello [G5]world [Am7]again [E9]and [F#]end'

describe('{simplify} in a chart', () => {
    it('draws an easier chord only where a plainer chord of the family is easier', () => {
        const plain = draw(SONG)
        expect(plain.chords).toEqual(['Cmaj9', 'G5', 'Am7', 'E9', 'F#'])
        expect(plain.meta).not.toContain('Easier chords')
        expect(plain.chart.hasAttribute('data-mn-simplified')).toBe(false)
        const easy = draw(`{simplify}\n${SONG}`)
        expect(easy.ok).toBe(true)
        expect(easy.chords).toEqual(['Cmaj7', 'G', 'Am7', 'E7', 'F#'])
        expect(easy.meta).toContain('Easier chords')
        expect(easy.chart.hasAttribute('data-mn-simplified')).toBe(true)
    })

    it('reads yes and no, the last one wins, and says what to write for anything else', () => {
        expect(draw(`{simplify: yes}\n${SONG}`).chords[0]).toBe('Cmaj7')
        expect(draw(`{simplify: On}\n${SONG}`).chords[0]).toBe('Cmaj7')
        expect(draw(`{simplify: no}\n${SONG}`).chords[0]).toBe('Cmaj9')
        expect(draw(`{simplify}\n{simplify: off}\n${SONG}`).chords[0]).toBe('Cmaj9')
        const bad = draw(`{simplify: maybe}\n${SONG}`)
        expect(bad.messages).toEqual(['{simplify: maybe}: use yes or no'])
        expect(bad.chords[0]).toBe('Cmaj9')
        expect(parseChordPro('{simplify}').simplify).toBe(true)
        expect(parseChordPro('[C]la').simplify).toBe(false)
    })

    it('says nothing when no chord gets easier', () => {
        const same = draw('{simplify}\n[G]Hello [C]world [Am7]end')
        expect(same.chords).toEqual(['G', 'C', 'Am7'])
        expect(same.meta).not.toContain('Easier chords')
        expect(same.chart.hasAttribute('data-mn-simplified')).toBe(false)
    })

    it('plays the easier chords: the bars and the chords of chartChords', () => {
        const easy = draw(`{simplify}\n${SONG}`)
        expect(
            [...easy.chart.querySelectorAll('[data-mn-bar]')].map((b) =>
                b.getAttribute('data-mn-chord')
            )
        ).toEqual(['Cmaj7', 'G', 'Am7', 'E7', 'F#'])
        const song = parseChordPro(`{simplify}\n${SONG}`)
        expect(chartChords(song).chords.map((c) => c.chord)).toEqual([
            'Cmaj7',
            'G',
            'Am7',
            'E7',
            'F#'
        ])
        // The option comes before the song's own wish, both ways.
        expect(chartChords(song, { simplify: false }).chords[0]!.chord).toBe('Cmaj9')
        expect(chartChords(parseChordPro(SONG), { simplify: true }).chords[0]!.chord).toBe('Cmaj7')
    })

    it('goes with a transposition: the chord shown is the one made easier', () => {
        // Bbmaj9 up 2 is Cmaj9, which has an easier Cmaj7.
        const moved = draw('{simplify}\n{transpose: 2}\n[Bbmaj9]Hello [F5]world')
        expect(moved.chords).toEqual(['Cmaj7', 'G'])
        expect(moved.meta).toContain('Transposed +2')
    })

    it('keeps a chord the song defines: its author gave it a shape', () => {
        const own = draw(
            '{simplify}\n{define: G5 base-fret 1 frets 3 5 5 x x x}\n[G5]Hello [E9]end'
        )
        expect(own.chords).toEqual(['G5', 'E7'])
    })

    it('leaves a piano chart as it is', () => {
        const piano = draw(`{simplify}\n{instrument: piano}\n${SONG}`)
        expect(piano.chords).toEqual(['Cmaj9', 'G5', 'Am7', 'E9', 'F#'])
        expect(piano.meta).not.toContain('Easier chords')
    })

    it('does not change the song it is given', () => {
        const song = parseChordPro(`{simplify}\n{capo: auto}\n[A9]Hello [D]world`)
        const before = JSON.stringify(song)
        chartChords(song)
        expect(JSON.stringify(song)).toBe(before)
    })
})

describe('{capo: auto} in a chart', () => {
    it('finds the capo with the most open shapes and draws the shapes to play', () => {
        const chart = draw('{capo: auto}\n[A]One [D]two [E]three [F#m]four')
        expect(chart.chords).toEqual(['G', 'C', 'D', 'Em'])
        expect(chart.meta).toContain('Capo 2')
        const song = parseChordPro('{capo: auto}\n[A]One')
        expect([song.capoAuto, song.capo]).toEqual([true, null])
    })

    it('draws the diagrams as played behind the capo, sounding the chords written', () => {
        const chart = draw('{capo: auto}\n{diagrams}\n[Bb]One [Eb]two [F]three [Gm]four', {
            voicings: lookupGuitarVoicing
        })
        expect(chart.chords).toEqual(['G', 'C', 'D', 'Em'])
        expect(chart.meta).toContain('Capo 3')
        const diagrams = [...chart.chart.querySelectorAll('.mn-chart-diagrams svg')]
        expect(diagrams.length).toBe(4)
        // The first bar sounds Bb: the G shape three frets up.
        const first = chart.chart.querySelector('[data-mn-bar]')!
        const lowest = Math.min(...first.getAttribute('data-mn-voicing')!.split(' ').map(Number))
        expect(lowest % 12).toBe(10)
    })

    it('adds no capo when none does better', () => {
        const open = draw('{capo: auto}\n[G]One [C]two [D]three [Em]four')
        expect(open.chords).toEqual(['G', 'C', 'D', 'Em'])
        expect(open.meta).not.toContain('Capo')
    })

    it('a capo written as a number is the song as before: the chords are the shapes', () => {
        const fixed = draw('{capo: 2}\n[A]One [D]two')
        expect(fixed.chords).toEqual(['A', 'D'])
        expect(fixed.meta).toContain('Capo 2')
        // The last `{capo}` wins.
        expect(parseChordPro('{capo: auto}\n{capo: 3}').capoAuto).toBe(false)
        expect(parseChordPro('{capo: 3}\n{capo: Auto}').capoAuto).toBe(true)
    })

    it('goes with {simplify}: the capo is found for the easier chords', () => {
        const both = draw('{simplify}\n{capo: auto}\n[A9]One [D]two [E]three [F#m]four')
        // A9 has an easier A7 (and A): the capo is found with it.
        expect(both.meta).toContain('Easier chords')
        expect(both.meta).toMatch(/Capo \d/)
        expect(both.chords).toHaveLength(4)
        expect(both.chords.slice(1)).toEqual(['C', 'D', 'Em'])
        expect(both.chords[0]).toMatch(/^G/)
    })

    it('goes with a transposition', () => {
        // G C D Em up 2 sounds A D E F#m: a capo on 2, and the shapes G C D Em again.
        const moved = draw('{capo: auto}\n{transpose: 2}\n[G]One [C]two [D]three [Em]four')
        expect(moved.chords).toEqual(['G', 'C', 'D', 'Em'])
        expect(moved.meta).toContain('Capo 2')
        expect(moved.meta).toContain('Transposed +2')
    })

    it('leaves a piano chart as it is', () => {
        const piano = draw('{capo: auto}\n{instrument: piano}\n[A]One [D]two [E]three [F#m]four')
        expect(piano.chords).toEqual(['A', 'D', 'E', 'F#m'])
        expect(piano.meta).not.toContain('Capo')
    })
})

describe('easierChart: the easier version as data, for an app', () => {
    const song = (source: string) => parseChordPro(source)

    it("says what the chart's own wishes change", () => {
        const none = easierChart(song(SONG))
        expect(none.easier).toEqual([])
        expect(none.capo).toBeNull()
        expect([...none.renames]).toEqual([])
        const asked = easierChart(song(`{simplify}\n${SONG}`))
        expect(asked.easier).toEqual([
            { from: 'Cmaj9', to: 'Cmaj7' },
            { from: 'G5', to: 'G' },
            { from: 'E9', to: 'E7' }
        ])
        expect([...asked.renames]).toEqual([
            ['Cmaj9', 'Cmaj7'],
            ['G5', 'G'],
            ['E9', 'E7']
        ])
    })

    it('shows what each switch would change, whatever the chart asks', () => {
        const easy = easierChart(song(SONG), { simplify: true })
        expect(easy.easier.map((c) => c.to)).toEqual(['Cmaj7', 'G', 'E7'])
        expect(easy.capo).toBeNull()
        // Off for a chart that asks for it.
        expect(easierChart(song(`{simplify}\n${SONG}`), { simplify: false }).easier).toEqual([])
        const capo = easierChart(song('[A]One [D]two [E]three [F#m]four'), { capo: true })
        expect(capo.capo!.capo).toBe(2)
        expect(capo.capo!.shapes.map((s) => `${s.chord}:${s.shape}`)).toEqual([
            'A:G',
            'D:C',
            'E:D',
            'F#m:Em'
        ])
        expect([...capo.renames]).toEqual([
            ['A', 'G'],
            ['D', 'C'],
            ['E', 'D'],
            ['F#m', 'Em']
        ])
        expect(easierChart(song('{capo: auto}\n[A]One [D]two'), { capo: false }).capo).toBeNull()
    })

    it('gives fret 0 when no capo does better, and nothing to rename', () => {
        const open = easierChart(song('[G]One [C]two [D]three [Em]four'), { capo: true })
        expect(open.capo!.capo).toBe(0)
        expect([...open.renames]).toEqual([])
    })

    it("with a capo, gives the easier version's transposition and key: the chords are as shown", () => {
        const moved = easierChart(
            song('{key: G}\n{transpose: 2}\n[G]One [C]two [D]three [Em]four'),
            {
                capo: true
            }
        )
        expect(moved.capo!.capo).toBe(2)
        // Written G sounds A, played as a G shape behind the capo: nothing to rename.
        expect([...moved.renames]).toEqual([])
        expect([moved.transpose, moved.key]).toEqual([0, 'A'])
        // Without a capo above 0 the song's own stay.
        const plain = easierChart(song('{key: G}\n{transpose: 2}\n[Gmaj9]One'), { simplify: true })
        expect([plain.transpose, plain.key]).toEqual([2, 'G'])
    })

    it('changes nothing on a piano chart', () => {
        const piano = easierChart(song(`{instrument: piano}\n${SONG}`), {
            simplify: true,
            capo: true
        })
        expect(piano.easier).toEqual([])
        expect(piano.capo).toBeNull()
        expect([...piano.renames]).toEqual([])
    })
})
