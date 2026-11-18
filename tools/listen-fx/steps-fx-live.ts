export default async (page: any) => {
    const out: Record<string, unknown> = {}
    await page.wait(5000)
    const click = (id: string) =>
        page.eval(
            `(() => { const b = document.querySelector('#${id} .mn-play-toggle'); if (!b) return 'no button'; b.click(); return 'clicked' })()`
        )
    const links = () => page.eval(`JSON.stringify(window.__links.splice(0))`)
    const summary = (list: string[]) => {
        const counts: Record<string, number> = {}
        for (const l of list) counts[l] = (counts[l] ?? 0) + 1
        return counts
    }
    await links()
    for (const id of (process.env.MN_IDS ?? 'plain').split(',')) {
        const clicked = await click(id)
        await page.wait(3500)
        const during = JSON.parse(await links())
        await click(id)
        await page.wait(500)
        out[id] = { clicked, links: summary(during) }
        await links()
    }
    out.errors = page.errors
    return out
}
