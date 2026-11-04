import { afterEach, describe, expect, it } from 'bun:test'
import { isNotationLanguage, LANGUAGES, MAX_DIAGRAMS, renderBlock } from './render-block.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

describe('renderBlock', () => {
    it('knows its languages', () => {
        expect(LANGUAGES).toEqual([
            'chord',
            'chords',
            'keyboard',
            'fretboard',
            'strum',
            'picking',
            'progression',
            'circle'
        ])
        expect(isNotationLanguage('chord')).toBe(true)
        expect(isNotationLanguage('toString')).toBe(false)
    })

    it('draws the full barre of frets written without fingers (#73)', () => {
        const h = host()
        renderBlock('chord', 'F 133211', h)
        const bars = h.querySelectorAll('.mn-barre')
        expect(bars).toHaveLength(1)
        expect(bars[0]!.getAttribute('data-mn-fret')).toBe('1')
        // No finger numbers appear: none were written.
        expect([...h.querySelectorAll('.mn-dot-text')].map((t) => t.textContent)).toEqual([])
        // An A-shape barre too; an open chord or a small grip gets none.
        const bm = host()
        renderBlock('chord', 'Bm7 x24232', bm)
        expect(bm.querySelectorAll('.mn-barre')).toHaveLength(1)
        const open = host()
        renderBlock('chord', 'A x02220', open)
        expect(open.querySelectorAll('.mn-barre')).toHaveLength(0)
        const small = host()
        renderBlock('chord', 'F xx3211', small)
        expect(small.querySelectorAll('.mn-barre')).toHaveLength(0)
    })

    it('fits a three-character label inside its dot (#73)', () => {
        const h = host()
        renderBlock('chord', 'Cdim7 x3424x\nlabels: intervals', h)
        const long = [...h.querySelectorAll('.mn-dot-text')].find((t) => t.textContent === 'bb7')!
        expect(long).toBeDefined()
        expect(long.classList.contains('mn-dot-text-long')).toBe(true)
        // Squeezed to the dot's width (r = 7): the text never passes its edge.
        expect(Number(long.getAttribute('textLength'))).toBeLessThanOrEqual(12)
        expect(long.getAttribute('lengthAdjust')).toBe('spacingAndGlyphs')
        // Short labels keep their size.
        const r = [...h.querySelectorAll('.mn-dot-text')].find((t) => t.textContent === 'R')!
        expect(r.classList.contains('mn-dot-text-long')).toBe(false)
        expect(r.getAttribute('textLength')).toBeNull()
        // Fretboards too.
        const f = host()
        renderBlock('fretboard', 'chord: Cdim7\nlabels: intervals', f)
        const fl = [...f.querySelectorAll('.mn-dot-text')].find((t) => t.textContent === 'bb7')
        expect(fl?.classList.contains('mn-dot-text-long')).toBe(true)
    })

    it('shows how a strum pattern placed by the hand was read (#73)', () => {
        const h = host()
        const result = renderBlock('strum', 'D U D U\nsubdivision: triplets', h)
        // A note, not an error: the pattern draws and plays.
        expect(result.ok).toBe(true)
        expect(h.querySelector('svg.mn-strum')).not.toBeNull()
        expect(h.querySelector('.mn-strum-note')?.textContent).toContain('Read as D - U D - U')
        const plain = host()
        renderBlock('strum', 'D DU UDU', plain)
        expect(plain.querySelector('.mn-strum-note')).toBeNull()
    })

    it('titles a single scale position like the diagrams of positions: all (#73)', () => {
        const title = (source: string) => {
            const h = host()
            renderBlock('fretboard', source, h)
            return h.querySelector('.mn-title')?.textContent
        }
        expect(title('scale: G major\nshape: E')).toBe('G major, E shape')
        expect(title('scale: A minor pentatonic\nposition: 2')).toBe('A minor pentatonic, box 2')
        expect(title('scale: C major\nshape: 3nps\nposition: 1')).toBe('C major, 3nps 1')
        expect(title('scale: A major pentatonic\nposition: 1\nnumbering: minor')).toBe(
            'A major pentatonic, box 1 (from F#m)'
        )
        expect(title('arpeggio: G7\nshape: A')).toBe('G7 arpeggio, A shape')
        // A title given wins.
        expect(title('scale: G major\nshape: E\ntitle: Mine')).toBe('Mine')
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
            'Cm11',
            // Chord-sheet spellings (#40): alterations in parentheses and other names tonal knows.
            'C7(b9)',
            'Cm7(b5)',
            'Cmaj9(#11)',
            'C7(b5,#9)',
            'Cmaj7(#5)',
            'C(add9)',
            'Cm(add9)',
            'Cmaj7b5',
            'Cm6/9',
            'Csus2sus4',
            'C-5',
            'Cm6add9',
            'Cmmaj9'
        ]) {
            expect(renderBlock('chord', `${symbol}\ninstrument: piano`, h).ok).toBe(true)
            expect(renderBlock('chord', symbol, h, { voicings: lookupGuitarVoicing }).ok).toBe(true)
        }
    })

    it("takes chords-db's voicings under its own names, and hands out copies of generated ones", () => {
        expect(lookupGuitarVoicing('Cmaj7b5', 0)?.frets).toEqual([null, 3, 4, 4, 5, null])
        expect(lookupGuitarVoicing('Cmmaj9', 0)?.frets).toEqual([null, 3, 1, 4, 3, null])
        const first = lookupGuitarVoicing('Cmaj9#11', 0)!
        const base = first.baseFret
        renderBlock('chord', 'symbol: Cmaj9#11\nposition: 1', host(), {
            voicings: lookupGuitarVoicing
        })
        first.frets[0] = 99
        expect(lookupGuitarVoicing('Cmaj9#11', 0)?.baseFret).toBe(base)
        expect(lookupGuitarVoicing('Cmaj9#11', 0)?.frets[0]).not.toBe(99)
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
        // D# is Eb, the chord's third: played as the bass below, not doubled above it.
        expect(h.querySelector('svg')?.getAttribute('data-mn-pitches')).toBe('51 60 67')
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
        ['chord', 'X\ninstrument: piano', `Didn't recognize "X": try`],
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
            // Each diagram's name has its own id.
            renderBlock('keyboard', 'C major', host(), o).el.innerHTML.replace(
                /mn-name-[\w-]+/g,
                ''
            )
        expect(keys({ hand: 'left' })).toBe(keys({}))
    })

    it('checks hand on keyboards too', () => {
        expect(renderBlock('keyboard', 'C major\nhand: up', host()).error).toContain(
            'Unknown hand "up"'
        )
    })
})

