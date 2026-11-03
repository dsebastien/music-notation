import { describe, expect, it } from 'bun:test'
import * as alphaTab from '@coderline/alphatab'
import {
    palmMutesOf,
    positionsOf,
    sketchRhythmOf,
    techniquesOf,
    textTabToAlphaTex
} from './text-tab.js'
import { chordSheetToChordPro } from './chord-sheet.js'

const six = (lines: string[]) => lines.join('\n')

describe('textTabToAlphaTex, edge cases', () => {
    it('keeps a fret written right-aligned under a two-digit one', () => {
        expect(
            textTabToAlphaTex(
                six(['e|--12--|', 'B|---3--|', 'G|------|', 'D|------|', 'A|------|', 'E|------|'])
            )
        ).toBe(':1 (12.1 3.2)')
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
        ).toBe(':1 0.1')
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
        expect(textTabToAlphaTex(tab)).toBe(':1 0.1 |\n3.1')
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
        // One line is enough when it names a drum (two hits in a bar: halves; the snare on 2 and 4).
        expect(textTabToAlphaTex('BD|o---o---|')).toContain(':2 KickHit KickHit')
        expect(textTabToAlphaTex('Snare |----o-------o---|')).toContain(
            ':4 r :2 SnareHit :4 SnareHit'
        )
    })

    it('keeps B and C lines of dashes only as strings, and reads them as drums with hits', () => {
        expect(textTabToAlphaTex('C|x---x---|\nB|o---o---|')).toContain('CrashHighHit KickHit')
        // A guitar tab with dead notes is still a guitar tab (#66: the dead notes are kept).
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
        ).toBe(':2 (x.1 x.2 x.3 x.4 x.5) (0.1 1.2 0.3 2.4 3.5)')
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
        expect(tex).toBe(':1 0.1 |\nr |\n3.1')
        const bars = load(tex).tracks[0]!.staves[0]!.bars
        expect(bars.map((b) => b.voices[0]!.beats.map((beat) => beat.isRest))).toEqual([
            [false],
            [true],
            [false]
        ])
    })

    it('reads strings numbered 1 to 6 as standard tuning', () => {
        expect(textTabToAlphaTex(SAMPLES.numbered)).toBe(':8 2.4 0.3 1.2 0.1 1.2 0.3 :4 r')
        expect(textTabToAlphaTex('1|--0--|\n2|--1--|\n3|--0--|')).toBe(
            '\\tuning (E4 B3 G3)\n:1 (0.1 1.2 0.3)'
        )
        expect(textTabToAlphaTex('3|--0--|\n4|--2--|\n5|--2--|')).toContain('\\tuning (G3 D3 A2)')
    })

    it('reads short excerpts on the strings they show, in guitar octaves', () => {
        const three = textTabToAlphaTex(SAMPLES.threeStrings)!
        expect(three).toBe('\\tuning (E4 B3 G3)\n:4 5.1 8.1 (5.1 8.2) 5.2')
        expect(load(three).tracks[0]!.staves[0]!.tuning).toEqual([64, 59, 55])
        // The four highest strings: E4 B3 G3 D3, not an octave below.
        expect(textTabToAlphaTex(SAMPLES.topFour)).toBe(
            '\\tuning (E4 B3 G3 D3)\n:8 7.4 5.3 5.2 5.1 5.2 5.3 :4 r'
        )
        expect(textTabToAlphaTex('A|--0--|\nE|--3--|')).toContain('\\tuning (A2 E2)')
        // One string: on a six-string guitar (alphaTab draws no staff for one string).
        expect(textTabToAlphaTex('e|--0--|')).toBe(':1 0.1')
        expect(textTabToAlphaTex('E|--0--|')).toBe(':1 0.6')
        expect(textTabToAlphaTex('C|--3--|')).toBe('\\tuning (E4 B3 G3 C3 A2 E2)\n:1 3.4')
        expect(load(textTabToAlphaTex('A|--3--|')!).tracks[0]!.staves[0]!.tuning).toHaveLength(6)
        // Three unnamed lines: the guitar's three highest strings.
        expect(textTabToAlphaTex('|--0--|\n|--1--|\n|--0--|')).toBe(
            '\\tuning (E4 B3 G3)\n:1 (0.1 1.2 0.3)'
        )
        // Bass names, lowest first E A D G or B E A D G, are an octave below.
        expect(textTabToAlphaTex('G|--0--|\nD|-----|\nA|-----|\nE|-----|\nB|-----|')).toContain(
            '\\tuning (G2 D2 A1 E1 B0)'
        )
    })

    it('reads text after the last bar line as an annotation', () => {
        const tex = textTabToAlphaTex(SAMPLES.letRing)!
        expect(tex).toBe(':1 (0.1 1.2 0.3 2.4 3.5){txt "let ring"}')
        expect(load(tex).tracks[0]!.staves[0]!.bars[0]!.voices[0]!.beats[0]!.text).toBe('let ring')
        expect(textTabToAlphaTex(SAMPLES.riff)).toBe(':4 0.5 3.5 :2 5.5{txt "x2"}')
        expect(textTabToAlphaTex('e|------| say "hi"')).toBe(':1 r{txt "say \\"hi\\""}')
        expect(load(textTabToAlphaTex('e|------| say "hi"')!)).toBeTruthy()
        // Frets right after the last bar line are music, not text.
        expect(textTabToAlphaTex('e|--0--|--3--')).toBe(':1 0.1 |\n3.1')
    })

    it('reads text with dashes or without a space as an annotation, keeping the string', () => {
        const strings = ['B|---1---|', 'G|---0---|', 'D|---2---|', 'A|---3---|', 'E|-------|']
        const chord = ':1 (0.1 1.2 0.3 2.4 3.5)'
        expect(textTabToAlphaTex(['e|---0---|  <-- let ring', ...strings].join('\n'))).toBe(
            `${chord}{txt "<-- let ring"}`
        )
        expect(
            textTabToAlphaTex(
                ['e|---0---|', ...strings.slice(0, 4), 'E|-------|  slide -- slowly'].join('\n')
            )
        ).toBe(`${chord}{txt "slide -- slowly"}`)
        expect(textTabToAlphaTex('e|--0--|-----| repeat --- 4x\nB|--1--|-----|')).toBe(
            '\\tuning (E4 B3)\n:1 (0.1 1.2) |\nr{txt "repeat --- 4x"}'
        )
        // A count right after the bar line is text, not a bar with fret 2.
        expect(textTabToAlphaTex('e|--0--|x2\nB|--1--|\nG|--0--|')).toBe(
            '\\tuning (E4 B3 G3)\n:1 (0.1 1.2 0.3){txt "x2"}'
        )
        expect(textTabToAlphaTex('e|--0--|2x\nB|--1--|\nG|--0--|')).toContain('{txt "2x"}')
        // Music after the last bar line stays music, harmonics too.
        expect(textTabToAlphaTex('e|--0--|--<12>--')).toBe(':1 0.1 |\n12.1{nh}')
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
        expect(textTabToAlphaTex(tab)).toBe(':1 0.1 |\n3.6')
        // A tab naming both E strings in capitals is one system.
        expect(
            textTabToAlphaTex(
                six(['E|--0--|', 'B|-----|', 'G|-----|', 'D|-----|', 'A|-----|', 'E|--3--|'])
            )
        ).toBe(':1 (0.1 3.6)')
        expect(textTabToAlphaTex('HH|x-x-x-x-|\nB |o-------|\nHH|x-x-x-x-|\nB |----o---|')).toBe(
            [
                '\\instrument percussion',
                '\\articulation defaults',
                ':4 (HiHatClosed KickHit) HiHatClosed HiHatClosed HiHatClosed |',
                'HiHatClosed HiHatClosed (HiHatClosed KickHit) HiHatClosed'
            ].join('\n')
        )
    })

    it('reads + as a closed hi-hat, # as a choke, and skips spaces between bars', () => {
        expect(textTabToAlphaTex('HH|+-+-o-+-|\nC |#-------|')).toContain(
            ':4 (HiHatClosed CrashHighChoke) HiHatClosed HiHatOpen HiHatClosed'
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
        ).toBe('\\tuning (D#4 A#3 F#3 C#3 G#2 D#2)\n:1 0.1')
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
        textTabToAlphaTex(`e|--0--|${' x'.repeat(50_000)}9`)
        textTabToAlphaTex(`e|--0--|${'-'.repeat(50_000)} let ring`)
        expect(performance.now() - start).toBeLessThan(500)
    })
})

