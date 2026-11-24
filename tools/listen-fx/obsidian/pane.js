;(async () => {
    app.setting.open()
    app.setting.openTabById('music-practice')
    await new Promise((r) => setTimeout(r, 4000))
    const root = app.setting.activeTab?.containerEl ?? app.setting.containerEl
    const rows = [...root.querySelectorAll('.setting-item')]
    const shown = document.body.contains(root)
    const pick = (name) =>
        rows.find((r) => (r.querySelector('.setting-item-name')?.textContent || '').trim() === name)
    const out = {}
    for (const name of [
        'Volume',
        'Room level',
        'Room length',
        'Amplifier cabinet',
        'Amplifier drive',
        'Scale tempo'
    ]) {
        const r = pick(name)
        if (!r) {
            out[name] = 'MISSING'
            continue
        }
        const input = r.querySelector('input[type=number], input[type=text]')
        const toggle = r.querySelector('.checkbox-container')
        out[name] = {
            value: input ? input.value : toggle ? toggle.classList.contains('is-enabled') : '?',
            desc: (r.querySelector('.setting-item-description')?.textContent || '').slice(0, 60)
        }
    }
    const names = rows.map((r) => (r.querySelector('.setting-item-name')?.textContent || '').trim())
    const i = names.indexOf('Volume')
    out.order = names.slice(i, i + 6)
    out.shown = shown
    out.rows = rows.length
    out.first = names.slice(0, 8)
    const target = pick('Room level')
    if (target) target.scrollIntoView({ block: 'center' })
    return JSON.stringify(out)
})()
