import { describe, expect, it } from 'bun:test'
import { SCORE_SCALES, scoreFit } from './score-fit.js'

/** A score that fits its area up to `largest`, and the draws asked for. */
function setup(largest: number) {
    const draws: [number, boolean][] = []
    let scale = 1
    const fit = scoreFit(
        (s, stretch) => {
            scale = s
            draws.push([s, stretch])
        },
        () => scale <= largest
    )
    /** Draws until nothing more is asked for. */
    const settle = () => {
        for (let i = 0; i < 20; i++) {
            const before = draws.length
            fit.drawn()
            if (draws.length === before) return
        }
    }
    return { fit, draws, settle }
}

describe('a score in full screen uses the screen (#113)', () => {
    it('a short score grows step by step, then takes the largest scale that fits', () => {
        const { fit, draws, settle } = setup(2)
        fit.enter()
        settle()
        // Stretched every time; up to 2.5, which no longer fits, then back to 2.
        expect(draws).toEqual([
            [1, true],
            [1.25, true],
            [1.5, true],
            [1.75, true],
            [2, true],
            [2.5, true],
            [2, true]
        ])
    })

    it('a long score keeps its own size (more bars a line), with its last line stretched', () => {
        const { fit, draws, settle } = setup(0.5)
        fit.enter()
        settle()
        expect(draws).toEqual([[1, true]])
    })

    it('stops at the largest scale', () => {
        const { fit, draws, settle } = setup(10)
        fit.enter()
        settle()
        expect(draws.at(-1)).toEqual([SCORE_SCALES.at(-1)!, true])
        expect(draws.length).toBe(SCORE_SCALES.length)
    })

    it('out of full screen: drawn as in the page, and draws after that change nothing', () => {
        const { fit, draws, settle } = setup(2)
        fit.enter()
        fit.leave()
        expect(draws.at(-1)).toEqual([1, false])
        const before = draws.length
        settle()
        expect(draws.length).toBe(before)
    })

    it('a draw before full screen asks for nothing', () => {
        const { draws, settle } = setup(2)
        settle()
        expect(draws).toEqual([])
    })
})