describe('rows after review', () => {
    it('splits CRLF and indented separators', () => {
        const h = host()
        renderBlock('chord', 'G 320003\r\n  ---  \r\nC x32010', h)
        expect(h.querySelectorAll('.mn-row .mn-guitar-chord')).toHaveLength(2)
    })

    it('draws nothing for a block of separators only', () => {
        const h = host()
        const result = renderBlock('chord', '---\n---', h)
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-empty')).not.toBeNull()
    })

    it('refuses a fractional columns, and a key that cannot be shared next to columns', () => {
        expect(renderBlock('chord', 'columns: 2.5\n---\nG 320003', host()).error).toContain(
            'columns must be a whole number'
        )
        expect(
            renderBlock('chord', 'columns: 2\ntitle: Song\n---\nG 320003', host()).error
        ).toContain(`"title" can't be shared: move it to a diagram`)
    })

    it('shares range for piano chords', () => {
        const h = host()
        const result = renderBlock('chord', 'instrument: piano\nrange: C3-C5\n---\nC\n---\nG', h)
        expect(result.ok).toBe(true)
        expect(h.querySelectorAll('.mn-keyboard')).toHaveLength(2)
    })

    it('shares piano voicing keys: a rootless ii-V-I', () => {
        const h = host()
        const result = renderBlock(
            'chord',
            'instrument: piano\nvoicing: rootless\noctave: 4\nhands: left+right\n---\nDm7\n---\nG7\n---\nCmaj7',
            h
        )
        expect([result.ok, result.error]).toEqual([true, null])
        const pitches = [...h.querySelectorAll('.mn-keyboard')].map((svg) =>
            svg.getAttribute('data-mn-pitches')
        )
        // Rootless A on Dm7: F A C E; the same block with each key written per chord agrees.
        const each = host()
        renderBlock(
            'chord',
            ['Dm7', 'G7', 'Cmaj7']
                .map(
                    (c) =>
                        `${c}\ninstrument: piano\nvoicing: rootless\noctave: 4\nhands: left+right`
                )
                .join('\n---\n'),
            each
        )
        expect(pitches).toEqual(
            [...each.querySelectorAll('.mn-keyboard')].map((svg) =>
                svg.getAttribute('data-mn-pitches')
            )
        )
        expect(pitches).toHaveLength(3)
        expect(
            renderBlock(
                'chord',
                'instrument: piano\ninversion: 1\nfingering: auto\n---\nC\n---\nF',
                host()
            ).ok
        ).toBe(true)
    })

    it('hints at the shareable keys when a first part meant as settings draws as a diagram', () => {
        const result = renderBlock('chord', 'tuning: DADGAD\ncolums: 2\n---\nG 320003', host())
        expect(result.error).toContain('shared settings before the first "---" may only hold')
    })

    it('lets an empty key fall back to the shared value', () => {
        const h = host()
        const result = renderBlock(
            'chord',
            'orientation: horizontal\nlabels: notes\n---\nA x02220\norientation:\nlabels:',
            h
        )
        expect(result.ok).toBe(true)
        const nut = h.querySelector('.mn-nut')!
        expect(nut.getAttribute('x1')).toBe(nut.getAttribute('x2'))
    })

    it('reports a bad shared value once', () => {
        const result = renderBlock(
            'chord',
            'orientation: diagonal\n---\nG 320003\n---\nC x32010',
            host()
        )
        expect(result.error).toBe('Unknown orientation "diagonal": use vertical or horizontal')
    })

    it('ignores invalid layout options and reads them in any case', () => {
        const h = host()
        const bad = { orientation: { chord: 'diagonal' }, hand: 'Left' } as unknown
        renderBlock('chord', 'A x02220', h, bad as Parameters<typeof renderBlock>[3])
        const nut = h.querySelector('.mn-nut')!
        // Vertical (diagonal ignored), and mirrored ("Left" read as left).
        expect(nut.getAttribute('y1')).toBe(nut.getAttribute('y2'))
        const strings = [...h.querySelectorAll('.mn-string')]
        expect(Number(strings[0]?.getAttribute('x1'))).toBeGreaterThan(
            Number(strings[5]?.getAttribute('x1'))
        )
    })

    it.each([
        ['chord', 'A x02220\ntuning: E A D G B E E A D G B E E', 'At most 12 strings'],
        ['fretboard', 'C major\ntuning: E A D G B E E A D G B E E', 'At most 12 strings'],
        ['chord', 'x0222000000000', 'At most 12 strings'],
        ['keyboard', 'C major\nrange: C0-C8', 'At most 88 keys'],
        ['keyboard', 'notes: C0 C8', 'At most 88 keys']
    ] as const)('caps the size of %s blocks: %p', (language, source, message) => {
        expect(renderBlock(language, source, host()).error).toContain(message)
    })
})

