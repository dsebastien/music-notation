import { describe, expect, it } from 'bun:test'
import { chordNoteSet, listNoteSet } from '../theory/note-set.js'
import { chordVoicingIn } from './play-voicing.js'

const voicing = (symbol: string, from = 60, to = 83) =>
    chordVoicingIn(chordNoteSet(symbol)!, from, to)

describe('chordVoicingIn (#61)', () => {
    it('plays root position from the lowest root drawn', () => {
        // C4–B5: G4 B4 D5 F5, not the 8 lit keys from D4.
        expect(voicing('G7')).toEqual([67, 71, 74, 77])
        expect(voicing('C')).toEqual([60, 64, 67])
        // The 9th sits above the 7th.
        expect(voicing('C9')).toEqual([60, 64, 67, 70, 74])
        expect(voicing('Am')).toEqual([69, 72, 76])
    })

    it('keeps every note on a drawn key: a note past the last key goes an octave down', () => {
        // One octave, C4–B4: G4 B4, then D and F fall to D4 and F4.
        expect(voicing('G7', 60, 71)).toEqual([62, 65, 67, 71])
    })

    it('puts the bass of a slash chord at the bottom, the other notes close above it', () => {
        expect(voicing('C/E')).toEqual([64, 67, 72])
        expect(voicing('C/Bb')).toEqual([70, 72, 76, 79])
    })

    it('leaves exact pitches, lists without a root and ranges without a root key alone', () => {
        const exact = chordNoteSet('C')!
        exact.pitches = [48, 60, 64, 67]
        expect(chordVoicingIn(exact, 48, 71)).toBeNull()
        expect(chordVoicingIn(listNoteSet('C E G')!, 60, 83)).toBeNull()
        expect(voicing('G7', 60, 66)).toBeNull()
    })
})
