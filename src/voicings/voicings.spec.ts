import { describe, expect, it } from 'bun:test'
import db from '@tombatossals/chords-db/lib/guitar.json'
import { lookupGuitarVoicing, voicingCount } from './index.js'
import { fingeringProblem, strummable, voicingProblem } from './check.js'
import { detectChordFromFrets } from '../theory/detect.js'
import { parseChord } from '../theory/chord-symbol.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { canonicalSuffix } from '../theory/suffix.js'

describe('lookupGuitarVoicing', () => {
    it('finds open chords with absolute frets', () => {
        expect(lookupGuitarVoicing('A', 0)).toEqual({
            frets: [null, 0, 2, 2, 2, 0],
            fingers: [null, null, '1', '2', '3', null],
            baseFret: 1
        })
        expect(lookupGuitarVoicing('Em', 0)?.frets).toEqual([0, 2, 2, 0, 0, 0])
    })

    it('converts relative frets up the neck', () => {
        const c = lookupGuitarVoicing('C', 1)!
        expect(c.baseFret).toBe(3)
        expect(c.frets).toEqual([null, 3, 5, 5, 5, 3])
    })

    it('understands sharps, flats, aliases and slash chords', () => {
        expect(lookupGuitarVoicing('F#m', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('Gbm', 0)).toEqual(lookupGuitarVoicing('F#m', 0))
        expect(lookupGuitarVoicing('Bbmaj7', 0)).toEqual(lookupGuitarVoicing('BbM7', 0))
        expect(lookupGuitarVoicing('C/E', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('Am/G', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('D/F#', 0)).toEqual(lookupGuitarVoicing('D/Gb', 0))
        expect(lookupGuitarVoicing('Cmin6', 0)).toEqual(lookupGuitarVoicing('Cm6', 0))
        expect(lookupGuitarVoicing('CM9', 0)).toEqual(lookupGuitarVoicing('Cmaj9', 0))
        expect(lookupGuitarVoicing('C6/9', 0)).not.toBeNull()
        expect(lookupGuitarVoicing('C7b9', 0)).not.toBeNull()
    })

    it('returns null for what it does not know', () => {
        expect(lookupGuitarVoicing('H7', 0)).toBeNull()
        expect(lookupGuitarVoicing('Cxyz', 0)).toBeNull()
        expect(lookupGuitarVoicing('A', 99)).toBeNull()
        expect(voicingCount('A')).toBeGreaterThan(2)
    })
})

/** Database keys as chord symbols. */
const ROOTS: Record<string, string> = { Csharp: 'C#', Fsharp: 'F#' }
const symbolOf = (key: string, suffix: string) =>
    `${ROOTS[key] ?? key}${suffix === 'major' ? '' : suffix === 'minor' ? 'm' : suffix}`
const show = (frets: (number | null)[]) => {
    const dashed = frets.some((f) => f !== null && f > 9)
    return frets.map((f) => (f === null ? 'x' : f)).join(dashed ? '-' : '')
}
const STANDARD = [40, 45, 50, 55, 59, 64]

/** Qualities the chord detector names reliably (6, 11 and 7sus4 voicings without a fifth read
 * as other chords: C6 x32210 is also Am/C). */
const DETECTED = new Set(
    ['', 'm', '7', 'm7', 'maj7', '5', 'sus2', 'sus4', 'dim', 'dim7', 'aug', 'm7b5', 'm6'].concat([
        '9',
        'm9',
        'maj9',
        'mMaj7',
        '7b5',
        '7b9',
        '7#9',
        '13'
    ])
)

/** Suffixes of the database the library doesn't read: no block can ask for them. */
const UNREAD = new Set(['aug9', 'mmaj11', 'mmaj7b5', '7sg'])

describe('every database voicing (#62)', () => {
    it('plays its chord, with the root or the slash bass lowest, and fingers a hand can use', () => {
        const failures: string[] = []
        let checkedCount = 0
        for (const [key, chords] of Object.entries(db.chords)) {
            for (const chord of chords) {
                const symbol = symbolOf(key, chord.suffix)
                if (UNREAD.has(chord.suffix)) {
                    expect(parseChord(symbol)).toBeNull()
                    continue
                }
                const parts = splitChordSymbol(symbol)!
                const suffix = canonicalSuffix(parts.suffix)
                const root = chromaOf(parts.root)!
                const bass = parts.bass ? chromaOf(parts.bass)! : root
                const count = voicingCount(symbol)
                if (count < 3) failures.push(`${symbol}: only ${count} voicings`)
                for (let i = 0; i < count; i++) {
                    const v = lookupGuitarVoicing(symbol, i)!
                    const where = `${symbol} #${i + 1} ${show(v.frets)}`
                    checkedCount++
                    const problem = voicingProblem(symbol, v.frets)
                    if (problem) failures.push(`${where}: ${problem}`)
                    const pitches = v.frets.flatMap((f, s) =>
                        f === null ? [] : [STANDARD[s]! + f]
                    )
                    // A diminished seventh is symmetrical: any of its notes may be lowest.
                    const dim7 = suffix === 'dim7' && !parts.bass
                    const roots = dim7 ? [0, 3, 6, 9].map((i) => (root + i) % 12) : [bass]
                    if (!roots.includes(Math.min(...pitches) % 12)) failures.push(`${where}: bass`)
                    const fingers = fingeringProblem(v.frets, v.fingers)
                    if (fingers) failures.push(`${where}: ${fingers}`)
                    if (!parts.bass && DETECTED.has(suffix)) {
                        const readings = detectChordFromFrets(v.frets)?.readings ?? []
                        const named = readings.some((reading) => {
                            const m = /^([A-G][#b]*)(.*?)(?:\/([A-G][#b]*))?$/.exec(reading)
                            const at = m ? chromaOf(m[1]!)! : -1
                            // Cdim7 xx1212 reads Ebdim7: the same four notes.
                            const rootOk = dim7 ? roots.includes(at) : at === root
                            return m && rootOk && m[2] === suffix && !m[3]
                        })
                        if (!named) failures.push(`${where}: the detector reads ${readings[0]}`)
                    }
                }
            }
        }
        expect(failures).toEqual([])
        expect(checkedCount).toBeGreaterThan(1900)
        // Every chord of the database, checked and some generated: a few seconds.
    }, 30_000)

    it('starts with the shapes teachers expect', () => {
        const first: Record<string, string> = {
            'C': 'x32010',
            'C#': 'x46664',
            'Eb': 'x68886',
            'F': '133211',
            'Ab': '466544',
            'Bb': 'x13331',
            'B': 'x24442',
            'Cm': 'x35543',
            'Gm': '355333',
            'Bm': 'x24432',
            'Bm7': 'x24232',
            'Bmaj7': 'x24342',
            'Bsus2': 'x24422',
            'Bsus4': 'x24452',
            'Cmaj7': 'x32000',
            'Ebmaj7': 'xx1333',
            'Dm7': 'xx0211',
            'C9': 'x32333',
            'A9': 'x02423',
            'E7#9': 'x7678x',
            'G5': '355xxx',
            'Am/G': '3x2210',
            'C/G': '332010',
            'D/F#': '200232'
        }
        for (const [symbol, frets] of Object.entries(first)) {
            expect(`${symbol} ${show(lookupGuitarVoicing(symbol, 0)!.frets)}`).toBe(
                `${symbol} ${frets}`
            )
        }
        expect(lookupGuitarVoicing('Dm7', 0)!.fingers).toEqual([null, null, null, '2', '1', '1'])
        expect(lookupGuitarVoicing('Cmaj7', 0)!.fingers).toEqual([null, '3', '2', null, null, null])
        expect(lookupGuitarVoicing('E7#9', 1)!.frets).toEqual([0, 7, 6, 7, 8, 0])
        expect(lookupGuitarVoicing('Gb5', 0)).toEqual(lookupGuitarVoicing('F#5', 0))
    })

    it('drops the wrong chords the review found', () => {
        const all = (symbol: string) =>
            Array.from({ length: voicingCount(symbol) }, (_, i) =>
                show(lookupGuitarVoicing(symbol, i)!.frets)
            )
        expect(all('C9')).not.toContain('032030')
        expect(all('Emadd9')).not.toContain('xx3113')
        expect(all('C#aug')).not.toContain('x44422')
        expect(all('Cmaj7')).not.toContain('332000')
        expect(all('B')).not.toContain('224442')
        expect(all('G7')).not.toContain('323033')
    })

    it('starts with a voicing you can strum: no muted string inside the shape (#72)', () => {
        const failures: string[] = []
        for (const [key, chords] of Object.entries(db.chords)) {
            for (const chord of chords) {
                const symbol = symbolOf(key, chord.suffix)
                if (UNREAD.has(chord.suffix)) continue
                const first = lookupGuitarVoicing(symbol, 0)
                if (first && !strummable(first.frets))
                    failures.push(`${symbol} ${show(first.frets)}`)
            }
        }
        expect(failures).toEqual([])
        expect(show(lookupGuitarVoicing('Bdim', 0)!.frets)).toBe('x2343x')
        // The jazz grips keep their muted A string under a low-E root (F#6 2x132x).
        expect(strummable([2, null, 1, 3, 2, null])).toBe(true)
        expect(strummable([null, 2, 0, null, 0, 1])).toBe(false)
    })

    it('keeps standard dim7 and 6/9 grips', () => {
        const all = (symbol: string) =>
            Array.from({ length: voicingCount(symbol) }, (_, i) =>
                show(lookupGuitarVoicing(symbol, i)!.frets)
            )
        // A dim7 is symmetrical: any of its notes may be the bass.
        expect(all('Cdim7')).toContain('xx1212')
        expect(all('Bbdim7')).toContain('xx2323')
        // The pinky barres the two highest strings.
        expect(all('E6/9')).toContain('022122')
        expect(all('Cm6/9')).toContain('x31233')
        expect(lookupGuitarVoicing('E6/9', 0)!.fingers).toEqual([null, '2', '3', '1', '4', '4'])
        expect(voicingProblem('Cdim7', [null, null, 1, 2, 1, 2])).toBeNull()
        expect(fingeringProblem([0, 2, 2, 1, 2, 2], [null, '2', '3', '1', '4', '4'])).toBeNull()
        expect(fingeringProblem([3, 1, 2, 4, 4, null], ['3', '1', '2', '4', '4', null])).toBe(
            'a barre with finger 4'
        )
    })

    it('hands out the curated shapes for chords the database lacks the name of', () => {
        expect(show(lookupGuitarVoicing('C7alt', 0)!.frets)).toBe('x3234x')
        expect(show(lookupGuitarVoicing('C7#5', 0)!.frets)).toBe(
            show(lookupGuitarVoicing('Caug7', 0)!.frets)
        )
    })
})
