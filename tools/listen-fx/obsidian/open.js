;(async () => {
    const P = 'zz-mn-room-check.md'
    let f = null
    for (let i = 0; i < 20 && !f; i++) {
        f = app.vault.getAbstractFileByPath(P)
        if (!f) await new Promise((r) => setTimeout(r, 300))
    }
    if (!f) return 'no file'
    window.__mnprev = app.workspace.getMostRecentLeaf()
    const leaf = app.workspace.getLeaf('tab')
    await leaf.openFile(f, { state: { mode: 'preview' }, active: true })
    window.__mnleaf = leaf
    await new Promise((r) => setTimeout(r, 6000))
    const el = leaf.view.containerEl
    return JSON.stringify({
        mode: leaf.view.getMode?.(),
        toggles: [...el.querySelectorAll('.mn-play-toggle')].map((b) =>
            b.getAttribute('aria-label')
        ),
        blocks: el.querySelectorAll('.mn-block').length,
        tabs: el.querySelectorAll('.at-surface, .mn-tab').length,
        errors: [...el.querySelectorAll('.mn-error')].map((e) => e.textContent.slice(0, 120)),
        commands: Object.keys(app.commands.commands).filter((c) => c.startsWith('music-practice:'))
            .length
    })
})()
