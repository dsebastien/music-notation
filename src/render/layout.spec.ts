import { describe, expect, it } from 'bun:test'
import { layoutDefaults, neckFrame, parseHand, parseOrientation, titleWidth } from './layout.js'

describe('orientation and hand', () => {
    it('reads both words, in any case', () => {
        expect(parseOrientation(' Vertical ')).toBe('vertical')
        expect(parseOrientation('horizontal')).toBe('horizontal')
        expect(parseHand('LEFT')).toBe('left')
        expect(parseHand('right')).toBe('right')
    })

    it('says what to write instead', () => {
        expect(() => parseOrientation('sideways')).toThrow(
            'Unknown orientation "sideways": use vertical or horizontal'
        )
        expect(() => parseHand('lefty')).toThrow('Unknown hand "lefty": use left or right')
    })

    it('keeps only valid defaults from a page', () => {
        expect(layoutDefaults(undefined)).toEqual({})
        expect(layoutDefaults('left')).toEqual({})
        expect(
            layoutDefaults({
                hand: 'left',
                orientation: { chord: 'horizontal', keyboard: 'diagonal', fretboard: 'vertical' },
                transpose: 3
            })
        ).toEqual({ hand: 'left', orientation: { chord: 'horizontal', fretboard: 'vertical' } })
        expect(layoutDefaults({ hand: 'up', orientation: 'vertical' })).toEqual({})
    })
})

describe('neckFrame', () => {
    const neck = {
        across: 100,
        along: 200,
        before: 10,
        after: 5,
        low: 30,
        high: 14,
        top: 20
    }

    it('vertical: nut on top, low string on the left', () => {
        const frame = neckFrame({ ...neck, orientation: 'vertical', hand: 'right' })
        expect(frame.width).toBe(144)
        expect(frame.height).toBe(235)
        expect(frame.at(0, 0)).toEqual([30, 30])
        expect(frame.at(100, 200)).toEqual([130, 230])
    })

    it('vertical, left-handed: low string on the right', () => {
        const frame = neckFrame({ ...neck, orientation: 'vertical', hand: 'left' })
        expect(frame.at(0, 0)).toEqual([114, 30])
        expect(frame.at(100, 0)).toEqual([14, 30])
    })

    it('horizontal: high string on top, nut on the left', () => {
        const frame = neckFrame({ ...neck, orientation: 'horizontal', hand: 'right' })
        expect(frame.width).toBe(215)
        expect(frame.height).toBe(164)
        expect(frame.at(100, 0)).toEqual([10, 34])
        expect(frame.at(0, 200)).toEqual([210, 134])
    })

    it('horizontal, left-handed: nut on the right', () => {
        const frame = neckFrame({ ...neck, orientation: 'horizontal', hand: 'left' })
        expect(frame.at(0, 0)).toEqual([205, 134])
        expect(frame.at(0, 200)).toEqual([5, 134])
    })

    it('boxes are the same in every frame, whatever the corners', () => {
        const frame = neckFrame({ ...neck, orientation: 'horizontal', hand: 'left' })
        expect(frame.box(10, 20, 30, 50)).toEqual({ x: 155, y: 104, width: 30, height: 20 })
        expect(frame.box(30, 50, 10, 20)).toEqual(frame.box(10, 20, 30, 50))
    })

    it('widens and centers a diagram for its title', () => {
        const frame = neckFrame({
            ...neck,
            orientation: 'vertical',
            hand: 'right',
            minWidth: titleWidth('A very long chord name')
        })
        const width = titleWidth('A very long chord name')
        expect(frame.width).toBe(width)
        expect(frame.at(0, 0)).toEqual([30 + (width - 144) / 2, 30])
    })

    it('counts capitals and wide characters wider', () => {
        expect(titleWidth('MMMM')).toBeGreaterThan(titleWidth('mmmm'))
        expect(titleWidth('和弦')).toBe(38)
        expect(titleWidth('')).toBe(0)
    })
})

describe('titles that wrap (#74)', () => {
    it('stay on one line when they fit, else wrap at spaces into lines that fit', async () => {
        const { titleLines, titleLineWidth } = await import('./layout.js')
        expect(titleLines('A, Open', 134)).toEqual([{ text: 'A, Open', textLength: null }])
        const lines = titleLines('F#m7b5, Drop 3 (strings 2-4, 6)', 134)
        expect(lines.map((l) => l.text).join(' ')).toBe('F#m7b5, Drop 3 (strings 2-4, 6)')
        expect(lines.map((l) => l.text)).toEqual(['F#m7b5, Drop 3', '(strings 2-4, 6)'])
        for (const l of lines) expect(titleLineWidth(l.text)).toBeLessThanOrEqual(134)
    })

    it('squeeze a word wider than the diagram, and the rest past three lines', async () => {
        const { titleLines, MAX_TITLE_LINES } = await import('./layout.js')
        expect(titleLines('Supercalifragilistic', 60)).toEqual([
            { text: 'Supercalifragilistic', textLength: 52 }
        ])
        const many = titleLines('one two three four five six seven eight nine ten', 50)
        expect(many.length).toBe(MAX_TITLE_LINES)
        expect(many.at(-1)!.textLength).toBe(42)
        expect(many.map((l) => l.text).join(' ')).toBe(
            'one two three four five six seven eight nine ten'
        )
    })

    it('line up the necks of a set: fewer lines move down by the missing lines', async () => {
        const { alignTitleLines, TITLE_LINE } = await import('./layout.js')
        const { renderGuitarDiagram } = await import('../chord/guitar.js')
        const a = { frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, '1', '2', '3', null] }
        const short = renderGuitarDiagram(document, a, { title: 'A, Open' })
        const long = renderGuitarDiagram(document, a, { title: '9. E shape (strings 1-4)' })
        const height = Number(short.getAttribute('viewBox')!.split(' ')[3])
        alignTitleLines([short, long])
        expect(short.getAttribute('data-mn-title-lines')).toBe('2')
        expect(Number(short.getAttribute('viewBox')!.split(' ')[3])).toBe(height + TITLE_LINE)
        const pad = short.querySelector(':scope > g.mn-title-pad')!
        expect(pad.getAttribute('transform')).toBe(`translate(0 ${TITLE_LINE})`)
        expect(pad.querySelector('.mn-nut')).not.toBeNull()
        // Its name for screen readers stays where it was.
        expect(short.querySelector(':scope > defs > title')).not.toBeNull()
        expect(long.querySelector(':scope > g.mn-title-pad')).toBeNull()
    })
})

describe('title helpers for apps (#74)', () => {
    it('are exported from the main entry', async () => {
        const lib = await import('../index.js')
        expect(typeof lib.alignTitleLines).toBe('function')
        expect(typeof lib.titleLines).toBe('function')
        expect(lib.MAX_TITLE_LINES).toBe(3)
    })
})
