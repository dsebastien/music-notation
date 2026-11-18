// A looping strum: are Dry and the amplifier taken at the next pass?
import { INSTALL } from './cap-lib.ts'
export default async (page: any) => {
    await page.wait(6000)
    await page.eval(INSTALL)
    const out: Record<string, unknown> = {}
    const n = Number(process.env.MN_PLAY ?? 7)
    out.loop = await page.eval(
        `(() => { const k = document.querySelectorAll('.mn-play-toggle')[${n}].closest('.mn-block'); const b = [...k.querySelectorAll('button')].find(x => /loop/i.test(x.className + x.title + (x.getAttribute('aria-label') ?? ''))); if (!b) return 'no loop button: ' + [...k.querySelectorAll('button')].map(x => x.className).join(','); b.click(); return b.className + ' pressed=' + b.getAttribute('aria-pressed') })()`
    )
    await page.eval(
        `window.__cap.start(); document.querySelectorAll('.mn-play-toggle')[${n}].click()`
    )
    await page.wait(5000)
    await page.eval(
        `(() => { const s = (id, prop, v, ev) => { const e = document.getElementById(id); e[prop] = v; e.dispatchEvent(new Event(ev)) }; s('fx-cabinet', 'checked', true, 'change'); s('fx-drive', 'value', '0.5', 'input') })()`
    )
    await page.wait(5000)
    await page.eval(
        `(() => { const e = document.getElementById('fx-dry'); e.checked = true; e.dispatchEvent(new Event('change')) })()`
    )
    await page.wait(5000)
    const raw = JSON.parse(await page.eval(`window.__cap.stop()`))
    await page.eval(`document.querySelectorAll('.mn-play-toggle')[${n}].click()`)
    out.events = raw.events
        .filter(([, e]: [number, string]) =>
            /speakers|WaveShaper|Worklet->|GainNode->GainNode|Biquad.*Biquad/.test(e)
        )
        .map(([ms, e]: [number, string]) => `${ms}:${e}`)
        .join('  ')
    out.errors = page.errors
    return out
}
