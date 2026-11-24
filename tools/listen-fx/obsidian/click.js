;(async () => {
    const el = window.__mnleaf.view.containerEl
    const b = el.querySelector('.markdown-preview-view').querySelectorAll('.mn-play-toggle')[N]
    if (!b) return 'no button'
    const before = b.getAttribute('aria-label')
    b.click()
    await new Promise((r) => setTimeout(r, 300))
    return before + ' -> ' + b.getAttribute('aria-label')
})()
