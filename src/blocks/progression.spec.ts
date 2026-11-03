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

    it('reads the chords before, between or after the keys, on one line or several', () => {
        const chords = (source: string) => {
            const h = host()
            const result = renderBlock('progression', source, h)
            expect(result.error).toBeNull()
            return texts(h, 'mn-progression-name')
        }
        expect(chords('key: G\ndiagrams: no\nI V vi IV')).toEqual(['G', 'D', 'Em', 'C'])
        expect(chords('key: G\nI V vi IV\ndiagrams: no')).toEqual(['G', 'D', 'Em', 'C'])
        expect(chords('key: G\nI V\ndiagrams: no\nvi IV')).toEqual(['G', 'D', 'Em', 'C'])
        expect(chords('key: C\ndiagrams: no\n---\nI V vi IV\n---\nkey: Eb\nI IV V')).toEqual([
            'C',
            'G',
            'Am',
            'F',
            'Eb',
            'Ab',
            'Bb'
        ])
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

    it('raises typed Nashville extensions: 57 shows 5⁷, 2-7 2-⁷', () => {
        const h = host()
        renderBlock('progression', '1 47 57 2m7 5/3 2-7 1maj7 57sus4\nkey: C\ndiagrams: no', h)
        // Every extension raised alike, the bass after a slash as written.
        expect(texts(h, 'mn-progression-numeral')).toEqual([
            '1',
            '4⁷',
            '5⁷',
            '2m⁷',
            '5/3',
            '2-⁷',
            '1maj⁷',
            '5⁷sus⁴'
        ])
        expect(texts(h, 'mn-progression-name')).toEqual([
            'C',
            'F7',
            'G7',
            'Dm7',
            'G/E',
            'Dm7',
            'Cmaj7',
            'G7sus4'
        ])
    })

    it('reads a blues in its key: I7 IV7 V7', () => {
        const found = host()
        renderBlock('progression', 'A7 D7 E7 A7\nfunctions: yes\ndiagrams: no', found)
        expect(texts(found, 'mn-progression-key')).toEqual(['Key: A major (blues)'])
        expect(texts(found, 'mn-progression-numeral')).toEqual(['I7', 'IV7', 'V7', 'I7'])
        expect(texts(found, 'mn-progression-function')).toEqual([
            'tonic',
            'subdominant',
            'dominant',
            'tonic'
        ])
        const typed = host()
        renderBlock('progression', 'I7 IV7 V7\nkey: A\nfunctions: yes\ndiagrams: no', typed)
        expect(texts(typed, 'mn-progression-key')).toEqual(['Key: A major (blues)'])
        expect(texts(typed, 'mn-progression-function')).toEqual([
            'tonic',
            'subdominant',
            'dominant'
        ])
    })

    it('names the mode chord names play in', () => {
        const h = host()
        renderBlock('progression', 'Dm C G\ndiagrams: no\nfunctions: yes', h)
        expect(texts(h, 'mn-progression-key')[0]).toMatch(/^Key: D dorian/)
        expect(texts(h, 'mn-progression-numeral')).toEqual(['i', 'bVII', 'IV'])
        expect(texts(h, 'mn-progression-function')).toEqual(['tonic', 'subdominant', 'subdominant'])
        const moved = host()
        renderBlock('progression', 'Dm C G\ntranspose: 2\ndiagrams: no', moved)
        expect(texts(moved, 'mn-progression-key')[0]).toMatch(/^Key: E dorian/)
        expect(texts(moved, 'mn-progression-name')).toEqual(['Em', 'D', 'A']) // A I7 going to IV is V7/IV in a major key, not a mixolydian I7.
        const secondary = host()
        renderBlock('progression', 'C C7 F C\ndiagrams: no', secondary)
        expect(texts(secondary, 'mn-progression-key')[0]).toMatch(/^Key: C major/)
        expect(texts(secondary, 'mn-progression-numeral')).toEqual(['I', 'V7/IV', 'IV', 'I'])
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
        expect(texts(unclear, 'mn-progression-key')).toEqual(['Key: A minor (or C major)'])
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

    it('gives every piano keyboard of a row the same range', () => {
        const range = (source: string) => {
            const h = host()
            expect(renderBlock('progression', source, h).error).toBeNull()
            return [...h.querySelectorAll('svg.mn-keyboard')].map((svg) => {
                const keys = [...svg.querySelectorAll('[data-midi]')].map((k) =>
                    Number(k.getAttribute('data-midi'))
                )
                return `${Math.min(...keys)}-${Math.max(...keys)} ${svg.getAttribute('width')}`
            })
        }
        // A slash chord's bass an octave below: every keyboard from C3, not only that one.
        expect(new Set(range('I V/3 vi IV/1\nkey: C\ninstrument: piano'))).toEqual(
            new Set(['48-83 464'])
        )
        expect(
            new Set(range('I IV V vii° vi\nkey: F#\ninstrument: piano\nvoice-leading: yes')).size
        ).toBe(1)
        expect(new Set(range('ii7 V7 Imaj7\nkey: C\ninstrument: piano\nvoicing: shell')).size).toBe(
            1
        )
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
        // Shells: root, third, seventh, alternating R-3 and R-7 so the third and seventh move least.
        const pitches = (el: Element) =>
            [...el.querySelectorAll('svg.mn-keyboard')].map((svg) =>
                svg.getAttribute('data-mn-pitches')
            )
        expect(pitches(h)).toEqual(['50 53 60', '43 53 59', '48 52 59'])
        // voice-leading: no draws each chord as written.
        const plain = host()
        renderBlock(
            'progression',
            'ii7 V7 Imaj7\nkey: C\ninstrument: piano\nvoicing: shell\nvoice-leading: no',
            plain
        )
        expect(pitches(plain)).toEqual(['62 65 72', '67 71 77', '60 64 71'])
        // Rootless A and B around middle C, with the hands.
        const rootless = host()
        renderBlock(
            'progression',
            'ii7 V7 Imaj7\nkey: C\ninstrument: piano\nvoicing: rootless A\nhands: left+right',
            rootless
        )
        // A minor ii-V-i with both hands: the right hand moves by step (D4 A4, D4 G#4, C4 G4).
        for (const source of ['Bm7b5 E7 Am7', 'iiø7 V7 i7']) {
            const minor = host()
            renderBlock(
                'progression',
                `${source}\nkey: A minor\ninstrument: piano\nvoicing: shell\nhands: left+right`,
                minor
            )
            expect(pitches(minor)).toEqual(['47 62 69', '40 62 68', '45 60 67'])
        }
        // The right hand from F3 up, clear of the left hand: Cmaj7 takes the B form.
        expect(pitches(rootless)).toEqual(['38 53 57 60 64', '43 53 57 59 64', '36 59 62 64 67'])
        expect(rootless.querySelectorAll('.mn-key-hand.mn-hand-left')).toHaveLength(3)
        // Rootless in a minor key: the dominant takes b9 and b13, the half-diminished chord the
        // key's 9th, and a triad tonic its 6/9 chord (ii-V-i in C minor: Dm7b5 F Ab C Eb, G7 F
        // Ab B Eb, Cm Eb G A D). A major tonic too (ii7 V7 I in F ends A C D G).
        const minor = host()
        renderBlock(
            'progression',
            'iiø7 V7 i\nkey: C minor\ninstrument: piano\nvoicing: rootless A',
            minor
        )
        expect(minor.querySelector('.mn-error-message')).toBeNull()
        expect(pitches(minor)).toEqual(['53 56 60 63', '53 56 59 63', '51 55 57 62'])
        const major = host()
        renderBlock('progression', 'ii7 V7 I\nkey: F\ninstrument: piano\nvoicing: rootless', major)
        expect(major.querySelector('.mn-error-message')).toBeNull()
        expect(pitches(major)[2]).toBe('57 60 62 67')
        // VI7 going to ii in Eb: C7 takes the key's 9th (D) and the b13 (Ab): E Ab Bb D.
        const six = host()
        renderBlock(
            'progression',
            'Imaj7 VI7 ii7 V7\nkey: Eb\ninstrument: piano\nvoicing: rootless',
            six
        )
        expect(
            pitches(six)[1]!
                .split(' ')
                .map((p) => Number(p) % 12)
                .sort((a, b) => a - b)
        ).toEqual([2, 4, 8, 10])
        // A 7sus4 chord takes the voicing too (rootless 4 5 b7 9 or b7 9 4 5; shell R 4 7).
        for (const voicing of ['rootless', 'shell']) {
            const sus = host()
            renderBlock(
                'progression',
                `Dm7 G7sus4 G7 Cmaj7\ninstrument: piano\nvoicing: ${voicing}`,
                sus
            )
            expect(sus.querySelector('.mn-error-message')).toBeNull()
            expect(sus.querySelectorAll('svg.mn-keyboard')).toHaveLength(4)
        }
        const error = (source: string) => renderBlock('progression', source, host()).error
        expect(error('I V\nkey: C\nvoicing: shell')).toContain('instrument: piano')
        expect(error('I V\nkey: C\ninstrument: piano\nvoice-leading: yes\noctave: 3')).toContain(
            'not both'
        )
        expect(error('I V\nkey: C\ninstrument: piano\nvoice-leading: yes\nhands: left')).toContain(
            'voice-leading goes with hands: left+right'
        )
        // Open voicings lead too, their lowest note within C3-C4 (Am7 doesn't climb to C6).
        const open = host()
        renderBlock(
            'progression',
            'Imaj7 vi7 ii7 V7\nkey: C\ninstrument: piano\nvoicing: open\nvoice-leading: yes',
            open
        )
        expect(open.querySelector('.mn-error-message')).toBeNull()
        for (const keys of pitches(open)) {
            const list = keys!.split(' ').map(Number)
            expect(list[0]).toBeGreaterThanOrEqual(48)
            expect(list[0]).toBeLessThanOrEqual(60)
            expect(list[list.length - 1]).toBeLessThan(77)
        }
        // Without voice-leading, open voicings keep their lowest note within F3-E4 too.
        const spread = host()
        renderBlock(
            'progression',
            'Imaj7 vi7 ii7 V7\nkey: C\ninstrument: piano\nvoicing: open',
            spread
        )
        expect(pitches(spread)).toEqual([
            '60 67 71 76',
            '57 64 67 72',
            '62 69 72 77',
            '55 62 65 71'
        ])
        // Both hands: the root in the left hand, voice-led close chords in the right (pop texture).
        const pop = host()
        renderBlock(
            'progression',
            'I vi IV V\nkey: G\ninstrument: piano\nvoice-leading: yes\nhands: left+right',
            pop
        )
        expect(pop.querySelector('.mn-error-message')).toBeNull()
        expect(pitches(pop)).toEqual(['43 55 59 62', '40 55 59 64', '48 55 60 64', '50 57 62 66'])
        // A bass line written with slash chords goes down by step: C3 B2 A2 G2 F2.
        const line = host()
        renderBlock(
            'progression',
            'C G/B Am C/G F\nkey: C\ninstrument: piano\nvoice-leading: yes\nhands: left+right',
            line
        )
        expect(line.querySelector('.mn-error-message')).toBeNull()
        expect(pitches(line).map((p) => p!.split(' ')[0])).toEqual(['48', '47', '45', '43', '41'])
        expect(pop.querySelectorAll('.mn-key-hand.mn-hand-left')).toHaveLength(4)
        expect(
            error('I V\nkey: C\ninstrument: piano\nvoice-leading: yes\nvoicing: close')
        ).toBeNull() // voicing: close with voice-leading draws the voice-led keys, with no error in a cell.
        const close = host()
        renderBlock(
            'progression',
            'ii7 V7 Imaj7\nkey: C\ninstrument: piano\nvoicing: close\nvoice-leading: yes',
            close
        )
        expect(close.querySelector('.mn-error-message')).toBeNull()
        expect(pitches(close)).toEqual(['62 65 69 72', '62 65 67 71', '60 64 67 71'])
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
        expect(error('I IV\nkey: D dorian')).toBe(
            'Progression keys are major or minor: write key: D major or key: D minor, got "D dorian"'
        )
        // Figured bass reads as inversions: I6 is C/E, V65 G7/B.
        const figured = host()
        renderBlock('progression', 'I6 IV64 V65 I\nkey: C\ndiagrams: no', figured)
        expect(texts(figured, 'mn-progression-name')).toEqual(['C/E', 'F/C', 'G7/B', 'C'])
        expect(texts(figured, 'mn-progression-numeral')).toEqual(['I6', 'IV64', 'V65', 'I'])
        expect(error('I Imaj765\nkey: C')).toContain('I6, V65')
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
        // Counted before reading: 800 chords (and one that doesn't read) fail fast on the count.
        const start = performance.now()
        expect(error(`${Array(800).fill('G').join(' ')} Xyz`)).toBe(
            'At most 32 chords per block, found 801'
        )
        expect(performance.now() - start).toBeLessThan(100)
    })
})
