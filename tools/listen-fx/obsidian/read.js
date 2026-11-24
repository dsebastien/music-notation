;(() => {
    const log = window.__mnlog
    if (!log) return 'no log'
    const seen = new Map()
    for (const [, e] of log.events) seen.set(e, (seen.get(e) || 0) + 1)
    const ctxs = [...log.ctxs].map((c) => ({
        state: c.state,
        rate: c.sampleRate,
        latency: +(c.outputLatency || 0).toFixed(3),
        ownDestination: Object.prototype.hasOwnProperty.call(c, 'destination'),
        stats: c.playbackStats
            ? {
                  underruns: c.playbackStats.underrunEvents,
                  underrunMs: Math.round(c.playbackStats.underrunDuration * 1000),
                  totalS: Math.round(c.playbackStats.totalDuration)
              }
            : 'no playbackStats'
    }))
    log.events.length = 0
    return JSON.stringify({ events: [...seen].map(([e, c]) => e + ' x' + c), ctxs })
})()
