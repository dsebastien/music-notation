import { describe, expect, it } from 'bun:test'
import { pianoOptionsOf, pianoPitches, pianoVoicing, triadFingering } from './piano-chord.js'
import { midiOf, noteOf } from '../theory/pitch.js'
import { renderBlock } from '../render/render-block.js'
import { attachPlayback } from '../playback/controls.js'

/** Pitches as note names with octaves, flats when asked. */
const names = (pitches: number[] | undefined, flats = false) =>
    pitches?.map((p) => noteOf(p, flats)).join(' ')
const voiced = (symbol: string, options = {}, flats = false) =>
    names(pianoVoicing(symbol, options)?.pitches, flats)

describe('pianoVoicing', () => {
    it('keeps root position from middle C, a slash bass an octave below', () => {
        expect(voiced('C')).toBe('C4 E4 G4')
        expect(voiced('B')).toBe('B4 D#5 F#5')
        expect(voiced('Cmaj7')).toBe('C4 E4 G4 B4')
        expect(voiced('C/G')).toBe('G3 C4 E4 G4')
        // Same as before the voicing options.
        expect(pianoPitches('C/Bb').pitches).toEqual([58, 60, 64, 67])
        expect(pianoVoicing('Hmaj7')).toBeNull()
    })

    it('inverts close voicings: the n-th chord note lowest', () => {
        expect(voiced('C', { inversion: 1 })).toBe('E4 G4 C5')
        expect(voiced('C', { inversion: 2 })).toBe('G4 C5 E5')
        expect(voiced('Cmaj7', { inversion: 3 })).toBe('B4 C5 E5 G5')
        expect(voiced('Am', { inversion: 1 })).toBe('C4 E4 A4')
        expect(() => pianoVoicing('C', { inversion: 3 })).toThrow(
            'C has 3 notes: inversion goes up to 2'
        )
        expect(() => pianoVoicing('C/E', { inversion: 1 })).toThrow('C/E already says its bass')
    })

    it('moves the register with octave', () => {
        expect(voiced('C', { octave: 3 })).toBe('C3 E3 G3')
        expect(voiced('C/G', { octave: 5 })).toBe('G4 C5 E5 G5')
        expect(() => pianoVoicing('C', { octave: 9 })).toThrow('octave: use a number from 0 to 8')
        expect(() => pianoVoicing('B', { octave: 8 })).toThrow("off the piano's keys")
    })

    it('opens a voicing: the note above the bass up an octave', () => {
        expect(voiced('C', { voicing: 'open' })).toBe('C4 G4 E5')
        expect(voiced('Cmaj7', { voicing: 'open' })).toBe('C4 G4 B4 E5')
        expect(voiced('C', { voicing: 'open', inversion: 1 })).toBe('E4 C5 G5')
        expect(() => pianoVoicing('C5', { voicing: 'open' })).toThrow('three notes or more')
    })

    it('voices shells as root, third, seventh', () => {
        expect(voiced('Cmaj7', { voicing: 'shell' })).toBe('C4 E4 B4')
        expect(voiced('G7', { voicing: 'shell' })!.replace(/\d/g, '')).toBe('G B F')
        expect(voiced('C6', { voicing: 'shell' })).toBe('C4 E4 A4')
        expect(voiced('C9', { voicing: 'shell' }, true)).toBe('C4 E4 Bb4')
        expect(voiced('C7sus4', { voicing: 'shell' }, true)).toBe('C4 F4 Bb4')
        expect(() => pianoVoicing('C', { voicing: 'shell' })).toThrow(
            'Shell voicings need a third and a seventh or sixth'
        )
        expect(() => pianoVoicing('Cmaj7', { voicing: 'shell', inversion: 1 })).toThrow(
            'inversion goes with close or open voicings, not shell'
        )
    })

    it('voices a ii-V-I with rootless A and B forms', () => {
        // Dm7 (A) F A C E, G7 (B) F A B E, Cmaj7 (A) E G B D: the textbook ii-V-I in C.
        expect(voiced('Dm7', { voicing: 'rootless' })).toBe('F4 A4 C5 E5')
        expect(voiced('G7', { voicing: 'rootless', rootless: 'B' })).toBe('F4 A4 B4 E5')
        expect(voiced('Cmaj7', { voicing: 'rootless', rootless: 'A' })).toBe('E4 G4 B4 D5')
        // And the other way: Dm7 (B) C E F A, G7 (A) B E F A, Cmaj7 (B) B D E G.
        expect(voiced('Dm7', { voicing: 'rootless', rootless: 'B', octave: 4 })).toBe('C4 E4 F4 A4')
        expect(voiced('G7', { voicing: 'rootless', rootless: 'A', octave: 3 })).toBe('B3 E4 F4 A4')
        expect(voiced('Cmaj7', { voicing: 'rootless', rootless: 'B', octave: 3 })).toBe(
            'B3 D4 E4 G4'
        )
        // Altered dominants keep their alterations; sixth chords use the sixth as the seventh.
        expect(voiced('G7b9', { voicing: 'rootless', rootless: 'B' }, true)).toBe('F4 Ab4 B4 E5')
        expect(voiced('C6', { voicing: 'rootless' })).toBe('E4 G4 A4 D5')
        expect(() => pianoVoicing('Bm7b5', { voicing: 'rootless' })).toThrow(
            'Rootless voicings are for major, minor and dominant'
        )
        expect(() => pianoVoicing('C', { voicing: 'rootless' })).toThrow('not C')
    })

    it('splits the hands: the bass in the left hand', () => {
        const both = pianoVoicing('C', { hands: 'left+right', inversion: 1 })!
        expect(names(both.left)).toBe('C3')
        expect(names(both.right)).toBe('E4 G4 C5')
        expect(names(both.pitches)).toBe('C3 E4 G4 C5')
        const slash = pianoVoicing('C/G', { hands: 'left+right' })!
        expect(names(slash.left)).toBe('G3')
        expect(names(slash.right)).toBe('C4 E4 G4')
        const left = pianoVoicing('C', { hands: 'left' })!
        expect(names(left.left)).toBe('C3 E3 G3')
        expect(left.right).toEqual([])
        const rootless = pianoVoicing('G7', {
            hands: 'left+right',
            voicing: 'rootless',
            rootless: 'B'
        })!
        expect(names(rootless.pitches)).toBe('G3 F4 A4 B4 E5')
    })

    it('fingers close triads', () => {
        const fingers = (options: object, symbol = 'C') =>
            [...triadFingering(pianoVoicing(symbol, options)!)!]
                .sort(([a], [b]) => a - b)
                .map(([, f]) => f)
                .join(' ')
        expect(fingers({})).toBe('1 3 5')
        expect(fingers({ inversion: 1 })).toBe('1 2 5')
        expect(fingers({ inversion: 2 })).toBe('1 3 5')
        expect(fingers({ hands: 'left' })).toBe('5 3 1')
        expect(fingers({ hands: 'left', inversion: 1 })).toBe('5 3 1')
        expect(fingers({ hands: 'left', inversion: 2 })).toBe('5 2 1')
        expect(fingers({ hands: 'left+right', inversion: 1 })).toBe('5 1 2 5')
        expect(triadFingering(pianoVoicing('Cmaj7')!)).toBeNull()
        expect(triadFingering(pianoVoicing('C', { voicing: 'open' })!)).toBeNull()
        expect(triadFingering(pianoVoicing('C/G')!)).toBeNull()
    })

    it('reads the block keys', () => {
        const read = (fields: Record<string, string>) => pianoOptionsOf((key) => fields[key])
        expect(read({ inversion: 'first' })).toEqual({ inversion: 1 })
        expect(read({ inversion: 'Second inversion' })).toEqual({ inversion: 2 })
        expect(read({ inversion: '3' })).toEqual({ inversion: 3 })
        expect(read({ voicing: 'rootless B' })).toEqual({ voicing: 'rootless', rootless: 'B' })
        expect(read({ voicing: 'Rootless-a' })).toEqual({ voicing: 'rootless', rootless: 'A' })
        // Guitar's numbered voicing is left alone.
        expect(read({ voicing: '2' })).toEqual({})
        expect(read({ hands: 'left + right', octave: '3' })).toEqual({
            hands: 'left+right',
            octave: 3
        })
        expect(() => read({ inversion: 'any' })).toThrow('inversion: use root, first, second')
        expect(() => read({ voicing: 'drop 2' })).toThrow('voicing: use close, open, shell')
        expect(() => read({ voicing: 'shell b' })).toThrow('voicing: use close')
        expect(() => read({ hands: 'three' })).toThrow('hands: use left+right, left or right')
    })
})

