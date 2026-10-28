import { afterEach, describe, expect, it } from 'bun:test'
import { isNotationLanguage, LANGUAGES, MAX_DIAGRAMS, renderBlock } from './render-block.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

describe('renderBlock', () => {
    it('knows its languages', () => {
        expect(LANGUAGES).toEqual(['chord', 'chords', 'keyboard', 'fretboard'])
        expect(isNotationLanguage('chord')).toBe(true)
        expect(isNotationLanguage('toString')).toBe(false)
    })

    it('renders a guitar chord from the shorthand', () => {
        const h = host()
        const result = renderBlock('chord', 'A x02220 x01230', h)
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-block-chord .mn-guitar-chord')).not.toBeNull()
        expect(h.querySelector('.mn-title')?.textContent).toBe('A')
        result.destroy()
        expect(h.children).toHaveLength(0)
    })

    it('renders a guitar chord from fields, with tuning and position', () => {
        const h = host()
        const result = renderBlock(
            'chord',
            'symbol: D\ntitle: D (DADGAD)\nfrets: 0 0 0 2 3 0\ntuning: DADGAD\nposition: 1',
            h
        )
        expect(result.error).toBeNull()
        expect(h.querySelector('.mn-title')?.textContent).toBe('D (DADGAD)')
    })

    it('draws nothing for an empty block', () => {
        const h = host()
        const result = renderBlock('chord', '  \n ', h)
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-empty')?.children).toHaveLength(0)
    })

    it('draws every chord spelling the parser accepts', () => {
        const h = host()
        for (const symbol of [
            'CΔ7',
            'Cmin6',
            'CM9',
            'Cm7-5',
            'Cø7',
            'Cm(maj7)',
            'C-(maj7)',
            'C7b9',
            'Cm11'
        ]) {
            expect(renderBlock('chord', `${symbol}\ninstrument: piano`, h).ok).toBe(true)
            expect(renderBlock('chord', symbol, h, { voicings: lookupGuitarVoicing }).ok).toBe(true)
        }
    })

    it('reads a chord symbol given as the name', () => {
        const h = host()
        renderBlock('chord', 'name: A\nfrets: x02220\nfingers: x01230', h)
        expect(h.querySelector('.mn-title')?.textContent).toBe('A')
        expect(h.querySelectorAll('.mn-root')).toHaveLength(2)
        renderBlock('chord', 'name: My shape\nfrets: x02220', h)
        expect(h.querySelectorAll('.mn-title')[1]?.textContent).toBe('My shape')
    })

    it('looks up a voicing when only the symbol is given', () => {
        const h = host()
        expect(renderBlock('chord', 'Am', h, { voicings: lookupGuitarVoicing }).ok).toBe(true)
        expect(
            renderBlock('chord', 'Am\nvoicing: 2', h, { voicings: lookupGuitarVoicing }).ok
        ).toBe(true)
        const missing = renderBlock('chord', 'Am\nvoicing: 99', h, {
            voicings: lookupGuitarVoicing
        })
        expect(missing.error).toContain('No voicing 99')
    })

    it('renders piano chords from a symbol, with a slash bass and fingering', () => {
        const h = host()
        const result = renderBlock('chord', 'C/G\ninstrument: piano\nfingering: 5-1-2-4', h)
        expect(result.ok).toBe(true)
        // G3 (bass), then C4 E4 G4.
        expect(h.querySelectorAll('.mn-on')).toHaveLength(4)
        expect([...h.querySelectorAll('.mn-key-label')].map((l) => l.textContent)).toEqual([
            '5',
            '1',
            '2',
            '4'
        ])
    })

    it('accepts ♯ and ♭ and unusual symbols when frets are given', () => {
        const h = host()
        expect(renderBlock('chord', 'F♯m 244222', h).ok).toBe(true)
        expect(h.querySelectorAll('.mn-root').length).toBeGreaterThan(0)
        expect(renderBlock('chord', 'B♭ x13331', h, { voicings: lookupGuitarVoicing }).ok).toBe(
            true
        )
        expect(renderBlock('chord', 'F♯m', h, { voicings: lookupGuitarVoicing }).ok).toBe(true)
        expect(renderBlock('chord', 'Cm(maj7)', h, { voicings: lookupGuitarVoicing }).ok).toBe(true)
        expect(renderBlock('chord', 'C7(b9) x32323', h).ok).toBe(true)
        expect(renderBlock('chord', 'Zz x02220', h).ok).toBe(true)
    })

    it('keeps a piano bass spelled differently from the chord', () => {
        const h = host()
        renderBlock('chord', 'Cm/D#\ninstrument: piano', h)
        // D# is Eb, already in the chord: still played as the bass below.
        expect(h.querySelectorAll('.mn-on')).toHaveLength(4)
    })

    it('reads a single note with an octave as that key', () => {
        const h = host()
        renderBlock('keyboard', 'C4', h)
        expect(h.querySelectorAll('.mn-on')).toHaveLength(1)
    })

    it('renders piano chords from pitches', () => {
        const h = host()
        expect(renderBlock('chord', 'symbol: A\npitches: A3 C#4 E4', h).ok).toBe(true)
        expect(h.querySelectorAll('.mn-on')).toHaveLength(3)
        expect(h.querySelectorAll('.mn-root')).toHaveLength(1)
    })

    it('renders keyboards and fretboards from any note set', () => {
        const h = host()
        expect(renderBlock('keyboard', 'chord: Cmaj7\nlabels: intervals', h).ok).toBe(true)
        expect(renderBlock('keyboard', 'D dorian\nrange: C4-C5', h).ok).toBe(true)
        expect(renderBlock('fretboard', 'scale: A minor pentatonic\nfrets: 5-8', h).ok).toBe(true)
        expect(renderBlock('fretboard', 'notes: E G# B\ntuning: Drop D\nlabels: none', h).ok).toBe(
            true
        )
    })

    it('renders chord charts with a transpose option', () => {
        const h = host()
        renderBlock('chords', '[G]Hello', h, { transpose: 2 })
        expect(h.querySelector('.mn-chord')?.textContent).toBe('A')
    })

    it.each([
        ['chord', 'A', 'Add "frets:" for A'],
        ['chord', 'title: Mystery', 'Add a chord symbol and "frets:"'],
        ['chord', 'A\nfrets: x0222a', 'Invalid frets "x0222a"'],
        ['chord', 'A x02220 x0123', 'has 5 fingers for 6 strings'],
        ['chord', 'C x32010\nposition: 5', 'position 5 is above the lowest fretted note (fret 1)'],
        ['chord', 'A x02220\ntuning: DADGA', 'The tuning has 5 strings, the frets 6'],
        ['chord', 'A x02220\nposition: 0', 'position must be a whole number from 1'],
        ['chord', 'A x02220\ninstrument: banjo', 'Unknown instrument "banjo"'],
        ['chord', 'X\ninstrument: piano', 'Unknown chord "X"'],
        ['keyboard', 'chord: Hm', 'Unknown chord "Hm"'],
        ['keyboard', 'C major\nrange: C5-C4', 'Invalid range'],
        ['keyboard', 'C major\nlabels: colors', 'Unknown labels "colors"'],
        ['keyboard', 'C major\nlabels: fingers', 'use notes, degrees, intervals or none'],
        ['fretboard', 'labels: notes', 'Add "scale:", "chord:" or "notes:"'],
        ['fretboard', 'C major\nfrets: 30-40', 'Frets go up to 36'],
        ['fretboard', 'C major\ntuning: XYZ', 'Unknown tuning "XYZ"'],
        ['fretboard', 'scale: C nonsense', 'Unknown scale "C nonsense"']
    ] as const)('shows an inline error for %s %p', (language, source, message) => {
        const h = host()
        const result = renderBlock(language, source, h)
        expect(result.ok).toBe(false)
        expect(result.error).toContain(message)
        expect(h.querySelector('.mn-error .mn-error-message')?.textContent).toContain(language)
    })
})

