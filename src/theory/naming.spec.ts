import { describe, expect, it } from 'bun:test'
import {
    NAMINGS,
    chordInNaming,
    lettersInBlock,
    noteInNaming,
    parseNaming,
    shown,
    shownText,
    toLetters,
    withNaming
} from './naming.js'

/** #12: note names in solfège (Do Ré Mi) and German (H for B). */
describe('naming: reading names into letters', () => {
    it('reads solfège notes, accents and signs optional', () => {
        expect(toLetters('Do Ré Re Mi Fa Sol La Si')).toBe('C D D E F G A B')
        expect(toLetters('Fa# Sib Lab Do♯ Mi♭')).toBe('F# Bb Ab C♯ E♭')
        expect(toLetters('Fa dièse, Si bémol, sol diese, la bemol')).toBe('F#, Bb, G#, Ab')
        expect(toLetters('do4 Sol3')).toBe('C4 G3')
    })

    it('reads solfège chords, with or without a space before the quality, and a bass', () => {
        expect(toLetters('Rém Sol7 Domaj7 Lam7b5 Fa#m Sibdim7')).toBe(
            'Dm G7 Cmaj7 Am7b5 F#m Bbdim7'
        )
        expect(toLetters('Do/Sol Lam/Mi')).toBe('C/G Am/E')
        expect(toLetters('Ré m7', 'letters', { chord: true })).toBe('Dm7')
    })

    it('leaves words that only start with a syllable alone', () => {
        expect(toLetters('Solo Doigts Laisse Fais Lamentation')).toBe(
            'Solo Doigts Laisse Fais Lamentation'
        )
    })

    it('reads H as B natural in every naming, and a bare B as B flat only in german', () => {
        expect(toLetters('H H7 Hm C/H H3')).toBe('B B7 Bm C/B B3')
        expect(toLetters('B B7 Bm C/B B3')).toBe('B B7 Bm C/B B3')
        expect(toLetters('B B7 Bm C/B B3 Bb H', 'german')).toBe('Bb Bb7 Bbm C/Bb Bb3 Bb B')
        expect(toLetters('E A D G H E', 'german')).toBe('E A D G B E')
    })

    it('reads majeur and mineur as major and minor', () => {
        expect(toLetters('La mineur')).toBe('A minor')
        expect(toLetters('Sol majeur')).toBe('G major')
    })

    it('reads a range of keys', () => {
        expect(toLetters('Do3-Si4')).toBe('C3-B4')
    })
})