describe('every element stays inside its diagram', () => {
    const inside = (svg: Element) => {
        const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number)
        const points: [number, number][] = []
        svg.querySelectorAll('line').forEach((l) => {
            points.push([Number(l.getAttribute('x1')), Number(l.getAttribute('y1'))])
            points.push([Number(l.getAttribute('x2')), Number(l.getAttribute('y2'))])
        })
        svg.querySelectorAll('circle').forEach((c) => {
            const r = Number(c.getAttribute('r'))
            const [cx, cy] = [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]
            points.push([cx - r, cy - r], [cx + r, cy + r])
        })
        // Hit areas are invisible and centered on their marks: at the edges the diagram clips them.
        svg.querySelectorAll('rect:not(.mn-hit)').forEach((r) => {
            const [x, y] = [Number(r.getAttribute('x')), Number(r.getAttribute('y'))]
            points.push(
                [x, y],
                [x + Number(r.getAttribute('width')), y + Number(r.getAttribute('height'))]
            )
        })
        svg.querySelectorAll('text').forEach((t) => {
            points.push([Number(t.getAttribute('x')), Number(t.getAttribute('y'))])
        })
        return points.every(([x, y]) => x >= 0 && y >= 0 && x <= w! && y <= h!)
    }

    it.each(['vertical', 'horizontal'] as const)(
        'in %s diagrams, for both hands',
        (orientation) => {
            for (const hand of ['left', 'right'] as const) {
                const h = host()
                for (const [language, source] of [
                    ['chord', 'A x02220 x01230'],
                    ['chord', 'A x-12-14-14-13-12\nfingers: x13421'],
                    ['chord', 'C\ninstrument: piano'],
                    ['fretboard', 'A minor pentatonic\nfrets: 0-12'],
                    ['fretboard', 'E major\ntuning: bass'],
                    ['keyboard', 'C major\nlabels: degrees']
                ] as const) {
                    renderBlock(language, source, h, {
                        orientation: {
                            chord: orientation,
                            fretboard: orientation,
                            keyboard: orientation
                        },
                        hand
                    })
                }
                for (const svg of h.querySelectorAll('svg')) expect(inside(svg)).toBe(true)
            }
        }
    )
})

