;(async () => {
    const out = []
    if (window.__mnlog) out.push(window.__mnlog.restore())
    if (window.__mnleaf) {
        window.__mnleaf.detach()
        delete window.__mnleaf
        out.push('tab closed')
    }
    if (window.__mnprev) {
        try {
            app.workspace.setActiveLeaf(window.__mnprev, { focus: true })
        } catch (e) {}
        delete window.__mnprev
    }
    return out.join(', ')
})()
