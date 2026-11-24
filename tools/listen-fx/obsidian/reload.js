;(async () => {
    await app.plugins.disablePlugin('music-practice')
    await app.plugins.loadManifests()
    await app.plugins.enablePlugin('music-practice')
    for (let i = 0; i < 60; i++) {
        if (Object.keys(app.commands.commands).some((c) => c.startsWith('music-practice:'))) break
        await new Promise((r) => setTimeout(r, 250))
    }
    return JSON.stringify({
        v: app.plugins.manifests['music-practice'].version,
        on: !!app.plugins.plugins['music-practice'],
        commands: Object.keys(app.commands.commands).filter((c) => c.startsWith('music-practice:'))
            .length
    })
})()