describe('piano chord blocks', () => {
    const host = () => document.createElement('div')
    const keys = (h: Element) =>
        names(h.querySelector('svg')?.getAttribute('data-mn-pitches')?.split(' ').map(Number))

    it('draws inversions, octaves and voicings', () => {
        const h = host()
        expect(renderBlock('chord', 'C\ninstrument: piano\ninversion: first', h).error).toBeNull()
        expect(keys(h)).toBe('E4 G4 C5')
        const shell = host()
        renderBlock('chord', 'Cmaj7\ninstrument: piano\nvoicing: shell\noctave: 3', shell)
        expect(keys(shell)).toBe('C3 E3 B3')
        const rootless = host()
        renderBlock('chord', 'G7\ninstrument: piano\nvoicing: rootless B', rootless)
        expect(keys(rootless)).toBe('F4 A4 B4 E5')
        // The added 9th and 13th are lit and labeled from the root.
        const labeled = host()
        renderBlock(
            'chord',
            'G7\ninstrument: piano\nvoicing: rootless B\nlabels: intervals',
            labeled
        )
        expect([...labeled.querySelectorAll('.mn-key-label')].map((el) => el.textContent)).toEqual([
            'b7',
            '9',
            '3',
            '13'
        ])
        expect(renderBlock('chord', 'C\ninstrument: piano\ninversion: 3', host()).error).toBe(
            'C has 3 notes: inversion goes up to 2'
        )
        expect(renderBlock('chord', 'pitches: C4 E4 G4\ninversion: 1', host()).error).toBe(
            'inversion goes with a chord symbol: pitches are already the keys to play'
        )
    })

    it('marks which hand plays each key', () => {
        const h = host()
        expect(
            renderBlock('chord', 'C\ninstrument: piano\nhands: left+right\ninversion: 1', h).error
        ).toBeNull()
        const svg = h.querySelector('svg')!
        const marks = [...svg.querySelectorAll('.mn-key-hand')].map((el) => [
            el.getAttribute('data-mn-key'),
            el.textContent
        ])
        expect(marks).toEqual([
            ['48', 'L'],
            ['64', 'R'],
            ['67', 'R'],
            ['72', 'R']
        ])
        expect(svg.querySelector('[data-midi="48"]')?.getAttribute('class')).toContain(
            'mn-hand-left'
        )
        expect(svg.getAttribute('aria-label')).toBe('C, left hand: C3, right hand: E4 G4 C5')
    })

    it('fingers triads with fingering: auto', () => {
        const h = host()
        renderBlock('chord', 'G\ninstrument: piano\ninversion: 2\nfingering: auto', h)
        const fingers = [...h.querySelectorAll('.mn-key-label')].map((el) => el.textContent)
        expect(fingers).toEqual(['1', '3', '5'])
        expect(renderBlock('chord', 'G7\ninstrument: piano\nfingering: auto', host()).error).toBe(
            'fingering: auto covers three-note chords in close position: write the fingers, e.g. fingering: 1 2 3 5'
        )
    })

    it('redraws an inversion for guitar with its own pitches', () => {
        const h = host()
        const result = renderBlock('chord', 'C\ninstrument: piano\ninversion: 1\noctave: 3', h)
        attachPlayback(result.el)
        const select = h.querySelector('select')!
        select.value = 'guitar'
        select.dispatchEvent(new Event('change'))
        const board = h.querySelector('.mn-fretboard')!
        expect(board.getAttribute('data-mn-pitches')).toBe(
            [midiOf('E3'), midiOf('G3'), midiOf('C4')].join(' ')
        )
    })
})
