/**
 * The playback bar of a diagram: play / stop, loop, speed (when several notes play), volume and
 * sound, at the bottom of the diagram, shown on hover (on tap on touch screens). A click on a dot
 * or a key plays that note.
 */
import { html, svg } from '../render/dom.js'
import {
    DEFAULT_SEQUENCE,
    lightPlayer,
    sequenceOf,
    type NoteEvent,
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

/** A number within bounds; the fallback when it isn't a number at all. */
const clamp = (n: number | undefined, lo: number, hi: number, fallback: number) =>
    n === undefined || !Number.isFinite(n) ? fallback : Math.min(hi, Math.max(lo, n))

/** Small icons, drawn so they look the same in every font. */
const ICONS: Record<'play' | 'stop' | 'loop' | 'volume', string> = {
    play: 'M4 2.5v11l9-5.5z',
    stop: 'M4 4h8v8H4z',
    loop: 'M3 8a5 5 0 0 1 8.5-3.5L13 6V2.5M13 8a5 5 0 0 1-8.5 3.5L3 10v3.5',
    volume: 'M2 6h3l4-3v10l-4-3H2zM11 5.5a3.5 3.5 0 0 1 0 5'
}

function icon(doc: Document, name: keyof typeof ICONS): SVGElement {
    const root = svg(doc, 'svg', {
        'class': `mn-play-icon mn-play-icon-${name}`,
        'viewBox': '0 0 16 16',
        'width': 12,
        'height': 12,
        'aria-hidden': 'true'
    })
    root.appendChild(svg(doc, 'path', { d: ICONS[name] }))
    return root
}

/** One light synthesizer per window. */
const players = new WeakMap<Window, NotePlayer>()
function lightFor(win: Window): NotePlayer {
    let player = players.get(win)
    if (!player) {
        player = lightPlayer(win)
        players.set(win, player)
    }
    return player
}

/** The player apps passed (read at each play), else the light synthesizer. */
function playerFor(win: Window, options: PlayOptions): NotePlayer {
    const given = typeof options.player === 'function' ? options.player() : options.player
    return given ?? lightFor(win)
}

/** The diagram's own playback data, set by its renderer. */
interface DiagramData {
    kind: PlayKind
    pitches: number[]
    sound: Sound
    /** A scale's root (chroma), for runs from root to root. */
    root: number | null
}

function dataOf(diagram: Element): DiagramData | null {
    const pitches = (diagram.getAttribute('data-mn-pitches') ?? '')
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))
    if (!pitches.length) return null
    return {
        kind: diagram.getAttribute('data-mn-play') === 'chord' ? 'chord' : 'scale',
        pitches,
        sound: diagram.getAttribute('data-mn-sound') === 'piano' ? 'piano' : 'guitar',
        root: Number.isInteger(Number(diagram.getAttribute('data-mn-root') ?? 'x'))
            ? Number(diagram.getAttribute('data-mn-root'))
            : null
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
    data: DiagramData,
    options: PlayOptions
): () => void {
    const wrap = html(doc, 'div', 'mn-playable')
    diagram.parentNode?.insertBefore(wrap, diagram)
    wrap.appendChild(diagram)
    const bar = html(doc, 'div', 'mn-play')
    bar.setAttribute('role', 'group')
    // Named after the diagram, so a page with many bars reads clearly.
    const name = diagram.getAttribute('aria-label')
    bar.setAttribute('aria-label', name ? `Play ${name}` : 'Playback')
    wrap.appendChild(bar)

    const settings = {
        sound: options.sound ?? data.sound,
        volume: clamp(options.volume, 0, 1, 0.8),
        bpm: clamp(options.bpm, 20, 240, DEFAULT_SEQUENCE.bpm),
        strum: clamp(options.strum, 0, 200, DEFAULT_SEQUENCE.strum),
        loop: false
    }
    let playing: PlayHandle | null = null

    const toggle = html(doc, 'button', 'mn-play-toggle')
    toggle.type = 'button'
    const show = () => {
        toggle.replaceChildren(icon(doc, playing ? 'stop' : 'play'))
        toggle.setAttribute('aria-label', playing ? 'Stop' : 'Play')
        toggle.title = playing ? 'Stop' : 'Play'
    }
    const stop = () => {
        playing?.stop()
        playing = null
        show()
    }
    /** Plays notes with the app's player, or the light synthesizer when that one fails. */
    const play = (events: NoteEvent[], onEnd: () => void): PlayHandle => {
        const options_ = { sound: settings.sound, volume: settings.volume, onEnd }
        try {
            return playerFor(win, options).play(events, options_)
        } catch {
            return lightFor(win).play(events, options_)
        }
    }
    const start = () => {
        stop()
        // A diagram no longer on the page (the block was redrawn or left) stops looping.
        if (!wrap.isConnected) return
        playing = play(sequenceOf(data.kind, data.pitches, settings, data.root), () => {
            playing = null
            if (settings.loop && wrap.isConnected) start()
            else show()
        })
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    const loop = html(doc, 'button', 'mn-play-loop')
    loop.type = 'button'
    loop.appendChild(icon(doc, 'loop'))
    loop.title = 'Loop'
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
        set: (n: number) => void,
        mark: string | SVGElement
    ) => {
        const field = html(doc, 'label', 'mn-play-field')
        field.title = `${label}: ${value}`
        const tag = html(doc, 'span', 'mn-play-label')
        tag.setAttribute('aria-hidden', 'true')
        tag.append(mark)
        const input = html(doc, 'input')
        input.type = 'range'
        input.min = String(min)
        input.max = String(max)
        input.value = String(value)
        input.setAttribute('aria-label', label)
        input.addEventListener('input', () => {
            set(Number(input.value))
            field.title = `${label}: ${input.value}`
        })
        field.append(tag, input)
        bar.appendChild(field)
    }
    // Speed only when several notes play: BPM for scales, the strum's spread for chords.
    if (data.pitches.length > 1) {
        if (data.kind === 'scale')
            slider('Tempo (BPM)', 20, 240, settings.bpm, (n) => (settings.bpm = n), '♩')
        else
            slider(
                'Strum (ms between strings)',
                0,
                200,
                settings.strum,
                (n) => (settings.strum = n),
                '≋'
            )
    }
    slider(
        'Volume',
        0,
        100,
        Math.round(settings.volume * 100),
        (n) => (settings.volume = n / 100),
        icon(doc, 'volume')
    )

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
        // Not `instanceof Element`: nodes of a popout window have that window's Element.
        const node = event.target as Partial<Element> | null
        const target = typeof node?.closest === 'function' ? node.closest('[data-midi]') : null
        const midi = Number(target?.getAttribute('data-midi'))
        if (!target || !Number.isFinite(midi)) return
        stop()
        playing = play([{ midi, time: 0, duration: 1.5 }], () => {
            playing = null
            show()
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
