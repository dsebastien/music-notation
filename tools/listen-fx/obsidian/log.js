;(() => {
    if (window.__mnlog) {
        window.__mnlog.events.length = 0
        return 'reset'
    }
    const real = AudioNode.prototype.connect
    const log = (window.__mnlog = { events: [], ctxs: new Set(), real })
    AudioNode.prototype.connect = function (dest, ...rest) {
        try {
            log.ctxs.add(this.context)
            log.events.push([
                Math.round(performance.now()),
                this.constructor.name +
                    '->' +
                    (dest instanceof AudioDestinationNode
                        ? 'speakers'
                        : dest && dest.constructor
                          ? dest.constructor.name
                          : '?')
            ])
        } catch (e) {}
        return real.apply(this, [dest, ...rest])
    }
    log.restore = () => {
        AudioNode.prototype.connect = real
        delete window.__mnlog
        return 'restored'
    }
    return 'installed'
})()
