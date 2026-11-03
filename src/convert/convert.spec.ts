import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
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

/** The score alphaTab reads from the tex (throws on alphaTex errors). */
const load = (tex: string) => alphaTab.importer.ScoreLoader.loadAlphaTex(tex)

/** Layouts found on the web (#37), as pasted. */
const SAMPLES = {
    rockBeat: [
        'Rock beat',
        '',
        'C |x---------------|----------------|',
        'HH|--x-x-x-x-x-x-x-|x-x-x-x-x-x-o-x-|',
        'S |----o-------o---|----o-------o-g-|',
        'B |o-------o-o-----|o-------o-o-----|',
        '   1 + 2 + 3 + 4 +   1 + 2 + 3 + 4 +'
    ].join('\n'),
    drumWords: [
        'Crash  |X---------------|',
        'Hi-Hat |--x-x-x-x-x-x-x-|',
        'Snare  |----o-------f---|',
        'Tom 1  |------------oo--|',
        'Floor  |--------------oo|',
        'Bass   |o-------o-o-----|'
    ].join('\n'),
    blank: [
        'e|----------------|----------------|',
        'B|----------------|----------------|',
        'G|----------------|----------------|',
        'D|----------------|----------------|',
        'A|----------------|----------------|',
        'E|----------------|----------------|'
    ].join('\n'),
    numbered: [
        '1|-----0-----|',
        '2|---1---1---|',
        '3|-0-------0-|',
        '4|2----------|',
        '5|-----------|',
        '6|-----------|'
    ].join('\n'),
    threeStrings: ['e|--5--8--5----|', 'B|--------8--5-|', 'G|-------------|'].join('\n'),
    topFour: ['e|-------5-----|', 'B|-----5---5---|', 'G|---5-------5-|', 'D|-7-----------|'].join(
        '\n'
    ),
    letRing: [
        'e|--0-----| let ring',
        'B|--1-----|',
        'G|--0-----|',
        'D|--2-----|',
        'A|--3-----|',
        'E|--------|'
    ].join('\n'),
    riff: 'A|--0--3--5--| x2'
}

