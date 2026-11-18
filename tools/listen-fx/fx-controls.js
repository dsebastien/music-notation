// The listening page's controls: what each next Play asks for. Nothing is stored.
const state = { reverb: 0.16, dry: false, cabinet: false, drive: 0 }
window.musicNotationOptions = {
    play: {
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser',
        reverb: () => state.reverb,
        dry: () => state.dry,
        amp: () => ({ cabinet: state.cabinet, drive: state.drive })
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div')
    bar.id = 'fx-bar'
    bar.innerHTML = `
      <strong>Applies at the next Play</strong>
      <label><input type="checkbox" id="fx-dry"> Dry (as today: no room, no limiter)</label>
      <label>Room <input type="range" id="fx-reverb" min="0" max="0.6" step="0.02" value="0.16"> <output id="fx-reverb-out">0.16</output></label>
      <span class="sep"></span>
      <em>Electric guitars only (clean, overdrive):</em>
      <label><input type="checkbox" id="fx-cabinet"> Cabinet</label>
      <label>Drive <input type="range" id="fx-drive" min="0" max="1" step="0.05" value="0"> <output id="fx-drive-out">0</output></label>
      <span id="fx-now"></span>`
    document.body.prepend(bar)
    const show = () => {
        document.getElementById('fx-reverb-out').textContent = state.reverb.toFixed(2)
        document.getElementById('fx-drive-out').textContent = state.drive.toFixed(2)
        document.getElementById('fx-now').textContent = state.dry
            ? 'Now: dry'
            : `Now: room ${state.reverb.toFixed(2)}, cabinet ${state.cabinet ? 'on' : 'off'}, drive ${state.drive.toFixed(2)}`
    }
    document.getElementById('fx-dry').addEventListener('change', (e) => {
        state.dry = e.target.checked
        show()
    })
    document.getElementById('fx-reverb').addEventListener('input', (e) => {
        state.reverb = Number(e.target.value)
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
