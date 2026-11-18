// The listening page's controls. Dry, Cabinet and Drive are what each next Play asks for.
// The room's level and shape are applied by this page itself to what sounds now: it finds the
// library's room (its convolver and the gain after it) and gives it a room made with the
// library's own `roomImpulse` (fx-effects.js is a build of src/playback/effects.ts). Nothing is stored.
const state = {
    reverb: 0.125,
    room: 1.2,
    bright: 4000,
    width: 0.5,
    soft: true,
    dry: false,
    cabinet: false,
    drive: 0
}
// ?vol=0.03 plays very softly (for checks that must not disturb).
const softly = Number(new URLSearchParams(location.search).get('vol'))
window.musicNotationOptions = {
    play: {
        ...(softly > 0 ? { volume: softly } : {}),
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser',
        reverb: () => state.reverb,
        dry: () => state.dry,
        amp: () => ({ cabinet: state.cabinet, drive: state.drive })
    }
}
const wets = new Set()
const rooms = new Set()
// Every audio context that sounds on this page, for the dropout counter.
const contexts = new Set()
// What the browser says it could not play in time (its own count), over all contexts.
const dropouts = () => {
    let events = 0,
        seconds = 0,
        total = 0,
        known = false
    for (const ctx of contexts) {
        const stats = ctx.playbackStats
        if (!stats) continue
        known = true
        events += stats.underrunEvents ?? stats.fallbackFramesEvents ?? 0
        seconds += stats.underrunDuration ?? stats.fallbackFramesDuration ?? 0
        total += stats.totalDuration ?? stats.totalFramesDuration ?? 0
    }
    return { known, events, ms: Math.round(seconds * 1000), total }
}
window.__dropouts = dropouts
let fx = null
const shapeNow = () => ({
    bright: state.bright,
    dark: state.bright / 5,
    rise: state.soft ? 0.02 : 0,
    width: state.width
})
const isDefault = () =>
    state.room === 1.2 && state.bright === 4000 && state.width === 0.5 && state.soft
