// A probe for a real browser (#103): records what reaches the speakers of this page, and compares
// a play with the room against a model made from the dry play. Load it before the first play.
;(() => {
    if (window.__probe) return
    const P = (window.__probe = {
        on: false,
        parts: [],
        times: [],
        takes: {},
        result: null,
        log: []
    })
    const real = AudioNode.prototype.connect
    const taps = new Map()
    const tapOf = (ctx, dest) => {
        let tap = taps.get(ctx)
        if (tap) return tap
        tap = ctx.createScriptProcessor(2048, 2, 2)
        tap.onaudioprocess = (e) => {
            if (!P.on) return
            P.times.push(performance.now())
            P.parts.push([
                e.inputBuffer.getChannelData(0).slice(),
                e.inputBuffer.getChannelData(1).slice(),
                ctx
            ])
        }
        const mute = ctx.createGain()
        mute.gain.value = 0
        real.call(tap, mute)
        real.call(mute, dest)
        taps.set(ctx, tap)
        return tap
    }
    AudioNode.prototype.connect = function (dest, ...rest) {
        if (dest instanceof AudioDestinationNode) real.call(this, tapOf(dest.context, dest))
        return real.apply(this, [dest, ...rest])
    }
    P.start = () => {
        P.parts = []
        P.times = []
        P.on = true
    }
    P.stop = (name) => {
        P.on = false
        // The context that sounded most.
        const by = new Map()
        for (const [l, r, ctx] of P.parts) {
            if (!by.has(ctx)) by.set(ctx, [])
            by.get(ctx).push([l, r])
        }
        let best = null,
            bestE = -1
        for (const [ctx, chunks] of by) {
            let e = 0
            for (const [l] of chunks) for (let i = 0; i < l.length; i += 7) e += l[i] * l[i]
            if (e > bestE) {
                bestE = e
                best = [ctx, chunks]
            }
        }
        if (!best) {
            P.takes[name] = null
            return 'nothing recorded'
        }
        const [ctx, chunks] = best,
            n = chunks.length * 2048,
            l = new Float32Array(n),
            r = new Float32Array(n)
        chunks.forEach(([a, b], i) => {
            l.set(a, i * 2048)
            r.set(b, i * 2048)
        })
        // How the browser asks for sound: the gaps between two blocks of 2048 points (ms).
        const gaps = P.times
            .slice(1)
            .map((t, i) => t - P.times[i])
            .sort((a, b) => a - b)
        P.takes[name] = { l, r, rate: ctx.sampleRate }
        let peak = 0
        for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]))
        return `${name}: ${(n / ctx.sampleRate).toFixed(1)} s, peak ${peak.toFixed(3)}, rate ${ctx.sampleRate}, state ${ctx.state}, base latency ${Math.round((ctx.baseLatency ?? 0) * 1000)} ms, output latency ${Math.round((ctx.outputLatency ?? 0) * 1000)} ms, block gaps ms: least ${gaps[0]?.toFixed(1)}, median ${gaps[gaps.length >> 1]?.toFixed(1)}, most ${gaps[gaps.length - 1]?.toFixed(1)}`
    }
    const db = (x) => +(10 * Math.log10(Math.max(x, 1e-15))).toFixed(1)
    const first = (d) => {
        for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 1e-4) return i
        return 0
    }
    // The play with the room against the dry play through a model of the room (level, module).
    P.compare = async (dryName, wetName, level, module = '/fx-effects-pass2.js') => {
        P.result = null
        try {
            const fx = await import(module)
            const dry = P.takes[dryName],
                live = P.takes[wetName],
                RATE = dry.rate
            const ctx = new OfflineAudioContext(2, dry.l.length + RATE * 2, RATE)
            const buf = ctx.createBuffer(1, dry.l.length, RATE)
            buf.getChannelData(0).set(dry.l)
            const src = ctx.createBufferSource()
            src.buffer = buf
            src.start(0)
            src.connect(ctx.destination)
            if (level) {
                const c = ctx.createConvolver()
                c.normalize = false
                const [il, ir] = fx.roomImpulse(RATE)
                const b = ctx.createBuffer(2, il.length, RATE)
                b.getChannelData(0).set(il)
                b.getChannelData(1).set(ir)
                c.buffer = b
                const f = ctx.createBiquadFilter()
                f.type = 'highpass'
                f.frequency.value = fx.ROOM_LOW_CUT
                f.Q.value = 0.7
                const w = ctx.createGain()
                w.gain.value = level
                src.connect(c)
                c.connect(f)
                f.connect(w)
                w.connect(ctx.destination)
            }
            const out = await ctx.startRendering()
            const side = (liveSide, ref) => {
                const a = first(dry.l),
                    b = first(liveSide)
                let best = [0, Infinity]
                for (let lag = -700; lag <= 700; lag++) {
                    let s = 0
                    for (let i = 4000; i < 40000; i += 5) {
                        const d = liveSide[b + i + lag] - ref[a + i]
                        s += d * d
                    }
                    if (s < best[1]) best = [lag, s]
                }
                const off = b + best[0] - a,
                    w = Math.round(RATE * 0.01)
                let e = 0,
                    r = 0,
                    eg = 0,
                    worst = 0,
                    worstAt = 0,
                    bad = 0,
                    frames = 0
                for (let i = a; i + w < ref.length && i + off + w < liveSide.length; i += w) {
                    let lr = 0,
                        rr = 0
                    for (let j = i; j < i + w; j++) {
                        lr += liveSide[j + off] * ref[j]
                        rr += ref[j] * ref[j]
                    }
                    if (rr / w < 1e-5) continue
                    const g = lr / rr
                    let d2 = 0,
                        dg2 = 0
                    for (let j = i; j < i + w; j++) {
                        const d = liveSide[j + off] - ref[j],
                            dg = liveSide[j + off] - g * ref[j]
                        d2 += d * d
                        dg2 += dg * dg
                    }
                    e += d2
                    eg += dg2
                    r += rr
                    frames++
                    if (dg2 / rr > 0.01) bad++
                    if (dg2 / rr > worst) {
                        worst = dg2 / rr
                        worstAt = i
                    }
                }
                return `left over ${db(e / r)} dB; level of each 10 ms taken out: ${db(eg / r)} dB; worst 10 ms ${db(worst)} dB at ${Math.round(((worstAt - a) / RATE) * 1000)} ms; frames worse than -20 dB: ${bad} of ${frames}; lag ${best[0]}`
            }
            P.result = {
                left: side(live.l, out.getChannelData(0)),
                right: side(live.r, out.getChannelData(1))
            }
        } catch (e) {
            P.result = 'error: ' + (e && e.message)
        }
        return P.result
    }
})()
