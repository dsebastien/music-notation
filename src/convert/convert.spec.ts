import { describe, expect, it } from 'bun:test'
import { textTabToAlphaTex } from './text-tab.js'
import { chordSheetToChordPro } from './chord-sheet.js'

const six = (lines: string[]) => lines.join('\n')

describe('textTabToAlphaTex, edge cases', () => {
    it('keeps a fret written right-aligned under a two-digit one', () => {
        expect(
            textTabToAlphaTex(
                six(['e|--12--|', 'B|---3--|', 'G|------|', 'D|------|', 'A|------|', 'E|------|'])
            )
        ).toBe(':8 (12.1 3.2)')
    })

    it('reads repeat signs as bar lines', () => {
        expect(
            textTabToAlphaTex(
                six([
                    'e|:--0--:|',
                    'B|:-----:|',
                    'G|:-----:|',
                    'D|:-----:|',
                    'A|:-----:|',
                    'E|:-----:|'
                ])
            )
        ).toBe(':8 0.1')
    })

    it('tunes basses and 7-string guitars', () => {
        expect(textTabToAlphaTex('G|--5--|\nD|--5--|\nA|-----|\nE|--3--|')).toContain(
            '\\tuning (G2 D2 A1 E1)'
        )
        expect(textTabToAlphaTex('|--5--|\n|--5--|\n|-----|\n|--3--|')).toContain(
            '\\tuning (G2 D2 A1 E1)'
        )
        expect(
            textTabToAlphaTex(
                ['|--5--|', '|-----|', '|-----|', '|-----|', '|-----|', '|-----|', '|--3--|'].join(
                    '\n'
                )
            )
        ).toContain('\\tuning (E4 B3 G3 D3 A2 E2 B1)')
    })

    it('keeps two systems apart when a line of dashes separates them', () => {
        const tab = [
            ...['e|--0--|', 'B|-----|', 'G|-----|', 'D|-----|', 'A|-----|', 'E|-----|'],
            '-------------------',
            ...['e|--3--|', 'B|-----|', 'G|-----|', 'D|-----|', 'A|-----|', 'E|-----|']
        ].join('\n')
        expect(textTabToAlphaTex(tab)).toBe(':8 0.1 |\n3.1')
    })
})

describe('chordSheetToChordPro, edge cases', () => {
    it('reads a labelled line of chords as a section with its chords', () => {
        expect(chordSheetToChordPro('Intro: G D Em C')).toBe('{comment: Intro}\n[G] [D] [Em] [C]')
    })

    it('skips bar lines, repeats, counts and "no chord" between chords', () => {
        expect(chordSheetToChordPro('|: G D :| 2x')).toBe('[G] [D]')
        expect(chordSheetToChordPro('G  N.C.  D')).toBe('[G] [D]')
    })

    it("keeps the lyrics' own brackets from reading as chords", () => {
        expect(chordSheetToChordPro('G\nHello [whisper]')).toBe('[G]Hello (whisper)')
    })
})
