/** Piano voicings of chord symbols, shared by `chord` blocks and chord charts. */
import { orFail } from '../blocks/note-set-field.js'
import { chordNoteSet, type NoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'

/** Piano voicing of a chord: root position from octave 4, a slash chord's bass in octave 3. */
export function pianoPitches(symbol: string): NoteSet {
    const set = orFail(chordNoteSet(symbol), `Unknown chord "${symbol}"`)
    const bassName = splitChordSymbol(symbol)?.bass
    const bass = bassName ? chromaOf(bassName) : null
    const pitches: number[] = []
    let previous = 59
    for (const member of set.members) {
        // A bass outside the chord only sounds below it.
        if (bass !== null && member.chroma === bass && member.degree === null) continue
        let midi = 60 + member.chroma
        while (midi <= previous) midi += 12
        while (midi - 12 > previous) midi -= 12
        pitches.push(midi)
        previous = midi
    }
    if (bass !== null) pitches.unshift(48 + bass)
    return { ...set, pitches }
}
