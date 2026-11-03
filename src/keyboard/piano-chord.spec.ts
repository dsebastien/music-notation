import { describe, expect, it } from 'bun:test'
import { pianoOptionsOf, pianoPitches, pianoVoicing, triadFingering } from './piano-chord.js'
import { midiOf, noteOf } from '../theory/pitch.js'
import { renderBlock } from '../render/render-block.js'
import { attachPlayback } from '../playback/controls.js'
import { accessibleName } from '../render/dom.js'

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
        // R-7: the seventh right above the root, the third a tenth above it.
        expect(voiced('Dm7', { voicing: 'shell', shell: 'R-7', octave: 3 })).toBe('D3 C4 F4')
        expect(voiced('G7', { voicing: 'shell', shell: 'R-3', octave: 3 })).toBe('G3 B3 F4')
        expect(() => pianoVoicing('Cmaj7', { voicing: 'shell', inversion: 1 })).toThrow(
            'inversion goes with close or open voicings, not shell'
        )
    })

    it('voices a ii-V-I with rootless A and B forms, in the comping range', () => {
        // Dm7 (A) F A C E, G7 (B) F A B E, Cmaj7 (A) E G B D: the textbook ii-V-I in C, the lowest
        // note in octave 3 by default, so every voicing stays between C3 and C5.
        expect(voiced('Dm7', { voicing: 'rootless' })).toBe('F3 A3 C4 E4')
        expect(voiced('G7', { voicing: 'rootless', rootless: 'B' })).toBe('F3 A3 B3 E4')
        expect(voiced('Cmaj7', { voicing: 'rootless', rootless: 'A' })).toBe('E3 G3 B3 D4')
        expect(voiced('Cm7', { voicing: 'rootless', rootless: 'B' }, true)).toBe('Bb3 D4 Eb4 G4')
        expect(voiced('Cmaj7', { voicing: 'rootless', octave: 4 })).toBe('E4 G4 B4 D5')
        // And the other way: Dm7 (B) C E F A, G7 (A) B E F A, Cmaj7 (B) B D E G.
        expect(voiced('Dm7', { voicing: 'rootless', rootless: 'B', octave: 4 })).toBe('C4 E4 F4 A4')
        expect(voiced('G7', { voicing: 'rootless', rootless: 'A', octave: 3 })).toBe('B3 E4 F4 A4')
        expect(voiced('Cmaj7', { voicing: 'rootless', rootless: 'B', octave: 3 })).toBe(
            'B3 D4 E4 G4'
        )
        // Altered dominants keep their alterations; sixth chords use the sixth as the seventh.
        expect(voiced('G7b9', { voicing: 'rootless', rootless: 'B' }, true)).toBe('F3 Ab3 B3 E4')
        expect(voiced('C6', { voicing: 'rootless' })).toBe('E3 G3 A3 D4')
        // Half-diminished: b3 b5 b7 9 (the natural 9th, locrian #2), or b7 9 b3 b5.
        expect(voiced('Dm7b5', { voicing: 'rootless' }, true)).toBe('F3 Ab3 C4 E4')
        expect(voiced('Dm7b5', { voicing: 'rootless', rootless: 'B' }, true)).toBe('C3 E3 F3 Ab3')
        expect(() => pianoVoicing('Cdim7', { voicing: 'rootless' })).toThrow(
            'Rootless voicings are for major, minor, dominant (sus4 too) and half-diminished'
        )
        // Dominant sus chords: the 4th for the 3rd, the 5th kept (the 13th when named).
        // A form C3 D3 F3 A3 would put a second under Eb3: the B form plays (low interval
        // limits), unless the octave is given.
        expect(voiced('G7sus4', { voicing: 'rootless' })).toBe('F3 A3 C4 D4')
        expect(voiced('G7sus4', { voicing: 'rootless', rootless: 'A' })).toBe('F3 A3 C4 D4')
        expect(voiced('G7sus4', { voicing: 'rootless', octave: 3 })).toBe('C3 D3 F3 A3')
        expect(voiced('A7sus4', { voicing: 'rootless' })).toBe('G3 B3 D4 E4')
        expect(voiced('G7sus4', { voicing: 'rootless', rootless: 'B' })).toBe('F3 A3 C4 D4')
        expect(voiced('G13sus4', { voicing: 'rootless', rootless: 'B' })).toBe('F3 A3 C4 E4')
        // Shells take the sus note for the third: R 4 7.
        expect(voiced('G7sus4', { voicing: 'shell' })).toBe('G4 C5 F5')
        // A triad is voiced as its 6/9 chord, the tonic jazz pianists play: C (A) E G A D.
        expect(voiced('C', { voicing: 'rootless' })).toBe('E3 G3 A3 D4')
        expect(voiced('C', { voicing: 'rootless', rootless: 'B' })).toBe('A3 D4 E4 G4')
        expect(voiced('Cm', { voicing: 'rootless' }, true)).toBe('Eb3 G3 A3 D4')
        expect(() => pianoVoicing('Cdim', { voicing: 'rootless' })).toThrow('not Cdim')
    })

    it('voices rootless dominants and half-diminished chords in their key', () => {
        const cMinor = [0, 2, 3, 5, 7, 8, 10]
        const aMinor = [9, 11, 0, 2, 4, 5, 7]
        const ebMajor = [3, 5, 7, 8, 10, 0, 2]
        // G7 in C minor: b9 and b13 (B form F Ab B Eb); E7 in A minor, C7 in Eb (9, b13).
        expect(voiced('G7', { voicing: 'rootless', rootless: 'B', key: cMinor }, true)).toBe(
            'F3 Ab3 B3 Eb4'
        )
        expect(voiced('E7', { voicing: 'rootless', rootless: 'B', key: aMinor })).toBe(
            'D3 F3 G#3 C4'
        )
        expect(voiced('C7', { voicing: 'rootless', key: ebMajor }, true)).toBe('E3 Ab3 Bb3 D4')
        // The half-diminished 9th from the key: Bm7b5 in A minor is D F A C.
        expect(voiced('Bm7b5', { voicing: 'rootless', key: aMinor })).toBe('D3 F3 A3 C4')
        // A named alteration stays; other chords keep the natural 9th.
        expect(voiced('G7#9', { voicing: 'rootless', key: cMinor })).toBe('B3 D#4 F4 A#4')
        expect(voiced('Dm7', { voicing: 'rootless', key: [0, 2, 4, 5, 7, 9, 11] })).toBe(
            'F3 A3 C4 E4'
        )
        // A dominant going to a minor chord a fifth below takes the b13, in any key.
        expect(voiced('G7', { voicing: 'rootless', resolvesTo: 'Cm' }, true)).toBe('B3 Eb4 F4 A4')
        expect(voiced('G7', { voicing: 'rootless', resolvesTo: 'C' })).toBe('B3 E4 F4 A4')
        expect(voiced('G7', { voicing: 'rootless', resolvesTo: 'Am' })).toBe('B3 E4 F4 A4')
        // Read from a chord block's keys.
        expect(pianoOptionsOf((k) => ({ 'key': 'C minor', 'resolves-to': 'Cm7' })[k])).toEqual({
            key: [0, 2, 3, 5, 7, 8, 10],
            resolvesTo: 'Cm7'
        })
        expect(() => pianoOptionsOf((k) => (k === 'key' ? 'H' : undefined))).toThrow(
            'Unknown key "H"'
        )
    })

    it('splits the hands: the bass in the left hand', () => {
        // A left-hand root under a right-hand triad: the root is doubled, as pianists play it.
        const root = pianoVoicing('C', { hands: 'left+right' })!
        expect(names(root.left)).toBe('C3')
        expect(names(root.right)).toBe('C4 E4 G4')
        // An inversion's note goes to the left hand; a triad stays whole in the right hand, in
        // root position, as method books write it (C/E: E3 + C4 E4 G4).
        const both = pianoVoicing('C', { hands: 'left+right', inversion: 1 })!
        expect(names(both.left)).toBe('E3')
        expect(names(both.right)).toBe('C4 E4 G4')
        expect(names(both.pitches)).toBe('E3 C4 E4 G4')
        // A seventh chord with its third in the bass doesn't double it: C7/E is E3 + C4 G4 Bb4.
        expect(names(pianoVoicing('C7/E', { hands: 'left+right' })!.pitches, true)).toBe(
            'E3 C4 G4 Bb4'
        )
        // A fifth in the bass is doubled (a 6/4 chord doubles its bass).
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
        expect(names(rootless.pitches)).toBe('G2 F3 A3 B3 E4')
        // The right hand clear of the left hand's root, from F3 up: C7 A (E3) takes the B form.
        const c7 = pianoVoicing('C7', { hands: 'left+right', voicing: 'rootless', rootless: 'A' })!
        expect(names(c7.pitches, true)).toBe('C2 Bb3 D4 E4 A4')
    })

    it('does not double the bass in the right hand (#63)', () => {
        // Shell and open voicings leave the root to the left hand.
        const shell = pianoVoicing('Cmaj7', { hands: 'left+right', voicing: 'shell' })!
        expect(names(shell.pitches)).toBe('C3 E4 B4')
        const open = pianoVoicing('C', { hands: 'left+right', voicing: 'open' })!
        expect(names(open.pitches)).toBe('C3 G4 E5')
        // A slash chord's third or seventh in the bass, with or without hands.
        expect(names(pianoVoicing('D/F#', { hands: 'left+right' })!.pitches)).toBe('F#3 D4 F#4 A4')
        expect(names(pianoVoicing('D/F#')!.pitches)).toBe('F#3 D4 A4')
        expect(voiced('D/F#')).toBe('F#3 D4 A4')
        expect(voiced('C/Bb', {}, true)).toBe('Bb3 C4 E4 G4')
        expect(voiced('C7/Bb', {}, true)).toBe('Bb3 C4 E4 G4')
        expect(names(pianoVoicing('C', { hands: 'left', inversion: 1 })!.left)).toBe('E3 G3 C4')
        expect(names(pianoVoicing('D/F#', { hands: 'left' })!.left)).toBe('F#2 D3 A3')
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
        expect(fingers({ hands: 'left+right' })).toBe('5 1 3 5')
        expect(fingers({ hands: 'left+right', inversion: 2 })).toBe('5 1 3 5')
        // The bass is the third: the right hand still plays the triad, 1 3 5.
        expect(fingers({ hands: 'left+right' }, 'D/F#')).toBe('5 1 3 5')
        expect(fingers({ hands: 'left+right', inversion: 1 })).toBe('5 1 3 5')
        expect(triadFingering(pianoVoicing('Cmaj9')!)).toBeNull()
        expect(triadFingering(pianoVoicing('C', { voicing: 'open' })!)).toBeNull()
        expect(triadFingering(pianoVoicing('C/G')!)).toBeNull()
    })

    it('fingers close seventh chords and their inversions by their spacing', () => {
        const fingers = (symbol: string, options: object = {}) => {
            const voicing = pianoVoicing(symbol, options)!
            const map = triadFingering(voicing)!
            return [...map]
                .sort(([a], [b]) => a - b)
                .map(([p, f]) => `${noteOf(p, true)}:${f}`)
                .join(' ')
        }
        const both = (inversion: number) => ({ hands: 'left+right', inversion })
        // Both hands: the bass 5; the right hand keeps a root or fifth bass, not a third or
        // seventh. Root and second inversion 1 2 3 5; first inversion (a fourth: G Bb C) 1 3 4;
        // third inversion (a triad left: C E G) 1 3 5.
        expect(fingers('C7', both(0))).toBe('C3:5 C4:1 E4:2 G4:3 Bb4:5')
        expect(fingers('C7', both(1))).toBe('E3:5 G4:1 Bb4:3 C5:4')
        expect(fingers('C7', both(2))).toBe('G3:5 G4:1 Bb4:2 C5:3 E5:5')
        expect(fingers('C7', both(3))).toBe('Bb3:5 C5:1 E5:3 G5:5')
        expect(fingers('Cmaj7', both(0))).toBe('C3:5 C4:1 E4:2 G4:3 B4:5')
        expect(fingers('Cmaj7', both(1))).toBe('E3:5 G4:1 B4:3 C5:4')
        expect(fingers('Cmaj7', both(2))).toBe('G3:5 G4:1 B4:2 C5:3 E5:5')
        expect(fingers('Cmaj7', both(3))).toBe('B3:5 C5:1 E5:3 G5:5')
        // A slash bass: C7/E leaves C G Bb, a fifth then a third (1 3 5).
        expect(fingers('C7/E', { hands: 'left+right' })).toBe('E3:5 C4:1 G4:3 Bb4:5')
        expect(fingers('C7/Bb', { hands: 'left+right' })).toBe('Bb3:5 C4:1 E4:3 G4:5')
        // The right hand alone: a second on top takes 4 5 (E G Bb C: 1 2 4 5), else 1 2 3 5.
        expect(fingers('C7')).toBe('C4:1 E4:2 G4:3 Bb4:5')
        expect(fingers('C7', { inversion: 1 })).toBe('E4:1 G4:2 Bb4:4 C5:5')
        expect(fingers('C7', { inversion: 2 })).toBe('G4:1 Bb4:2 C5:3 E5:5')
        expect(fingers('C7', { inversion: 3 })).toBe('Bb4:1 C5:2 E5:3 G5:5')
        expect(fingers('C6')).toBe('C4:1 E4:2 G4:4 A4:5')
        // The left hand alone mirrors it: 5 3 2 1, a second at the bottom 5 4 2 1.
        expect(fingers('C7', { hands: 'left' })).toBe('C3:5 E3:3 G3:2 Bb3:1')
        expect(fingers('C7', { hands: 'left', inversion: 1 })).toBe('E3:5 G3:3 Bb3:2 C4:1')
        expect(fingers('C7', { hands: 'left', inversion: 2 })).toBe('G3:5 Bb3:3 C4:2 E4:1')
        expect(fingers('C7', { hands: 'left', inversion: 3 })).toBe('Bb3:5 C4:4 E4:2 G4:1')
        // A slash bass without hands has no finger to give.
        expect(triadFingering(pianoVoicing('C7/E')!)).toBeNull()
    })

    it('fingers rootless and shell voicings', () => {
        const fingers = (symbol: string, options: object) => {
            const map = triadFingering(pianoVoicing(symbol, options)!)
            return map
                ? [...map]
                      .sort(([a], [b]) => a - b)
                      .map(([p, f]) => `${noteOf(p, true)}:${f}`)
                      .join(' ')
                : null
        }
        // Rootless voicings sit below middle C: the left hand, 5 3 2 1 (5 4 2 1 over a second).
        expect(fingers('Dm7', { voicing: 'rootless' })).toBe('F3:5 A3:3 C4:2 E4:1')
        expect(fingers('G7', { voicing: 'rootless', rootless: 'B' })).toBe('F3:5 A3:3 B3:2 E4:1')
        expect(fingers('G7sus4', { voicing: 'rootless', octave: 3 })).toBe('C3:5 D3:4 F3:2 A3:1')
        // The right hand above middle C, or when asked.
        expect(fingers('Dm7', { voicing: 'rootless', octave: 4 })).toBe('F4:1 A4:2 C5:3 E5:5')
        expect(fingers('Dm7', { voicing: 'rootless', hands: 'right' })).toBe('F3:1 A3:2 C4:3 E4:5')
        // Both hands: the root 5, the right hand by its spacing.
        expect(fingers('C7', { voicing: 'rootless', hands: 'left+right', octave: 3 })).toBe(
            'C2:5 E3:1 A3:2 Bb3:3 D4:5'
        )
        // Shells: R-3 in one hand (5 3 1 left, 1 2 5 right), two notes over a left-hand root.
        expect(fingers('Cmaj7', { voicing: 'shell', octave: 3 })).toBe('C3:5 E3:3 B3:1')
        expect(fingers('Cmaj7', { voicing: 'shell' })).toBe('C4:1 E4:2 B4:5')
        expect(fingers('Cmaj7', { voicing: 'shell', hands: 'left+right' })).toBe('C3:5 E4:1 B4:5')
        // A shell R-7 spans a tenth: no hand reaches it.
        expect(fingers('Cmaj7', { voicing: 'shell', shell: 'R-7' })).toBeNull()
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
        expect(read({ voicing: 'shell R-7' })).toEqual({ voicing: 'shell', shell: 'R-7' })
        expect(read({ voicing: 'Shell r3' })).toEqual({ voicing: 'shell', shell: 'R-3' })
        expect(() => read({ voicing: 'shell b' })).toThrow('voicing: use close')
        expect(() => read({ voicing: 'rootless R-7' })).toThrow('voicing: use close')
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
        // Titled with its slash name.
        expect(h.querySelector('.mn-title')?.textContent).toBe('C/E')
        const second = host()
        renderBlock('chord', 'Bb\ninstrument: piano\ninversion: 2', second)
        expect(second.querySelector('.mn-title')?.textContent).toBe('Bb/F')
        const titled = host()
        renderBlock('chord', 'C\ninstrument: piano\ninversion: 1\ntitle: Mine', titled)
        expect(titled.querySelector('.mn-title')?.textContent).toBe('Mine')
        const shell = host()
        renderBlock('chord', 'Cmaj7\ninstrument: piano\nvoicing: shell\noctave: 3', shell)
        expect(keys(shell)).toBe('C3 E3 B3')
        const rootless = host()
        renderBlock('chord', 'G7\ninstrument: piano\nvoicing: rootless B', rootless)
        expect(keys(rootless)).toBe('F3 A3 B3 E4')
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
            renderBlock('chord', 'C\ninstrument: piano\nhands: left+right\ninversion: 2', h).error
        ).toBeNull()
        const svg = h.querySelector('svg')!
        // One mark per hand, LH and RH (never R, which reads as a root), with a bracket each.
        const marks = [...svg.querySelectorAll('.mn-key-hand')].map((el) => [
            el.getAttribute('data-mn-keys'),
            el.textContent
        ])
        expect(marks).toEqual([
            ['55', 'LH'],
            ['60 64 67', 'RH']
        ])
        expect(svg.querySelectorAll('.mn-hand-bracket')).toHaveLength(2)
        // A bass right under the chord: the two labels stay apart.
        const close = host()
        renderBlock('chord', 'instrument: piano\npitches: B3 C4 E4 G4\nhands: left+right', close)
        const xs = [...close.querySelectorAll('.mn-key-hand')].map((el) =>
            Number(el.getAttribute('x'))
        )
        expect(xs[1]! - xs[0]!).toBeGreaterThanOrEqual(26)
        expect(svg.querySelector('[data-midi="55"]')?.getAttribute('class')).toContain(
            'mn-hand-left'
        )
        expect(accessibleName(svg)).toBe('C/G, left hand: G3, right hand: C4 E4 G4')
    })

    it('fingers triads with fingering: auto', () => {
        const h = host()
        renderBlock('chord', 'G\ninstrument: piano\ninversion: 2\nfingering: auto', h)
        const fingers = [...h.querySelectorAll('.mn-key-label')].map((el) => el.textContent)
        expect(fingers).toEqual(['1', '3', '5'])
        expect(renderBlock('chord', 'G9\ninstrument: piano\nfingering: auto', host()).error).toBe(
            'fingering: auto covers triads and four-note chords (sevenths, sixths) in close position, and rootless and shell voicings one hand can reach: write the fingers, e.g. fingering: 1 2 3 4 5'
        )
        // Both hands with the third in the bass: the right hand's notes get fingers too.
        const both = (source: string) => {
            const el = host()
            expect(renderBlock('chord', source, el).error).toBeNull()
            return [...el.querySelectorAll('.mn-key-label')]
                .sort((a, b) => +a.getAttribute('x')! - +b.getAttribute('x')!)
                .map((l) => l.textContent)
        }
        // A seventh chord with its third in the bass: E3 5, then G4 Bb4 C5 1 3 4.
        expect(
            both('C7\ninstrument: piano\ninversion: 1\nhands: left+right\nfingering: auto')
        ).toEqual(['5', '1', '3', '4'])
        expect(
            both('C\ninstrument: piano\ninversion: 1\nhands: left+right\nfingering: auto')
        ).toEqual(['5', '1', '3', '5'])
        expect(both('D/F#\ninstrument: piano\nhands: left+right\nfingering: auto')).toEqual([
            '5',
            '1',
            '3',
            '5'
        ])
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
