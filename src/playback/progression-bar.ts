/**
 * The play bar of a progression or a ChordPro chart (#46), below its chords (#58): play / stop,
 * loop, count-in, click (the metronome), tempo, strum (on the beats, once a bar, arpeggio, or the
 * block's pattern) and sound; the volume is the app's. One chord a bar, read from the drawing
 * (each `data-mn-bar` element's notes), the chord playing lit while it sounds. It is the block's
 * one bar: its diagrams play on a click, on the sound it chose.
 */
import { html } from '../render/dom.js'
import { isCompound, parseStrum, parseTime, type StrumPattern } from '../strum/pattern.js'
import { countedTempoOf, tempoOf } from '../strum/play.js'
import type { PlayOptions } from './controls.js'
import type { DiagramGroup } from './block-bar.js'
import { choice, icon, playBar, pressedButton, valueSlider, volumeOf } from './bar-parts.js'
import { followNotes, START_WAIT } from './follow.js'
import type { PlayHandle } from './player.js'
import {
    runProgression,
    PROGRESSION_STRUMS,
    type ProgressionBar,
    type ProgressionSettings,
    type ProgressionStrum
} from './progression.js'
import { barPlayer } from './strum-bar.js'
import { handToApp } from './app-bar.js'
import { copyImageButton } from './copy-image.js'

const pitchesOf = (text: string | null): number[] =>
    (text ?? '')
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))

/** The bars of a drawn progression or chart, in order, each with the elements that show it. */
export function barsFromDrawing(drawing: Element): { bars: ProgressionBar[]; marks: Element[][] } {
    const byBar = new Map<number, Element[]>()
    for (const el of drawing.querySelectorAll('[data-mn-bar]')) {
        const index = Number(el.getAttribute('data-mn-bar'))
        if (!Number.isInteger(index) || index < 0) continue
        byBar.set(index, [...(byBar.get(index) ?? []), el])
    }
    const order = [...byBar.keys()].sort((a, b) => a - b)
    const bars: ProgressionBar[] = []
    const marks: Element[][] = []
    for (const index of order) {
        const els = byBar.get(index)!
        const pitches = pitchesOf(els[0]!.getAttribute('data-mn-voicing'))
        // A bar of silence (#75: a chart's bar of N.C.) plays nothing for its beats.
        const rest = els[0]!.hasAttribute('data-mn-rest')
        if (!pitches.length && !rest) continue
        // How long it lasts (#75): beats as written, a bar when not said.
        const beats = Number(els[0]!.getAttribute('data-mn-beats'))
        bars.push({
            chord: rest ? null : els[0]!.getAttribute('data-mn-chord'),
            pitches,
            ...(els[0]!.hasAttribute('data-mn-beats') && beats > 0 ? { beats } : {})
        })
        marks.push(els)
    }
    return { bars, marks }
}

/** The strum written on the drawing: a plain one, or a pattern (null when it doesn't read). */
function strumOf(
    drawing: Element,
    time: string | null
): { strum: ProgressionStrum; pattern: StrumPattern | null } {
    const written = drawing.getAttribute('data-mn-strum')?.trim() ?? ''
    if (!written) return { strum: 'beats', pattern: null }
    if ((PROGRESSION_STRUMS as readonly string[]).includes(written))
        return { strum: written as ProgressionStrum, pattern: null }
    try {
        return {
            strum: 'beats',
            pattern: parseStrum(`${time ? `time: ${time}\n` : ''}${written}`)
        }
    } catch {
        return { strum: 'beats', pattern: null }
    }
}

const STRUM_LABELS: Record<ProgressionStrum | 'pattern', string> = {
    beats: 'On the beats',
    bar: 'Once a bar',
    arpeggio: 'Arpeggio',
    pattern: 'Pattern'
}

