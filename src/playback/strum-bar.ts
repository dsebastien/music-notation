/**
 * The playback bar of a strumming pattern (#22), like the diagrams' bar: play / stop, loop,
 * count-in, tempo (BPM), volume and sound. What plays is read from the drawing (each slot's
 * `data-mn-beat` element, each chord's notes), so any page that drew the pattern can play it.
 */
import { html, svg } from '../render/dom.js'
import { runStrum, tempoOf, type StrumScore, type StrumSettings } from '../strum/play.js'
import { strumVoicing } from '../strum/voicing.js'
import type { Stroke } from '../strum/pattern.js'
import { clamp, icon, lightFor, playerFor, type PlayOptions } from './controls.js'
import type { NoteEvent, NotePlayer, PlayHandle, Sound } from './player.js'

const STROKES = new Set<Stroke>(['down', 'up', 'mute', 'rest'])

const pitchesOf = (text: string | null): number[] | null => {
    if (text === null) return null
    const pitches = text
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))
    return pitches.length ? pitches : null
}

/** The score of a drawn pattern; null when it has no slots. */
export function scoreFromDrawing(drawing: Element): StrumScore | null {
    const cells = [...drawing.querySelectorAll('[data-mn-beat]')].sort(
        (a, b) => Number(a.getAttribute('data-mn-beat')) - Number(b.getAttribute('data-mn-beat'))
    )
    if (!cells.length) return null
    let pitches = pitchesOf(drawing.getAttribute('data-mn-voicing')) ?? strumVoicing(null)
    const slots = cells.map((cell) => {
        pitches = pitchesOf(cell.getAttribute('data-mn-voicing')) ?? pitches
        const written = cell.getAttribute('data-mn-stroke') as Stroke | null
        return {
            stroke: written && STROKES.has(written) ? written : 'rest',
            accent: cell.getAttribute('data-mn-accent') === 'true',
            ghost: cell.getAttribute('data-mn-ghost') === 'true',
            pitches
        }
    })
    const perBeat = Number(drawing.getAttribute('data-mn-slots-per-beat'))
    const beats = Number(/^(\d+)\//.exec(drawing.getAttribute('data-mn-time') ?? '')?.[1])
    return {
        slots,
        slotsPerBeat: Number.isInteger(perBeat) && perBeat > 0 ? perBeat : 2,
        beatsPerBar: Number.isInteger(beats) && beats > 0 ? beats : 4
    }
}

/** A metronome, for the count-in. */
const COUNT_IN = 'M5.5 14h5L9 2.5H7zM8 11.5l4.5-7'

export function strumBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions
): () => void {
    const score = scoreFromDrawing(drawing)
    if (!score) return () => {}
    const wrap = html(doc, 'div', 'mn-playable mn-strum-playable')
    drawing.parentNode?.insertBefore(wrap, drawing)
    wrap.appendChild(drawing)
    const bar = html(doc, 'div', 'mn-play')
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', 'Play the strumming pattern')
    wrap.appendChild(bar)

    const tempo = Number(drawing.getAttribute('data-mn-tempo'))
    const settings: StrumSettings = {
        bpm: tempoOf(
            drawing.hasAttribute('data-mn-tempo') && Number.isFinite(tempo) ? tempo : options.bpm
        ),
        countIn: false,
        loop: false,
        sound: options.sound ?? 'guitar',
        volume: clamp(options.volume, 0, 1, 0.8)
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
    /**
     * The app's player in the window the drawing is in now (a host may move it to a popout), the
     * light synthesizer when that one fails.
     */
    const player = (): NotePlayer => {
        const here = wrap.ownerDocument.defaultView ?? win
        const chosen = playerFor(here, options)
        return {
            play(events: NoteEvent[], opts: { sound: Sound; volume: number; onEnd?: () => void }) {
                try {
                    return chosen.play(events, opts)
                } catch {
                    return lightFor(here).play(events, opts)
                }
            }
        }
    }
    const start = () => {
        stop()
        // A pattern no longer on the page (redrawn, or the note closed) doesn't play.
        if (!wrap.isConnected) return
        const here = wrap.ownerDocument.defaultView ?? win
        playing = runStrum(
            score,
            player,
            // A loop stops once the drawing leaves the page.
            () => ({ ...settings, loop: settings.loop && wrap.isConnected }),
            here,
            () => {
                playing = null
                show()
            }
        )
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    const pressed = (cls: string, label: string, mark: SVGElement, set: (on: boolean) => void) => {
        const button = html(doc, 'button', cls)
        button.type = 'button'
        button.appendChild(mark)
        button.title = label
        button.setAttribute('aria-label', label)
        button.setAttribute('aria-pressed', 'false')
        let on = false
        button.addEventListener('click', () => {
            on = !on
            set(on)
            button.setAttribute('aria-pressed', String(on))
            button.classList.toggle('mn-on', on)
        })
        bar.appendChild(button)
    }
    pressed('mn-play-loop', 'Loop', icon(doc, 'loop'), (on) => (settings.loop = on))
    const metronome = svg(doc, 'svg', {
        'class': 'mn-play-icon mn-play-icon-loop',
        'viewBox': '0 0 16 16',
        'width': 12,
        'height': 12,
        'aria-hidden': 'true'
    })
    metronome.appendChild(svg(doc, 'path', { d: COUNT_IN }))
    pressed('mn-play-count', 'Count-in', metronome, (on) => (settings.countIn = on))

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
    // Changes apply from the next pass of a loop.
    slider('Tempo (BPM)', 20, 240, settings.bpm, (n) => (settings.bpm = tempoOf(n)), '♩')
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

    // Touch screens have no hover: a tap on the pattern shows the bar.
    wrap.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' || bar.contains(event.target as Node)) return
        wrap.classList.toggle('mn-play-open')
    })
    return stop
}
