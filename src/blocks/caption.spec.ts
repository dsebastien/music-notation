import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { lookupGuitarVoicing } from '../voicings/index.js'
import { describeBlock, formatDiagram } from '../cli/describe.js'

const render = (source: string, options = {}) => {
    const host = document.createElement('div')
    const result = renderBlock('chord', source, host, options)
    return {
        host,
        result,
        captions: [...host.querySelectorAll('figcaption.mn-fingering')].map((c) => c.textContent)
    }
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('caption: fingering (#53)', () => {
    it('writes a guitar chord fingering in words under its diagram', () => {
        const { host, result, captions } = render('A x02220 x01230\ncaption: fingering')
        expect(result.ok).toBe(true)
        expect(host.querySelector('figure.mn-captioned > svg.mn-guitar-chord')).not.toBeNull()
        expect(captions).toEqual([
            'Strum from the 5th string (A). Index on the D string, 2nd fret. Middle on the G string, 2nd fret. Ring on the B string, 2nd fret. The A and high E strings ring open.'
        ])
    })

    it('leaves diagrams without the key as they were', () => {
        const { host } = render('A x02220 x01230')
        expect(host.querySelector('figure, figcaption')).toBeNull()
        expect(host.querySelector('.mn-block > svg.mn-guitar-chord')).not.toBeNull()
        expect(render('A x02220\ncaption: none').host.querySelector('figure')).toBeNull()
    })

    it('says the capo, and other tunings by their notes', () => {
        expect(render('C x32010 x32010\ncapo: 2\ncaption: fingering').captions[0]).toStartWith(
            'Capo on the 2nd fret: frets count from the capo. Strum from the 5th string (A).'
        )
        expect(
            render('symbol: Dsus2\nfrets: x00230\ntuning: DADGAD\ncaption: fingering').captions[0]
        ).toEndWith('The 5th string (A), the 4th string (D) and the 1st string (D) ring open.')
    })

    it('works out the fingers of a looked-up voicing', () => {
        expect(render('D\ncaption: fingering', { voicings: lookupGuitarVoicing }).captions).toEqual(
            [
                'Strum from the 4th string (D). Index on the G string, 2nd fret. Ring on the B string, 3rd fret. Middle on the high E string, 2nd fret. The D string rings open.'
            ]
        )
    })

    it('captions every diagram of a row, as a shared key or in rows the block draws', () => {
        expect(render('caption: fingering\n---\nG 320003\n---\nC x32010').captions).toHaveLength(2)
        expect(render('A\nvoicings: 2\ncaption: fingering').captions).toHaveLength(2)
        expect(
            render('from: C x32010\nto: Am\ncount: 1\ncaption: fingering').captions
        ).toHaveLength(2)
        expect(render('G\ntriads: 1-3\ninversion: 0\ncaption: fingering').captions[0]).toStartWith(
            'Strum from the 3rd string (G).'
        )
    })

    it('writes a piano chord by hand, left hand first', () => {
        expect(
            render(
                'symbol: C\ninstrument: piano\ninversion: first\nhands: left+right\nfingering: auto\ncaption: fingering'
            ).captions
        ).toEqual([
            'Left hand: little finger on E3. Right hand: thumb on C4, middle finger on E4, little finger on G4.'
        ])
        expect(render('symbol: C\ninstrument: piano\ncaption: fingering').captions).toEqual([
            'Play C, E and G.'
        ])
    })

    it('keeps the caption out of the playback bar', () => {
        const { host } = render('A x02220 x01230\ncaption: fingering', { play: true })
        expect(host.querySelector('figure.mn-captioned > .mn-playable > svg')).not.toBeNull()
        expect(host.querySelector('.mn-playable figcaption')).toBeNull()
    })

    it('says what to write for another value', () => {
        const { result } = render('A x02220\ncaption: Diagram')
        expect(result.ok).toBe(false)
        expect(result.error).toBe(
            'caption: use fingering (the fingering in words) or none, got "Diagram"'
        )
    })

    it('adds the words to check --describe, only for captioned chords', () => {
        const lines = (source: string) =>
            describeBlock(render(source).host).flatMap((d, i) => formatDiagram(d, i + 1))
        expect(lines('symbol: C\ninstrument: piano\ncaption: fingering').at(-1)).toBe(
            '   words: Play C, E and G.'
        )
        expect(lines('A x02220 x01230').some((l) => l.includes('words:'))).toBe(false)
    })
})