/** Each bar's beats as alphaTab reads them: `4`, `8.` (dotted), `r8` (a rest), `4~` (tied). */
const rhythmOf = (tex: string) =>
    load(tex)
        .tracks[0]!.staves[0]!.bars.map((bar) =>
            bar.voices[0]!.beats.map(
                (b) =>
                    `${b.isRest ? 'r' : ''}${b.duration}${'.'.repeat(b.dots)}` +
                    (b.notes.some((n) => n.isTieDestination) ? '~' : '')
            ).join(' ')
        )
        .join(' | ')

/** The notes alphaTab reads, beat by beat. */
const notesOf = (tex: string) =>
    load(tex).tracks[0]!.staves[0]!.bars.flatMap((bar) =>
        bar.voices[0]!.beats.flatMap((b) => b.notes)
    )

/** Riffs as they're found on the web, spaced a sixteenth a column or an eighth a column. */
const RIFFS = {
    // Deep Purple, Smoke on the Water: G Bb C | G Bb Db C | G Bb C | Bb G.
    smoke: [
        'G|-0---3---5-------|-0---3---6-5-----|-0---3---5-------|-3---0-----------|',
        'D|-0---3---5-------|-0---3---6-5-----|-0---3---5-------|-3---0-----------|'
    ].join('\n'),
    smokeEighths: [
        'G|0-3-5---|0-3-65--|0-3-5---|3-0-----|',
        'D|0-3-5---|0-3-65--|0-3-5---|3-0-----|'
    ].join('\n'),
    // A metal gallop (an eighth and two sixteenths), palm-muted.
    gallop: ['  PM--------------', 'E|0-000-000-000-00|'].join('\n'),
    // Dotted eighths (3 + 3 + 2 sixteenths), twice.
    dotted: 'E|0--0--0-0--0--0-|',
    // A blues lick: bend, release, pull-off; hammer-on, pull-off, slide, vibrato.
    lick: [
        'e|-----------------|-5h7p5-----------|',
        'B|-8b10r8p5---7----|-------8-5/7~~---|',
        'G|-----------------|-----------------|'
    ].join('\n'),
    // Chords and dead strums, an eighth each.
    chug: ['G|--2-x-2-x-2-x-2-x-|', 'D|--2-x-2-x-2-x-2-x-|', 'A|--0-x-0-x-0-x-0-x-|'].join('\n')
}

