import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { parseChord } from '../theory/chord-symbol.js'
import { parseChordName, readChord } from '../theory/chord-name.js'
import { detectChordFromFrets, detectChordFromPitches } from '../theory/detect.js'
import { blockFromProperties, instrumentOf, DEFAULT_PROPERTY_NAMES } from './properties.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

const host = () => document.createElement('div')
const titles = (h: HTMLElement) => [...h.querySelectorAll('.mn-title')].map((t) => t.textContent)

describe('chord names in words', () => {
    it('round-trips every name the parser writes', () => {
        for (const symbol of [
            'A',
            'Am',
            'F#m7',
            'Bb7',
            'C/G',
            'E5',
            'Dsus4',
            'Csus2',
            'Cmaj7',
            'Cmaj9',
            'Cdim',
            'Cdim7',
            'Cm7b5',
            'Caug',
            'Cadd9',
            'C6/9',
            'CmMaj7',
            'C6',
            'C9',
            'C11',
            'C13',
            'G7sus4',
            'Cm6',
            'Cm9'
        ]) {
            expect(parseChordName(parseChord(symbol)!.name)?.symbol).toBe(symbol)
        }
    })

    it('reads words in any case, with symbols or words for accidentals', () => {
        expect(readChord('a minor')?.symbol).toBe('Am')
        expect(readChord('e flat major 7')?.symbol).toBe('Ebmaj7')
        expect(readChord('F# minor')?.symbol).toBe('F#m')
        expect(readChord('E 5')?.symbol).toBe('E5')
        expect(readChord('G Dominant 7')?.symbol).toBe('G7')
        expect(readChord('A Majr')).toBeNull()
    })

    it('draws a chord written in words, titled as written', () => {
        const h = host()
        expect(renderBlock('chord', 'A Major x02220 x01230', h).ok).toBe(true)
        expect(titles(h)).toEqual(['A Major'])
        expect(h.querySelectorAll('.mn-root')).toHaveLength(2)
        expect(renderBlock('chord', 'F Sharp Minor', h, { voicings: lookupGuitarVoicing }).ok).toBe(
            true
        )
        expect(renderBlock('chord', 'name: C Major over G\ninstrument: piano', h).ok).toBe(true)
    })

    it('suggests what to write for a chord it does not recognize', () => {
        expect(
            renderBlock('chord', 'A Majr', host(), { voicings: lookupGuitarVoicing }).error
        ).toBe(`Didn't recognize "A Majr": try A, Am, A7 or A Major`)
    })

    it('still draws an unknown symbol given frets, without root marks', () => {
        const h = host()
        expect(renderBlock('chord', 'Mystery x02220', h).ok).toBe(true)
        expect(titles(h)).toEqual(['Mystery'])
        expect(h.querySelectorAll('.mn-root')).toHaveLength(0)
    })
})

describe('chords recognized from their notes', () => {
    it('names common shapes', () => {
        expect(detectChordFromFrets([null, 0, 2, 2, 2, 0])?.symbol).toBe('A')
        expect(detectChordFromFrets([null, 0, 2, 0, 1, 0])?.symbol).toBe('Am7')
        expect(detectChordFromFrets([null, null, 0, 2, 1, 2])?.symbol).toBe('D7')
        expect(detectChordFromFrets([null, 3, 5, 5, null, null])?.symbol).toBe('C5')
        expect(detectChordFromFrets([null, 0, 2, 2, 2])).toBeNull()
    })

    it('prefers common chords and usual spellings', () => {
        expect(detectChordFromPitches([64, 67, 72])?.symbol).toBe('C/E')
        expect(detectChordFromPitches([58, 62, 65])?.symbol).toBe('Bb')
        expect(detectChordFromPitches([60])).toBeNull()
    })

    it('titles and marks a diagram from its frets alone', () => {
        const h = host()
        renderBlock('chord', 'frets: x02220', h)
        expect(titles(h)).toEqual(['A'])
        expect(h.querySelectorAll('.mn-root')).toHaveLength(2)
        renderBlock('chord', 'pitches: E4 G4 C5', h)
        expect(titles(h)[1]).toBe('C/E')
    })

    it('lets a given symbol win', () => {
        const h = host()
        renderBlock('chord', 'symbol: C6/A\nfrets: x00210', h)
        expect(titles(h)).toEqual(['C6/A'])
    })
})

