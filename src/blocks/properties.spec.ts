import { describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { blockFromProperties, kindOf, DEFAULT_PROPERTY_NAMES } from './properties.js'

// The same notes as Music Practice's practice blocks (#56, #58), so a note draws the same in
// Obsidian and on Obsidian Publish. The kind comes from the type tag, as Music Practice reads it.
const ARPEGGIO = 'type/music/guitar/arpeggio'
const PIANO_ARPEGGIO = 'type/music/piano/arpeggio'
const CHORD = 'type/music/guitar/chord'
const STRUM = 'type/music/guitar/strum'

describe('kindOf', () => {
    it('reads the kind of a music type tag', () => {
        expect(kindOf({ tags: [ARPEGGIO] }, DEFAULT_PROPERTY_NAMES)).toBe('arpeggio')
        expect(kindOf({ tags: '#type/music/piano/chord' }, DEFAULT_PROPERTY_NAMES)).toBe('chord')
        expect(kindOf({ tags: ['music', 'type/music/theory'] }, DEFAULT_PROPERTY_NAMES)).toBe(
            'theory'
        )
        expect(kindOf({ tags: ['type/creation/product'] }, DEFAULT_PROPERTY_NAMES)).toBeNull()
        expect(kindOf({}, DEFAULT_PROPERTY_NAMES)).toBeNull()
    })
})

describe('blocks from properties: arpeggio notes (#56)', () => {
    it("draws an arpeggio note's chord in its CAGED shape on a fretboard", () => {
        const props = { chord_symbol: 'A Minor 7', shape: 'CAGED E', tags: [ARPEGGIO] }
        expect(blockFromProperties('fretboard', props)).toBe('arpeggio: Am7\nshape: E')
        expect(blockFromProperties('fretboard', { ...props, shape: 'A' })).toBe(
            'arpeggio: Am7\nshape: A'
        )
        expect(blockFromProperties('fretboard', { ...props, shape: 'g shape' })).toBe(
            'arpeggio: Am7\nshape: G'
        )
        expect(blockFromProperties('fretboard', { ...props, shape: 'E-shape barre' })).toBe(
            'arpeggio: Am7\nshape: E'
        )
        expect(blockFromProperties('fretboard', { ...props, shape: ['D'] })).toBe(
            'arpeggio: Am7\nshape: D'
        )
    })

    it('draws the whole neck without a CAGED shape', () => {
        for (const shape of ['Open', 'Triad', '3NPS', '', undefined])
            expect(
                blockFromProperties('fretboard', { chord_symbol: 'G7', shape, tags: [ARPEGGIO] })
            ).toBe('arpeggio: G7')
    })

    it('draws piano arpeggios on a keyboard, without a shape', () => {
        const props = { chord_symbol: 'Cmaj7', shape: 'E', tags: [PIANO_ARPEGGIO] }
        expect(blockFromProperties('keyboard', props)).toBe('arpeggio: Cmaj7')
        expect(blockFromProperties('fretboard', props)).toBeNull()
    })

    it("draws a guitar chord note's arpeggio in its empty fretboard, not in other blocks", () => {
        const props = { chord_symbol: 'C', shape: 'A', frets: 'x35553', tags: [CHORD] }
        expect(blockFromProperties('fretboard', props)).toBe('arpeggio: C\nshape: A')
        expect(blockFromProperties('chord', props)).toBe('symbol: C\nfrets: x35553')
        expect(
            blockFromProperties('keyboard', { ...props, tags: ['type/music/piano/chord'] })
        ).toBeNull()
    })

    it('leaves scales, unknown chords and other kinds as they were', () => {
        expect(
            blockFromProperties('fretboard', {
                scale_root: 'A',
                scale_type: 'Minor pentatonic',
                tags: ['type/music/guitar/scale']
            })
        ).toBe('scale: A Minor pentatonic')
        expect(
            blockFromProperties('fretboard', { chord_symbol: 'Hmaj', tags: [ARPEGGIO] })
        ).toBeNull()
        expect(blockFromProperties('fretboard', { tags: [ARPEGGIO] })).toBeNull()
        expect(
            blockFromProperties('fretboard', {
                chord_symbol: 'C',
                tags: ['type/music/guitar/exercise']
            })
        ).toBeNull()
        // No type tag: no kind, so no arpeggio.
        expect(blockFromProperties('fretboard', { chord_symbol: 'C' })).toBeNull()
    })

    it('uses the configured property names', () => {
        expect(
            blockFromProperties(
                'fretboard',
                { mp_chord: 'D', mp_shape: 'C', labels: [ARPEGGIO] },
                { names: { chordSymbol: 'mp_chord', shape: 'mp_shape', tags: 'labels' } }
            )
        ).toBe('arpeggio: D\nshape: C')
    })
})

describe('blocks from properties: strumming pattern notes (#58)', () => {
    it("draws a strumming pattern note's pattern with its time signature, feel and tempo", () => {
        const props = {
            strum_pattern: 'D DU UDU',
            time_signature: '4/4',
            strum_feel: 'swing',
            bpm_current: 80,
            tags: [STRUM]
        }
        expect(blockFromProperties('strum', props)).toBe(
            'D DU UDU\ntime: 4/4\nswing: yes\ntempo: 80'
        )
    })

    it('reads a feel as the strum block swing', () => {
        const swing = (strum_feel: string) =>
            blockFromProperties('strum', { strum_pattern: 'DU', strum_feel })
        expect(swing('Shuffle')).toBe('DU\nswing: yes')
        expect(swing('swung 8ths')).toBe('DU\nswing: yes')
        expect(swing('60%')).toBe('DU\nswing: 60%')
        expect(swing('straight')).toBe('DU')
    })

    it('draws one bar per line from a list, and the chord when the note has one', () => {
        const props = {
            strum_pattern: ['D - - D - -', 'D - U D - U'],
            time_signature: '6/8',
            chord_symbol: 'A Minor'
        }
        expect(blockFromProperties('strum', props)).toBe(
            'D - - D - -\nD - U D - U\ntime: 6/8\nchord: Am'
        )
    })

    it('leaves out values the block would not read', () => {
        const props = {
            strum_pattern: 'D D D D',
            time_signature: 'four four',
            strum_feel: 'laid back',
            bpm_current: 400
        }
        expect(blockFromProperties('strum', props)).toBe('D D D D')
    })

    it('draws nothing without a pattern', () => {
        expect(blockFromProperties('strum', { time_signature: '4/4' })).toBeNull()
        expect(blockFromProperties('strum', { strum_pattern: '  ' })).toBeNull()
    })

    it('uses the configured property names', () => {
        expect(
            blockFromProperties(
                'strum',
                { pat: 'DDU', meter: '3/4', groove: 'shuffle', speed: '96' },
                {
                    names: {
                        strumPattern: 'pat',
                        timeSignature: 'meter',
                        strumFeel: 'groove',
                        bpmCurrent: 'speed'
                    }
                }
            )
        ).toBe('DDU\ntime: 3/4\nswing: yes\ntempo: 96')
    })
})

describe('empty blocks drawn from these notes', () => {
    it('draws an empty strum block from a strumming pattern note', () => {
        const h = document.createElement('div')
        const r = renderBlock('strum', '', h, {
            properties: { strum_pattern: 'D DU UDU', time_signature: '4/4', tags: [STRUM] }
        })
        expect(r.ok).toBe(true)
        expect(r.el.classList.contains('mn-from-properties')).toBe(true)
        expect(h.querySelector('svg')).not.toBeNull()
    })

    it('draws an empty fretboard from an arpeggio note and from a guitar chord note', () => {
        for (const props of [
            { chord_symbol: 'Am', shape: 'A', tags: [ARPEGGIO] },
            { chord_symbol: 'G', frets: '320003', tags: [CHORD] }
        ]) {
            const h = document.createElement('div')
            const r = renderBlock('fretboard', '', h, { properties: props })
            expect(r.ok).toBe(true)
            expect(r.el.classList.contains('mn-from-properties')).toBe(true)
            // A dot for each chord tone on the neck (a whole-neck arpeggio has no visible title).
            expect(h.querySelectorAll('svg [data-midi]').length).toBeGreaterThan(5)
        }
    })

    it('leaves an empty strum block empty without a pattern', () => {
        const h = document.createElement('div')
        const r = renderBlock('strum', '', h, { properties: { tags: [STRUM] } })
        expect(r.ok).toBe(true)
        expect(r.el.classList.contains('mn-empty')).toBe(true)
    })
})

describe('a chord from its root and quality when the note has no chord symbol (#132)', () => {
    const guitar = { tags: ['type/music/guitar/chord'] }
    const piano = { tags: ['type/music/piano/chord'] }

    it("draws a new chord note: the Starter Kit's template asks for the root and the quality", () => {
        expect(
            blockFromProperties('chord', { ...guitar, chord_root: 'A', chord_quality: 'Minor 7' })
        ).toBe('symbol: Am7')
        expect(
            blockFromProperties('chord', { ...piano, chord_root: 'C#', chord_quality: 'Major 7' })
        ).toBe('symbol: C#maj7\ninstrument: piano')
        // A note in brackets is not part of the name.
        expect(
            blockFromProperties('chord', { ...guitar, chord_root: 'E', chord_quality: '5 (Power)' })
        ).toBe('symbol: E5')
        // A root alone is its major chord.
        expect(blockFromProperties('chord', { ...guitar, chord_root: 'G' })).toBe('symbol: G')
    })

    it('reads every quality the template offers', () => {
        for (const quality of [
            'Major',
            'Minor',
            '5 (Power)',
            '7',
            'Major 7',
            'Minor 7',
            'Minor 7 flat 5',
            'Diminished',
            'Diminished 7',
            'Augmented',
            'Sus2',
            'Sus4',
            '7sus4',
            'Add9',
            '6',
            'Minor 6',
            '9',
            'Major 9',
            'Minor 9',
            '11',
            '13'
        ])
            expect(
                blockFromProperties('chord', {
                    ...guitar,
                    chord_root: 'Bb',
                    chord_quality: quality
                })
            ).toMatch(/^symbol: Bb\S*$/)
    })

    it('a chord symbol wins, and nothing is drawn without a root', () => {
        expect(
            blockFromProperties('chord', {
                ...guitar,
                chord_symbol: 'Dm',
                chord_root: 'A',
                chord_quality: 'Minor 7'
            })
        ).toBe('symbol: Dm')
        expect(blockFromProperties('chord', { ...guitar, chord_quality: 'Minor 7' })).toBeNull()
    })

    it("an arpeggio note and a guitar chord note's fretboard use them too", () => {
        expect(
            blockFromProperties('fretboard', {
                tags: ['type/music/guitar/arpeggio'],
                chord_root: 'A',
                chord_quality: 'Minor 7'
            })
        ).toBe('arpeggio: Am7')
    })

    it('the names are the defaults Music Practice and the Starter Kit use', () => {
        expect(DEFAULT_PROPERTY_NAMES.chordRoot).toBe('chord_root')
        expect(DEFAULT_PROPERTY_NAMES.chordQuality).toBe('chord_quality')
    })
})
