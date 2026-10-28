import { afterEach, describe, expect, it } from 'bun:test'
import { isNotationLanguage, LANGUAGES, renderBlock } from './render-block.js'
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
        ['chord', '', 'Add a chord symbol and "frets:"'],
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
        ['fretboard', '', 'Add "scale:", "chord:" or "notes:"'],
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