describe('scales and modes', () => {
    const count = (h: HTMLElement, selector: string) => h.querySelectorAll(selector).length

    it('reads the usual names', () => {
        for (const name of ['A Natural minor', 'A Blues', 'C Major pentatonic', 'C Whole tone']) {
            expect(renderBlock('keyboard', `scale: ${name}`, host()).ok).toBe(true)
        }
    })

    it('asks for a root', () => {
        expect(renderBlock('fretboard', 'scale: lydian', host()).error).toBe(
            'Add a root note: C lydian'
        )
        expect(renderBlock('keyboard', 'blues', host()).error).toBe('Add a root note: C blues')
    })

    it('marks characteristic notes of modes by default, and on request', () => {
        const h = host()
        renderBlock('keyboard', 'C lydian\nrange: C4-B4', h)
        expect(count(h, '.mn-char')).toBe(1)
        const plain = host()
        renderBlock('keyboard', 'C major\nrange: C4-B4', plain)
        expect(count(plain, '.mn-char')).toBe(0)
        const off = host()
        renderBlock('keyboard', 'C lydian\nrange: C4-B4\nhighlight: none', off)
        expect(count(off, '.mn-char')).toBe(0)
        const asked = host()
        renderBlock('keyboard', 'A minor\nrange: A3-G#4\nhighlight: characteristic', asked)
        expect(count(asked, '.mn-char')).toBe(1)
    })

    it('marks the intervals asked for, and refuses one the scale does not have', () => {
        const h = host()
        renderBlock('fretboard', 'A minor pentatonic\nfrets: 5-8\nhighlight: b3 5', h)
        expect(count(h, '.mn-dot.mn-char')).toBe(5)
        expect(
            renderBlock('fretboard', 'A minor pentatonic\nhighlight: b6', host()).error
        ).toContain(`"b6" isn't in A minor pentatonic`)
    })

    it('compares with a parent scale', () => {
        const h = host()
        renderBlock('keyboard', 'C lydian\nrange: C4-B4\ncompare: major', h)
        // F# differs from C major; F, which C major has, is a ghost.
        expect(count(h, '.mn-diff')).toBe(1)
        expect(count(h, '.mn-ghost')).toBe(1)
        expect(renderBlock('keyboard', 'C lydian\ncompare: nonsense', host()).error).toContain(
            'Unknown scale "nonsense" to compare with'
        )
    })

    it('draws positions, by number and by shape', () => {
        const h = host()
        expect(renderBlock('fretboard', 'A minor pentatonic\nposition: 2', h).ok).toBe(true)
        expect(count(h, '.mn-dot')).toBe(12)
        const shape = host()
        expect(renderBlock('fretboard', 'C major\nshape: E', shape).ok).toBe(true)
        expect(count(shape, '.mn-dot')).toBe(16)
        expect(renderBlock('fretboard', 'C major\nposition: 6', host()).error).toBe(
            'C major has 5 CAGED positions: use position 1 to 5'
        )
        expect(renderBlock('fretboard', 'notes: C E G\nposition: 1', host()).error).toBe(
            'Positions need a scale: e.g. scale: A minor'
        )
    })

    it('draws every position of a scale in a row', () => {
        const h = host()
        expect(renderBlock('fretboard', 'A minor pentatonic\npositions: all', h).ok).toBe(true)
        expect(titles(h)).toEqual([1, 2, 3, 4, 5].map((n) => `A minor pentatonic, box ${n}`))
        const caged = host()
        renderBlock('fretboard', 'C major\npositions: 1 4', caged)
        expect(titles(caged)).toEqual(['C major, E shape', 'C major, A shape'])
        const nps = host()
        renderBlock('fretboard', 'G major\nshape: 3nps\npositions: all', nps)
        expect(titles(nps)).toHaveLength(7)
        expect(renderBlock('fretboard', 'C major\npositions: 6', host()).error).toBe(
            'positions: use all, or numbers from 1 to 5 for C major'
        )
        expect(renderBlock('fretboard', 'positions: all', host()).error).toContain(
            'positions needs a scale'
        )
    })

    it('draws every mode of a key in a row', () => {
        const h = host()
        expect(renderBlock('keyboard', 'modes: C major\nrange: C4-B5', h).ok).toBe(true)
        expect(titles(h)).toEqual([
            'C ionian',
            'D dorian',
            'E phrygian',
            'F lydian',
            'G mixolydian',
            'A aeolian',
            'B locrian'
        ])
        // Every mode but ionian marks its characteristic note.
        expect(h.querySelectorAll('.mn-cell').length).toBe(7)
        expect(renderBlock('fretboard', 'modes: C chromatic', host()).error).toContain(
            'has no modes'
        )
        expect(renderBlock('fretboard', 'modes: C major\ntitle: Modes', host()).error).toContain(
            `"title" can't be used with modes`
        )
    })

    it('shows a scale fingering on one octave', () => {
        const h = host()
        renderBlock('keyboard', 'C major\nfingering: 1 2 3 1 2 3 4 5', h)
        expect([...h.querySelectorAll('.mn-key-label')].map((l) => l.textContent)).toEqual([
            '1',
            '2',
            '3',
            '1',
            '2',
            '3',
            '4',
            '5'
        ])
    })
})

