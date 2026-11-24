;(async () => {
    const el = window.__mnleaf.view.containerEl
    const b = el.querySelector('.markdown-preview-view').querySelectorAll('.mn-play-toggle')[N]
    if (!b) return 'no button'
    let before = b.getAttribute('aria-label')
    if (before === 'Stop' || before === 'Pause') {
        b.click()
        await new Promise((r) => setTimeout(r, 1500))
        const stop = b.closest('.mn-block')?.querySelector('.mn-tab-stop')
        if (stop) {
            stop.click()
            await new Promise((r) => setTimeout(r, 800))
        }
        before += ' (stopped first)'
    }
    b.click()
    await new Promise((r) => setTimeout(r, 300))
    return before + ' -> ' + b.getAttribute('aria-label')
})()