describe('scale fingering on keyboards (#28)', () => {
    const texts = (h: HTMLElement, cls: string) =>
        [...h.querySelectorAll(cls)].map((e) => e.textContent).join(' ')

    it('shows fingering and labels together', () => {
        const h = document.createElement('div')
        renderBlock('keyboard', 'C major\nfingering: 1 2 3 1 2 3 4 5\nlabels: degrees', h)
        expect(texts(h, '.mn-key-label')).toBe('1 2 3 4 5 6 7 1 2 3 4 5 6 7 1')
        expect(texts(h, '.mn-key-finger')).toBe('1 2 3 1 2 3 4 1 2 3 1 2 3 4 5')
    })

    it('fingers every octave of the range, the thumb where two octaves meet (#68)', () => {
        const h = document.createElement('div')
        renderBlock('keyboard', 'C major\nfingering: 1 2 3 1 2 3 4 5\nrange: C2-B3', h)
        expect(texts(h, '.mn-key-label')).toBe('1 2 3 1 2 3 4 1 2 3 1 2 3 4')
        expect(h.querySelector('[data-midi="36"]')?.getAttribute('class')).toContain('mn-on')
        // Every octave in the range stays lit.
        expect(h.querySelectorAll('.mn-on')).toHaveLength(14)
        // Two octaves, root to root: the thumb on C4, the little finger on the top C only.
        const two = document.createElement('div')
        renderBlock('keyboard', 'C major\nfingering: 1 2 3 1 2 3 4 5\nrange: C3-C5', two)
        expect(texts(two, '.mn-key-label')).toBe('1 2 3 1 2 3 4 1 2 3 1 2 3 4 5')
    })

    it('gives the standard fingering with fingering: auto, for each hand (#68)', () => {
        const fingered = (source: string) => {
            const h = document.createElement('div')
            const result = renderBlock('keyboard', source, h)
            expect(result.error).toBeNull()
            // Low to high (white keys draw before black ones).
            const byKey = [...h.querySelectorAll('[data-midi]')]
                .map((key) => {
                    const label = key.nextElementSibling
                    return label?.classList.contains('mn-key-label')
                        ? ([Number(key.getAttribute('data-midi')), label.textContent] as const)
                        : null
                })
                .filter((x) => x !== null)
                .sort((x, y) => x[0] - y[0])
            return {
                fingers: byKey.map(([, f]) => f).join(' '),
                keys: h.querySelector('svg')?.getAttribute('data-mn-pitches'),
                title: h.querySelector('.mn-title')?.textContent
            }
        }
        // Two octaves from the tonic, as an unfingered scale.
        expect(fingered('C major\nfingering: auto')).toEqual({
            fingers: '1 2 3 1 2 3 4 1 2 3 1 2 3 4 5',
            keys: '60 62 64 65 67 69 71 72 74 76 77 79 81 83 84',
            title: 'C major, right hand'
        })
        // The left hand plays an octave lower.
        expect(fingered('C major\nfingering: auto left')).toEqual({
            fingers: '5 4 3 2 1 3 2 1 4 3 2 1 3 2 1',
            keys: '48 50 52 53 55 57 59 60 62 64 65 67 69 71 72',
            title: 'C major, left hand'
        })
        expect(fingered('scale: F major\nfingering: auto').fingers).toBe(
            '1 2 3 4 1 2 3 1 2 3 4 1 2 3 4'
        )
        expect(fingered('scale: Bb major\nfingering: right hand').fingers).toBe(
            '4 1 2 3 1 2 3 4 1 2 3 1 2 3 4'
        )
        expect(fingered('scale: Eb harmonic minor\nfingering: left').fingers).toBe(
            '2 1 4 3 2 1 3 2 1 4 3 2 1 3 2'
        )
        expect(fingered('scale: F# harmonic minor\nfingering: auto').fingers).toBe(
            '3 4 1 2 3 1 2 3 4 1 2 3 1 2 3'
        )
        // A tonic from G up starts below middle C: A major A3 to A5, the left hand A2 to A4.
        expect(fingered('scale: A major\nfingering: auto').keys?.split(' ').at(0)).toBe('57')
        expect(fingered('scale: A major\nfingering: auto left').keys?.split(' ').at(-1)).toBe('69')
        // Two octaves of the left hand: the thumb on the middle root, 4 crossing over after it.
        expect(fingered('C major\nfingering: auto left\nrange: C2-C4').fingers).toBe(
            '5 4 3 2 1 3 2 1 4 3 2 1 3 2 1'
        )
        expect(fingered('C major\nfingering: auto\ntitle: Mine').title).toBe('Mine')
    })

    it('refuses fingers it cannot use (#68)', () => {
        const error = (source: string) =>
            renderBlock('keyboard', source, document.createElement('div')).error
        expect(error('C major\nfingering: 1 2 3 1 2 3 4 6')).toBe(
            'fingering: fingers go from 1 (thumb) to 5 (little finger), got "6"'
        )
        expect(error('notes: C D E\nfingering: 1 2 0')).toContain('got "0"')
        expect(error('C major\nfingering: 1 2 3 1 2 3 4')).toBe(
            'fingering has 7 fingers: C major needs 8, one per note from the root up to the root above'
        )
        expect(error('A minor pentatonic\nfingering: auto')).toContain(
            'fingering: auto knows the major, natural minor, harmonic minor and melodic minor scales'
        )
        expect(error('notes: C D E\nfingering: auto')).toContain(
            'fingering: auto goes with a major or minor scale'
        )
        expect(
            renderBlock(
                'chord',
                'C\ninstrument: piano\nfingering: 1 3 6',
                document.createElement('div')
            ).error
        ).toContain('got "6"')
    })
})

