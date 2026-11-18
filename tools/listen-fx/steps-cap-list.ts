export default async (page: any) => {
    await page.wait(Number(process.env.MN_WAIT ?? 3000))
    return JSON.parse(
        await page.eval(
            `JSON.stringify([...document.querySelectorAll('.mn-play-toggle')].map((b, i) => { const k = b.closest('.mn-block'); let h = k; while (h && !/^H[23]$/.test(h.tagName)) h = h.previousElementSibling || h.parentElement; let h2 = h; while (h2 && h2.tagName !== 'H2') h2 = h2.previousElementSibling || h2.parentElement; return i + ' ' + (h2?.textContent ?? '').slice(0, 28) + ' | ' + (h?.textContent ?? '').slice(0, 30) + ' | ' + (k?.className ?? '').replace('mn-block', '').trim().slice(0, 30) + ' | ' + (k?.getAttribute('data-mn-guitar') ?? '') }))`
        )
    )
}
