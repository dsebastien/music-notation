import { take, INSTALL } from './cap-lib.ts'
export default async (page: any) => {
    await page.wait(6000)
    await page.eval(INSTALL)
    const out: Record<string, unknown> = {}
    for (const n of (process.env.MN_PLAYS ?? '22').split(',').map(Number)) {
        const t = await take(
            page,
            `document.querySelectorAll('.mn-play-toggle')[${n}].click()`,
            7000
        )
        out[n] = t
            ? t.events
                  .filter(([, e]) => /Worklet|speakers/.test(e))
                  .map(([ms, e]) => `${ms}:${e}`)
                  .join('  ')
            : 'no sound'
    }
    out.errors = page.errors
    return out
}
