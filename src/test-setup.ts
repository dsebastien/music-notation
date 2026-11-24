import { expect } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

/**
 * How long a growth check may take (ms). It runs its work seven times, up to four times the size:
 * on a busy CI runner that passed the 5 s a test gets by default (5.8 s and 7.7 s for one check),
 * and the check failed on its time, not on its growth.
 */
export const LINEAR_TIMEOUT = 30_000

/**
 * Linear time, measured as growth so a slow CI runner doesn't fail it: the work at four times the
 * size must take less than eight times as long (linear is about 4x, quadratic 16x), plus 50 ms of
 * timer noise. A first run at size 1 warms the code up.
 */
export function expectLinear(run: (scale: number) => void): void {
    const time = (k: number) => {
        const start = performance.now()
        run(k)
        return performance.now() - start
    }
    // The best of three runs at each size: a garbage collection or a busy CI runner slows one run,
    // rarely all three.
    const best = (k: number) => Math.min(time(k), time(k), time(k))
    time(1)
    const one = best(1)
    expect(best(4)).toBeLessThan(8 * one + 50)
}