describe('blocks from properties', () => {
    const guitar = {
        chord_symbol: 'A',
        frets: 'x02220',
        fingers: 'x01230',
        position: 0,
        tags: ['type/music/guitar/chord']
    }

    it('writes a guitar chord, a piano chord, and scales with their shapes', () => {
        expect(blockFromProperties('chord', guitar)).toBe(
            'symbol: A\nfrets: x02220\nfingers: x01230'
        )
        expect(
            blockFromProperties('chord', {
                chord_symbol: 'C',
                fingering: '1 3 5',
                tags: 'type/music/piano/chord'
            })
        ).toBe('symbol: C\ninstrument: piano\nfingering: 1 3 5')
        expect(
            blockFromProperties('fretboard', {
                scale_root: 'A',
                scale_type: 'Minor pentatonic',
                shape: 'Box 2'
            })
        ).toBe('scale: A Minor pentatonic\nposition: 2')
        expect(
            blockFromProperties('fretboard', {
                scale_root: 'C',
                scale_type: 'Major',
                shape: 'CAGED E'
            })
        ).toBe('scale: C Major\nshape: E')
        expect(
            blockFromProperties('keyboard', {
                scale_root: 'C',
                scale_type: 'Major',
                fingering_rh: '1 2 3 1 2 3 4 5'
            })
        ).toBe('scale: C Major\nfingering: 1 2 3 1 2 3 4 5')
    })

    it('says nothing when the properties describe no block', () => {
        expect(blockFromProperties('chord', { tags: ['type/music/guitar/chord'] })).toBeNull()
        expect(blockFromProperties('fretboard', guitar)).toBeNull()
        expect(blockFromProperties('chords', guitar)).toBeNull()
    })

    it('uses other property names, and never lets a value add a key', () => {
        expect(
            blockFromProperties(
                'chord',
                { sym: 'A', f: 'x02220' },
                { names: { chordSymbol: 'sym', frets: 'f' } }
            )
        ).toBe('symbol: A\nfrets: x02220')
        expect(blockFromProperties('chord', { chord_symbol: 'A\ninstrument: piano' })).toBe(
            'symbol: A instrument: piano'
        )
    })

    it('tells piano notes by their tags', () => {
        expect(instrumentOf({ tags: ['#type/music/piano/chord'] }, DEFAULT_PROPERTY_NAMES)).toBe(
            'piano'
        )
        expect(instrumentOf({ tags: ['type/music/pianist'] }, DEFAULT_PROPERTY_NAMES)).toBe(
            'guitar'
        )
    })

    it('draws an empty block from the properties, and leaves blocks with content alone', () => {
        const h = host()
        const empty = renderBlock('chord', '', h, { properties: guitar })
        expect(empty.el.classList.contains('mn-from-properties')).toBe(true)
        expect(titles(h)).toEqual(['A'])
        renderBlock('chord', 'G 320003', h, { properties: guitar })
        expect(titles(h)).toEqual(['A', 'G'])
    })

    it('reads properties from a function, and draws nothing when it fails', () => {
        const h = host()
        expect(renderBlock('chord', '', h, { properties: () => guitar }).ok).toBe(true)
        const failing = renderBlock('chord', '', host(), {
            properties: () => {
                throw new Error('no page')
            }
        })
        expect(failing.ok).toBe(true)
        expect(failing.el.classList.contains('mn-empty')).toBe(true)
    })
})