describe('several diagrams in one block', () => {
    const titles = (h: HTMLElement) =>
        [...h.querySelectorAll('.mn-title')].map((t) => t.textContent)

    it('draws each part in its own cell of a row', () => {
        const h = host()
        const result = renderBlock('chord', 'G 320003 210003\n---\nC x32010\n---\nD xx0232', h)
        expect(result.ok).toBe(true)
        expect(h.querySelectorAll('.mn-row > .mn-cell')).toHaveLength(3)
        expect(titles(h)).toEqual(['G', 'C', 'D'])
    })

    it('shares the first part when it only holds shareable keys, and a part overrides it', () => {
        const h = host()
        renderBlock(
            'chord',
            'orientation: horizontal\ncolumns: 2\n---\nG 320003\n---\nC x32010\norientation: vertical',
            h
        )
        expect(h.querySelector('.mn-grid.mn-cols-2')).not.toBeNull()
        const [g, c] = [...h.querySelectorAll('.mn-guitar-chord')]
        // Horizontal: the nut is a vertical line.
        const nut = (svg: Element | undefined) => svg?.querySelector('.mn-nut')
        expect(nut(g)?.getAttribute('x1')).toBe(nut(g)?.getAttribute('x2') ?? 'none')
        expect(nut(c)?.getAttribute('y1')).toBe(nut(c)?.getAttribute('y2') ?? 'none')
    })

    it('treats a first part with a diagram as a diagram', () => {
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nfrets: 5-8\n---\nC major\nfrets: 0-3', h)
        expect(h.querySelectorAll('.mn-fretboard')).toHaveLength(2)
    })

    it('uses the shared tuning for every chord', () => {
        const h = host()
        renderBlock('chord', 'tuning: DADGAD\n---\nD 000230\n---\nG 000020', h)
        expect(h.querySelectorAll('.mn-guitar-chord')).toHaveLength(2)
        // D in DADGAD: the open D strings are roots.
        expect(h.querySelectorAll('.mn-guitar-chord')[0]?.querySelectorAll('.mn-root').length).toBe(
            3
        )
    })

    it('shows a mistake in its cell and still draws the others', () => {
        const h = host()
        const result = renderBlock('chord', 'G 320003\n---\nC x3201a\n---\nD xx0232', h)
        expect(result.ok).toBe(false)
        expect(result.error).toBe('diagram 2: Invalid frets "x3201a": use e.g. x02220')
        expect(h.querySelectorAll('.mn-guitar-chord')).toHaveLength(2)
        expect(h.querySelector('.mn-cell.mn-error .mn-error-message')?.textContent).toBe(
            'chord, diagram 2: Invalid frets "x3201a": use e.g. x02220'
        )
    })

    it.each([
        ['tuning: DADGAD\n---', 'Add a diagram after the shared settings'],
        ['---\n---', 'Add a diagram'],
        ['columns: 0\n---\nG 320003', 'columns must be a whole number from 1 to 12, got "0"'],
        ['columns: 13\n---\nG 320003', 'from 1 to 12'],
        ['G 320003\ncolumns: 2\n---\nC x32010', '"columns" goes in the shared settings'],
        ['orientation: sideways\n---\nG 320003', 'Unknown orientation "sideways"']
    ])('says what is wrong in %p', (source, message) => {
        const result = renderBlock('chord', source, host())
        expect(result.ok).toBe(false)
        expect(result.error).toContain(message)
    })

    it('refuses more diagrams than the limit', () => {
        const source = Array.from({ length: MAX_DIAGRAMS + 1 }, () => 'A x02220').join('\n---\n')
        const result = renderBlock('chord', source, host())
        expect(result.error).toBe(`At most ${MAX_DIAGRAMS} diagrams per block, found 33`)
    })

    it('never splits chord charts', () => {
        const h = host()
        const result = renderBlock('chords', '{title: Song}\n[G]One\n---\n[C]Two', h)
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-row')).toBeNull()
    })
})

