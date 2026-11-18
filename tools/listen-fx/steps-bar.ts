// The yellow bar of the third pass: the room's level and shape reach what sounds, on both pages.
import { take, stats, INSTALL } from './cap-lib.ts'
export default async (page: any) => {
    await page.wait(6000)
    await page.eval(INSTALL)
    const out: Record<string, unknown> = {}
    const n = Number(process.env.MN_PLAY ?? 1)
    const press = (id: string) =>
        page.eval(
            `(() => { document.getElementById('${id}').click(); return document.getElementById('fx-now').textContent })()`
        )
    const info = () =>
        page.eval(
            `JSON.stringify({ rooms: [...rooms].map(r => ({ seconds: +(r.buffer.length / r.context.sampleRate).toFixed(2), mine: !!r.__mine })), wets: [...wets].map(w => +w.gain.value.toFixed(3)) })`
        )
    const rec = async (label: string) => {
        const t = await take(
            page,
            `document.querySelectorAll('.mn-play-toggle')[${n}].click()`,
            6000
        )
        await page.wait(500)
        if (!t) {
            out[label] = 'no sound'
            return
        }
        const s = stats(t)
        // The highs of the tail after the notes: the share of the jumps between points.
        const from = Math.round(((s.lastMs - 600) / 1000) * t.rate),
            to = Math.round(((s.lastMs - 100) / 1000) * t.rate)
        let jumps = 0,
            e = 0,
            lr = 0,
            ll = 0,
            rr = 0
        for (let i = from + 1; i < to; i++) {
            const m = (t.l[i]! + t.r[i]!) / 2,
                p = (t.l[i - 1]! + t.r[i - 1]!) / 2
            jumps += (m - p) ** 2
            e += m * m
            lr += t.l[i]! * t.r[i]!
            ll += t.l[i]! ** 2
            rr += t.r[i]! ** 2
        }
        out[label] =
            `peak ${s.peak} last ${s.lastMs} ms; the tail (its last half second): highs ${(10 * Math.log10(jumps / e)).toFixed(1)} dB, left and right alike ${(lr / Math.sqrt(ll * rr)).toFixed(2)}, level ${(10 * Math.log10(e / (to - from))).toFixed(1)} dB | ${await info()}`
    }
    out.start = await page.eval(`document.getElementById('fx-now').textContent`)
    await rec('the new room (the library alone)')
    out.old = await press('fx-old')
    await page.wait(400)
    await rec('the room of this morning (button)')
    out.new = await press('fx-new')
    await page.wait(400)
    await rec('the new room (button)')
    await page.eval(
        `(() => { const e = document.getElementById('fx-width'); e.value = '0'; e.dispatchEvent(new Event('input')); const l = document.getElementById('fx-room'); l.value = '2'; l.dispatchEvent(new Event('input')) })()`
    )
    await page.wait(400)
    await rec('width 0, length 2 s')
    out.shot = await page.shot(
        (process.env.MN_OUT ?? '/tmp') + '/' + (process.env.MN_NAME ?? 'bar3') + '.png',
        '#fx-bar'
    )
    out.errors = page.errors
    return out
}