describe('fingering on keyboard note lists (#55)', () => {
    const fingers = (source: string) => {
        const h = document.createElement('div')
        expect(renderBlock('keyboard', source, h).ok).toBe(true)
        return [...h.querySelectorAll('[data-midi]')]
            .map((key) => {
                const label = key.nextElementSibling
                return label?.classList.contains('mn-key-label')
                    ? `${key.getAttribute('data-midi')}:${label.textContent}`
                    : null
            })
            .filter(Boolean)
    }

    it('puts one finger on each listed key, low to high', () => {
        expect(fingers('notes: C4 D4 E4 F4 G4\nfingering: 1 2 3 4 5')).toEqual([
            '60:1',
            '62:2',
            '64:3',
            '65:4',
            '67:5'
        ])
    })

    it('goes up from the first note for pitch classes, inside the range when given', () => {
        expect(fingers('notes: C D E F G\nfingering: 1 2 3 4 5')).toEqual([
            '60:1',
            '62:2',
            '64:3',
            '65:4',
            '67:5'
        ])
        expect(fingers('notes: G A B C D\nfingering: 1 2 3 4 5\nrange: C3-B4')).toEqual([
            '55:1',
            '57:2',
            '59:3',
            '60:4',
            '62:5'
        ])
    })
})

describe('fingering on note lists, review fixes', () => {
    const keys = (source: string) => {
        const h = document.createElement('div')
        const result = renderBlock('keyboard', source, h)
        return {
            result,
            fingers: [...h.querySelectorAll('[data-midi]')]
                .map((key) => {
                    const label = key.nextElementSibling
                    return label?.classList.contains('mn-key-label')
                        ? `${key.getAttribute('data-midi')}:${label.textContent}`
                        : null
                })
                .filter(Boolean)
        }
    }

    it('follows the order written, high to low too', () => {
        expect(keys('notes: G4 F4 E4 D4 C4\nfingering: 5 4 3 2 1').fingers).toEqual([
            '60:1',
            '62:2',
            '64:3',
            '65:4',
            '67:5'
        ])
        expect(keys('notes: G F E D C\nfingering: 5 4 3 2 1').fingers).toEqual([
            '60:1',
            '62:2',
            '64:3',
            '65:4',
            '67:5'
        ])
        // A repeated note is the octave above.
        expect(keys('notes: C D E F G A B C\nfingering: 1 2 3 1 2 3 4 5').fingers.at(-1)).toBe(
            '72:5'
        )
    })

    it('says when fingers and notes do not match, a key repeats, or a note leaves the range', () => {
        expect(keys('notes: C D E\nfingering: 1 2').result.error).toContain('2 fingers for 3 notes')
        expect(keys('notes: C4 C4 D4\nfingering: 1 2 3').result.error).toContain('listed twice')
        expect(keys('notes: F G A\nfingering: 1 2 3\nrange: C4-E4').result.error).toContain(
            'past the range'
        )
    })
})