describe('orientation and hand', () => {
    const lineIsVertical = (el: Element | null) =>
        el !== null && el.getAttribute('x1') === el.getAttribute('x2')

    it('follows the defaults, unless the block says otherwise', () => {
        const h = host()
        const options = { orientation: { chord: 'horizontal', keyboard: 'vertical' } } as const
        renderBlock('chord', 'A x02220', h, options)
        renderBlock('chord', 'A x02220\norientation: vertical', h, options)
        const [defaulted, own] = [...h.querySelectorAll('.mn-nut')]
        expect(lineIsVertical(defaulted ?? null)).toBe(true)
        expect(lineIsVertical(own ?? null)).toBe(false)
    })

    it('draws piano chords with the keyboards default, not the chord diagrams one', () => {
        const h = host()
        renderBlock('chord', 'C\ninstrument: piano', h, {
            orientation: { chord: 'horizontal', keyboard: 'vertical' }
        })
        const svg = h.querySelector('.mn-keyboard')!
        const [, , w, ht] = svg.getAttribute('viewBox')!.split(' ').map(Number)
        expect(ht).toBeGreaterThan(w!)
    })

    it('mirrors guitar diagrams and fretboards for left-handed players, not keyboards', () => {
        const h = host()
        const right = renderBlock('chord', 'A x02220', h).el
        const left = renderBlock('chord', 'A x02220', h, { hand: 'left' }).el
        const lowX = (el: HTMLElement) => Number(el.querySelector('.mn-string')?.getAttribute('x1'))
        expect(lowX(left)).toBeGreaterThan(lowX(right))
        const keys = (o: { hand?: 'left' }) =>
            renderBlock('keyboard', 'C major', host(), o).el.innerHTML
        expect(keys({ hand: 'left' })).toBe(keys({}))
    })

    it('checks hand on keyboards too', () => {
        expect(renderBlock('keyboard', 'C major\nhand: up', host()).error).toContain(
            'Unknown hand "up"'
        )
    })
})
