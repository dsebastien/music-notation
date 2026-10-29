/**
 * The playback bar of a diagram: play / stop, loop, speed (when several notes play), volume and
 * sound, at the bottom of the diagram, shown on hover (on tap on touch screens). A click on a dot
 * or a key plays that note.
 */
import { html } from '../render/dom.js'
import {
    DEFAULT_SEQUENCE,
    lightPlayer,
    sequenceOf,
    type NotePlayer,
    type PlayHandle,
    type PlayKind,
    type Sound
} from './player.js'

export interface PlayOptions {
    /**
     * Plays the notes: a player, or a function returning one at each play (null for the default),
     * so a soundfont loaded later is used once it's there. The light synthesizer by default.
     */
    player?: NotePlayer | (() => NotePlayer | null | undefined)
    /** Guitar or piano; by default the diagram's (piano for keyboards and piano chords). */
    sound?: Sound
    /** 0 to 1, 0.8 by default. */
    volume?: number
    /** Scales: notes per minute, 90 by default. */
    bpm?: number
    /** Chords: milliseconds between strings, 40 by default. */
    strum?: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** The player apps passed, or one light synthesizer per window. */
const players = new WeakMap<Window, NotePlayer>()
function playerFor(win: Window, options: PlayOptions): NotePlayer {
    const given = typeof options.player === 'function' ? options.player() : options.player
    if (given) return given
    let player = players.get(win)
    if (!player) {
        player = lightPlayer(win)
        players.set(win, player)
    }
    return player
}

/** The diagram's own playback data, set by its renderer. */
function dataOf(diagram: Element): { kind: PlayKind; pitches: number[]; sound: Sound } | null {
    const pitches = (diagram.getAttribute('data-mn-pitches') ?? '')
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))
    if (!pitches.length) return null
    return {
        kind: diagram.getAttribute('data-mn-play') === 'chord' ? 'chord' : 'scale',
        pitches,
        sound: diagram.getAttribute('data-mn-sound') === 'piano' ? 'piano' : 'guitar'
    }
}

/**
 * Wraps each playable diagram in `el` (an SVG with notes to play) with its playback bar. Returns
 * a function that stops whatever plays.
 */
export function attachPlayback(el: HTMLElement, options: PlayOptions = {}): () => void {
    const doc = el.ownerDocument
    const win = doc.defaultView
    if (!win) return () => {}
    const stops: (() => void)[] = []
    for (const diagram of [...el.querySelectorAll('svg[data-mn-pitches]')]) {
        const data = dataOf(diagram)
        if (!data) continue
        stops.push(barFor(doc, win, diagram, data, options))
    }
    return () => stops.forEach((stop) => stop())
}

function barFor(
    doc: Document,
    win: Window,
    diagram: Element,
    data: { kind: PlayKind; pitches: number[]; sound: Sound },
    options: PlayOptions
): () => void {
    const wrap = html(doc, 'div', 'mn-playable')
    diagram.parentNode?.insertBefore(wrap, diagram)
    wrap.appendChild(diagram)
    const bar = html(doc, 'div', 'mn-play')
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', 'Playback')
    wrap.appendChild(bar)

    const settings = {
        sound: options.sound ?? data.sound,
        volume: clamp(options.volume ?? 0.8, 0, 1),
        bpm: clamp(options.bpm ?? DEFAULT_SEQUENCE.bpm, 20, 400),
        strum: clamp(options.strum ?? DEFAULT_SEQUENCE.strum, 0, 500),
        loop: false
    }
    let playing: PlayHandle | null = null

    const toggle = html(doc, 'button', 'mn-play-toggle', '▶')
    toggle.type = 'button'
    const show = () => {
        toggle.textContent = playing ? '■' : '▶'
        toggle.setAttribute('aria-label', playing ? 'Stop' : 'Play')
    }
    const stop = () => {
        playing?.stop()
        playing = null
        show()
    }
    const start = () => {
        stop()
        const events = sequenceOf(data.kind, data.pitches, settings)
        playing = playerFor(win, options).play(events, {
            sound: settings.sound,
            volume: settings.volume,
            onEnd: () => {
                playing = null
                if (settings.loop) start()
                else show()
            }
        })
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    const loop = html(doc, 'button', 'mn-play-loop', '⟲')
    loop.type = 'button'
    loop.setAttribute('aria-label', 'Loop')
    loop.setAttribute('aria-pressed', 'false')
    loop.addEventListener('click', () => {
        settings.loop = !settings.loop
        loop.setAttribute('aria-pressed', String(settings.loop))
        loop.classList.toggle('mn-on', settings.loop)
    })
    bar.appendChild(loop)

    const slider = (
        label: string,
        min: number,
        max: number,
        value: number,
        set: (n: number) => void
    ) => {
        const field = html(doc, 'label', 'mn-play-field')
        field.appendChild(html(doc, 'span', 'mn-play-label', label))
        const input = html(doc, 'input')
        input.type = 'range'
        input.min = String(min)
        input.max = String(max)
        input.value = String(value)
        const out = html(doc, 'span', 'mn-play-value', String(value))
        input.addEventListener('input', () => {
            set(Number(input.value))
            out.textContent = input.value
        })
        field.append(input, out)
        bar.appendChild(field)
    }
    // Speed only when several notes play: BPM for scales, the strum's spread for chords.
    if (data.pitches.length > 1) {
        if (data.kind === 'scale') slider('BPM', 20, 240, settings.bpm, (n) => (settings.bpm = n))
        else slider('Strum ms', 0, 200, settings.strum, (n) => (settings.strum = n))
    }
    slider('Vol', 0, 100, Math.round(settings.volume * 100), (n) => (settings.volume = n / 100))

    const sound = html(doc, 'select', 'mn-play-sound')
    sound.setAttribute('aria-label', 'Sound')
    for (const value of ['guitar', 'piano'] as const) {
        const option = html(doc, 'option', undefined, value === 'guitar' ? 'Guitar' : 'Piano')
        option.value = value
        option.selected = value === settings.sound
        sound.appendChild(option)
    }
    sound.addEventListener('change', () => {
        settings.sound = sound.value === 'piano' ? 'piano' : 'guitar'
    })
    bar.appendChild(sound)

    // A dot or a key plays its note.
    diagram.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-midi]') : null
        const midi = Number(target?.getAttribute('data-midi'))
        if (!target || !Number.isFinite(midi)) return
        stop()
        playing = playerFor(win, options).play([{ midi, time: 0, duration: 1.5 }], {
            sound: settings.sound,
            volume: settings.volume,
            onEnd: () => {
                playing = null
                show()
            }
        })
        show()
    })
    // Touch screens have no hover: a tap on the diagram shows the bar.
    wrap.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' || bar.contains(event.target as Node)) return
        wrap.classList.toggle('mn-play-open')
    })
    return stop
}
