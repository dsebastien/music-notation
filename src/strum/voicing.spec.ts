import { describe, expect, it } from 'bun:test'
import { strumVoicing } from './voicing.js'

const E_MINOR = [40, 47, 52, 55, 59, 64]
const G = [43, 47, 50, 55, 59, 67]

describe('strumVoicing', () => {
    it('strums the easiest voicing of a chord, lowest string first', () => {
        expect(strumVoicing('G')).toEqual(G)
        expect(strumVoicing('Am')).toEqual([45, 52, 57, 60, 64])
        expect(strumVoicing('A Minor')).toEqual([45, 52, 57, 60, 64])
    })

    it('strums E minor without a chord, the open strings on other tunings', () => {
        expect(strumVoicing(null)).toEqual(E_MINOR)
        expect(strumVoicing(null, [67, 60, 64, 69])).toEqual([67, 60, 64, 69])
    })

    it('uses the voicing lookup on a standard guitar', () => {
        const lookup = () => ({ frets: [null, 3, 2, 0, 1, 0], fingers: [] })
        expect(strumVoicing('C', undefined, lookup)).toEqual([48, 52, 55, 60, 64])
        // Other tunings: generated voicings, in string order (ukulele's G string first).
        const uke: number[] = strumVoicing('C', [67, 60, 64, 69], lookup)
        expect(uke.map((m) => m % 12).sort()).toEqual([0, 4, 7, 0].sort())
    })
})

describe('strumVoicing fallbacks', () => {
    it('stacks the chord notes when no voicing fits the strings', () => {
        // 12 strings: past what the generator handles.
        const twelve = [40, 45, 50, 55, 59, 64, 69, 74, 79, 84, 88, 93]
        expect(strumVoicing('Am', twelve)).toEqual([45, 48, 52])
    })
})
