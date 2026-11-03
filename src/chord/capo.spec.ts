import { describe, expect, it } from 'bun:test'
import {
    capoTuning,
    fretsFromCapo,
    parseCapo,
    parseFretsFrom,
    soundingChord,
    soundsLike
} from './capo.js'
import { renderGuitarDiagram, STANDARD_TUNING } from './guitar.js'
import { renderBlock } from '../render/render-block.js'
import { attachPlayback } from '../playback/controls.js'

const host = () => document.createElement('div')
const pitches = (el: Element | null | undefined) =>
    el?.getAttribute('data-mn-pitches')?.split(' ').map(Number)

describe('capo theory', () => {
    it('reads capo and frets-from', () => {
        expect(parseCapo('2')).toBe(2)
        expect(parseCapo(' 0 ')).toBe(0)
        expect(parseCapo('none')).toBe(0)
        expect(() => parseCapo('13')).toThrow('capo: use a fret from 1 to 12')
        expect(() => parseCapo('two')).toThrow('capo: use a fret from 1 to 12, got "two"')
        expect(parseFretsFrom(undefined)).toBe('capo')
        expect(parseFretsFrom('Nut')).toBe('nut')
        expect(() => parseFretsFrom('bridge')).toThrow('frets-from: use capo')
    })

    it('names the chord a shape sounds, spelled for its key', () => {
        expect(soundingChord('A', 2)).toBe('B')
        expect(soundingChord('Am7', 3)).toBe('Cm7')
        expect(soundingChord('C', 1)).toBe('Db')
        expect(soundingChord('Am', 1)).toBe('Bbm')
        expect(soundingChord('E', 1)).toBe('F')
        expect(soundingChord('G', 4)).toBe('B')
        expect(soundingChord('D/F#', 2)).toBe('E/G#')
        expect(soundingChord('Cmaj7', 0)).toBe('Cmaj7')
        expect(soundingChord('Mystery', 2)).toBe('Mystery')
    })

    it('checks a sounding chord by its notes, any spelling', () => {
        expect(soundsLike('B', 'A', 2)).toBe(true)
        expect(soundsLike('A#m', 'Am', 1)).toBe(true)
        expect(soundsLike('Bbm', 'Am', 1)).toBe(true)
        expect(soundsLike('C', 'A', 2)).toBe(false)
        expect(soundsLike('Bm', 'A', 2)).toBe(false)
        expect(soundsLike('E/G#', 'D/F#', 2)).toBe(true)
        expect(soundsLike('E', 'D/F#', 2)).toBe(false)
    })

    it('counts frets from the capo', () => {
        expect(fretsFromCapo([null, 2, 4, 4, 4, 2], 2)).toEqual([null, 0, 2, 2, 2, 0])
        expect(fretsFromCapo([null, 0, 4, 4, 4, 2], 2)).toBeNull()
        expect(capoTuning(STANDARD_TUNING, 2)).toEqual([42, 47, 52, 57, 61, 66])
    })
})

describe('capo on guitar diagrams', () => {
    it('draws the capo where the nut is, and sounds the shape higher', () => {
        const svg = renderGuitarDiagram(
            document,
            { frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, '1', '2', '3', null] },
            { title: 'A', capo: 2, root: 11, sounds: 'B' }
        )
        expect(svg.querySelector('.mn-capo')).not.toBeNull()
        expect(svg.querySelector('.mn-nut')).toBeNull()
        expect(svg.querySelector('.mn-caption')?.textContent).toBe('Capo 2, sounds B')
        expect(svg.getAttribute('aria-label')).toBe('A chord diagram, capo 2, sounds b')
        // A shape (x02220) with a capo on 2: B2 F#3 B3 D#4 F#4.
        expect(pitches(svg)).toEqual([47, 54, 59, 63, 66])
        // B is the root: the open A string (now B) and the G string's dot.
        const roots = [...svg.querySelectorAll('.mn-root')].map((el) =>
            el.getAttribute('data-midi')
        )
        expect(roots).toEqual(['47', '59'])
        expect(svg.getAttribute('data-mn-capo')).toBe('2')
    })

    it('draws the real neck with frets from the nut', () => {
        const svg = renderGuitarDiagram(
            document,
            { frets: [null, 2, 4, 4, 4, 2], fingers: [null, null, '1', '2', '3', null] },
            { capo: 2, fretsFrom: 'nut', root: 11 }
        )
        // The nut stays; the capo sits on fret 2; the strings it plays are rings on it.
        expect(svg.querySelector('.mn-nut')).not.toBeNull()
        expect(svg.querySelectorAll('.mn-capo-open')).toHaveLength(2)
        expect(svg.querySelectorAll('.mn-open')).toHaveLength(0)
        expect(pitches(svg)).toEqual([47, 54, 59, 63, 66])
        expect(svg.querySelector('.mn-capo-open.mn-root')?.getAttribute('data-midi')).toBe('47')
    })
})

