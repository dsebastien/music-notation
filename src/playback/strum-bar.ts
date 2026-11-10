/**
 * The playback bar of a strumming pattern (#22), below it and always shown (#58): play / stop,
 * loop, count-in, tempo (BPM) and sound; the volume is the app's. What plays is read from the
 * drawing (each slot's `data-mn-beat` element, each chord's notes), so any page that drew the
 * pattern can play it.
 */
import { html } from '../render/dom.js'
import {
    countedTempoOf,
    runPasses,
    strumEvents,
    tempoOf,
    type PassMaker,
    type StrumScore
} from '../strum/play.js'
import type { ProgressionSettings } from './progression.js'
import { strumVoicing } from '../strum/voicing.js'
import { isCompound, type Stroke } from '../strum/pattern.js'
import { lightFor, playerFor, type PlayOptions } from './controls.js'
import { choice, icon, playBar, pressedButton, valueSlider, volumeOf } from './bar-parts.js'
import type { NoteEvent, NotePlayer, PlayHandle } from './player.js'
import { followNotes, sawStart, startsReported, START_WAIT } from './follow.js'
import { handToApp } from './app-bar.js'
import { copyImageButton } from './copy-image.js'

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
    const time = /^(\d+)\/(\d+)$/.exec(drawing.getAttribute('data-mn-time') ?? '')
    const beats = Number(time?.[1])
    const slotsPerBeat = Number.isInteger(perBeat) && perBeat > 0 ? perBeat : 2
    const beatsPerBar = Number.isInteger(beats) && beats > 0 ? beats : 4
    const swing = Number(drawing.getAttribute('data-mn-swing'))
    return {
        slots,
        slotsPerBeat,
        beatsPerBar,
        // Compound time (6/8) counts the tempo in dotted beats of three.
        slotsPerPulse: isCompound(beatsPerBar, Number(time?.[2])) ? slotsPerBeat * 3 : slotsPerBeat,
        swing:
            drawing.hasAttribute('data-mn-swing') &&
            swing > 0.5 &&
            swing < 1 &&
            slotsPerBeat % 2 === 0
                ? swing
                : null
    }
}

/** The drawn time signature's beat unit (8 in 6/8); 4 when unknown. */
function unitOf(drawing: Element): number {
    const unit = Number(/^\d+\/(\d+)$/.exec(drawing.getAttribute('data-mn-time') ?? '')?.[1])
    return Number.isInteger(unit) && unit > 0 ? unit : 4
}

/**
 * The app's player in the window `wrap` is in now (a host may move it to a popout), the light
 * synthesizer when that one fails. It says when its notes start like the player it wraps (the
 * light one does too), or once the player it wraps was seen saying it, here or on another bar.
 */
export function barPlayer(wrap: Element, win: Window, options: PlayOptions): NotePlayer {
    const here = wrap.ownerDocument.defaultView ?? win
    const chosen = playerFor(here, options)
    return {
        reportsStart: startsReported(chosen),
        play(events: NoteEvent[], opts: Parameters<NotePlayer['play']>[1]) {
            const onStart = opts.onStart
            const given = onStart
                ? {
                      ...opts,
                      onStart: () => {
                          sawStart(chosen)
                          onStart()
                      }
                  }
                : opts
            try {
                return chosen.play(events, given)
            } catch {
                return lightFor(here).play(events, opts)
            }
        }
    }
}

export function strumBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions
): () => void {
    const score = scoreFromDrawing(drawing)
    if (!score) return () => {}
    return timedBarFor(doc, win, drawing, options, {
        kind: 'strum',
        cls: 'mn-strum-playable',
        label: 'Play the strumming pattern',
        compound: (score.slotsPerPulse ?? score.slotsPerBeat) > score.slotsPerBeat,
        make: (s, first, id) =>
            strumEvents(score, {
                bpm: s.bpm,
                countIn: first && s.countIn,
                tail: s.loop ? 0 : 1.2,
                seed: id
            })
    })
}

/** What a timed bar plays: its passes, and how it's counted. */
export interface TimedPiece {
    /** What it plays, for the app (#77). */
    kind: 'strum' | 'picking'
    /** The wrapper's own class, beside `mn-timed`. */
    cls: string
    /** The bar's name for screen readers. */
    label: string
    /** Counted in dotted beats (6/8): the tempo counts dotted quarters. */
    compound: boolean
    make: PassMaker
    /** Shows a click (metronome) button, on or off at the start; none when absent. */
    click?: boolean
}