const giveRoom = (room) => {
    if (!fx || (isDefault() && !room.__mine)) return
    try {
        const ctx = room.context
        const [l, r] = fx.roomImpulse(ctx.sampleRate, state.room, shapeNow())
        const b = ctx.createBuffer(2, l.length, ctx.sampleRate)
        b.getChannelData(0).set(l)
        b.getChannelData(1).set(r)
        room.buffer = b
        room.__mine = true
    } catch (e) {
        console.error('room', e)
    }
}
import('/fx-effects.js').then((m) => {
    fx = m
    for (const room of rooms) giveRoom(room)
})
;(() => {
    const lowCuts = new WeakSet()
    const real = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (to, ...rest) {
        try {
            if (this.context instanceof AudioContext) contexts.add(this.context)
            if (this instanceof ConvolverNode && to instanceof BiquadFilterNode) {
                lowCuts.add(to)
                rooms.add(this)
                giveRoom(this)
            }
            if (lowCuts.has(this) && to instanceof GainNode) wets.add(to)
        } catch {}
        return real.apply(this, [to, ...rest])
    }
})()
const liveLevel = () => {
    for (const wet of wets)
        try {
            wet.gain.setTargetAtTime(state.reverb, wet.context.currentTime, 0.03)
        } catch {}
}
let roomTimer = 0
const liveRoom = () => {
    clearTimeout(roomTimer)
    roomTimer = setTimeout(() => {
        for (const room of rooms) giveRoom(room)
    }, 120)
}
document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div')
    bar.id = 'fx-bar'
    bar.innerHTML = `
      <label><input type="checkbox" id="fx-dry"> <b>Dry</b> (the sound of today: no room, no limiter, no amplifier) <i>next Play</i></label>
      <span class="sep"></span>
      <em>The room, live (move them while it plays; a small click when the room changes is normal):</em>
      <span class="sep"></span>
      <label><b>Level</b> <input type="range" id="fx-reverb" min="0" max="0.5" step="0.005" value="0.125"> <output id="fx-reverb-out"></output></label>
      <label><b>Length</b> <input type="range" id="fx-room" min="0.3" max="3" step="0.1" value="1.2"> <output id="fx-room-out"></output></label>
      <label><b>Tone</b> dark <input type="range" id="fx-bright" min="1000" max="10000" step="250" value="4000"> bright <output id="fx-bright-out"></output></label>
      <label><b>Width</b> middle <input type="range" id="fx-width" min="0" max="1" step="0.05" value="0.5"> wide <output id="fx-width-out"></output></label>
      <label><input type="checkbox" id="fx-soft" checked> <b>Soft start</b></label>
      <button id="fx-new" type="button">Back to the library's room</button>
      <span class="sep"></span>
      <em>Electric guitars only (clean, overdrive), next Play:</em>
      <label><input type="checkbox" id="fx-cabinet"> <b>Cabinet</b></label>
      <label><b>Drive</b> <input type="range" id="fx-drive" min="0" max="1" step="0.05" value="0"> <output id="fx-drive-out"></output></label>
      <span id="fx-now"></span>
      <span id="fx-drop" title="Counted by the browser: sound it could not deliver in time. Each one is a click or a gap."></span>`
    document.body.prepend(bar)
    const el = (id) => document.getElementById(id)
    const show = () => {
        el('fx-reverb').value = state.reverb
        el('fx-room').value = state.room
        el('fx-bright').value = state.bright
        el('fx-width').value = state.width
        el('fx-soft').checked = state.soft
        el('fx-reverb-out').textContent =
            state.reverb.toFixed(3) +
            (state.reverb > 0
                ? ' (' + (20 * Math.log10(state.reverb)).toFixed(0) + ' dB under the notes)'
                : ' (off)')
        el('fx-room-out').textContent = state.room.toFixed(1) + ' s'
        el('fx-bright-out').textContent = (state.bright / 1000).toFixed(2) + ' kHz'
        el('fx-width-out').textContent = state.width.toFixed(2)
        el('fx-drive-out').textContent = state.drive.toFixed(2)
        el('fx-now').textContent = state.dry
            ? 'Now: dry'
            : `Now: level ${state.reverb.toFixed(3)}, length ${state.room.toFixed(1)} s, tone ${(state.bright / 1000).toFixed(2)} kHz, width ${state.width.toFixed(2)}, soft start ${state.soft ? 'on' : 'off'}, cabinet ${state.cabinet ? 'on' : 'off'}, drive ${state.drive.toFixed(2)}`
    }
    el('fx-dry').addEventListener('change', (e) => {
        state.dry = e.target.checked
        show()
    })
    el('fx-reverb').addEventListener('input', (e) => {
        state.reverb = Number(e.target.value)
        liveLevel()
        show()
    })
    el('fx-room').addEventListener('input', (e) => {
        state.room = Number(e.target.value)
        liveRoom()
        show()
    })
    el('fx-bright').addEventListener('input', (e) => {
        state.bright = Number(e.target.value)
        liveRoom()
        show()
    })
    el('fx-width').addEventListener('input', (e) => {
        state.width = Number(e.target.value)
        liveRoom()
        show()
    })
    el('fx-soft').addEventListener('change', (e) => {
        state.soft = e.target.checked
        liveRoom()
        show()
    })
    el('fx-new').addEventListener('click', () => {
        Object.assign(state, { reverb: 0.125, room: 1.2, bright: 4000, width: 0.5, soft: true })
        liveLevel()
        liveRoom()
        show()
    })
    el('fx-cabinet').addEventListener('change', (e) => {
        state.cabinet = e.target.checked
        show()
    })
    el('fx-drive').addEventListener('input', (e) => {
        state.drive = Number(e.target.value)
        show()
    })
    show()
    let seen = 0
    setInterval(() => {
        const d = dropouts()
        const out = el('fx-drop')
        out.textContent = !d.known
            ? contexts.size
                ? 'Dropouts: this browser does not count them'
                : 'Dropouts: none yet (press Play)'
            : `Dropouts counted by the browser since the page loaded: ${d.events} (${d.ms} ms of sound lost)`
        out.style.background = d.events > seen ? '#ffb3b3' : ''
        seen = d.events
    }, 500)
})
