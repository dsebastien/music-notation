export default async (page: any) => {
    for (let i = 0; i < 40; i++) {
        const done = await page.eval(`window.__fx ? 'yes' : ''`)
        if (done === 'yes') break
        await page.wait(250)
    }
    return {
        fx: JSON.parse(await page.eval(`JSON.stringify(window.__fx ?? null)`)),
        errors: page.errors
    }
}
