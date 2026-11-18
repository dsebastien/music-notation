// The yellow bar: does the live Room level reach the room's gain, and does a loop take the length?
import { INSTALL } from './cap-lib.ts'
export default async (page: any) => {
    await page.wait(6000)
    await page.eval(INSTALL)
    const out: Record<string, unknown> = {}
    out.bar = await page.eval(`document.getElementById('fx-now').textContent`)
    await page.eval(`document.querySelectorAll('.mn-play-toggle')[1].click()`)
    await page.wait(2500)
    out.wets = await page.eval(`JSON.stringify([...wets].map(w => +w.gain.value.toFixed(3)))`)
    await page.eval(
        `(() => { const e = document.getElementById('fx-reverb'); e.value = '0.8'; e.dispatchEvent(new Event('input')) })()`
    )
    await page.wait(400)
    out.wetsAfter = await page.eval(`JSON.stringify([...wets].map(w => +w.gain.value.toFixed(3)))`)
    out.barAfter = await page.eval(`document.getElementById('fx-now').textContent`)
    out.shot = await page.shot(
        (process.env.MN_OUT ?? '/tmp') + '/' + (process.env.MN_NAME ?? 'bar') + '.png',
        '#fx-bar'
    )
    out.errors = page.errors
    return out
}