describe('root: in blocks that expand into rows (#56, review)', () => {
    it('is refused once, not in every diagram', () => {
        for (const source of [
            'from: C\nto: G\nroot: E',
            'progression: C G Am F\nroot: E',
            'voicings: all\nsymbol: C\nroot: E',
            'C\ntriads: 1-3\nroot: E'
        ]) {
            const result = renderBlock('chord', source, document.createElement('div'))
            expect(result.ok).toBe(false)
            expect(result.error!.split('root only applies').length - 1).toBe(1)
        }
    })
})

describe("both hands' scale fingering (#49)", () => {
    /** Each diagram's title, fingers low to high and pitches. */
    const hands = (source: string) => {
        const h = document.createElement('div')
        const result = renderBlock('keyboard', source, h)
        return {
            result,
            h,
            diagrams: [...h.querySelectorAll('svg.mn-keyboard')].map((svg) => ({
                title: svg.querySelector('.mn-title')?.textContent,
                keys: svg.getAttribute('data-mn-pitches'),
                fingers: [...svg.querySelectorAll('[data-midi]')]
                    .map((key) => {
                        const label = key.nextElementSibling
                        return label?.classList.contains('mn-key-label')
                            ? ([Number(key.getAttribute('data-midi')), label.textContent] as const)
                            : null
                    })
                    .filter((x) => x !== null)
                    .sort((x, y) => x[0] - y[0])
                    .map(([, f]) => f)
                    .join(' ')
            }))
        }
    }

    it('draws the right hand, then the left hand an octave lower, in a column', () => {
        const { result, h, diagrams } = hands('C major\nfingering: auto both')
        expect(result.error).toBeNull()
        expect(h.querySelector('.mn-grid.mn-cols-1')).not.toBeNull()
        expect(h.querySelectorAll('.mn-cell')).toHaveLength(2)
        expect(diagrams).toEqual([
            {
                title: 'C major, right hand',
                keys: '60 62 64 65 67 69 71 72 74 76 77 79 81 83 84',
                fingers: '1 2 3 1 2 3 4 1 2 3 1 2 3 4 5'
            },
            {
                title: 'C major, left hand',
                keys: '48 50 52 53 55 57 59 60 62 64 65 67 69 71 72',
                fingers: '5 4 3 2 1 3 2 1 4 3 2 1 3 2 1'
            }
        ])
    })

    it('draws each hand as fingering: auto and auto left draw it alone', () => {
        for (const scale of ['scale: Bb major', 'scale: F# harmonic minor', 'A melodic minor']) {
            const alone = (fingering: string) =>
                hands(`${scale}\nfingering: ${fingering}`).diagrams.at(0)!
            expect(hands(`${scale}\nfingering: auto both`).diagrams).toEqual([
                alone('auto'),
                alone('auto left')
            ])
        }
    })

    it('reads the usual spellings', () => {
        for (const fingering of ['both', 'both hands', 'auto both hands', 'Auto (both hands)']) {
            const { result, diagrams } = hands(`G major\nfingering: ${fingering}`)
            expect(result.error).toBeNull()
            expect(diagrams.map((d) => d.title)).toEqual([
                'G major, right hand',
                'G major, left hand'
            ])
        }
    })

    it('keeps the range, the labels, a title and the columns written', () => {
        const ranged = hands('C major\nfingering: auto both\nrange: C3-C5\nlabels: notes')
        expect(ranged.diagrams.map((d) => d.keys)).toEqual([
            '48 50 52 53 55 57 59 60 62 64 65 67 69 71 72',
            '48 50 52 53 55 57 59 60 62 64 65 67 69 71 72'
        ])
        // Labels stay on the keys: the fingers get their own row.
        expect(ranged.h.querySelectorAll('svg.mn-keyboard .mn-key-finger').length).toBe(30)
        const titled = hands('C major\nfingering: auto both\ntitle: Daily scale')
        expect(titled.diagrams.map((d) => d.title)).toEqual([
            'Daily scale, right hand',
            'Daily scale, left hand'
        ])
        const side = hands('C major\nfingering: auto both\ncolumns: 2')
        expect(side.h.querySelector('.mn-grid.mn-cols-2')).not.toBeNull()
    })

    it('refuses what it cannot finger, once', () => {
        const pentatonic = hands('A minor pentatonic\nfingering: auto both')
        expect(pentatonic.result.ok).toBe(false)
        expect(pentatonic.h.querySelectorAll('.mn-error-message')).toHaveLength(1)
        expect(pentatonic.result.error).toContain('fingering: auto knows the major')
        expect(hands('notes: C4 E4 G4\nfingering: both').result.error).toContain(
            'fingering: auto goes with a major or minor scale'
        )
        // In a --- row, a diagram can't split in two.
        const row = hands('C major\nfingering: auto both\n---\nG major')
        expect(row.result.ok).toBe(false)
        expect(row.h.querySelector('.mn-error-message')?.textContent).toContain(
            'fingering: auto both draws two keyboards'
        )
    })
})
