const OUT = process.env.MN_SHOTS ?? '/tmp'
export default async (page: any) => {
    const out: Record<string, unknown> = {}
    await page.wait(Number(process.env.MN_WAIT ?? 3000))
    await page.eval(
        `(() => { window.__links = []; for (const [name, tag] of [['connect', '->'], ['disconnect', 'x']]) { const o = AudioNode.prototype[name]; AudioNode.prototype[name] = function (...a) { window.__links.push(this.constructor.name + tag + (a[0] && a[0].constructor ? a[0].constructor.name : '')); return o.apply(this, a) } } })()`
    )
    out.blocks = await page.eval(
        `JSON.stringify({ blocks: document.querySelectorAll('.mn-block').length, errors: [...document.querySelectorAll('.mn-error-message')].map(e => e.textContent).slice(0, 3), bars: document.querySelectorAll('.mn-play-toggle').length, bar: document.getElementById('fx-now')?.textContent })`
    )
    const set = (js: string) =>
        page.eval(`(() => { ${js}; return document.getElementById('fx-now').textContent })()`)
    const links = async () => {
        const l: string[] = JSON.parse(await page.eval(`JSON.stringify(window.__links.splice(0))`))
        const c: Record<string, number> = {}
        for (const x of l) c[x] = (c[x] ?? 0) + 1
        return c
    }
    // The overdriven guitar's strum of the first engine: the 8th toggle (4 guitars x chord, strum).
    const toggle = (n: number) =>
        page.eval(
            `(() => { const b = document.querySelectorAll('.mn-play-toggle')[${n}]; if (!b) return 'none'; b.click(); return b.closest('.mn-block')?.getAttribute('data-mn-guitar') ?? 'no guitar' })()`
        )
    const play = async (n: number) => {
        await links()
        const g = await toggle(n)
        await page.wait(2500)
        const l = await links()
        await toggle(n)
        await page.wait(400)
        return { guitar: g, links: l }
    }
    out['default (overdrive strum)'] = await play(7)
    out['dry'] = {
        now: await set(
            `const d = document.getElementById('fx-dry'); d.checked = true; d.dispatchEvent(new Event('change'))`
        ),
        ...(await play(7))
    }
    out['cabinet and drive'] = {
        now: await set(
            `const d = document.getElementById('fx-dry'); d.checked = false; d.dispatchEvent(new Event('change')); const c = document.getElementById('fx-cabinet'); c.checked = true; c.dispatchEvent(new Event('change')); const r = document.getElementById('fx-drive'); r.value = '0.5'; r.dispatchEvent(new Event('input'))`
        ),
        ...(await play(7))
    }
    out['steel with the amp on (no amp expected)'] = await play(1)
    out.shot = await page.shot(`${OUT}/${process.env.MN_NAME ?? 'listen-fx'}.png`)
    out.errors = page.errors
    return out
}
