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
        expect(toLetters('Do Ré Re Mi Fa Sol La Si', 'solfege')).toBe('C D D E F G A B')
        expect(toLetters('Fa# Sib Lab Do♯ Mi♭')).toBe('F# Bb Ab C♯ E♭')
        expect(toLetters('Fa dièse, Si bémol, Sol diese, La bemol')).toBe('F#, Bb, G#, Ab')
        expect(toLetters('Do4 Sol3')).toBe('C4 G3')
        // NFD accents (a decomposed é) read too.
        expect(toLetters('Rém')).toBe('Dm')
    })

    it('reads solfège chords, a bass, and the spaced forms the library shows', () => {
        expect(toLetters('Rém Sol7 Lam7b5 Fa#m Sibdim7')).toBe('Dm G7 Am7b5 F#m Bbdim7')
        expect(toLetters('Do/Sol Lam/Mi', 'solfege')).toBe('C/G Am/E')
        expect(toLetters('Ré m7 Sol 7 Do 7/Mi', 'solfege')).toBe('Dm7 G7 C7/E')
        expect(toLetters('Sol 7/Si')).toBe('G7/B')
        expect(toLetters('La/Do dièse')).toBe('A/C#')
        expect(toLetters('Sol,Ré,Mim,Do')).toBe('G,D,Em,C')
        expect(toLetters('|Sol|Ré|')).toBe('|G|D|')
    })

    it('reads letters first: what already reads as letters stays (Do is D diminished)', () => {
        expect(toLetters('Do Do7 Do/F')).toBe('Do Do7 Do/F')
        expect(toLetters('Do Do7', 'german')).toBe('Do Do7')
        expect(toLetters('Do Do7 Do/F', 'solfege')).toBe('C C7 C/F')
    })

    it('leaves words alone: lowercase syllables and words that start with one', () => {
        expect(toLetters('Solo Doigts Laisse Fais Lamentation')).toBe(
            'Solo Doigts Laisse Fais Lamentation'
        )
        expect(toLetters('sim. la do re Six Mix')).toBe('sim. la do re Six Mix')
    })

    it('reads H as B natural, and a bare B as B flat only in german', () => {
        expect(toLetters('H H7 Hm C/H H3')).toBe('B B7 Bm C/B B3')
        expect(toLetters('H7', 'letters', { h: false })).toBe('H7')
        expect(toLetters('B B7 Bm C/B B3')).toBe('B B7 Bm C/B B3')
        expect(toLetters('B B7 Bm C/B B3 Bb H', 'german')).toBe('Bb Bb7 Bbm C/Bb Bb3 Bb B')
    })

    it('reads majeur and mineur as major and minor, and a range of keys', () => {
        expect(toLetters('La mineur')).toBe('A minor')
        expect(toLetters('Sol majeur')).toBe('G major')
        expect(toLetters('Do3-Si4', 'solfege')).toBe('C3-B4')
    })

    it('keeps the English major and minor apart from a solfège root (not "Cmajor")', () => {
        // "Cmajor" and "Dminor" parse as chords: joined, a fretboard drew an arpeggio for a scale.
        expect(toLetters('Do major', 'solfege')).toBe('C major')
        expect(toLetters('Ré minor', 'solfege')).toBe('D minor')
        expect(toLetters('Sol Major', 'solfege')).toBe('G Major')
        expect(toLetters('Ré minor pentatonic', 'solfege')).toBe('D minor pentatonic')
        expect(toLetters('Fa# major', 'solfege')).toBe('F# major')
        expect(toLetters('Do major', 'solfege', { chord: true })).toBe('C major')
        expect(toLetters('Ré minor', 'solfege', { chord: true })).toBe('D minor')
        // Chord qualities still join.
        expect(toLetters('Ré m7 Sol 7 Do maj7 La min7', 'solfege')).toBe('Dm7 G7 Cmaj7 Amin7')
        expect(toLetters('Ré m', 'solfege', { chord: true })).toBe('Dm')
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
        expect(noteInNaming('B♭', 'german')).toBe('B')
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
        // Signs as written: German keeps ♯ and ♭.
        expect(chordInNaming('F♯m', 'german')).toBe('F♯m')
        expect(chordInNaming('E♭m', 'german')).toBe('E♭m')
    })

    it('rewrites the chords and notes in a generated text, and leaves the rest', () => {
        expect(shownText('Fretboard: A minor pentatonic', 'solfege')).toBe(
            'Fretboard: La minor pentatonic'
        )
        expect(shownText('Keyboard: Cmaj7, left hand: C3, right hand: E4 G4', 'solfege')).toBe(
            'Keyboard: Do maj7, left hand: Do3, right hand: Mi4 Sol4'
        )
        expect(shownText('B major scale, capo 2', 'german')).toBe('H major scale, capo 2')
        expect(shownText('Capo 3', 'solfege')).toBe('Capo 3')
        expect(shownText('3 2 1', 'solfege')).toBe('3 2 1')
        expect(shownText('Fretboard: A minor', 'letters')).toBe('Fretboard: A minor')
        // 5, 6, 7 and 9 after a letter make a chord, other digits an octave; a run of notes
        // with octaves keeps its octaves.
        expect(shownText('G7 chord diagram', 'solfege')).toBe('Sol 7 chord diagram')
        expect(shownText('C6, A9, E5', 'solfege')).toBe('Do 6, La 9, Mi 5')
        expect(shownText('Keyboard: C5 E5 G5', 'solfege')).toBe('Keyboard: Do5 Mi5 Sol5')
        expect(shownText('C3 B4 D8', 'german')).toBe('C3 H4 D8')
        // CAGED shapes keep their letters.
        expect(shownText('G major, E shape', 'solfege')).toBe('Sol major, E shape')
        // Two chords of one cell, and the signs as written.
        expect(shownText('D♯m/E♭m', 'solfege')).toBe('Ré♯ m/Mi♭ m')
        expect(shownText('F♯ or G♭', 'german')).toBe('F♯ or G♭')
    })

    it('never rewrites a title written by hand, even inside a longer name', () => {
        withNaming(
            'solfege',
            () => {
                expect(shown('A Day in the Life')).toBe('A Day in the Life')
                expect(shown('Gamme de Do majeur, left hand')).toBe('Gamme de Do majeur, left hand')
                expect(shown('Fretboard: A minor')).toBe('Fretboard: La minor')
            },
            ['A Day in the Life', 'Gamme de Do majeur']
        )
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
    it("takes the block's naming line out and reads the keys that hold notes", () => {
        const read = lettersInBlock(
            'fretboard',
            'La mineur pentatonic\nnaming: solfege\ntitle: La belle\nroot: Do'
        )
        expect(read.text).toBe('A minor pentatonic\ntitle: La belle\nroot: C')
        expect(read.naming).toBe('solfege')
        expect(read.titles).toEqual(['La belle'])
        expect(lettersInBlock('chord', 'naming: german\nH7').text).toBe('B7')
        expect(lettersInBlock('chord', 'naming: german\nB7').text).toBe('Bb7')
        expect(lettersInBlock('chord', 'B7')).toMatchObject({ text: 'B7', naming: null })
        expect(lettersInBlock('keyboard', 'notes: Do4 Mi4 Sol4\nrange: Do4-Si4').text).toBe(
            'notes: C4 E4 G4\nrange: C4-B4'
        )
    })

    it('reads a solfège scale with major or minor as a scale (#12 review, 0.16.0 defect)', () => {
        expect(lettersInBlock('fretboard', 'naming: solfege\nDo major').text).toBe('C major')
        expect(lettersInBlock('fretboard', 'naming: solfege\nscale: Ré minor').text).toBe(
            'scale: D minor'
        )
        expect(lettersInBlock('keyboard', 'naming: solfege\nscale: Do major pentatonic').text).toBe(
            'scale: C major pentatonic'
        )
        expect(lettersInBlock('chord', 'naming: solfege\nchord: Do major').text).toBe(
            'chord: C major'
        )
    })

    it('reads every key that holds notes', () => {
        for (const key of ['symbol', 'name', 'from', 'to', 'modes', 'scales-for-notes', 'sounds'])
            expect(lettersInBlock('chord', `naming: german\n${key}: B`).text).toBe(`${key}: Bb`)
        expect(lettersInBlock('chord', 'from: Do x32010\nto: Lam').text).toBe(
            'from: Do x32010\nto: Am'
        )
    })

    it('reads H only where it was an error before, unless the block names its naming', () => {
        // A key value: H was an error.
        expect(lettersInBlock('keyboard', 'chord: H7').text).toBe('chord: B7')
        // A shorthand line or a progression keeps H as written, as before.
        expect(lettersInBlock('chord', 'H x24442').text).toBe('H x24442')
        expect(lettersInBlock('progression', 'H E').text).toBe('H E')
        expect(lettersInBlock('progression', 'naming: german\nH E').text).toBe('B E')
    })

    it('reads tunings, compact ones too', () => {
        expect(lettersInBlock('fretboard', 'naming: german\ntuning: E A D G H E').text).toBe(
            'tuning: E A D G B E'
        )
        expect(lettersInBlock('fretboard', 'naming: german\ntuning: EADGHE').text).toBe(
            'tuning: E A D G B E'
        )
        expect(lettersInBlock('fretboard', 'naming: german\ntuning: EADGBE').text).toBe(
            'tuning: E A D G Bb E'
        )
        expect(lettersInBlock('fretboard', 'tuning: EADGBE').text).toBe('tuning: EADGBE')
    })

    it('reads progression lines, circle keys, strum chord changes; never patterns', () => {
        expect(lettersInBlock('progression', 'key: Sol\nSol Rém Do').text).toBe('key: G\nG Dm C')
        expect(lettersInBlock('circle', 'Sol').text).toBe('G')
        expect(lettersInBlock('strum', 'chord: Rém\nD DU UDU').text).toBe('chord: Dm\nD DU UDU')
        expect(lettersInBlock('strum', '[Sol]D D U [Rém]D').text).toBe('[G]D D U [Dm]D')
        // Among other solfège names, Do is C.
        expect(lettersInBlock('picking', 'chords: Do Sol\np i m a').text).toBe(
            'chords: C G\np i m a'
        )
    })

    it('reads a chart only when it names its naming, never its lyrics', () => {
        const chart = '[Sol]La vie [Rém]est belle [Solo] [sim.] [Do7] [H7]'
        expect(lettersInBlock('chords', chart)).toMatchObject({ text: chart, naming: null })
        const read = lettersInBlock('chords', `{naming: solfege}\n{key: La mineur}\n${chart}`)
        expect(read.naming).toBe('solfege')
        expect(read.text).toBe('{key: A minor}\n[G]La vie [Dm]est belle [Solo] [sim.] [C7] [B7]')
    })

    it('keeps a wrong chart naming as a warning, and the chart as it is', () => {
        const read = lettersInBlock('chords', '{naming: french}\n[Sol]x')
        expect(read.naming).toBeNull()
        expect(read.text).toBe('[Sol]x')
        expect(read.warning).toBe(
            'naming: write {naming: letters}, {naming: solfege} or {naming: german}'
        )
    })

    it('records what it read, to quote the user in messages', () => {
        const read = lettersInBlock('keyboard', 'naming: german\nkey: H dorian\nchord: Rém')
        expect(read.changes).toContainEqual(['H dorian', 'B dorian'])
        expect(read.changes).toContainEqual(['Rém', 'Dm'])
    })

    it('says what to write for a wrong naming', () => {
        expect(() => lettersInBlock('chord', 'naming: french\nC')).toThrow(
            'naming: write letters, solfege or german'
        )
    })
})
