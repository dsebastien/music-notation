import { afterEach, describe, expect, it } from 'bun:test'
import { chordFormula, scaleFormula } from './formula.js'
import { renderBlock } from '../render/render-block.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

afterEach(() => {
    document.body.innerHTML = ''
})

describe('chord formulas (#52)', () => {
    it('says the notes, the formula, the quality in words and the other symbols', () => {
        expect(chordFormula('Am7')).toEqual([
            'Am7 (A minor seventh): A C E G.',
            'Formula 1 b3 5 b7.',
            'Also written Amin7, Ami7, A-7.'
        ])
        expect(chordFormula('C')).toEqual([
            'C (C major): C E G.',
            'Formula 1 3 5.',
            'Also written CM, Cmaj.'
        ])
        expect(chordFormula('Bdim7')?.[1]).toBe('Formula 1 b3 b5 bb7.')
        expect(chordFormula('C7#9')?.[1]).toBe('Formula 1 3 5 b7 #9.')
    })

    it('reads the usual names of the library', () => {
        expect(chordFormula('Am(maj7)')?.slice(0, 2)).toEqual([
            'Am(maj7) (A minor/major seventh): A C E G#.',
            'Formula 1 b3 5 7.'
        ])
        expect(chordFormula('C+maj7')?.[1]).toBe('Formula 1 3 #5 7.')
    })

    it('says a slash chord’s bass', () => {
        expect(chordFormula('C/G')?.[0]).toBe('C/G (C major, G in the bass): C E G.')
        expect(chordFormula('C/Bb')?.[0]).toBe('C/Bb (C major, Bb in the bass): C E G.')
    })

    it('is null for a chord the library does not know', () => {
        expect(chordFormula('Hmaj13')).toBeNull()
        expect(chordFormula('C xyz')).toBeNull()
    })
})

describe('scale formulas (#52)', () => {
    it('says the notes, the formula and the steps', () => {
        expect(scaleFormula('A minor pentatonic')).toEqual([
            'A minor pentatonic: A C D E G.',
            'Formula 1 b3 4 5 b7.',
            'Steps W+H W W W+H W.'
        ])
        expect(scaleFormula('C major')?.[2]).toBe('Steps W W H W W W H.')
        expect(scaleFormula('A harmonic minor')?.[2]).toBe('Steps W H W W H W+H H.')
        expect(scaleFormula('D dorian')?.[1]).toBe('Formula 1 2 b3 4 5 6 b7.')
    })

    it('is null for a scale the library does not know', () => {
        expect(scaleFormula('C nothing')).toBeNull()
    })
})

const render = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const result = renderBlock(language, source, host, options)
    const text = (selector: string) =>
        [...host.querySelectorAll(selector)].map((c) => c.textContent)
    return { host, result, text }
}

describe('caption: formula in blocks (#52)', () => {
    it('writes a guitar chord’s formula under its diagram', () => {
        const { host, result, text } = render('chord', 'Am x02210\ncaption: formula')
        expect(result.ok).toBe(true)
        expect(host.querySelector('figure.mn-captioned > svg.mn-guitar-chord')).not.toBeNull()
        expect(text('figcaption.mn-formula')).toEqual([
            'Am (A minor): A C E. Formula 1 b3 5. Also written Amin, A-.'
        ])
    })

    it('names a chord from its frets, and the chord heard with a capo', () => {
        expect(
            render('chord', 'frets: 320003\ncaption: formula').text('.mn-formula')[0]
        ).toStartWith('G (G major): G B D.')
        expect(
            render('chord', 'Em 022000\ncapo: 3\ncaption: formula').text('.mn-formula')[0]
        ).toStartWith('Gm (G minor): G Bb D.')
    })

    it('writes both, the fingering first, in one figcaption', () => {
        const { host, result } = render('chord', 'A x02220 x01230\ncaption: fingering, formula')
        expect(result.ok).toBe(true)
        const both = host.querySelector('figure.mn-captioned > figcaption.mn-captions')!
        expect([...both.children].map((c) => c.className)).toEqual(['mn-fingering', 'mn-formula'])
        expect(both.children[1]!.textContent).toStartWith('A (A major): A C# E.')
        // The fingering alone is as before.
        expect(
            render('chord', 'A x02220\ncaption: fingering').host.querySelector(
                'figure > figcaption.mn-fingering'
            )
        ).not.toBeNull()
    })

    it('writes a piano chord’s formula', () => {
        expect(
            render('chord', 'Cmaj7\ninstrument: piano\ncaption: formula').text('.mn-formula')
        ).toEqual([
            'Cmaj7 (C major seventh): C E G B. Formula 1 3 5 7. Also written CΔ, Cma7, CM7, CMaj7.'
        ])
    })

    it('writes a scale’s or a chord’s formula under keyboards and fretboards', () => {
        expect(
            render('fretboard', 'A minor pentatonic\nposition: 1\ncaption: formula').text(
                '.mn-formula'
            )
        ).toEqual(['A minor pentatonic: A C D E G. Formula 1 b3 4 5 b7. Steps W+H W W W+H W.'])
        expect(
            render('keyboard', 'chord: G7\ncaption: formula').text('.mn-formula')[0]
        ).toStartWith('G7 (G dominant seventh): G B D F.')
        // A row: each diagram its own.
        expect(
            render('fretboard', 'G major\npositions: all\ncaption: formula').text('.mn-formula')
        ).toHaveLength(5)
    })

    it('follows the block’s naming', () => {
        expect(
            render('keyboard', 'La mineur\nnaming: solfege\ncaption: formula').text(
                '.mn-formula'
            )[0]
        ).toBe('La minor: La Si Do Ré Mi Fa Sol. Formula 1 2 b3 4 5 b6 b7. Steps W H W W H W W.')
    })

    it('says what to add without a chord or a scale the library knows', () => {
        expect(render('keyboard', 'notes: C E G\ncaption: formula').result.error).toBe(
            'caption: formula needs a chord or a scale the library knows: add chord: or scale:'
        )
        expect(render('chord', 'Mystery x02220\ncaption: formula').result.error).toBe(
            'caption: formula needs a chord the library knows: add its symbol (e.g. symbol: A)'
        )
        expect(render('fretboard', 'C major\ncaption: fingering').result.error).toBe(
            'caption: fingering is for chord blocks: use formula or none here'
        )
        expect(render('keyboard', 'C major\ncaption: words').result.error).toBe(
            'caption: use formula (notes and intervals) or none, got "words"'
        )
    })

    it('reaches progression diagrams', () => {
        expect(render('progression', 'I V\nkey: C\ncaption: formula').text('.mn-formula')).toEqual([
            'C (C major): C E G. Formula 1 3 5. Also written CM, Cmaj.',
            'G (G major): G B D. Formula 1 3 5. Also written GM, Gmaj.'
        ])
    })
})
