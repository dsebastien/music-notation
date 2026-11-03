import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { lookupGuitarVoicing } from '../voicings/index.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

const texts = (h: HTMLElement, cls: string) =>
    [...h.querySelectorAll(`.${cls}`)].map((el) => el.textContent)

describe('progression block', () => {
    it('draws roman numerals in a key with guitar diagrams', () => {
        const h = host()
        const result = renderBlock('progression', 'I V vi IV\nkey: G', h)
        expect(result.error).toBeNull()
        expect(texts(h, 'mn-progression-key')).toEqual(['Key: G major'])
        expect(texts(h, 'mn-progression-numeral')).toEqual(['I', 'V', 'vi', 'IV'])
        const diagrams = [...h.querySelectorAll('svg.mn-guitar-chord')]
        expect(diagrams.map((d) => d.getAttribute('data-mn-chord'))).toEqual(['G', 'D', 'Em', 'C'])
        expect(h.querySelector('.mn-progression-function')).toBeNull()
    })

    it('shows functions, and Nashville numbers as written', () => {
        const h = host()
        renderBlock('progression', '1 5 6m 4\nkey: G\nfunctions: yes\ndiagrams: no', h)
        expect(texts(h, 'mn-progression-numeral')).toEqual(['1', '5', '6m', '4'])
        expect(texts(h, 'mn-progression-name')).toEqual(['G', 'D', 'Em', 'C'])
        expect(texts(h, 'mn-progression-function')).toEqual([
            'tonic',
            'dominant',
            'tonic',
            'subdominant'
        ])
        expect(h.querySelector('svg')).toBeNull()
    })

    it('switches numeral styles', () => {
        const h = host()
        renderBlock('progression', 'I V/V V7\nkey: C\nnumerals: nashville\ndiagrams: no', h)
        expect(texts(h, 'mn-progression-numeral')).toEqual(['1', '2', '5⁷'])
        const g = host()
        renderBlock('progression', '1 5 6m\nkey: C\nnumerals: roman\ndiagrams: no', g)
        expect(texts(g, 'mn-progression-numeral')).toEqual(['I', 'V', 'vi'])
        const n = host()
        renderBlock('progression', '1 5\nkey: C\nnumerals: none\ndiagrams: no', n)
        expect(n.querySelector('.mn-progression-numeral')).toBeNull()
    })

    it('finds a key the chords spell with too many flats under its other name', () => {
        const h = host()
        renderBlock('progression', 'Gbm Cbm Db Gbm\ndiagrams: no', h)
        expect(texts(h, 'mn-progression-key')[0]).toMatch(/^Key: F# minor/)
    })

    it('finds the key of chord names and gives their numerals', () => {
        const h = host()
        renderBlock('progression', 'G D Em C\ndiagrams: no', h)
        expect(texts(h, 'mn-progression-key')).toEqual(['Key: G major'])
        expect(texts(h, 'mn-progression-numeral')).toEqual(['I', 'V', 'vi', 'IV'])
        const unclear = host()
        renderBlock('progression', 'Am F C G\ndiagrams: no', unclear)
        expect(texts(unclear, 'mn-progression-key')).toEqual(['Key: A minor (or C major, G major)'])
    })

    it('transposes numerals and chord names, spelled for the new key', () => {
        const h = host()
        renderBlock('progression', 'I IV V\nkey: G\ntranspose: -1\ndiagrams: no', h)
        expect(texts(h, 'mn-progression-key')).toEqual(['Key: F# major'])
        expect(texts(h, 'mn-progression-name')).toEqual(['F#', 'B', 'C#'])
        const names = host()
        renderBlock('progression', 'G D Em C\nkey: G\ntranspose: 3\ndiagrams: no', names)
        expect(texts(names, 'mn-progression-key')).toEqual(['Key: Bb major'])
        expect(texts(names, 'mn-progression-name')).toEqual(['Bb', 'F', 'Gm', 'Eb'])
        expect(texts(names, 'mn-progression-numeral')).toEqual(['I', 'V', 'vi', 'IV'])
        const down = host()
        renderBlock(
            'progression',
            'G C D F#dim\nkey: G\ntranspose: -1\nfunctions: yes\ndiagrams: no',
            down
        )
        expect(texts(down, 'mn-progression-name')).toEqual(['F#', 'B', 'C#', 'E#dim'])
        expect(texts(down, 'mn-progression-numeral')).toEqual(['I', 'IV', 'V', 'vii°'])
        expect(texts(down, 'mn-progression-function')).toEqual([
            'tonic',
            'subdominant',
            'dominant',
            'dominant'
        ])
        const minor = host()
        renderBlock('progression', 'Em Am B7 C\nkey: Em\ntranspose: -1\ndiagrams: no', minor)
        expect(texts(minor, 'mn-progression-name')).toEqual(['Ebm', 'Abm', 'Bb7', 'Cb'])
        expect(texts(minor, 'mn-progression-numeral')).toEqual(['i', 'iv', 'V7', 'bVI'])
    })

    it('draws chords whose root needs a double sharp', () => {
        const h = host()
        const result = renderBlock('progression', 'i iv V vii°\nkey: G#m', h)
        expect(result.error).toBeNull()
        const diagrams = [...h.querySelectorAll('svg.mn-guitar-chord')]
        expect(diagrams.map((d) => d.getAttribute('data-mn-chord'))).toEqual([
            'G#m',
            'C#m',
            'D#',
            'F##dim'
        ])
    })

    it('draws piano chords, voice-led when asked', () => {
        const h = host()
        const result = renderBlock(
            'progression',
            'I V vi IV\nkey: C\ninstrument: piano\nvoice-leading: yes',
            h
        )
        expect(result.error).toBeNull()
        const keyboards = [...h.querySelectorAll('svg.mn-keyboard')]
        expect(keyboards.map((k) => k.getAttribute('data-mn-pitches'))).toEqual([
            '60 64 67',
            '59 62 67',
            '60 64 69',
            '60 65 69'
        ])
        const plain = host()
        renderBlock('progression', 'I IV\nkey: F\ninstrument: piano', plain)
        expect(plain.querySelectorAll('svg.mn-keyboard')[1]!.getAttribute('data-mn-pitches')).toBe(
            '70 74 77'
        )
        expect(
            plain.querySelectorAll('svg.mn-keyboard')[1]!.querySelector('[data-mn-note="Bb"]')
        ).not.toBeNull()
    })

    it('passes piano voicings to every chord', () => {
        const h = host()
        const result = renderBlock(
            'progression',
            'ii7 V7 Imaj7\nkey: C\ninstrument: piano\nvoicing: shell',
            h
        )
        expect(result.error).toBeNull()
        // Shells: root, third, seventh.
        expect(h.querySelectorAll('svg.mn-keyboard')[0]!.getAttribute('data-mn-pitches')).toBe(
            '62 65 72'
        )
        const error = (source: string) => renderBlock('progression', source, host()).error
        expect(error('I V\nkey: C\nvoicing: shell')).toContain('instrument: piano')
        expect(error('I V\nkey: C\ninstrument: piano\nvoice-leading: yes\noctave: 3')).toContain(
            'not both'
        )
    })

    it('takes the piano from the note’s instrument', () => {
        const h = host()
        renderBlock('progression', 'I V\nkey: C', h, { instrument: 'piano' })
        expect(h.querySelectorAll('svg.mn-keyboard')).toHaveLength(2)
    })

    it('changes key in sections, with shared settings', () => {
        const h = host()
        const result = renderBlock(
            'progression',
            'diagrams: no\ntitle: Song\n---\nI IV V\nkey: C\n---\nI IV V\nkey: D',
            h
        )
        expect(result.error).toBeNull()
        expect(texts(h, 'mn-progression-title')).toEqual(['Song'])
        expect(texts(h, 'mn-progression-key')).toEqual(['Key: C major', 'Key: D major'])
        expect(texts(h, 'mn-progression-name')).toEqual(['C', 'F', 'G', 'D', 'G', 'A'])
    })

    it('adds a playback bar to each diagram', () => {
        const h = host()
        renderBlock('progression', 'I V\nkey: G', h, { play: true, voicings: lookupGuitarVoicing })
        expect(h.querySelectorAll('.mn-playable')).toHaveLength(2)
    })

    it('says what to write instead', () => {
        const error = (source: string) => renderBlock('progression', source, host()).error
        expect(error('I VIII\nkey: C')).toContain('Didn\'t read "VIII"')
        expect(error('I IV V')).toBe('Add the key: e.g. key: G or key: E minor')
        expect(error('I IV\nkey: H')).toContain('Unknown key "H"')
        expect(error('i iv\nkey: Gbm')).toBe('Gb minor needs 9 flats: write F# minor')
        expect(error('I IV\nkey: Fb')).toBe('Fb major needs 8 flats: write E major')
        expect(error('I IV\nkey: D dorian')).toContain('Unknown key "D dorian"')
        expect(error('key: C')).toContain('Add the chords')
        expect(error('I IV\nkey: C\ntranspose: 1.5')).toContain('transpose')
        expect(error('I IV\nkey: C\nfunctions: maybe')).toBe(
            'functions must be yes or no, got "maybe"'
        )
        expect(error('I IV\nkey: C\nvoice-leading: yes')).toContain('instrument: piano')
        expect(error('I IV\nkey: C\ninstrument: banjo')).toContain('Unknown instrument')
        expect(error('I IV\nkey: C\nnumerals: greek')).toContain('numerals: use roman')
        expect(error('I IV V\nkey: C\ninstrument: piano\nvoicing: drop2')).toContain(
            'voicing: use close, open, shell'
        )
        expect(error('I IV V\nkey: C\ninstrument: piano\noctave: 9')).toContain(
            'octave: use a number from 0 to 8'
        )
        expect(error('I IV V\nkey: C\ninstrument: piano\nhands: three')).toContain('hands: use')
        expect(error(`${Array(33).fill('I').join(' ')}\nkey: C`)).toContain('At most 32 chords')
        expect(error('G Dxyz')).toContain('Didn\'t read "Dxyz"')
    })
})
