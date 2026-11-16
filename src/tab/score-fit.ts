/**
 * A score in full screen (#113) uses the screen: its last line is stretched to the full width, and
 * a short score is drawn larger, step by step, while it still fits the screen. A long score keeps
 * its own size, so a wide screen still shows more bars a line. Nothing here knows alphaTab:
 * `apply` sets the scale and the last line and draws again; `fits` says whether the drawing fits
 * its area after a draw.
 */

/** The scales tried in full screen, from the score's own size up. */
export const SCORE_SCALES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const

export interface ScoreFit {
    /** The score entered full screen: drawn again at its own size, its last line stretched. */
    enter(): void
    /** The score left full screen: drawn again as in the page. */
    leave(): void
    /** The score was drawn: one step larger while it fits, one step back when it no longer does. */
    drawn(): void
}

export function scoreFit(
    apply: (scale: number, stretch: boolean) => void,
    fits: () => boolean
): ScoreFit {
    /** The step drawn, while the fit goes on; null out of full screen or once settled. */
    let step: number | null = null
    /** Whether the last draw went one step back: the next one is the last. */
    let back = false
    const go = (to: number) => {
        step = to
        apply(SCORE_SCALES[to]!, true)
    }
    return {
        enter() {
            back = false
            go(0)
        },
        leave() {
            step = null
            back = false
            apply(1, false)
        },
        drawn() {
            if (step === null) return
            if (back) {
                step = null
                return
            }
            if (fits()) {
                if (step + 1 < SCORE_SCALES.length) go(step + 1)
                else step = null
                return
            }
            if (step > 0) {
                back = true
                go(step - 1)
            } else step = null
        }
    }
}
