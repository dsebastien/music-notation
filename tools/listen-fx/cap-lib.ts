// Records what reaches the speakers of a page (every audio context), for measures (#103).
// page-side: window.__cap.start() / window.__cap.stop() -> { rate, left: base64 f32, right, events }
export const INSTALL = `(() => {
  if (window.__cap) return 'already'
  const cap = (window.__cap = { on: false, taps: new Map(), parts: [], events: [], t0: 0 })
  const real = AudioNode.prototype.connect
  const realDis = AudioNode.prototype.disconnect
  const tapOf = (ctx, dest) => {
    let tap = cap.taps.get(ctx)
    if (tap) return tap
    tap = ctx.createScriptProcessor(2048, 2, 2)
    tap.onaudioprocess = (e) => {
      if (!cap.on) return
      cap.parts.push({ ctx: ctx.__capId, rate: ctx.sampleRate, l: e.inputBuffer.getChannelData(0).slice(), r: e.inputBuffer.getChannelData(1).slice() })
    }
    ctx.__capId = cap.taps.size
    const mute = ctx.createGain(); mute.gain.value = 0
    real.call(tap, mute); real.call(mute, dest)
    cap.taps.set(ctx, tap)
    return tap
  }
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) {
      real.call(this, tapOf(dest.context, dest))
      if (cap.on) cap.events.push([Math.round(performance.now() - cap.t0), this.constructor.name + '->speakers'])
    } else if (cap.on && dest && dest.constructor) cap.events.push([Math.round(performance.now() - cap.t0), this.constructor.name + '->' + dest.constructor.name])
    return real.apply(this, [dest, ...rest])
  }
  AudioNode.prototype.disconnect = function (...a) {
    if (cap.on) cap.events.push([Math.round(performance.now() - cap.t0), this.constructor.name + ' x'])
    return realDis.apply(this, a)
  }
  cap.start = () => { cap.parts = []; cap.events = []; cap.t0 = performance.now(); cap.on = true }
  cap.stop = () => {
    cap.on = false
    const by = new Map()
    for (const p of cap.parts) { if (!by.has(p.ctx)) by.set(p.ctx, { rate: p.rate, l: [], r: [] }); by.get(p.ctx).l.push(p.l); by.get(p.ctx).r.push(p.r) }
    const b64 = (chunks) => { const n = chunks.reduce((s, c) => s + c.length, 0); const all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length } const u = new Uint8Array(all.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s) }
    const out = []
    for (const [id, v] of by) out.push({ ctx: id, rate: v.rate, l: b64(v.l), r: b64(v.r) })
    return JSON.stringify({ contexts: out, events: cap.events })
  }
  return 'installed'
})()`

const f32 = (b64: string) => {
    const b = Buffer.from(b64, 'base64')
    return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice()
}
export interface Take {
    rate: number
    l: Float32Array
    r: Float32Array
    events: [number, string][]
}
/** Records `ms` of the page's output around `action` (page-side JS). The loudest context wins. */
export async function take(page: any, action: string, ms: number): Promise<Take | null> {
    await page.eval(INSTALL)
    await page.eval(`window.__cap.start()`)
    await page.eval(action)
    await page.wait(ms)
    const raw = JSON.parse(await page.eval(`window.__cap.stop()`))
    let best: Take | null = null,
        bestE = -1
    for (const c of raw.contexts) {
        const l = f32(c.l),
            r = f32(c.r)
        let e = 0
        for (let i = 0; i < l.length; i++) e += l[i]! * l[i]! + r[i]! * r[i]!
        if (e > bestE) {
            bestE = e
            best = { rate: c.rate, l, r, events: raw.events }
        }
    }
    return best
}
export const db = (x: number) => +(20 * Math.log10(Math.max(x, 1e-9))).toFixed(1)
export function stats(t: Take) {
    const n = t.l.length,
        m = new Float32Array(n)
    let peak = 0,
        first = -1
    for (let i = 0; i < n; i++) {
        m[i] = (t.l[i]! + t.r[i]!) / 2
        const a = Math.max(Math.abs(t.l[i]!), Math.abs(t.r[i]!))
        if (a > peak) peak = a
        if (first < 0 && a > 1e-4) first = i
    }
    let last = n - 1
    while (last > 0 && Math.abs(m[last]!) < 1e-4) last--
    const rms = (a: number, b: number) => {
        let s = 0
        a = Math.max(0, a)
        b = Math.min(n, b)
        for (let i = a; i < b; i++) s += m[i]! * m[i]!
        return Math.sqrt(s / Math.max(1, b - a))
    }
    // The envelope: rms per 50 ms from the first sound.
    const win = Math.round(t.rate * 0.05),
        env: number[] = []
    for (let i = Math.max(0, first); i < n; i += win) env.push(db(rms(i, i + win)))
    // Clicks: the largest jump between two samples, against the level around it.
    let jump = 0,
        jumpAt = 0
    for (let i = 1; i < n; i++) {
        const d = Math.abs(m[i]! - m[i - 1]!)
        if (d > jump) {
            jump = d
            jumpAt = i
        }
    }
    // Left and right alike? (1 = mono)
    let lr = 0,
        ll = 0,
        rr = 0
    for (let i = 0; i < n; i++) {
        lr += t.l[i]! * t.r[i]!
        ll += t.l[i]! * t.l[i]!
        rr += t.r[i]! * t.r[i]!
    }
    return {
        rate: t.rate,
        firstMs: Math.round((first / t.rate) * 1000),
        lastMs: Math.round((last / t.rate) * 1000),
        peak: +peak.toFixed(3),
        rmsDb: db(rms(first, last)),
        jump: +jump.toFixed(3),
        jumpAtMs: Math.round((jumpAt / t.rate) * 1000),
        width: +(lr / Math.sqrt(ll * rr || 1)).toFixed(3),
        env
    }
}
export async function wav(file: string, t: Take) {
    const n = t.l.length,
        b = Buffer.alloc(44 + n * 4)
    b.write('RIFF', 0)
    b.writeUInt32LE(36 + n * 4, 4)
    b.write('WAVEfmt ', 8)
    b.writeUInt32LE(16, 16)
    b.writeUInt16LE(1, 20)
    b.writeUInt16LE(2, 22)
    b.writeUInt32LE(t.rate, 24)
    b.writeUInt32LE(t.rate * 4, 28)
    b.writeUInt16LE(4, 32)
    b.writeUInt16LE(16, 34)
    b.write('data', 36)
    b.writeUInt32LE(n * 4, 40)
    for (let i = 0; i < n; i++) {
        b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, t.l[i]!)) * 32767), 44 + i * 4)
        b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, t.r[i]!)) * 32767), 46 + i * 4)
    }
    await Bun.write(file, b)
    // The exact samples too (left then right), for offline renders.
    const raw = new Float32Array(n * 2)
    raw.set(t.l, 0)
    raw.set(t.r, n)
    await Bun.write(file.replace(/\.wav$/, '.f32'), new Uint8Array(raw.buffer))
}
