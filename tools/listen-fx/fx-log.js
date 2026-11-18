// Logs every Web Audio connection, so a check can see where each node's sound goes.
window.__links = []
for (const [name, tag] of [
    ['connect', '->'],
    ['disconnect', 'x']
]) {
    const original = AudioNode.prototype[name]
    AudioNode.prototype[name] = function (...args) {
        const to = args[0] && args[0].constructor ? args[0].constructor.name : ''
        window.__links.push(this.constructor.name + tag + to)
        return original.apply(this, args)
    }
}