export function progressionBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions,
    diagrams: DiagramGroup | null = null
): () => void {
    const { bars, marks } = barsFromDrawing(drawing)
    if (!bars.length) return () => {}
    const time = drawing.getAttribute('data-mn-time')
    let beatsPerBar = 4
    let beatUnit = 4
    if (time) {
        try {
            ;({ beatsPerBar, beatUnit } = parseTime(time))
        } catch {
            // 4/4.
        }
    }
    const written = strumOf(drawing, time)
    const pattern = written.pattern
    const compound = pattern ? pattern.compound : isCompound(beatsPerBar, beatUnit)
    const tempo = Number(drawing.getAttribute('data-mn-tempo'))
    const piano = drawing.getAttribute('data-mn-sound') === 'piano'
    const settings: ProgressionSettings = {
        // The app's bpm counts quarters: the same speed in the beat the progression counts.
        bpm: tempoOf(
            drawing.hasAttribute('data-mn-tempo') && Number.isFinite(tempo)
                ? tempo
                : countedTempoOf(options.bpm, compound, pattern ? pattern.beatUnit : beatUnit),
            compound
        ),
        countIn: false,
        loop: false,
        click: true,
        sound: options.sound ?? (piano ? 'piano' : 'guitar'),
        volume: volumeOf(options.volume)
    }
    let strum: ProgressionStrum | 'pattern' = pattern ? 'pattern' : written.strum
    let playing: PlayHandle | null = null

    const bar = playBar(doc, 'mn-progression-play', 'Play the chords in time')
    // Below the chords (#58).
    drawing.appendChild(bar)

    const toggle = html(doc, 'button', 'mn-play-toggle')
    toggle.type = 'button'
    const show = () => {
        toggle.replaceChildren(icon(doc, playing ? 'stop' : 'play'))
        toggle.setAttribute('aria-label', playing ? 'Stop' : 'Play in time')
        toggle.title = playing ? 'Stop' : 'Play in time'
    }
    const stop = () => {
        playing?.stop()
        playing = null
        show()
    }
    // One thing plays in the block: a diagram's click stops the progression, and back.
    if (diagrams) {
        diagrams.onPlay = stop
        // Escape on one of its diagrams stops the progression too.
        diagrams.stopOthers = () => {
            const was = playing !== null
            stop()
            return was
        }
    }
    const start = () => {
        stop()
        if (!drawing.isConnected) return
        diagrams?.stop()
        const here = drawing.ownerDocument.defaultView ?? win
        playing = runProgression(
            bars,
            {
                beatsPerBar,
                beatUnit,
                strum: strum === 'pattern' ? 'beats' : strum,
                pattern: strum === 'pattern' ? pattern : null
            },
            () => barPlayer(drawing, win, options),
            // A loop stops once the drawing leaves the page; the app's volume at each pass.
            () => ({
                ...settings,
                volume: volumeOf(options.volume),
                loop: settings.loop && drawing.isConnected
            }),
            here,
            () => {
                playing = null
                show()
            },
            // The chord playing lights for its bar, from the moment the pass is heard (#41).
            (timings, current) =>
                followNotes(
                    here,
                    drawing,
                    timings.map((t) => marks[t.slot] ?? []),
                    timings.map((t) => ({ midi: 0, time: t.time, duration: t.duration })),
                    current.reportsStart === true ? Infinity : START_WAIT
                )
        )
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    // Changes apply from the next pass of a loop.
    bar.append(
        pressedButton(doc, 'mn-play-loop', 'Loop', 'loop', false, (on) => (settings.loop = on)),
        pressedButton(doc, 'mn-play-count', 'Count-in', 'count', false, (on) => {
            settings.countIn = on
        }),
        pressedButton(doc, 'mn-play-click', 'Click', 'click', true, (on) => (settings.click = on))
    )
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
    const strums: (ProgressionStrum | 'pattern')[] = [
        ...(pattern ? (['pattern'] as const) : []),
        ...PROGRESSION_STRUMS
    ]
    // A new strum starts again from the first bar.
    bar.appendChild(
        choice(doc, 'mn-play-strum', 'Strum', strums, strum, STRUM_LABELS, (value) => {
            strum = value
            if (playing) start()
        })
    )
    bar.appendChild(
        choice(
            doc,
            'mn-play-sound',
            'Sound',
            ['guitar', 'piano'] as const,
            settings.sound,
            { guitar: 'Guitar', piano: 'Piano' },
            (value) => {
                settings.sound = value === 'piano' ? 'piano' : 'guitar'
                // The diagrams play on it too (not redrawn: the block chose their drawing).
                diagrams?.setSound(settings.sound)
            }
        )
    )
    // The whole block (#11), drawn without the bar.
    if (options.copy !== false)
        bar.append(...copyImageButton(doc, win, () => drawing.closest('.mn-block') ?? drawing))
    // Last, so the app's controls come after the bar's own (#77).
    const app = handToApp(options, bar, {
        kind: drawing.classList.contains('mn-chart') ? 'chart' : 'progression',
        drawing,
        compound,
        tempo: () => settings.bpm
    })
    return () => {
        stop()
        if (diagrams?.onPlay === stop) {
            diagrams.onPlay = null
            diagrams.stopOthers = null
        }
        app.free()
    }
}