describe('textTabToAlphaTex, layouts from the web (#37)', () => {
    it('reads a drum tab as a percussion track', () => {
        const tex = textTabToAlphaTex(SAMPLES.rockBeat)!
        expect(tex).toBe(
            [
                '\\instrument percussion',
                '\\articulation defaults',
                ':8 (CrashHighHit KickHit) HiHatClosed (HiHatClosed SnareHit) HiHatClosed (HiHatClosed KickHit) (HiHatClosed KickHit) (HiHatClosed SnareHit) HiHatClosed |',
                '(HiHatClosed KickHit) HiHatClosed (HiHatClosed SnareHit) HiHatClosed (HiHatClosed KickHit) (HiHatClosed KickHit) (HiHatOpen SnareHit) (HiHatClosed SnareHit{g})'
            ].join('\n')
        )
        const score = load(tex)
        const track = score.tracks[0]!
        expect(track.isPercussion).toBe(true)
        expect(track.staves[0]!.bars).toHaveLength(2)
        // General MIDI: crash 49, kick 35, closed hi-hat 42, snare 38, open hi-hat 46.
        expect(track.percussionArticulations.map((a) => a.outputMidiNumber)).toEqual([
            49, 35, 42, 38, 46
        ])
    })

    it('reads drum names in words, accents, flams and toms', () => {
        const tex = textTabToAlphaTex(SAMPLES.drumWords)!
        expect(tex).toContain(':8 (CrashHighHit{ac} KickHit) HiHatClosed')
        expect(tex).toContain('(HiHatClosed SnareHit HighTomHit) HighTomHit')
        expect(tex).toContain('(HiHatClosed VeryLowTomHit) VeryLowTomHit')
        expect(load(tex).tracks[0]!.isPercussion).toBe(true)
        // One line is enough when it names a drum.
        expect(textTabToAlphaTex('BD|o---o---|')).toContain(':8 KickHit KickHit')
        expect(textTabToAlphaTex('Snare |----o-------o---|')).toContain(':8 SnareHit SnareHit')
    })

    it('keeps B and C lines of dashes only as strings, and reads them as drums with hits', () => {
        expect(textTabToAlphaTex('C|x---x---|\nB|o---o---|')).toContain('CrashHighHit KickHit')
        // A guitar tab with dead notes is still a guitar tab.
        expect(
            textTabToAlphaTex(
                six([
                    'e|--x--0--|',
                    'B|--x--1--|',
                    'G|--x--0--|',
                    'D|--x--2--|',
                    'A|--x--3--|',
                    'E|--------|'
                ])
            )
        ).toBe(':8 (0.1 1.2 0.3 2.4 3.5)')
    })

    it('reads a blank stave as empty bars, one whole rest each', () => {
        const tex = textTabToAlphaTex(SAMPLES.blank)!
        expect(tex).toBe(':1 r |\nr')
        expect(load(tex).tracks[0]!.staves[0]!.bars).toHaveLength(2)
        expect(textTabToAlphaTex('HH|--------|\nS |--------|')).toBe(
            '\\instrument percussion\n\\articulation defaults\n:1 r'
        )
    })

    it('keeps a bar with no notes between others as a rest bar', () => {
        const tex = textTabToAlphaTex(
            six([
                'e|--0--|-----|--3--|',
                'B|-----|-----|-----|',
                'G|-----|-----|-----|',
                'D|-----|-----|-----|',
                'A|-----|-----|-----|',
                'E|-----|-----|-----|'
            ])
        )!
        expect(tex).toBe(':8 0.1 |\n:1 r |\n:8 3.1')
        const bars = load(tex).tracks[0]!.staves[0]!.bars
        expect(bars.map((b) => b.voices[0]!.beats.map((beat) => beat.duration))).toEqual([
            [8],
            [1],
            [8]
        ])
    })

    it('reads strings numbered 1 to 6 as standard tuning', () => {
        expect(textTabToAlphaTex(SAMPLES.numbered)).toBe(':8 2.4 0.3 1.2 0.1 1.2 0.3')
        expect(textTabToAlphaTex('1|--0--|\n2|--1--|\n3|--0--|')).toBe(
            '\\tuning (E4 B3 G3)\n:8 (0.1 1.2 0.3)'
        )
        expect(textTabToAlphaTex('3|--0--|\n4|--2--|\n5|--2--|')).toContain('\\tuning (G3 D3 A2)')
    })

    it('reads short excerpts on the strings they show, in guitar octaves', () => {
        const three = textTabToAlphaTex(SAMPLES.threeStrings)!
        expect(three).toBe('\\tuning (E4 B3 G3)\n:8 5.1 8.1 (5.1 8.2) 5.2')
        expect(load(three).tracks[0]!.staves[0]!.tuning).toEqual([64, 59, 55])
        // The four highest strings: E4 B3 G3 D3, not an octave below.
        expect(textTabToAlphaTex(SAMPLES.topFour)).toBe(
            '\\tuning (E4 B3 G3 D3)\n:8 7.4 5.3 5.2 5.1 5.2 5.3'
        )
        expect(textTabToAlphaTex('A|--0--|\nE|--3--|')).toContain('\\tuning (A2 E2)')
        expect(textTabToAlphaTex('e|--0--|')).toContain('\\tuning (E4)')
        expect(textTabToAlphaTex('E|--0--|')).toContain('\\tuning (E2)')
        // Three unnamed lines: the guitar's three highest strings.
        expect(textTabToAlphaTex('|--0--|\n|--1--|\n|--0--|')).toBe(
            '\\tuning (E4 B3 G3)\n:8 (0.1 1.2 0.3)'
        )
        // Bass names, lowest first E A D G or B E A D G, are an octave below.
        expect(textTabToAlphaTex('G|--0--|\nD|-----|\nA|-----|\nE|-----|\nB|-----|')).toContain(
            '\\tuning (G2 D2 A1 E1 B0)'
        )
    })

    it('reads text after the last bar line as an annotation', () => {
        const tex = textTabToAlphaTex(SAMPLES.letRing)!
        expect(tex).toBe(':8 (0.1 1.2 0.3 2.4 3.5){txt "let ring"}')
        expect(load(tex).tracks[0]!.staves[0]!.bars[0]!.voices[0]!.beats[0]!.text).toBe('let ring')
        expect(textTabToAlphaTex(SAMPLES.riff)).toBe('\\tuning (A2)\n:8 0.1 3.1 5.1{txt "x2"}')
        expect(textTabToAlphaTex('e|------| say "hi"')).toBe(
            '\\tuning (E4)\n:1 r{txt "say \\"hi\\""}'
        )
        expect(load(textTabToAlphaTex('e|------| say "hi"')!)).toBeTruthy()
        // Frets right after the last bar line are music, not text.
        expect(textTabToAlphaTex('e|--0--|--3--')).toBe('\\tuning (E4)\n:8 0.1 |\n3.1')
    })

    it('loads every sample in alphaTab', () => {
        for (const sample of Object.values(SAMPLES)) {
            const tex = textTabToAlphaTex(sample)
            expect(tex).not.toBeNull()
            expect(load(tex!).tracks[0]!.staves[0]!.bars.length).toBeGreaterThan(0)
        }
    })

    it('splits systems written one under the other without a blank line', () => {
        const strings = ['e', 'B', 'G', 'D', 'A', 'E']
        const tab = [
            ...strings.map((n, i) => `${n}|--${i === 0 ? '0' : '-'}--|`),
            ...strings.map((n, i) => `${n}|--${i === 5 ? '3' : '-'}--|`)
        ].join('\n')
        expect(textTabToAlphaTex(tab)).toBe(':8 0.1 |\n3.6')
        // A tab naming both E strings in capitals is one system.
        expect(
            textTabToAlphaTex(
                six(['E|--0--|', 'B|-----|', 'G|-----|', 'D|-----|', 'A|-----|', 'E|--3--|'])
            )
        ).toBe(':8 (0.1 3.6)')
        expect(textTabToAlphaTex('HH|x-x-x-x-|\nB |o-------|\nHH|x-x-x-x-|\nB |----o---|')).toBe(
            [
                '\\instrument percussion',
                '\\articulation defaults',
                ':8 (HiHatClosed KickHit) HiHatClosed HiHatClosed HiHatClosed |',
                'HiHatClosed HiHatClosed (HiHatClosed KickHit) HiHatClosed'
            ].join('\n')
        )
    })

    it('reads + as a closed hi-hat, # as a choke, and skips spaces between bars', () => {
        expect(textTabToAlphaTex('HH|+-+-o-+-|\nC |#-------|')).toContain(
            ':8 (HiHatClosed CrashHighChoke) HiHatClosed HiHatOpen HiHatClosed'
        )
        expect(textTabToAlphaTex('HH|x-x-x-x-|  |x-x-x-x-|')).toContain(
            'HiHatClosed |\nHiHatClosed'
        )
    })

    it('reads flat string names (half a step down)', () => {
        expect(
            textTabToAlphaTex(
                six(['eb|--0--|', 'Bb|-----|', 'Gb|-----|', 'Db|-----|', 'Ab|-----|', 'Eb|-----|'])
            )
        ).toBe('\\tuning (D#4 A#3 F#3 C#3 G#2 D#2)\n:8 0.1')
    })

    it('ignores markdown table rules and lone unnamed lines', () => {
        expect(textTabToAlphaTex('| a | b |\n|---|---|\n| 1 | 2 |')).toBeNull()
        expect(textTabToAlphaTex('|--0--|\n|--1--|')).toBeNull()
        expect(textTabToAlphaTex('constructor|x-x-x-x-|\ntoString|o---o---|')).toBeNull()
    })

    it('reads long lines in linear time', () => {
        const start = performance.now()
        textTabToAlphaTex(`H${' '.repeat(50_000)}!\n${'e|' + '-'.repeat(50_000)} x`)
        textTabToAlphaTex(`${' '.repeat(50_000)}1${' '.repeat(50_000)}z`)
        textTabToAlphaTex(`Hi-Hat${' '.repeat(50_000)}|${'x-'.repeat(25_000)}?`)
        expect(performance.now() - start).toBeLessThan(500)
    })
})

describe('chordSheetToChordPro, edge cases', () => {
    it('reads a labelled line of chords as a section with its chords', () => {
        expect(chordSheetToChordPro('Intro: G D Em C')).toBe('{comment: Intro}\n[G] [D] [Em] [C]')
    })

    it('skips bar lines, repeats, counts and "no chord" between chords', () => {
        expect(chordSheetToChordPro('|: G D :| 2x')).toBe('[G] [D]')
        expect(chordSheetToChordPro('C7(b9) Cm(add9) Cmaj7b5')).toBe(
            '[C7(b9)] [Cm(add9)] [Cmaj7b5]'
        )
        // Commas outside parentheses: a lyric line, not chords.
        expect(chordSheetToChordPro('G, D, Em, C')).toBe('G, D, Em, C')
        expect(chordSheetToChordPro('G  N.C.  D')).toBe('[G] [D]')
    })

    it("keeps the lyrics' own brackets from reading as chords", () => {
        expect(chordSheetToChordPro('G\nHello [whisper]')).toBe('[G]Hello (whisper)')
    })
})
