// The listening page's controls: what each next Play asks for. Nothing is stored.
const state = { reverb: 0.25, room: 1.2, dry: false, cabinet: false, drive: 0 }
window.musicNotationOptions = {
    play: {
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser',
        reverb: () => state.reverb,
        room: () => state.room,
        dry: () => state.dry,
        amp: () => ({ cabinet: state.cabinet, drive: state.drive })
    }
}
// The Room level is also applied to what sounds now (this page only: it finds the room's gain,
// the one the room's low cut goes to). The library applies a level at the next Play.
const wets = new Set()
;(() => {
    const lowCuts = new WeakSet()
    const real = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (to, ...rest) {
        try {
            if (this instanceof ConvolverNode && to instanceof BiquadFilterNode) lowCuts.add(to)
            if (lowCuts.has(this) && to instanceof GainNode) wets.add(to)
        } catch {}
        return real.apply(this, [to, ...rest])
    }
})()
const liveRoom = () => {
    for (const wet of wets)
        try {
            wet.gain.setTargetAtTime(state.dry ? 0 : state.reverb, wet.context.currentTime, 0.03)
        } catch {}
}
document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div')
    bar.id = 'fx-bar'
    bar.innerHTML = `
      <label><input type="checkbox" id="fx-dry"> <b>Dry</b> (the sound of today: no room, no limiter, no amplifier) <i>next Play</i></label>
      <span class="sep"></span>
      <label><b>Room level</b> <input type="range" id="fx-reverb" min="0" max="1" step="0.05" value="0.25"> <output id="fx-reverb-out">0.25</output> <i>live: move it while it plays</i></label>
      <label><b>Room length</b> <input type="range" id="fx-room" min="0.3" max="3" step="0.1" value="1.2"> <output id="fx-room-out">1.2 s</output> <i>next Play</i></label>
      <span class="sep"></span>
      <em>Electric guitars only (clean, overdrive), next Play:</em>
      <label><input type="checkbox" id="fx-cabinet"> <b>Cabinet</b></label>
      <label><b>Drive</b> <input type="range" id="fx-drive" min="0" max="1" step="0.05" value="0"> <output id="fx-drive-out">0</output></label>
      <span id="fx-now"></span>`
    document.body.prepend(bar)
    const show = () => {
        document.getElementById('fx-reverb-out').textContent = state.reverb.toFixed(2)
        document.getElementById('fx-room-out').textContent = state.room.toFixed(1) + ' s'
        document.getElementById('fx-drive-out').textContent = state.drive.toFixed(2)
        document.getElementById('fx-now').textContent = state.dry
            ? 'Now: dry'
            : `Now: room ${state.reverb.toFixed(2)}, ${state.room.toFixed(1)} s, cabinet ${state.cabinet ? 'on' : 'off'}, drive ${state.drive.toFixed(2)}`
    }
    document.getElementById('fx-dry').addEventListener('change', (e) => {
        state.dry = e.target.checked
        show()
    })
    document.getElementById('fx-reverb').addEventListener('input', (e) => {
        state.reverb = Number(e.target.value)
        liveRoom()
        show()
    })
    document.getElementById('fx-room').addEventListener('input', (e) => {
        state.room = Number(e.target.value)
        show()
    })
    document.getElementById('fx-cabinet').addEventListener('change', (e) => {
        state.cabinet = e.target.checked
        show()
    })
    document.getElementById('fx-drive').addEventListener('input', (e) => {
        state.drive = Number(e.target.value)
        show()
    })
    show()
})
