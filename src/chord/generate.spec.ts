import { describe, expect, it } from 'bun:test'
import { fingerVoicing, generateVoicings, voicingShape } from './generate.js'
import { parseTuning } from '../fretboard/tuning.js'

const frets = (text: string) =>
    (/-/.test(text) ? text.split('-') : [...text]).map((t) => (t === 'x' ? null : Number(t)))
const fingers = (text: string) => [...text].map((t) => (t === '0' || t === 'x' ? null : t))
const show = (f: (number | null)[]) => {
    const dashed = f.some((n) => n !== null && n > 9)
    return f.map((n) => (n === null ? 'x' : n)).join(dashed ? '-' : '')
}
/** Where a voicing ranks (from 1), or 0 when missing. */
const rank = (symbol: string, wanted: string) =>
    generateVoicings(symbol).findIndex((v) => show(v.frets) === wanted) + 1

describe('fingerVoicing', () => {
    it('fingers open chords one finger per note', () => {
        expect(fingerVoicing(frets('x32010'))).toEqual(fingers('x32010'))
        expect(fingerVoicing(frets('x02220'))).toEqual(fingers('x01230'))
        expect(fingerVoicing(frets('320003'))).toEqual(fingers('210003'))
        expect(fingerVoicing(frets('xx0232'))).toEqual(fingers('xx0132'))
        expect(fingerVoicing(frets('022100'))).toEqual(fingers('023100'))
    })

    it('barres the lowest fret when four fingers are not enough', () => {
        expect(fingerVoicing(frets('133211'))).toEqual(fingers('134211'))
        expect(fingerVoicing(frets('x13331'))).toEqual(fingers('x12341'))
        expect(fingerVoicing(frets('x-5-7-7-7-5'))).toEqual(fingers('x12341'))
    })

    it('puts a second barre on the highest fret when needed', () => {
        // Index across fret 5, two notes at 6, three at 7: the ring finger barres fret 7.
        expect(fingerVoicing([5, 6, 7, 7, 7, 5, 6])).toEqual(['1', '2', '4', '4', '4', '1', '3'])
    })

    it("refuses what a hand can't play", () => {
        // An open string under the barre.
        expect(fingerVoicing(frets('101111'))).toBeNull()
        expect(fingerVoicing(frets('123432'))).toBeNull()
    })

    it('leaves open and muted strings without a finger', () => {
        expect(fingerVoicing(frets('xx000x'))).toEqual(fingers('xx000x'))
    })
})