describe('after review', () => {
    it('reads common open shapes by their usual names', () => {
        for (const [frets, symbol] of [
            [[null, null, 0, 2, 3, 0], 'Dsus2'],
            [[null, 0, 2, 2, 0, 0], 'Asus2'],
            [[null, 0, 2, 2, 1, 2], 'Am6'],
            [[3, 2, 0, 0, 0, 0], 'G6'],
            [[null, 0, 2, 1, 1, 0], 'AmMaj7'],
            [[null, 3, 2, 0, 3, 0], 'Cadd9'],
            [[null, 3, 2, 3, 1, 0], 'C7']
        ] as const) {
            expect(detectChordFromFrets([...frets])?.symbol).toBe(symbol)
        }
        expect(detectChordFromFrets([null, 0, 2, 2, 2, 0])?.readings).not.toContain('Dsus24/A')
    })

    it('draws a numbered position of a 7-note scale as a CAGED shape, with all its notes', () => {
        const h = host()
        renderBlock('fretboard', 'D dorian\nposition: 2', h)
        expect(h.querySelectorAll('.mn-dot').length).toBeGreaterThanOrEqual(15)
    })

    it('draws the modes of harmonic and melodic minor', () => {
        for (const scale of ['C harmonic minor', 'C melodic minor']) {
            expect(renderBlock('keyboard', `modes: ${scale}`, host()).ok).toBe(true)
        }
    })

    it('puts columns and shared keys of positions in a shared part', () => {
        const h = host()
        const result = renderBlock(
            'fretboard',
            'scale: A minor pentatonic\npositions: all\ncolumns: 2\nlabels: intervals',
            h
        )
        expect(result.ok).toBe(true)
        expect(h.querySelector('.mn-grid.mn-cols-2')).not.toBeNull()
        expect(h.querySelectorAll('.mn-cell')).toHaveLength(5)
    })

    it('refuses positions and modes inside a row', () => {
        expect(
            renderBlock('fretboard', 'tuning: DADGAD\n---\nscale: A minor\npositions: all', host())
                .error
        ).toContain('"positions" draws its own row')
    })

    it('puts the leading zeros back on frets stored as numbers', () => {
        expect(
            blockFromProperties('chord', { chord_symbol: 'E', frets: 22100, fingers: 2310 })
        ).toBe('symbol: E\nfrets: 022100\nfingers: 002310')
    })

    it('reads more ways of writing a scale shape', () => {
        const scale = { scale_root: 'C', scale_type: 'Major' }
        expect(blockFromProperties('fretboard', { ...scale, shape: 'E' })).toBe(
            'scale: C Major\nshape: E'
        )
        expect(blockFromProperties('fretboard', { ...scale, shape: '3NPS 4' })).toBe(
            'scale: C Major\nshape: 3nps\nposition: 4'
        )
    })

    it('draws nothing when a property throws when read', () => {
        const hostile = {
            get chord_symbol(): string {
                throw new Error('nope')
            }
        }
        const result = renderBlock('chord', '', host(), { properties: hostile })
        expect(result.ok).toBe(true)
        expect(result.el.classList.contains('mn-empty')).toBe(true)
    })

    it('stays quick on a very long shorthand line', () => {
        const started = performance.now()
        renderBlock('chord', Array.from({ length: 3000 }, () => 'x02220').join(' '), host())
        expect(performance.now() - started).toBeLessThan(500)
    })

    it('reads more ways of writing chords in words', () => {
        expect(readChord('C over G')?.symbol).toBe('C/G')
        expect(readChord('B-flat major')?.symbol).toBe('Bb')
        expect(readChord('C Major/G')?.symbol).toBe('C/G')
        expect(readChord('A minor over g sharp')?.symbol).toBe('Am/G#')
    })

    it('offers the major chord when nothing is close', () => {
        expect(renderBlock('chord', 'Zm', host(), { voicings: lookupGuitarVoicing }).error).toBe(
            `Didn't recognize "Zm": try A, Am, A7 or A Major`
        )
    })

    it('reads flats and sharps in highlights, and explains lists of notes', () => {
        const h = host()
        renderBlock('keyboard', 'A minor\nrange: A3-G#4\nhighlight: ♭3', h)
        expect(h.querySelectorAll('.mn-char')).toHaveLength(1)
        expect(renderBlock('keyboard', 'notes: C E G\nhighlight: 3', host()).error).toContain(
            'a list of notes has no intervals'
        )
    })

    it('names the marked notes for screen readers', () => {
        const h = host()
        renderBlock('keyboard', 'C lydian\nrange: C4-B4', h)
        expect(h.querySelector('svg')?.getAttribute('aria-label')).toContain(
            'characteristic notes: F#'
        )
    })
})