/**
 * The bar of a piece played in time over a drawing whose slots are `[data-mn-beat]` elements,
 * below it: play / stop, loop, count-in, click when asked, tempo, sound. Each pass's slots light
 * as they sound.
 */
export function timedBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions,
    piece: TimedPiece
): () => void {
    const wrap = html(doc, 'div', `mn-timed ${piece.cls}`)
    drawing.parentNode?.insertBefore(wrap, drawing)
    wrap.appendChild(drawing)
    // Below the pattern, always shown (#58).
    const bar = playBar(doc, 'mn-timed-bar', piece.label)
    wrap.appendChild(bar)

    const tempo = Number(drawing.getAttribute('data-mn-tempo'))
    const compound = piece.compound
    const settings: ProgressionSettings = {
        // The app's bpm counts quarters: the same speed in the beat the pattern counts.
        bpm: tempoOf(
            drawing.hasAttribute('data-mn-tempo') && Number.isFinite(tempo)
                ? tempo
                : countedTempoOf(options.bpm, compound, unitOf(drawing)),
            compound
        ),
        countIn: false,
        loop: false,
        click: piece.click ?? false,
        sound: options.sound ?? 'guitar',
        volume: volumeOf(options.volume)
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
    const player = (): NotePlayer => barPlayer(wrap, win, options)
    const start = () => {
        stop()
        // A pattern no longer on the page (redrawn, or the note closed) doesn't play.
        if (!wrap.isConnected) return
        const here = wrap.ownerDocument.defaultView ?? win
        playing = runPasses(
            piece.make,
            player,
            // A loop stops once the drawing leaves the page; the app's volume at each pass.
            () => ({
                ...settings,
                volume: volumeOf(options.volume),
                loop: settings.loop && wrap.isConnected
            }),
            here,
            () => {
                playing = null
                show()
            },
            // Each strum lights while it plays, from the moment the pass is heard, as notes do
            // on diagrams (#41); it waits for players that say when they start.
            (strums, current) => {
                const cells = new Map(
                    [...drawing.querySelectorAll('[data-mn-beat]')].map((el) => [
                        Number(el.getAttribute('data-mn-beat')),
                        el
                    ])
                )
                return followNotes(
                    here,
                    drawing,
                    strums.map((s) => {
                        const cell = cells.get(s.slot)
                        return cell ? [cell] : []
                    }),
                    strums.map((s) => ({ midi: 0, time: s.time, duration: s.duration })),
                    current.reportsStart === true ? Infinity : START_WAIT
                )
            }
        )
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    bar.append(
        pressedButton(doc, 'mn-play-loop', 'Loop', 'loop', false, (on) => (settings.loop = on)),
        pressedButton(doc, 'mn-play-count', 'Count-in', 'count', false, (on) => {
            settings.countIn = on
        })
    )
    if (piece.click !== undefined)
        bar.appendChild(
            pressedButton(doc, 'mn-play-click', 'Click', 'click', piece.click, (on) => {
                settings.click = on
            })
        )
    // Changes apply from the next pass of a loop. The tempo counts dotted quarters in compound
    // time.
    bar.appendChild(
        valueSlider(
            doc,
            'Tempo (BPM)',
            'BPM',
            20,
            240,
            settings.bpm,
            (n) => {
                settings.bpm = tempoOf(n)
                app.tempoChanged(settings.bpm)
            },
            compound ? 'counts dotted quarters' : undefined
        ).field
    )
    bar.appendChild(
        choice(
            doc,
            'mn-play-sound',
            'Sound',
            ['guitar', 'piano'] as const,
            settings.sound,
            { guitar: 'Guitar', piano: 'Piano' },
            (value) => (settings.sound = value === 'piano' ? 'piano' : 'guitar')
        )
    )
    // The whole block (#11), drawn without the bar.
    if (options.copy !== false)
        bar.append(...copyImageButton(doc, win, () => wrap.closest('.mn-block') ?? wrap))
    // Last, so the app's controls come after the bar's own (#77).
    const app = handToApp(options, bar, {
        kind: piece.kind,
        drawing,
        compound,
        tempo: () => settings.bpm
    })
    return () => {
        stop()
        app.free()
    }
}