describe('textTabToAlphaTex, rhythm from the spacing (#66)', () => {
    it('keeps the rhythm of Smoke on the Water, however wide the bars', () => {
        const tex = textTabToAlphaTex(RIFFS.smoke)!
        expect(tex).toBe(
            [
                '\\tuning (G3 D3)',
                ':4 (0.1 0.2) (3.1 3.2) :2 (5.1 5.2) |',
                ':4 (0.1 0.2) (3.1 3.2) :8 (6.1 6.2) :4 (5.1 5.2){d} |',
                '(0.1 0.2) (3.1 3.2) :2 (5.1 5.2) |',
                ':4 (3.1 3.2) :2 (0.1 0.2){d}'
            ].join('\n')
        )
        expect(rhythmOf(tex)).toBe('4 4 2 | 4 4 8 4. | 4 4 2 | 4 2.')
        // An eighth a column: the same rhythm, and 65 is two frets (6 then 5), not fret 65.
        expect(textTabToAlphaTex(RIFFS.smokeEighths)).toBe(tex)
    })

    it('reads sixteenths and dotted notes', () => {
        expect(rhythmOf(textTabToAlphaTex(RIFFS.gallop)!)).toBe('8 16 16 8 16 16 8 16 16 8 16 16')
        expect(rhythmOf(textTabToAlphaTex(RIFFS.dotted)!)).toBe('8. 8. 8 8. 8. 8')
        // Two open strings are two notes (00), not fret 0.
        expect(notesOf(textTabToAlphaTex('E|0---0---0-00----|')!).map((n) => n.fret)).toEqual([
            0, 0, 0, 0, 0
        ])
    })

    it('starts a bar with a rest when its first beat comes late', () => {
        expect(textTabToAlphaTex('S |----o-------o---|')).toContain(':4 r :2 SnareHit :4 SnareHit')
        expect(rhythmOf(textTabToAlphaTex('e|-0---0---|-----0---|')!)).toBe('2 2 | r2 2')
    })

    it('ties a length no note value has, and moves a pull-off to the tie', () => {
        // 5 sixteenths, 1, 10: a quarter tied to a sixteenth, a sixteenth, a half tied to an eighth.
        const tex = textTabToAlphaTex('E|0----00---------|')!
        expect(tex).toBe(':4 0.6 :16 -.6 0.6 :2 0.6 :8 -.6')
        expect(rhythmOf(tex)).toBe('4 16~ 16 2 8~')
        const pull = textTabToAlphaTex('B|-8b10r8p56------|')!
        expect(pull).toBe(':4 8.2{b (0 4 0) d} :16 -.2{h} 5.2 :2 6.2')
        expect(
            notesOf(pull).map((n) => [n.fret, n.isTieDestination, n.isHammerPullOrigin])
        ).toEqual([
            [8, false, false],
            [8, true, true],
            [5, false, false],
            [6, false, false]
        ])
    })

    it('keeps even notes even when the spacing fits no grid, eighths filling the bar', () => {
        // Evenly spaced, the bar a little short: quarters. Unevenly: eighths, then rests.
        expect(textTabToAlphaTex('e|--5--8--5--8-|')).toBe(':4 5.1 8.1 5.1 8.1')
        expect(textTabToAlphaTex(SAMPLES.numbered)).toBe(':8 2.4 0.3 1.2 0.1 1.2 0.3 :4 r')
        // Five even notes: five eighths, rests on the beats to the end of the 4/4 bar.
        expect(rhythmOf(textTabToAlphaTex('A|-0-0-0-0-0--|')!)).toBe('8 8 8 8 8 r8 r4')
        // The most frequent gap is an eighth, a gap twice as wide a quarter.
        expect(sketchRhythmOf([1, 3, 5, 9, 11])).toEqual([
            { beat: 0, sixteenths: 2 },
            { beat: 1, sixteenths: 2 },
            { beat: 2, sixteenths: 4 },
            { beat: 3, sixteenths: 2 },
            { beat: 4, sixteenths: 2 },
            { beat: -1, sixteenths: 4 }
        ])
        // Eighths would overrun the bar: sixteenths.
        const ten = sketchRhythmOf([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        expect(ten.reduce((n, e) => n + e.sixteenths, 0)).toBe(16)
        // Past 8 beats, sixteenths, then rests to the end of the bar.
        expect(rhythmOf(textTabToAlphaTex(`e|${'-0'.repeat(9)}-|`)!)).toBe(
            `${Array(9).fill('16').join(' ')} r16 r8 r4`
        )
    })

    it('places beats on the coarsest grid that fits', () => {
        expect(positionsOf([0, 4, 8], 16, 0)).toEqual([0, 4, 8])
        expect(positionsOf([1, 5, 9, 11], 17, 1)).toEqual([0, 4, 8, 10])
        expect(positionsOf([2, 5, 8], 11, 2)).toEqual([0, 4, 8])
        expect(positionsOf([4, 12], 16, 3)).toEqual([4, 12])
        expect(positionsOf([0, 1, 3, 5, 7, 9], 11, 0)).toBeNull()
        expect(positionsOf([], 16, 0)).toEqual([])
    })

    it('fits a beat exactly a column off (no rounding error)', () => {
        // Columns 1 and 9 of 19: 1.0000000000000004 columns off the half-note grid.
        expect(positionsOf([1, 9], 19, 1)).toEqual([0, 8])
        expect(textTabToAlphaTex('A|-3-------3---------|')).toBe(':2 3.5 3.5')
    })
})

describe('textTabToAlphaTex, techniques (#66)', () => {
    it('reads a bend, its release and a pull-off as one bent note, then the next', () => {
        const tex = textTabToAlphaTex(RIFFS.lick)!
        expect(tex).toBe(
            [
                '\\tuning (E4 B3 G3)',
                ':2 8.2{b (0 4 0) h} :4 5.2 7.2 |',
                ':8 5.1{h} 7.1{h} 5.1 8.2 5.2{sl} :4 7.2{v d}'
            ].join('\n')
        )
        const notes = notesOf(tex)
        expect(notes.map((n) => n.fret)).toEqual([8, 5, 7, 5, 7, 5, 8, 5, 7])
        const bend = notes[0]!
        expect(bend.bendType).toBe(alphaTab.model.BendType.BendRelease)
        expect(bend.bendPoints!.map((p) => p.value)).toEqual([0, 4, 4, 0])
        expect(bend.isHammerPullOrigin).toBe(true)
        expect(notes[3]!.isHammerPullOrigin).toBe(true)
        expect(notes[7]!.slideOutType).toBe(alphaTab.model.SlideOutType.Legato)
        expect(notes[8]!.vibrato).toBe(alphaTab.model.VibratoType.Slight)
    })

    it('bends a half tone, a whole tone by default, and to a target in parentheses', () => {
        expect(textTabToAlphaTex('e|--7b8--7b--7b(9)-|')).toBe(
            ':4 7.1{b (0 2)} 7.1{b (0 4)} :2 7.1{b (0 4)}'
        )
        expect(textTabToAlphaTex('G|-7b9r-----------|')).toBe(':1 7.3{b (0 4 0)}')
    })

    it('slides in and out', () => {
        const tex = textTabToAlphaTex('A|-/5---5\\-\\7---7/|')!
        expect(tex).toBe(':4 5.5{sib} 5.5{sod} 7.5{sia} 7.5{sou}')
        expect(notesOf(tex).map((n) => [n.slideInType, n.slideOutType])).toEqual([
            [alphaTab.model.SlideInType.IntoFromBelow, alphaTab.model.SlideOutType.None],
            [alphaTab.model.SlideInType.None, alphaTab.model.SlideOutType.OutDown],
            [alphaTab.model.SlideInType.IntoFromAbove, alphaTab.model.SlideOutType.None],
            [alphaTab.model.SlideInType.None, alphaTab.model.SlideOutType.OutUp]
        ])
    })

    it('keeps dead notes as percussive notes', () => {
        const tex = textTabToAlphaTex(RIFFS.chug)!
        expect(tex).toBe(
            '\\tuning (G3 D3 A2)\n:8 (2.1 2.2 0.3) (x.1 x.2 x.3) (2.1 2.2 0.3) (x.1 x.2 x.3) (2.1 2.2 0.3) (x.1 x.2 x.3) (2.1 2.2 0.3) (x.1 x.2 x.3)'
        )
        expect(notesOf(tex).filter((n) => n.isDead)).toHaveLength(12)
    })

    it('reads natural harmonics, starting at their bracket', () => {
        const tex = textTabToAlphaTex('e|-<12>---<7>-----|\nB|-<12>---<7>-----|')!
        expect(tex).toBe('\\tuning (E4 B3)\n:2 (12.1{nh} 12.2{nh}) (7.1{nh} 7.2{nh})')
        expect(
            notesOf(tex).every((n) => n.harmonicType === alphaTab.model.HarmonicType.Natural)
        ).toBe(true)
    })

    it('palm-mutes the notes under a PM line', () => {
        const tex = textTabToAlphaTex(RIFFS.gallop)!
        expect(notesOf(tex).every((n) => n.isPalmMute)).toBe(true)
        // Only under the marks, and only from the line right above.
        const part = textTabToAlphaTex(['   PM---     P.M.', 'E|0-0-0-0-0-0-0-0-|'].join('\n'))!
        expect(notesOf(part).map((n) => n.isPalmMute)).toEqual([
            false,
            true,
            true,
            false,
            false,
            false,
            true,
            true
        ])
        expect(textTabToAlphaTex(['PM----', '', 'E|0-0-0-0-|'].join('\n'))).not.toContain('pm')
        expect(palmMutesOf('  PM----  P.M. - - -|')).toEqual([
            [2, 7],
            [10, 20]
        ])
        expect(palmMutesOf('Play it muted')).toEqual([])
    })

    it('finds the techniques of a line in one pass', () => {
        const { frets, effects } = techniquesOf('-8b10r8p5-12h14~-')
        expect([...frets].map(([col, f]) => [col, f.fret])).toEqual([
            [1, 8],
            [8, 5],
            [10, 12],
            [13, 14]
        ])
        expect(effects.get(1)).toEqual(['b (0 4 0)', 'h'])
        expect(effects.get(10)).toEqual(['h'])
        expect(effects.get(13)).toEqual(['v'])
    })

    it('loads every riff in alphaTab, each bar a full 4/4 bar', () => {
        for (const riff of Object.values(RIFFS)) {
            const bars = load(textTabToAlphaTex(riff)!).tracks[0]!.staves[0]!.bars
            for (const bar of bars) {
                const sixteenths = bar.voices[0]!.beats.reduce(
                    (sum, b) => sum + (16 / b.duration) * (b.dots ? 1.5 : 1),
                    0
                )
                expect(sixteenths).toBe(16)
            }
        }
    })

    it('reads techniques in linear time', () => {
        const start = performance.now()
        textTabToAlphaTex(`e|${'1'.repeat(50_000)}|\nB|${'-'.repeat(50_000)}|`)
        textTabToAlphaTex(`e|-5${'~'.repeat(50_000)}|\nB|${'5b'.repeat(25_000)}|`)
        textTabToAlphaTex(`${'PM'.repeat(25_000)}\ne|${'0-'.repeat(25_000)}|`)
        textTabToAlphaTex(`e|${'<1>'.repeat(20_000)}|\nB|${'5h'.repeat(25_000)}|`)
        expect(performance.now() - start).toBeLessThan(1000)
    })
})

/** Two-string rows (e and B), one per item, a blank line between them. */
const rows = (...items: [string, string][]) => items.map(([e, b]) => `e${e}\nB${b}`).join('\n\n')

describe('textTabToAlphaTex, bars split across rows (#70)', () => {
    // Nothing Else Matters, intro (Ultimate Guitar tab 54340): the fourth bar starts at the end of
    // the first row and ends at the start of the second.
    const nem = [
        'e|------0----|------0----|------0----|----',
        'B|----0---0--|----0---0--|----0---0--|----',
        'G|--0-------0|--0-------0|--0-------0|--0-',
        'D|-----------|-----------|-----------|----',
        'A|-----------|-----------|-----------|----',
        'E|0----------|0----------|0----------|0---',
        '',
        'e|--0---7|7-----7p0----|',
        'B|0---0--|--0---0---0--|',
        'G|-------|----0-------0|',
        'D|-------|-------------|',
        'A|-------|-------------|',
        'E|-------|0------------|'
    ].join('\n')

    it("joins a fragment at the end of a row to the next row's first bar", () => {
        const tex = textTabToAlphaTex(nem)!
        const bars = tex.split(' |\n')
        expect(bars).toHaveLength(5)
        expect(bars[3]).toBe('0.6 0.3 0.2 0.1 0.2 7.1')
        // The joined bar has the rhythm of the full bars before it (six eighths in 6/8, see #70).
        const rhythm = rhythmOf(tex).split(' | ')
        expect(rhythm[3]).toBe(rhythm[0])
        expect(rhythm[3]).toBe('8 8 8 8 8 8')
    })

    it("joins a fragment before a row's first bar line to the bar before it", () => {
        const tex = textTabToAlphaTex(
            rows(
                ['|0---0---0---0---|0---0---|', '|----------------|--------|'],
                [' 0---0---|0---0---0---0---|', ' --------|----------------|']
            )
        )
        expect(tex).toBe(
            '\\tuning (E4 B3)\n:4 0.1 0.1 0.1 0.1 |\n0.1 0.1 0.1 0.1 |\n0.1 0.1 0.1 0.1'
        )
        // Bar lines on both sides: joined when both are fragments and make a bar together.
        expect(
            textTabToAlphaTex(
                rows(
                    ['|0---0---0---0---|0---0---|', '|----------------|--------|'],
                    ['|0---0---|0---0---0---0---|', '|--------|----------------|']
                )
            )
        ).toBe(tex)
    })

    it('makes a short first bar a pickup bar', () => {
        const bar = '3---3---3---3---'
        const closed = textTabToAlphaTex(
            rows([`|-----0-2-|${bar}|${bar}|`, `|---------|${'-'.repeat(16)}|${'-'.repeat(16)}|`])
        )!
        expect(closed).toBe(
            '\\tuning (E4 B3)\n\\ac :8 0.1 2.1 |\n:4 3.1 3.1 3.1 3.1 |\n3.1 3.1 3.1 3.1'
        )
        const score = load(closed)
        expect(score.masterBars[0]!.isAnacrusis).toBe(true)
        expect(score.masterBars[1]!.isAnacrusis).toBe(false)
        // Without a bar line before it, the same.
        expect(
            textTabToAlphaTex(
                rows([` ----0-2-|${bar}|${bar}|`, ` --------|${'-'.repeat(16)}|${'-'.repeat(16)}|`])
            )
        ).toBe(closed)
    })

    it('places a fragment that joins nothing in a bar of the typical width', () => {
        const full = '0---0---0---0---'
        const none = '-'.repeat(16)
        // A pickup into the next bar, after a full bar: rests, then the note.
        expect(
            rhythmOf(
                textTabToAlphaTex(
                    rows(
                        [`|${full}|${full}|`, `|${none}|${none}|`],
                        [` ------3-|${full}|`, ` --------|${none}|`]
                    )
                )!
            )
        ).toBe('4 4 4 4 | 4 4 4 4 | r2 r4 r8 8 | 4 4 4 4')
        // The tab's last bar cut short: its notes keep their length, rests fill the bar.
        expect(
            rhythmOf(
                textTabToAlphaTex(rows([`|${full}|${full}|0---0---`, `|${none}|${none}|--------`]))!
            )
        ).toBe('4 4 4 4 | 4 4 4 4 | 4 4 r2')
        // A few dashes after the last bar line are no bar.
        expect(textTabToAlphaTex(rows([`|${full}|${full}|--`, `|${none}|${none}|--`]))).toBe(
            textTabToAlphaTex(rows([`|${full}|${full}|`, `|${none}|${none}|`]))
        )
    })

    it('keeps short bars that are not fragments as they are', () => {
        const full = '0---0---0---0---'
        const none = '-'.repeat(16)
        // A short bar in a row, and one ending a row followed by a full bar, bar lines on both sides.
        expect(
            rhythmOf(
                textTabToAlphaTex(
                    rows(
                        [
                            `|${full}|0---0---|${full}|0-0-0-0-|`,
                            `|${none}|--------|${none}|--------|`
                        ],
                        [`|${full}|`, `|${none}|`]
                    )
                )!
            )
        ).toBe('4 4 4 4 | 2 2 | 4 4 4 4 | 4 4 4 4 | 4 4 4 4')
        // Without two bars between bar lines, there is no typical width: nothing is joined.
        expect(textTabToAlphaTex(rows(['|--0--|--3--', '|-----|-----']))).toBe(
            '\\tuning (E4 B3)\n:1 0.1 |\n3.1'
        )
    })

    it('joins bars across many rows in linear time', () => {
        const row = rows(['|0---0---0---0---|0---', '|----------------|----'])
        const next = rows(['|0---0---0---|', '|------------|'])
        const tab = (n: number) => Array(n).fill(`${row}\n\n${next}`).join('\n\n')
        const time = (n: number) => {
            const start = performance.now()
            const tex = textTabToAlphaTex(tab(n))!
            expect(tex.split('|')).toHaveLength(2 * n)
            return performance.now() - start
        }
        time(500) // warm-up
        // Twice the rows takes about twice the time; a quadratic join would take four times.
        // A ratio, not a wall-clock limit, so a slow CI runner doesn't fail it.
        expect(time(5_000)).toBeLessThan(3 * time(2_500) + 50)
    })

    it('joins drum bars split across rows', () => {
        const tex = textTabToAlphaTex(
            [
                'HH|x-x-x-x-x-x-x-x-|x-x-',
                ' S|----o-------o---|----',
                '',
                'HH|x-x-x-x-x-x-|',
                ' S|o-------o---|'
            ].join('\n')
        )!
        expect(rhythmOf(tex)).toBe('8 8 8 8 8 8 8 8 | 8 8 8 8 8 8 8 8')
    })
})

/** Lines of a tab, highest string first, joined into one text. */
const tab = (...lines: string[]) => lines.join('\n')

/** A score's time signature, as alphaTab reads it. */
const meterOfTex = (tex: string) => {
    const bar = load(tex).masterBars[0]!
    return `${bar.timeSignatureNumerator}/${bar.timeSignatureDenominator}`
}

describe('textTabToAlphaTex, the meter from the typical bar', () => {
    it('reads the Nothing Else Matters intro in 6/8: six eighths a bar, no rest', () => {
        const nem = tab(
            'e|------0----|------0----|------0----|',
            'B|----0---0--|----0---0--|----0---0--|',
            'G|--0-------0|--0-------0|--0-------0|',
            'D|-----------|-----------|-----------|',
            'A|-----------|-----------|-----------|',
            'E|0----------|0----------|0----------|'
        )
        const tex = textTabToAlphaTex(nem)!
        expect(tex.split('\n')[0]).toBe('\\ts 6 8')
        expect(meterOfTex(tex)).toBe('6/8')
        expect(rhythmOf(tex)).toBe('8 8 8 8 8 8 | 8 8 8 8 8 8 | 8 8 8 8 8 8')
    })

    it('reads a waltz riff in 3/4', () => {
        const tex = textTabToAlphaTex(
            tab(
                'G|----2---2---|----2---2---|',
                'D|----2---2---|----2---2---|',
                'A|0-----------|3-----------|'
            )
        )!
        expect(tex).toContain('\\ts 3 4')
        expect(rhythmOf(tex)).toBe('4 4 4 | 4 4 4')
    })

    it('chooses 6/8 or 3/4 for six eighths by how the beats and bass notes group', () => {
        // Bass notes on every other eighth: three quarters.
        const twos = tab('G|--1---1---1-|--1---1---1-|', 'D|0---0---0---|0---0---0---|')
        expect(textTabToAlphaTex(twos)).toContain('\\ts 3 4')
        // Bass notes on the first and fourth eighths: two dotted quarters.
        const threes = tab('G|--1-1---1-1-|--1-1---1-1-|', 'D|0-----0-----|0-----0-----|')
        expect(textTabToAlphaTex(threes)).toContain('\\ts 6 8')
        expect(rhythmOf(textTabToAlphaTex(threes)!)).toBe('8 8 8 8 8 8 | 8 8 8 8 8 8')
    })

    it('reads a shuffle of quarters and eighths in 12/8', () => {
        const tex = textTabToAlphaTex(
            tab(
                'A|0---0-0---0-0---0-0---0-|2---2-2---2-2---2-2---2-|',
                'E|0-----0-----0-----0-----|0-----0-----0-----0-----|'
            )
        )!
        expect(meterOfTex(tex)).toBe('12/8')
        expect(rhythmOf(tex)).toBe('4 8 4 8 4 8 4 8 | 4 8 4 8 4 8 4 8')
    })

    it('keeps 4/4 when the bars show no clear count', () => {
        // Five eighths, dotted eighths, a single bar of six eighths, Smoke on the Water.
        for (const text of [
            'e|0-0-0-0-0-|0-0-0-0-0-|',
            'E|0--0--0-0--0--0-|0--0--0-0--0--0-|',
            'e|0-0-0-0-0-0-|',
            RIFFS.smoke
        ])
            expect(textTabToAlphaTex(text)).not.toContain('\\ts')
    })

    it('fills empty bars, fragments and rests to the bar of the meter', () => {
        const six = '0-0-0-0-0-0-'
        const tex = textTabToAlphaTex(`e|${six}|${six}|------------|0-0-0-`)!
        expect(rhythmOf(tex)).toBe('8 8 8 8 8 8 | 8 8 8 8 8 8 | r2. | 8 8 8 r4.')
        for (const bar of load(tex).tracks[0]!.staves[0]!.bars) {
            const sixteenths = bar.voices[0]!.beats.reduce(
                (sum, b) => sum + (16 / b.duration) * (b.dots ? 1.5 : 1),
                0
            )
            expect(sixteenths).toBe(12)
        }
    })
})

describe('textTabToAlphaTex, rhythm of unbarred and uneven tabs (#71)', () => {
    it('splits a line with no bar lines into 4/4 bars, an eighth its most frequent gap', () => {
        // Three bars written two columns an eighth, with no bar line between them: one bar
        // before, 21 eighths overran it and every note became a sixteenth.
        const tex = textTabToAlphaTex(
            six([
                'e|--0---0---0-0-0---0-0-0-0-0---0---0-------0-------|',
                'B|--------------------------------------------------|',
                'G|--------------------------------------------------|',
                'D|--------------------------------------------------|',
                'A|--------------------------------------------------|',
                'E|--------------------------------------------------|'
            ])
        )!
        expect(rhythmOf(tex)).toBe('4 4 8 8 4 | 8 8 8 8 4 4 | 2 2')
    })

    it('puts the same columns on the same beats in bars of the same width', () => {
        const tex = textTabToAlphaTex(
            six([
                'e|-----0---3---5---|-----0---3---6-5-|',
                'B|-----------------|-----------------|',
                'G|-----------------|-----------------|',
                'D|-----------------|-----------------|',
                'A|-----------------|-----------------|',
                'E|-----------------|-----------------|'
            ])
        )!
        expect(rhythmOf(tex)).toBe('r4 4 4 4 | r4 4 4 8 8')
    })

    it('gives a hammer-on or pull-off pair one eighth before a bar falls back to sixteenths', () => {
        // Nothing Else Matters, intro: the second row's second bar has seven beats two columns
        // apart, one more than a 6/8 bar holds; the 7p0 shares one eighth.
        const nem = [
            'e|------0----|------0----|------0----|----',
            'B|----0---0--|----0---0--|----0---0--|----',
            'G|--0-------0|--0-------0|--0-------0|--0-',
            'D|-----------|-----------|-----------|----',
            'A|-----------|-----------|-----------|----',
            'E|0----------|0----------|0----------|0---',
            '',
            'e|--0---7|7-----7p0----|',
            'B|0---0--|--0---0---0--|',
            'G|-------|----0-------0|',
            'D|-------|-------------|',
            'A|-------|-------------|',
            'E|-------|0------------|'
        ].join('\n')
        const tex = textTabToAlphaTex(nem)!
        expect(rhythmOf(tex).split(' | ')[4]).toBe('8 8 8 16 16 8 8')
    })

    it('moves the beats after a legato pair one eighth earlier, whatever the second note lasts', () => {
        // Nine eighths in a 4/4 bar: the pull-off's 0 lasts a quarter, so it keeps a dotted eighth.
        const lengths = sketchRhythmOf([0, 2, 4, 6, 8, 12, 14, 16], undefined, [3])
        expect(lengths.map((e) => e.sixteenths)).toEqual([2, 2, 2, 1, 3, 2, 2, 2])
        expect(lengths.every((e) => e.beat >= 0)).toBe(true)
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
