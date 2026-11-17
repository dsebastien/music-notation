/**
 * The play bar of a progression or a ChordPro chart (#46), below its chords (#58): play / stop,
 * loop, count-in, click (the metronome), tempo, strum (on the beats, once a bar, arpeggio, or the
 * block's pattern) and sound; the volume is the app's. One chord a bar, read from the drawing
 * (each `data-mn-bar` element's notes), the chord playing lit while it sounds. It is the block's
 * one bar: its diagrams play on a click, on the sound it chose.
 */
import { html } from '../render/dom.js'
import { currentLanguage, translator, withLanguage, type Translator } from '../i18n/translate.js'
import { namingOf, withNaming } from '../theory/naming.js'
import { chartRedrawOf } from '../chords/chart.js'
import { isCompound, parseStrum, parseTime, type StrumPattern } from '../strum/pattern.js'
import { countedTempoOf, tempoOf } from '../strum/play.js'
import type { PlayOptions } from './controls.js'
import type { DiagramGroup } from './block-bar.js'
import { choice, icon, playBar, pressedButton, valueSlider, volumeOf } from './bar-parts.js'
import { soundMenu } from './sound-menu.js'
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
import { addFullScreen } from './full-screen.js'

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

/** The names of the strums, in the language in progress. */
const strumLabels = (tr: Translator): Record<ProgressionStrum | 'pattern', string> => ({
    beats: tr('playback.strum.beats'),
    bar: tr('playback.strum.bar'),
    arpeggio: tr('playback.strum.arpeggio'),
    pattern: tr('playback.strum.pattern')
})

export function progressionBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions,
    diagrams: DiagramGroup | null = null,
    /**
     * Gives the group of the drawing's diagrams again, after the chart was drawn again (#45): the
     * caller frees the old one.
     */
    regroup?: () => DiagramGroup | null
): () => void {
    let { bars, marks } = barsFromDrawing(drawing)
    if (!bars.length) return () => {}
    // Kept for the toggle, which changes its text on each press, after the draw.
    const tr = translator()
    // What the chart is drawn again under, when its chords change (#45).
    const language = currentLanguage()
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

    const bar = playBar(doc, 'mn-progression-play', tr('playback.progression.bar'))
    // Below the chords (#58).
    drawing.appendChild(bar)

    const toggle = html(doc, 'button', 'mn-play-toggle')
    toggle.type = 'button'
    const show = () => {
        toggle.replaceChildren(icon(doc, playing ? 'stop' : 'play'))
        toggle.setAttribute(
            'aria-label',
            playing ? tr('playback.stop') : tr('playback.progression.play')
        )
        toggle.title = playing ? tr('playback.stop') : tr('playback.progression.play')
    }
    const stop = () => {
        playing?.stop()
        playing = null
        show()
    }
    // One thing plays in the block: a diagram's click stops the progression, and back.
    const wire = () => {
        if (!diagrams) return
        diagrams.onPlay = stop
        // Escape on one of its diagrams stops the progression too.
        diagrams.stopOthers = () => {
            const was = playing !== null
            stop()
            return was
        }
    }
    wire()
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
        pressedButton(
            doc,
            'mn-play-loop',
            tr('playback.loop'),
            'loop',
            false,
            (on) => (settings.loop = on)
        ),
        pressedButton(doc, 'mn-play-count', tr('playback.countIn'), 'count', false, (on) => {
            settings.countIn = on
        }),
        pressedButton(
            doc,
            'mn-play-click',
            tr('playback.click'),
            'click',
            true,
            (on) => (settings.click = on)
        )
    )
    bar.appendChild(
        valueSlider(
            doc,
            tr('playback.tempo'),
            tr('playback.unit.bpm'),
            20,
            240,
            settings.bpm,
            (n) => {
                settings.bpm = tempoOf(n)
                app.tempoChanged(settings.bpm)
            },
            compound ? tr('playback.dotted') : undefined
        ).field
    )
    const strums: (ProgressionStrum | 'pattern')[] = [
        ...(pattern ? (['pattern'] as const) : []),
        ...PROGRESSION_STRUMS
    ]
    // A new strum starts again from the first bar.
    bar.appendChild(
        choice(
            doc,
            'mn-play-strum',
            tr('playback.strumChoice'),
            strums,
            strum,
            strumLabels(tr),
            (value) => {
                strum = value
                if (playing) start()
            }
        )
    )
    bar.appendChild(
        soundMenu(
            doc,
            tr,
            options,
            () => [drawing],
            () => settings.sound,
            (value) => {
                settings.sound = value
                // The diagrams play on it too (not redrawn: the block chose their drawing).
                diagrams?.setSound(settings.sound)
            }
        ).el
    )
    // Easier chords (#45): a chart that has some draws them, or its own again, on a click. The
    // chart's content changes; the chart element, its bar and what the bar is set to stay.
    const redraw = chartRedrawOf(drawing)
    if (redraw) {
        const simplify = html(doc, 'button', 'mn-play-simplify')
        simplify.type = 'button'
        const shown = () => {
            const on = drawing.hasAttribute('data-mn-simplified')
            simplify.textContent = tr(on ? 'playback.simplified' : 'playback.simplify')
            simplify.title = tr(on ? 'playback.simplified.hint' : 'playback.simplify.hint')
            simplify.setAttribute('aria-pressed', String(on))
            simplify.classList.toggle('mn-on', on)
        }
        simplify.addEventListener('click', () => {
            stop()
            diagrams?.stop()
            const on = !drawing.hasAttribute('data-mn-simplified')
            const naming = namingOf(
                drawing.closest('[data-mn-naming]')?.getAttribute('data-mn-naming')
            )
            let next: HTMLElement
            try {
                next = withLanguage(language, () =>
                    naming ? withNaming(naming, () => redraw(on)) : redraw(on)
                )
            } catch {
                // The chart stays as it is.
                return
            }
            for (const child of [...drawing.children]) if (child !== bar) child.remove()
            bar.before(...next.children)
            drawing.toggleAttribute('data-mn-simplified', next.hasAttribute('data-mn-simplified'))
            // The bar plays the chords now shown, and their diagrams play on a click again.
            ;({ bars, marks } = barsFromDrawing(drawing))
            if (regroup) {
                diagrams = regroup()
                wire()
                if (settings.sound !== (piano ? 'piano' : 'guitar'))
                    diagrams?.setSound(settings.sound)
            }
            shown()
        })
        shown()
        bar.appendChild(simplify)
    }
    // The whole block (#11), drawn without the bar.
    if (options.copy !== false)
        bar.append(...copyImageButton(doc, win, () => drawing.closest('.mn-block') ?? drawing))
    const freeFull = addFullScreen(doc, bar, drawing.closest('.mn-block'), options.fullScreen)
    // Last, so the app's controls come after the bar's own (#77).
    const app = handToApp(options, bar, {
        kind: drawing.classList.contains('mn-chart') ? 'chart' : 'progression',
        drawing,
        compound,
        tempo: () => settings.bpm
    })
    return () => {
        stop()
        freeFull()
        if (diagrams?.onPlay === stop) {
            diagrams.onPlay = null
            diagrams.stopOthers = null
        }
        app.free()
    }
}
