// Records plays of a listening page with several settings of its yellow bar, and prints measures.
// MN_PLAYS="7,10" (toggle numbers), MN_SETS="dry;room=0.16;room=0.6;room=0.16,cab;room=0.16,drive=0.5", MN_MS=4500
import { take, stats, wav, INSTALL } from './cap-lib.ts'
const OUT = process.env.MN_OUT ?? '/tmp'
export default async (page: any) => {
    await page.wait(Number(process.env.MN_WAIT ?? 6000))
    await page.eval(INSTALL)
    const plays = (process.env.MN_PLAYS ?? '7').split(',').map(Number)
    const sets = (process.env.MN_SETS ?? 'dry;room=0.16;room=0.6').split(';')
    const ms = Number(process.env.MN_MS ?? 4500)
    const out: Record<string, unknown> = {}
    const apply = (set: string) => {
        const has = (k: string) => set.split(',').some((p) => p === k)
        const num = (k: string, d: number) => {
            const m = set.split(',').find((p) => p.startsWith(k + '='))
            return m ? Number(m.split('=')[1]) : d
        }
        return page.eval(
            `(() => { const s = (id, prop, v, ev) => { const e = document.getElementById(id); e[prop] = v; e.dispatchEvent(new Event(ev)) }; s('fx-dry', 'checked', ${has('dry')}, 'change'); s('fx-reverb', 'value', '${num('room', 0.125)}', 'input'); s('fx-room', 'value', '${num('secs', 1.2)}', 'input'); s('fx-cabinet', 'checked', ${has('cab')}, 'change'); s('fx-drive', 'value', '${num('drive', 0)}', 'input'); return document.getElementById('fx-now').textContent })()`
        )
    }
    // A first play of each, not recorded: files load, the contexts start.
    if (process.env.MN_WARM !== '0')
        for (const n of plays) {
            await page.eval(`document.querySelectorAll('.mn-play-toggle')[${n}].click()`)
            await page.wait(3500)
            await page.eval(
                `(() => { const b = document.querySelectorAll('.mn-play-toggle')[${n}]; if (b.getAttribute('aria-pressed') === 'true' || b.classList.contains('mn-playing')) b.click() })()`
            )
            await page.wait(1500)
        }
    for (const n of plays)
        for (const set of sets) {
            const now = await apply(set)
            const t = await take(
                page,
                `document.querySelectorAll('.mn-play-toggle')[${n}].click()`,
                ms
            )
            await page.wait(600)
            if (!t) {
                out[`${n} ${set}`] = 'no sound'
                continue
            }
            const s = stats(t)
            await wav(
                `${OUT}/${process.env.MN_NAME ?? 'p'}-${n}-${set.replace(/[=,.]/g, '_')}.wav`,
                t
            )
            const ev = t.events
                .filter(([, e]) => /speakers| x|Worklet|Convolver|WaveShaper|Compressor/.test(e))
                .slice(0, 14)
                .map(([ms2, e]) => `${ms2}:${e}`)
                .join(' ')
            out[`${n} ${set}`] =
                `first ${s.firstMs} last ${s.lastMs} peak ${s.peak} rms ${s.rmsDb} jump ${s.jump}@${s.jumpAtMs} width ${s.width} rate ${s.rate} | env ${s.env
                    .filter((_, i) => i % 2 === 0)
                    .slice(0, 40)
                    .join(' ')} | ${ev} | ${now}`
        }
    out.errors = page.errors
    return out
}
