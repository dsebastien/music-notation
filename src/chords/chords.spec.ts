import { describe, expect, it } from 'bun:test'
import { parseChordPro, parseLyrics } from './chordpro.js'
import { renderChart } from './chart.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

const SONG = `{title: Example Song}
{artist: Someone}
{key: G}
{capo: 2}
# a comment line, ignored

[G]Hello [D/F#]little [Em]world
{c: softly}

{soc}
[C]La la [G]la
{eoc}

{start_of_verse: label="Verse 2"}
[G] [D] [Em] [C]
{end_of_verse}

{sot}
e|---0---|
{eot}`

describe('parseLyrics', () => {
    it('splits chords from lyrics', () => {
        expect(parseLyrics('[G]Hello [D]world')).toEqual([
            { chord: 'G', text: 'Hello ' },
            { chord: 'D', text: 'world' }
        ])
        expect(parseLyrics('Intro [Am]')).toEqual([
            { chord: null, text: 'Intro ' },
            { chord: 'Am', text: '' }
        ])
        expect(parseLyrics('no chords')).toEqual([{ chord: null, text: 'no chords' }])
    })
})

describe('parseChordPro', () => {
    it('reads metadata, sections and lines', () => {
        const song = parseChordPro(SONG)
        expect(song).toMatchObject({ title: 'Example Song', artist: 'Someone', key: 'G', capo: 2 })
        expect(song.sections.map((s) => [s.kind, s.label])).toEqual([
            ['none', null],
            ['chorus', null],
            ['verse', 'Verse 2'],
            ['tab', null]
        ])
        expect(song.sections[0]!.lines.map((l) => l.kind)).toEqual(['lyrics', 'comment'])
        expect(song.sections[3]!.lines).toEqual([{ kind: 'text', text: 'e|---0---|' }])
    })

    it('parses long malformed lines in linear time', () => {
        const start = performance.now()
        parseChordPro(`{a${' '.repeat(5000)}x\n{title${' '.repeat(5000)}`)
        expect(performance.now() - start).toBeLessThan(100)
    })

    it('reads directive values with colons and spaces', () => {
        expect(parseChordPro('{title: Intro: part 1}').title).toBe('Intro: part 1')
        expect(parseChordPro('{start_of_verse Verse 2}\n[A]x').sections[0]!.label).toBe('Verse 2')
        expect(parseChordPro('{titlex}').title).toBeNull()
    })

    it('reads transpose and ignores unknown directives', () => {
        const song = parseChordPro('{transpose: -2}\n{x_custom: 1}\n[A]Hi')
        expect(song.transpose).toBe(-2)
        expect(song.sections).toHaveLength(1)
    })
})

describe('renderChart', () => {
    it('renders chords over lyrics with the song details', () => {
        const el = renderChart(document, parseChordPro(SONG))
        expect(el.querySelector('.mn-chart-title')?.textContent).toBe('Example Song')
        expect(el.querySelector('.mn-chart-meta')?.textContent).toBe('Key G · Capo 2')
        expect([...el.querySelectorAll('.mn-chord')].slice(0, 3).map((c) => c.textContent)).toEqual(
            ['G', 'D/F#', 'Em']
        )
        expect(el.querySelector('.mn-section-chorus .mn-section-label')?.textContent).toBe('Chorus')
        expect(el.querySelectorAll('.mn-chords-only')).toHaveLength(1)
        expect(el.querySelector('.mn-pre')?.textContent).toBe('e|---0---|')
    })

    it('rounds fractional and ignores invalid transpositions', () => {
        const song = parseChordPro('{key: G}\n[G]Hi')
        expect(
            renderChart(document, song, { transpose: 1.6 }).querySelector('.mn-chord')?.textContent
        ).toBe('A')
        expect(
            renderChart(document, song, { transpose: NaN }).querySelector('.mn-chord')?.textContent
        ).toBe('G')
    })

    it('transposes chords and the key, spelled for the new key', () => {
        const el = renderChart(document, parseChordPro(SONG), { transpose: 3 })
        expect([...el.querySelectorAll('.mn-chord')].slice(0, 3).map((c) => c.textContent)).toEqual(
            ['Bb', 'F/A', 'Gm']
        )
        expect(el.querySelector('.mn-chart-meta')?.textContent).toBe(
            'Key Bb · Capo 2 · Transposed +3'
        )
    })

    it('keeps the letters of the key when it moves', () => {
        const chords = (source: string, transpose: number) =>
            [
                ...renderChart(document, parseChordPro(source), { transpose }).querySelectorAll(
                    '.mn-chord'
                )
            ].map((c) => c.textContent)
        expect(chords('{key: G}\n[G]a [D]b [Em]c [C]d [D/F#]e', -1)).toEqual([
            'F#',
            'C#',
            'D#m',
            'B',
            'C#/E#'
        ])
        expect(chords('{key: Em}\n[Em]a [Am]b [B7]c [C]d', -1)).toEqual(['Ebm', 'Abm', 'Bb7', 'Cb'])
        expect(chords('{key: C}\n[C]a [F]b [G]c [Bdim]d [E7]e', 6)).toEqual([
            'F#',
            'B',
            'C#',
            'E#dim',
            'A#7'
        ])
        expect(chords('{key: A}\n[A]a [D]b [E7]c', 1)).toEqual(['Bb', 'Eb', 'F7'])
        // Without a key, the key the chords are likeliest in: one spelling direction.
        expect(chords('[C]a [F]b [G7]c [Am]d [E7]e [Bb]f', 1)).toEqual([
            'Db',
            'Gb',
            'Ab7',
            'Bbm',
            'F7',
            'Cb'
        ])
        expect(chords('[Am]a [Dm]b [E7]c', 2)).toEqual(['Bm', 'Em', 'F#7'])
        expect(chords('[A]a [D]b [E7]c [F#m]d', -1)).toEqual(['Ab', 'Db', 'Eb7', 'Fm'])
    })

    it('spells the chords used row like the lyrics', () => {
        const el = renderChart(document, parseChordPro('{key: G}\n{diagrams}\n[G]a [C]b'), {
            transpose: -1,
            voicings: lookupGuitarVoicing
        })
        expect(
            [...el.querySelectorAll('.mn-chart-diagrams svg.mn-svg')].map((s) =>
                s.getAttribute('data-mn-chord')
            )
        ).toEqual(['F#', 'B'])
    })
})
