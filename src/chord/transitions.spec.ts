import { describe, expect, it } from 'bun:test'
import { smoothProgression, transition } from './transitions.js'
import { renderBlock } from '../render/render-block.js'
import { lookupGuitarVoicing, type VoicingLookup } from '../voicings/index.js'

const frets = (text: string) =>
    (/-/.test(text) ? text.split('-') : [...text]).map((t) => (t === 'x' ? null : Number(t)))
const show = (f: (number | null)[]) => {
    const dashed = f.some((n) => n !== null && n > 9)
    return f.map((n) => (n === null ? 'x' : n)).join(dashed ? '-' : '')
}

describe('transition', () => {
    it('keeps the fingers that can stay: C to Am, Em to C', () => {
        const am = transition(frets('x32010'), 'Am')[0]!
        expect(show(am.voicing.frets)).toBe('x02210')
        expect(am.anchors.sort()).toEqual([2, 4])
        expect(am.tips).toContain("Keep your middle finger on the D string's 2nd fret.")
        const c = transition(frets('022000'), 'C')[0]!
        expect(show(c.voicing.frets)).toBe('x32010')
        expect(c.anchors).toEqual([2])
    })

    it('slides a finger along its string: A to D', () => {
        const d = transition(frets('x02220'), 'D')[0]!
        expect(show(d.voicing.frets)).toBe('xx0232')
        expect(d.guides).toEqual([4])
        expect(d.tips[0]).toBe('Slide your ring finger along the B string from fret 2 to 3.')
    })

    it('says how far the hand moves', () => {
        const steps = transition(frets('x02220'), 'C')
        const far = steps.find((s) => s.shift >= 2)
        expect(far?.tips.some((t) => /Move your hand (up|down) \d+ frets\./.test(t))).toBe(true)
    })

    it('names the low and high E strings apart', () => {
        const g = transition(frets('320003'), 'G').find((s) => show(s.voicing.frets) === '320003')!
        expect(g.anchors.length).toBe(3)
        expect(g.tips.some((t) => t.includes('high E string'))).toBe(true)
    })

    it('names strings as the fingering captions do (#79)', () => {
        // Drop D: two D strings. By number and note, never "the high D string".
        const dropD = [38, 45, 50, 55, 59, 64]
        const tips = transition(frets('002232'), 'A', { tuning: dropD }).flatMap((s) => s.tips)
        expect(tips).toContain("Keep your index finger on the 4th string (D)'s 2nd fret.")
        expect(tips.some((t) => /high D string|low D string/.test(t))).toBe(false)
        // Half step down written with flats: spelled as written.
        const halfDown = [39, 44, 49, 54, 58, 63]
        const names = ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb']
        const flat = transition(frets('x02220'), 'A7', {
            tuning: halfDown,
            tuningNames: names
        }).flatMap((s) => s.tips)
        expect(flat).toContain('Slide your middle finger along the Gb string from fret 2 to 1.')
        expect(flat.some((t) => /G#|C#|F#|A#/.test(t))).toBe(false)
        // Standard tuning reads as before.
        const am = transition(frets('x32010'), 'Am')[0]!
        expect(am.tips).toContain("Keep your middle finger on the D string's 2nd fret.")
    })

    it('names strings the same way along a progression (#79)', () => {
        const steps = smoothProgression(['C', 'Am'], {
            tuning: [39, 44, 49, 54, 58, 63],
            tuningNames: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb']
        })
        const tips = steps.flatMap((s) => s.tips ?? [])
        expect(tips.some((t) => /G#|C#|F#|A#/.test(t))).toBe(false)
    })

    it('returns nothing for an unknown chord or a mismatched tuning', () => {
        expect(transition(frets('x32010'), 'Hm')).toEqual([])
        expect(transition(frets('0003'), 'C')).toEqual([])
    })
})

describe('smoothProgression', () => {
    it('picks the open shapes for G D Em C and C Am F G', () => {
        expect(smoothProgression(['G', 'D', 'Em', 'C']).map((s) => show(s.voicing.frets))).toEqual([
            '320033',
            'xx0232',
            '022000',
            'x32010'
        ])
        const steps = smoothProgression(['C', 'Am', 'F', 'G'])
        expect(steps.map((s) => s.chord)).toEqual(['C', 'Am', 'F', 'G'])
        expect(steps[0]!.anchors).toBeUndefined()
        expect(steps[1]!.anchors?.length).toBe(2)
    })

    const shapes = (chords: string, options: { voicings?: VoicingLookup } = {}) =>
        smoothProgression(chords.split(' '), options).map((s) => show(s.voicing.frets))

    it('writes the shapes a teacher would, near the nut', () => {
        for (const options of [{}, { voicings: lookupGuitarVoicing }]) {
            expect(shapes('F# C# D#m B', options)).toEqual(['244322', 'x46664', 'x68876', 'x24442'])
            expect(shapes('E B C#m A', options)).toEqual(['022100', 'x24442', 'x46654', 'x02220'])
            expect(shapes('D A Bm G', options)).toEqual(['xx0232', 'x02220', 'x24432', '320003'])
            expect(shapes('Bb F Gm Eb', options)).toEqual(['x13331', '133211', '355333', 'x68886'])
            expect(shapes('Ab Eb Fm Db', options)).toEqual(['466544', 'x68886', '133111', 'x46664'])
            expect(shapes('B F# G#m E', options)).toEqual(['x24442', '244322', '466444', '022100'])
            expect(shapes('Dm Bb F C', options)).toEqual(['xx0231', 'x13331', '133211', 'x32010'])
            expect(shapes('D Bm Em A7', options)).toEqual(['xx0232', 'x24432', '022000', 'x02020'])
        }
        // The open B7, from the database and from the generator alone.
        expect(shapes('Em Am B7 Em', { voicings: lookupGuitarVoicing })).toEqual([
            '022000',
            'x02210',
            'x21202',
            '022000'
        ])
        expect(shapes('Em Am B7 Em')[2]).toBe('x21202')
        expect(shapes('Gm Cm D7 Gm', { voicings: lookupGuitarVoicing })).toEqual([
            '355333',
            'x35543',
            'xx0212',
            '355333'
        ])
    })

    it('keeps full shapes with the root in the bass in every key', () => {
        const progressions = [
            'G D Em C',
            'C G Am F',
            'D A Bm G',
            'A E F#m D',
            'E B C#m A',
            'F C Dm Bb',
            'Bb F Gm Eb',
            'F# C# D#m B',
            'Db Ab Bbm Gb',
            'Eb Bb Cm Ab',
            'Am F C G',
            'Em C G D',
            'Bm G D A',
            'C#m A E B',
            'Gm Eb Bb F',
            'Fm Db Ab Eb'
        ]
        for (const options of [{}, { voicings: lookupGuitarVoicing }]) {
            for (const progression of progressions) {
                for (const { chord, voicing } of smoothProgression(
                    progression.split(' '),
                    options
                )) {
                    const where = `${chord} ${show(voicing.frets)} in ${progression}`
                    const frets = voicing.frets.filter((f): f is number => f !== null)
                    expect(Math.max(...frets), where).toBeLessThanOrEqual(9)
                    expect(voicing.inversion, where).toBe(0)
                    expect(voicing.reasons, where).not.toContain('no fifth')
                    expect(voicing.frets.at(-1), where).not.toBeNull()
                    expect(frets.length >= 5 || voicing.shape === 'Open', where).toBe(true)
                }
            }
        }
    })

    it('weighs the database voicings the generator can play, in standard tuning only', () => {
        const asked: string[] = []
        const spy: VoicingLookup = (symbol, index) => {
            asked.push(symbol)
            return lookupGuitarVoicing(symbol, index)
        }
        // The database's first B has F# in the bass: never picked.
        expect(shapes('E B', { voicings: spy })).toEqual(['022100', 'x24442'])
        expect(asked).toContain('B')
        asked.length = 0
        const dropD = [38, 45, 50, 55, 59, 64]
        expect(smoothProgression(['D', 'G'], { tuning: dropD, voicings: spy })).toHaveLength(2)
        expect(asked).toEqual([])
    })

    it('stays fast on 32 chords', () => {
        const chords =
            'C Am F G Dm7 G7 Cmaj7 E7 Am Dm Bb F C/E G/B F#m7b5 B7 Em Ebmaj7 Ab Db Gb B E A D G C#m F#m G#m D#m Bbm Fm'.split(
                ' '
            )
        const start = performance.now()
        expect(smoothProgression(chords, { voicings: lookupGuitarVoicing })).toHaveLength(32)
        expect(performance.now() - start).toBeLessThan(1500)
    })

    it('returns nothing when a chord is unknown', () => {
        expect(smoothProgression(['C', 'Hm'])).toEqual([])
        expect(smoothProgression([])).toEqual([])
    })
})

describe('transition blocks', () => {
    const host = () => document.createElement('div')
    const titles = (h: HTMLElement) =>
        [...h.querySelectorAll('.mn-title')].map((t) => t.textContent)

    it('draws the held chord and the easiest next ones, anchors marked', () => {
        const h = host()
        expect(renderBlock('chord', 'from: C x32010\nto: Am', h).ok).toBe(true)
        expect(titles(h)).toEqual(['C', 'Am, 1', 'Am, 2', 'Am, 3'])
        expect(h.querySelectorAll('.mn-cell')[1]!.querySelectorAll('.mn-anchor')).toHaveLength(2)
        const one = host()
        renderBlock('chord', 'from: A\nto: D\ncount: 1', one)
        expect(titles(one)).toEqual(['A', 'D'])
        expect(one.querySelectorAll('.mn-guide').length).toBeGreaterThan(0)
    })

    it('draws a smooth progression', () => {
        const h = host()
        expect(renderBlock('chord', 'progression: G D Em C\ncolumns: 4', h).ok).toBe(true)
        expect(titles(h)).toEqual(['G', 'D', 'Em', 'C'])
        expect(renderBlock('chord', 'progression: C, A Minor, F', host()).ok).toBe(true)
    })

    it('weighs the voicing lookup in progressions', () => {
        const asked = new Set<string>()
        const voicings: VoicingLookup = (symbol, index) => {
            asked.add(symbol)
            return lookupGuitarVoicing(symbol, index)
        }
        expect(renderBlock('chord', 'progression: F# C# D#m B', host(), { voicings }).ok).toBe(true)
        expect([...asked].sort()).toEqual(['B', 'C#', 'D#m', 'F#'])
        asked.clear()
        expect(renderBlock('progression', 'F# C# D#m B', host(), { voicings }).ok).toBe(true)
        expect([...asked].sort()).toEqual(['B', 'C#', 'D#m', 'F#'])
    })

    it('says what to change', () => {
        const error = (source: string) => renderBlock('chord', source, host()).error
        expect(error('from: A')).toBe('Add the next chord: to: D')
        expect(error('progression: G')).toContain('two chords or more')
        expect(error('from: A\nto: Jm')).toContain("Didn't recognize")
        expect(error('from: A\nto: D\ncount: 0')).toContain('count:')
        expect(error('from: A\nto: D\nprogression: G C')).toContain('not both')
        expect(error('from: A\nto: D\nvoicings: all')).toContain("can't be used")
    })
})