describe('capo in blocks', () => {
    it('draws a chord block with a capo, its root marks and caption', () => {
        const h = host()
        const result = renderBlock('chord', 'A x02220 x01230\ncapo: 2\nsounds: yes', h)
        expect(result.error).toBeNull()
        const svg = h.querySelector('svg')!
        expect(svg.querySelector('.mn-title')?.textContent).toBe('A')
        expect(svg.querySelector('.mn-caption')?.textContent).toBe('Capo 2, sounds B')
        expect(svg.getAttribute('data-mn-chord')).toBe('A')
        expect(svg.getAttribute('data-mn-sounds')).toBe('B')
        expect(pitches(svg)).toEqual([47, 54, 59, 63, 66])
        expect(svg.querySelectorAll('.mn-root')).toHaveLength(2)
    })

    it('captions only the capo by default, and checks a written sounding chord', () => {
        const h = host()
        expect(renderBlock('chord', 'G 320003\ncapo: 4', h).ok).toBe(true)
        expect(h.querySelector('.mn-caption')?.textContent).toBe('Capo 4')
        expect(renderBlock('chord', 'G 320003\ncapo: 4\nsounds: B', h).ok).toBe(true)
        const wrong = renderBlock('chord', 'G 320003\ncapo: 4\nsounds: C', host())
        expect(wrong.error).toBe('With capo 4, G sounds B, not C: write sounds: B (or sounds: yes)')
        expect(renderBlock('chord', 'G 320003\nsounds: B', host()).error).toBe(
            'sounds goes with a capo: add e.g. capo: 2'
        )
        expect(renderBlock('chord', 'Mystery x02220\ncapo: 2\nsounds: yes', host()).error).toBe(
            'sounds: yes needs a chord the library knows: add its symbol (e.g. symbol: A), or write the chord: sounds: B'
        )
        expect(renderBlock('chord', 'Mystery x02220\ncapo: 2\nsounds: B', host()).ok).toBe(true)
        // No capo (a template's capo: 0) and sounds: yes say nothing.
        expect(renderBlock('chord', 'G 320003\ncapo: 0\nsounds: yes', host()).ok).toBe(true)
    })

    it('reads frets from the nut', () => {
        const h = host()
        const result = renderBlock('chord', 'frets: x24442\ncapo: 2\nfrets-from: nut', h)
        expect(result.error).toBeNull()
        const svg = h.querySelector('svg')!
        // Named from the shape as played (A), sounding B.
        expect(svg.querySelector('.mn-title')?.textContent).toBe('A')
        expect(svg.getAttribute('data-mn-sounds')).toBe('B')
        expect(pitches(svg)).toEqual([47, 54, 59, 63, 66])
        expect(renderBlock('chord', 'A x02220\ncapo: 2\nfrets-from: nut', host()).error).toBe(
            'With frets-from: nut, every sounding fret is at the capo (2) or above: write x for strings behind it'
        )
    })

    it('labels the sounding notes, and refuses a capo on piano', () => {
        const h = host()
        renderBlock('chord', 'A x02220\ncapo: 2\nlabels: notes', h)
        const labels = [...h.querySelectorAll('.mn-dot-text')].map((el) => el.textContent)
        expect(labels).toEqual(['F#', 'B', 'D#'])
        expect(renderBlock('chord', 'C\ninstrument: piano\ncapo: 2', host()).error).toBe(
            'capo is for guitar and other fretted instruments, not piano'
        )
        expect(renderBlock('chord', 'A x02220\ncapo: 13', host()).error).toBe(
            'capo: use a fret from 1 to 12, got "13"'
        )
    })

    it('shares a capo across a row and through voicings', () => {
        const h = host()
        const row = renderBlock('chord', 'capo: 3\nsounds: yes\n---\nG 320003\n---\nEm 022000', h)
        expect(row.error).toBeNull()
        expect([...h.querySelectorAll('.mn-caption')].map((el) => el.textContent)).toEqual([
            'Capo 3, sounds Bb',
            'Capo 3, sounds Gm'
        ])
        const v = host()
        expect(renderBlock('chord', 'A\nvoicings: 2\ncapo: 2\nfrets-from: nut', v).error).toBeNull()
        // Generated shapes are drawn as played from the capo.
        expect(v.querySelector('svg')?.getAttribute('data-mn-frets-from')).toBe('capo')
    })

    it('draws a fretboard from the capo, positions found from it', () => {
        const h = host()
        const result = renderBlock('fretboard', 'A minor pentatonic\nposition: 1\ncapo: 2', h)
        expect(result.error).toBeNull()
        const svg = h.querySelector('svg')!
        // Box 1 of A minor pentatonic from the capo: frets 3-6 above it (5-8 on the neck).
        expect(svg.getAttribute('data-mn-frets')).toBe('3-6')
        expect(Math.min(...pitches(svg)!)).toBe(45)
        // The strings' names are what they sound.
        const names = [...svg.querySelectorAll('.mn-string-name')].map((el) => el.textContent)
        expect(names).toEqual(['F#', 'C#', 'A', 'E', 'B', 'F#'])
        expect(svg.querySelector('.mn-caption')?.textContent).toBe('Capo 2')
    })

    it('draws a fretboard from the nut, nothing behind the capo', () => {
        const h = host()
        const result = renderBlock(
            'fretboard',
            'E minor pentatonic\ncapo: 2\nfrets-from: nut\nfrets: 2-6',
            h
        )
        expect(result.error).toBeNull()
        const svg = h.querySelector('svg')!
        expect(svg.querySelector('.mn-capo')).not.toBeNull()
        const frets = [...svg.querySelectorAll('circle.mn-dot')].map((el) =>
            Number(el.getAttribute('data-mn-fret'))
        )
        expect(Math.min(...frets)).toBe(2)
        expect(
            renderBlock('fretboard', 'E minor\ncapo: 2\nfrets-from: nut\nfrets: 0-5', host()).error
        ).toBe('With frets-from: nut, frets start at the capo (2) or above: e.g. frets: 2-7')
        const p = host()
        renderBlock('fretboard', 'A minor pentatonic\npositions: all\ncapo: 2\nfrets-from: nut', p)
        expect(
            [...p.querySelectorAll('svg')].map((el) => el.getAttribute('data-mn-frets'))
        ).toEqual(['5-8', '7-10', '9-13', '12-15', '14-17'])
    })

    it('redraws a capo shape for piano with its sounding chord', () => {
        const h = host()
        const result = renderBlock('chord', 'A x02220\ncapo: 2', h)
        attachPlayback(result.el)
        const select = h.querySelector('select')!
        select.value = 'piano'
        select.dispatchEvent(new Event('change'))
        const keyboard = h.querySelector('.mn-keyboard')!
        expect(pitches(keyboard)).toEqual([47, 54, 59, 63, 66])
        expect(keyboard.querySelector('.mn-title')?.textContent).toBe('A (sounds B)')
        expect(keyboard.querySelectorAll('.mn-root')).toHaveLength(2)
        expect(keyboard.getAttribute('data-mn-set')).toBe('B')
    })
})