describe('generateVoicings', () => {
    it('ranks the open chords first', () => {
        expect(rank('C', 'x32010')).toBe(1)
        expect(rank('A', 'x02220')).toBe(1)
        expect(rank('G', '320003')).toBe(1)
        expect(rank('E', '022100')).toBe(1)
        expect(rank('D', 'xx0232')).toBe(1)
        expect(rank('Am', 'x02210')).toBe(1)
        expect(rank('Em', '022000')).toBe(1)
        expect(rank('Dm', 'xx0231')).toBe(1)
        expect(rank('Cmaj7', 'x32000')).toBe(1)
        expect(rank('B7', 'x21202')).toBe(1)
    })

    it('finds the barre chords and ranks them high', () => {
        expect(rank('F', '133211')).toBe(1)
        const bb = rank('Bb', 'x13331')
        expect(bb).toBeGreaterThan(0)
        expect(bb).toBeLessThanOrEqual(8)
        expect(rank('A', '577655')).toBeLessThanOrEqual(10)
        expect(rank('C', 'x-3-5-5-5-3')).toBeLessThanOrEqual(12)
    })

    it('fingers, names and describes each voicing', () => {
        const f = generateVoicings('F').find((v) => show(v.frets) === '133211')!
        expect(f.fingers).toEqual(fingers('134211'))
        expect(f.shape).toBe('E-shape barre')
        expect(f.bassString).toBe(6)
        expect(f.inversion).toBe(0)
        expect(f.baseFret).toBe(1)
        expect(f.reasons).toContain('barre')
        const c = generateVoicings('C')[0]!
        expect(c.shape).toBe('Open')
        expect(c.bassString).toBe(5)
    })

    it('plays every required tone and only chord tones, with the root in the bass', () => {
        for (const symbol of ['C', 'Am7', 'G7', 'Dmaj7', 'F#m7b5', 'Bbdim7', 'E9', 'Csus4']) {
            const list = generateVoicings(symbol)
            expect(list.length).toBeGreaterThan(0)
            for (const v of list) expect(v.inversion).toBe(0)
        }
        // Every C voicing sounds C and E (the fifth may be left out) and nothing else.
        const std = [40, 45, 50, 55, 59, 64]
        for (const v of generateVoicings('C')) {
            const chromas = new Set(
                v.frets.flatMap((f, s) => (f === null ? [] : [(std[s]! + f) % 12]))
            )
            expect(chromas.has(0) && chromas.has(4)).toBe(true)
            expect([...chromas].every((c) => [0, 4, 7].includes(c))).toBe(true)
        }
    })

    it('keeps a slash chord bass lowest', () => {
        const list = generateVoicings('C/G')
        expect(list.length).toBeGreaterThan(0)
        expect(list.map((v) => show(v.frets))).toContain('332010')
        expect(list.every((v) => v.inversion === 2)).toBe(true)
    })

    it('filters by area, bass string, strings and inversion', () => {
        for (const v of generateVoicings('A', { area: [5, 9] })) {
            expect(v.frets.every((f) => f === null || f === 0 || (f >= 5 && f <= 9))).toBe(true)
        }
        expect(generateVoicings('A', { area: 'open' })[0]!.frets).toEqual(frets('x02220'))
        const fifth = generateVoicings('C', { bassString: 5 })
        expect(fifth.every((v) => v.bassString === 5)).toBe(true)
        const top = generateVoicings('C', { strings: [1, 2, 3], minStrings: 3 })
        expect(top.length).toBeGreaterThan(0)
        expect(top.every((v) => v.frets.slice(0, 3).every((f) => f === null))).toBe(true)
        const first = generateVoicings('C', { inversion: 1 })
        expect(first.length).toBeGreaterThan(0)
        expect(first.every((v) => v.inversion === 1)).toBe(true)
        const any = generateVoicings('C', { inversion: 'any' })
        expect(new Set(any.map((v) => v.inversion)).size).toBe(3)
        expect(generateVoicings('C', { allowOpen: false }).every((v) => !v.frets.includes(0))).toBe(
            true
        )
    })

    it('keeps the hand within its span, wider with a stretch', () => {
        const span = (f: (number | null)[]) => {
            const fretted = f.filter((n): n is number => n !== null && n > 0)
            return fretted.length ? Math.max(...fretted) - Math.min(...fretted) + 1 : 0
        }
        expect(
            Math.max(...generateVoicings('Cmaj9').map((v) => span(v.frets)))
        ).toBeLessThanOrEqual(4)
        expect(
            Math.max(...generateVoicings('Cmaj9', { maxSpan: 5 }).map((v) => span(v.frets)))
        ).toBe(5)
    })

    it('mutes no inner string unless asked', () => {
        const inner = (f: (number | null)[]) => {
            const s = f.flatMap((n, i) => (n === null ? [] : [i]))
            return s[s.length - 1]! - s[0]! + 1 > s.length
        }
        expect(generateVoicings('G7').some((v) => inner(v.frets))).toBe(false)
        expect(generateVoicings('G7', { gaps: true }).some((v) => inner(v.frets))).toBe(true)
    })

    it('works on other tunings and string counts', () => {
        const ukulele = generateVoicings('C', { tuning: parseTuning('ukulele')! })
        expect(ukulele.map((v) => show(v.frets))).toContain('0003')
        const dropD = generateVoicings('D', { tuning: parseTuning('drop d')! })
        expect(show(dropD[0]!.frets)).toMatch(/^0/)
        const bass = generateVoicings('A5', { tuning: parseTuning('bass')! })
        expect(bass.length).toBeGreaterThan(0)
        expect(generateVoicings('C', { tuning: new Array<number>(9).fill(40) })).toEqual([])
    })

    it('finds power chords on two or three strings', () => {
        expect(rank('A5', 'x02xxx')).toBe(1)
        expect(generateVoicings('A5').map((v) => show(v.frets))).toContain('577xxx')
        expect(generateVoicings('A5')[0]!.shape).toBe('Power chord')
    })

    it('returns nothing for unknown chords', () => {
        expect(generateVoicings('Hm')).toEqual([])
        expect(generateVoicings('C', { inversion: 3 })).toEqual([])
    })

    it('stays quick', () => {
        const start = performance.now()
        for (const symbol of ['C', 'G13', 'Cmaj9', 'F#m7b5', 'E7#9']) generateVoicings(symbol)
        expect(performance.now() - start).toBeLessThan(500)
    })
})

describe('voicingShape', () => {
    it('names the usual shapes', () => {
        expect(voicingShape(frets('x32010'), 'C')).toBe('Open')
        expect(voicingShape(frets('577655'), 'A')).toBe('E-shape barre')
        expect(voicingShape(frets('x-3-5-5-5-3'), 'C')).toBe('A-shape barre')
        expect(voicingShape(frets('x-5-4-2-3-x'), 'D')).toBe('CAGED C')
        expect(voicingShape(frets('x-x-3-5-6-5'), 'F')).toBe('CAGED D')
        expect(voicingShape(frets('x02xxx'), 'A5')).toBe('Power chord')
        expect(voicingShape(frets('xxx553'), 'C')).toBe('Triad')
        expect(voicingShape(frets('3x34xx'), 'G7')).toBe('Shell')
        expect(voicingShape(frets('x-x-10-9-8-x'), 'C')).toBe('Triad')
    })

    it('says nothing of shapes it does not know', () => {
        expect(voicingShape(frets('x-3-5-0-5-0'), 'C')).toBeNull()
        expect(voicingShape(frets('x32010'), 'Hm')).toBeNull()
    })
})
