;(async () => {
    const rows = [
        ...(app.setting.activeTab?.containerEl ?? app.setting.containerEl).querySelectorAll(
            '.setting-item'
        )
    ]
    const r = rows.find(
        (r) => (r.querySelector('.setting-item-name')?.textContent || '').trim() === NAME
    )
    if (!r) return 'no row'
    const input = r.querySelector('input[type=number], input[type=text]')
    const toggle = r.querySelector('.checkbox-container')
    if (input) {
        input.value = VALUE
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.blur()
    } else if (toggle) toggle.click()
    await new Promise((r) => setTimeout(r, 1200))
    const pb = app.plugins.plugins['music-practice'].settings.playback
    const err =
        r.querySelector(
            '.setting-item-description .mod-warning, .setting-validation-error, .mod-error'
        )?.textContent || r.className
    return JSON.stringify({
        roomLevel: pb.roomLevel,
        roomLength: pb.roomLength,
        ampCabinet: pb.ampCabinet,
        ampDrive: pb.ampDrive,
        row: err
    })
})()