describe('naming: showing names', () => {
    it('knows the namings, and says what to write for another one', () => {
        expect(NAMINGS).toEqual(['letters', 'solfege', 'german'])
        expect(parseNaming('Solfège')).toBe('solfege')
        expect(parseNaming(' GERMAN ')).toBe('german')
        expect(() => parseNaming('italian')).toThrow('naming: write letters, solfege or german')
    })

    it('shows notes in solfège with ♯ and ♭, and in German with H and B', () => {
        expect(noteInNaming('C', 'solfege')).toBe('Do')
        expect(noteInNaming('F#', 'solfege')).toBe('Fa♯')
        expect(noteInNaming('Bb', 'solfege')).toBe('Si♭')
        expect(noteInNaming('E♭', 'solfege')).toBe('Mi♭')
        expect(noteInNaming('B', 'german')).toBe('H')
        expect(noteInNaming('Bb', 'german')).toBe('B')
        expect(noteInNaming('B#', 'german')).toBe('H#')
        expect(noteInNaming('F#', 'german')).toBe('F#')
        expect(noteInNaming('F#', 'letters')).toBe('F#')
    })

    it('shows chords: a space before the quality in solfège, the bass in the same system', () => {
        expect(chordInNaming('Dm7', 'solfege')).toBe('Ré m7')
        expect(chordInNaming('G7', 'solfege')).toBe('Sol 7')
        expect(chordInNaming('C', 'solfege')).toBe('Do')
        expect(chordInNaming('C/G', 'solfege')).toBe('Do/Sol')
        expect(chordInNaming('B7', 'german')).toBe('H7')
        expect(chordInNaming('Bbmaj7/D', 'german')).toBe('Bmaj7/D')
        expect(chordInNaming('C/B', 'german')).toBe('C/H')
    })

    it('rewrites the chords and notes in a text, and leaves the rest', () => {
        expect(shownText('Fretboard: A minor pentatonic', 'solfege')).toBe(
            'Fretboard: La minor pentatonic'
        )
        expect(shownText('Keyboard: Cmaj7, left hand: C3, right hand: E4 G4', 'solfege')).toBe(
            'Keyboard: Do maj7, left hand: Do3, right hand: Mi4 Sol4'
        )
        expect(shownText('G major, E shape', 'german')).toBe('G major, E shape')
        expect(shownText('B major scale, capo 2', 'german')).toBe('H major scale, capo 2')
        // The English article stays.
        expect(shownText('A long title for Am', 'solfege')).toBe('A long title for La m')
        expect(shownText('Capo 3', 'solfege')).toBe('Capo 3')
        expect(shownText('3 2 1', 'solfege')).toBe('3 2 1')
        expect(shownText('Fretboard: A minor', 'letters')).toBe('Fretboard: A minor')
    })

    it('shows through the naming a drawing is made under, letters outside', () => {
        expect(shown('Am')).toBe('Am')
        expect(withNaming('solfege', () => shown('Am'))).toBe('La m')
        expect(shown('Am')).toBe('Am')
        expect(() =>
            withNaming('german', () => {
                throw new Error('x')
            })
        ).toThrow('x')
        expect(shown('B')).toBe('B')
    })
})

describe('naming: a block read into letters', () => {
    it('takes the naming line out and reads the notes of the keys that hold them', () => {
        expect(
            lettersInBlock(
                'fretboard',
                'La mineur pentatonique\nnaming: solfege\ntitle: La belle\nroot: Do',
                'letters'
            )
        ).toEqual({
            text: 'A minor pentatonique\ntitle: La belle\nroot: C',
            naming: 'solfege'
        })
        expect(lettersInBlock('chord', 'naming: german\nH7', 'letters')).toEqual({
            text: 'B7',
            naming: 'german'
        })
        expect(lettersInBlock('chord', 'B7', 'german').text).toBe('Bb7')
        expect(lettersInBlock('chord', 'B7', 'letters')).toEqual({ text: 'B7', naming: 'letters' })
        expect(
            lettersInBlock('keyboard', 'notes: Do4 Mi4 Sol4\nrange: Do4-Si4', 'letters').text
        ).toBe('notes: C4 E4 G4\nrange: C4-B4')
        expect(lettersInBlock('fretboard', 'C major\ntuning: E A D G H E', 'german').text).toBe(
            'C major\ntuning: E A D G B E'
        )
    })

    it('reads progression lines and keys, never strum or picking patterns', () => {
        expect(lettersInBlock('progression', 'key: Sol\nSol Rém Do', 'letters').text).toBe(
            'key: G\nG Dm C'
        )
        expect(lettersInBlock('strum', 'chord: Rém\nD DU UDU', 'letters').text).toBe(
            'chord: Dm\nD DU UDU'
        )
        expect(lettersInBlock('picking', 'chords: Do Sol\np i m a', 'letters').text).toBe(
            'chords: C G\np i m a'
        )
    })

    it('reads chart chords and directives, never lyrics', () => {
        const { text, naming } = lettersInBlock(
            'chords',
            '{naming: solfege}\n{key: Sol}\n[Sol]La vie [Rém]est belle [Solo]',
            'letters'
        )
        expect(naming).toBe('solfege')
        expect(text).toBe('{key: G}\n[G]La vie [Dm]est belle [Solo]')
    })

    it('says what to write for a wrong naming', () => {
        expect(() => lettersInBlock('chord', 'naming: french\nC', 'letters')).toThrow(
            'naming: write letters, solfege or german'
        )
    })
})
