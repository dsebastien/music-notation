/**
 * Playing a block's diagrams (#58): each diagram is a button (a click or Space / Enter plays it,
 * a dot or a key plays its note), and the block gets one bar below its diagrams: play / stop the
 * selected diagram, play all in turn, the selected diagram's name, loop, the speed and the sound
 * (choosing the other instrument redraws every diagram for it). No volume: the app's setting.
 */
import { accessibleName, html, uniqueId } from '../render/dom.js'
import {
    DEFAULT_SEQUENCE,
    sequenceOf,
    type NoteEvent,
    type NotePlayer,
    type PlayHandle,
    type Sound
} from './player.js'
import { followNotes, noteTargets, sawStart, startsReported, START_WAIT } from './follow.js'
import { followVolume } from './live-volume.js'
import {
    clamp,
    dataOf,
    lightFor,
    playerFor,
    redrawFor,
    rootOf,
    strumsOf,
    tonesOf,
    type DiagramData,
    type PlayOptions
} from './controls.js'
import {
    choice,
    icon,
    iconButton,
    placeBar,
    playBar,
    pressedButton,
    valueSlider,
    volumeOf
} from './bar-parts.js'
import { copyImageButton, diagramImage } from './copy-image.js'

/** One playable diagram of a block. */
interface Item {
    diagram: Element
    data: DiagramData
    /** The diagram's button: the `.mn-playable` around it. */
    wrap: HTMLElement
    /** The drawing on the page: the diagram, or its redrawing for the other instrument. */
    shown: Element
    /** Its redrawing for the other instrument, once made (null: nothing to draw). */
    other: Element | null | undefined
    /** A caption in words (caption: fingering), about the diagram's own instrument. */
    caption: HTMLElement | undefined
    /** What the bar calls it. */
    name: string
    /** What screen readers call it: its accessible name, else the bar's. */
    spoken: string
}

/** A block's diagrams as they play: the bar (when the block has one) drives it. */
export interface DiagramGroup {
    /** Stops what plays. */
    stop(): void
    /** Plays the diagrams on another sound (and redraws them for it, when a block bar plays it). */
    setSound(sound: Sound): void
    /** Called each time something starts playing (so another bar of the block stops). */
    onPlay: (() => void) | null
    /**
     * Stops what another bar of the block plays (Escape on a diagram); true when something
     * played. A progression's bar sets it.
     */
    stopOthers: (() => boolean) | null
    /** Frees the group: stops, and no timer stays. */
    destroy(): void
}

export interface GroupOptions {
    /**
     * A block bar plays the group: the sound redraws the diagrams for the other instrument, and
     * the selected diagram (the one the bar plays) is marked. A progression's diagrams have none.
     */
    bar: boolean
}

/** The name the bar gives a diagram: its title, else its accessible name. */
function nameOf(diagram: Element): string {
    const title = diagram.querySelector('.mn-title')?.textContent?.trim()
    return title || accessibleName(diagram) || 'Diagram'
}

/** Whether a click's target is a note: a `data-midi` element, or a mark's hit area (#69). */
function noteAt(node: EventTarget | null): Element | null {
    // Not `instanceof Element`: nodes of a popout window have that window's Element.
    const el = node as Partial<Element> | null
    if (typeof el?.closest !== 'function') return null
    return el.closest('[data-midi]') ?? el.closest('.mn-mark')?.querySelector('[data-midi]') ?? null
}

/**
 * Makes `diagrams` (all of one block) playable together: one thing plays at a time; a click on a
 * diagram plays it, a click on a note plays that note. With `bar`, the block's bar is built and
 * placed below them.
 */
export function diagramGroup(
    doc: Document,
    win: Window,
    diagrams: { diagram: Element; data: DiagramData }[],
    options: PlayOptions,
    how: GroupOptions
): { group: DiagramGroup; items: readonly Item[]; api: GroupApi; bind: (ui: GroupUi) => void } {
    const items: Item[] = diagrams.map(({ diagram, data }) => {
        const wrap = html(doc, 'div', 'mn-playable')
        diagram.parentNode?.insertBefore(wrap, diagram)
        wrap.appendChild(diagram)
        const figure = wrap.parentElement
        // The fingering in words: the figure's caption, or a span of its captions (#52).
        const caption = figure?.classList.contains('mn-captioned')
            ? ([...figure.children, ...[...figure.children].flatMap((c) => [...c.children])].find(
                  (c) => c.classList.contains('mn-fingering')
              ) as HTMLElement | undefined)
            : undefined
        return {
            diagram,
            data,
            wrap,
            shown: diagram,
            other: undefined,
            caption,
            name: nameOf(diagram),
            spoken: accessibleName(diagram) ?? nameOf(diagram)
        }
    })
    // Rows often repeat a title (C's voicings): the bar adds the place to tell them apart.
    const counts = new Map<string, number>()
    for (const item of items) counts.set(item.name, (counts.get(item.name) ?? 0) + 1)
    items.forEach((item, i) => {
        if ((counts.get(item.name) ?? 0) <= 1) return
        const place = ` (${i + 1} of ${items.length})`
        item.name += place
        item.spoken += place
    })

    const strums = strumsOf(options.strum)
    const settings = {
        /** The sound chosen on the bar; null: each diagram its own. */
        chosen: options.sound ?? null,
        bpm: clamp(options.bpm, 20, 240, DEFAULT_SEQUENCE.bpm),
        loop: false
    }
    let selected: Item = items[0]!
    let playing: PlayHandle | null = null
    let playingItem: Item | null = null
    let lights: ReturnType<typeof followNotes> | null = null
    /** Playing every diagram in turn. */
    let inTurn = false
    /** The pause between two diagrams in turn, or before a loop's next pass, and its window. */
    let pause: { id: number; win: Window } | null = null
    let ui: GroupUi | null = null
    let alive = true
    /** Counts plays: the end of a play stopped or replaced since is ignored. */
    let run = 0
    const self: DiagramGroup = {
        stop: () => stop(),
        setSound: (sound) => setSound(sound),
        onPlay: null,
        stopOthers: null,
        destroy() {
            stop()
            alive = false
        }
    }

    const soundOf = (item: Item): Sound => settings.chosen ?? item.data.sound
    const connected = () => items.some((item) => item.wrap.isConnected)
    const changed = () => ui?.changed()

    const clearPause = () => {
        if (pause) pause.win.clearTimeout(pause.id)
        pause = null
    }
    /** Waits `ms` on the window the diagram is in now (a popout has its own timers). */
    const later = (item: Item, ms: number, then: () => void) => {
        clearPause()
        const here = item.wrap.ownerDocument.defaultView ?? win
        pause = {
            win: here,
            id: here.setTimeout(() => {
                pause = null
                then()
            }, ms)
        }
    }
    /**
     * What a play does when its notes end: after the call that started it returned (a player may
     * end inside `play()`), and only if nothing played since.
     */
    const ended = (mine: number, then: () => void) => () =>
        queueMicrotask(() => {
            if (mine === run) then()
        })
    const stop = () => {
        clearPause()
        inTurn = false
        run++
        playing?.stop()
        playing = null
        playingItem = null
        lights?.stop()
        lights = null
        changed()
    }

    /**
     * Plays notes with the app's player, or the light synthesizer when that one fails, in the
     * window the diagram is in now: a host may move a drawn diagram to another window (Obsidian
     * popouts), and its sound then belongs to that window.
     */
    const play = (
        item: Item,
        events: NoteEvent[],
        onEnd: () => void,
        targets: readonly (readonly Element[])[]
    ): PlayHandle => {
        const here = item.wrap.ownerDocument.defaultView ?? win
        // Each note lights when it really sounds: a soundfont may take seconds on the first play.
        const run = (player: NotePlayer) => {
            lights?.stop()
            const follower = followNotes(
                here,
                item.shown,
                targets,
                events,
                startsReported(player) ? Infinity : START_WAIT
            )
            lights = follower
            const onStart = () => {
                sawStart(player)
                follower.heard()
            }
            // The play follows the app's volume while it sounds (#85).
            const volume = volumeOf(options.volume)
            let handle: PlayHandle | null = null
            const unfollow = followVolume(
                () => volumeOf(options.volume),
                () => (handle ? [handle] : []),
                volume
            )
            try {
                handle = player.play(events, {
                    sound: soundOf(item),
                    volume,
                    onEnd: () => {
                        unfollow()
                        onEnd()
                    },
                    onStart
                })
            } catch (error) {
                unfollow()
                follower.stop()
                throw error
            }
            const played = handle
            return {
                stop() {
                    unfollow()
                    played.stop()
                },
                setVolume: (next: number) => played.setVolume?.(next)
            }
        }
        try {
            return run(playerFor(here, options))
        } catch {
            return run(lightFor(here))
        }
    }

    const select = (item: Item) => {
        selected = item
        if (how.bar && items.length > 1)
            for (const each of items) {
                each.wrap.classList.toggle('mn-selected', each === item)
                if (each === item) each.wrap.setAttribute('aria-current', 'true')
                else each.wrap.removeAttribute('aria-current')
            }
        changed()
    }

    /** Plays a diagram: its chord strummed or its notes run; then the next one in turn, or again. */
    const start = (item: Item, turn: number | null) => {
        // What the block plays stops first; a run in turn goes on.
        clearPause()
        run++
        playing?.stop()
        playing = null
        lights?.stop()
        lights = null
        inTurn = turn !== null
        // A diagram no longer on the page (the block was redrawn or left) stops looping.
        if (!alive || !item.wrap.isConnected) return stop()
        self.onPlay?.()
        const shown = item.shown
        const pitches =
            shown === item.diagram
                ? item.data.pitches
                : (dataOf(shown)?.pitches ?? item.data.pitches)
        const tones = tonesOf(shown)
        const sound = soundOf(item)
        const events = sequenceOf(item.data.kind, pitches, {
            sound,
            bpm: settings.bpm,
            strum: strums[sound],
            root: shown === item.diagram ? item.data.root : rootOf(shown),
            ...(tones ? { tones } : {}),
            // A list of notes plays as written (keyboard data-mn-order), then back.
            ...(shown.getAttribute('data-mn-order') === 'written' ? { ordered: true } : {})
        })
        playingItem = item
        const mine = ++run
        playing = play(
            item,
            events,
            ended(mine, () => {
                playing = null
                playingItem = null
                // One beat between diagrams, at the bar's tempo.
                if (inTurn && turn !== null) later(item, 60000 / settings.bpm, () => next(turn + 1))
                // Again, from the page's next turn (never a loop inside one call).
                else if (settings.loop && item.wrap.isConnected && alive)
                    later(item, 0, () => start(item, null))
                else changed()
            }),
            noteTargets(shown, events, item.data.kind)
        )
        changed()
    }

    /** The diagram at `index` of a run in turn; after the last, again with loop, else the end. */
    const next = (index: number) => {
        if (!inTurn || !alive) return
        if (!connected()) return stop()
        if (index >= items.length) {
            if (!settings.loop) return stop()
            index = 0
        }
        const item = items[index]!
        select(item)
        start(item, index)
    }

    const playAll = () => {
        stop()
        inTurn = true
        next(0)
    }

    const playNote = (item: Item, target: Element) => {
        const midi = Number(target.getAttribute('data-midi'))
        if (!alive || !Number.isFinite(midi)) return
        stop()
        select(item)
        self.onPlay?.()
        // A chord on the element (a key on the circle of fifths) is strummed; else its one note.
        // Only the clicked element lights, not the pitch's other places.
        const strum = (target.getAttribute('data-mn-strum') ?? '')
            .split(' ')
            .filter(Boolean)
            .map(Number)
            .filter((n) => Number.isFinite(n))
        const sound = soundOf(item)
        const events = strum.length
            ? sequenceOf('chord', strum, { sound, bpm: settings.bpm, strum: strums[sound] })
            : [{ midi, time: 0, duration: 1.5 }]
        const mine = ++run
        playing = play(
            item,
            events,
            ended(mine, () => {
                playing = null
                changed()
            }),
            events.map(() => [target])
        )
        changed()
    }

    /** A click or Space / Enter on a diagram: plays it, or stops it when it's the one playing. */
    const press = (item: Item) => {
        if (!alive) return
        if (playingItem === item || (inTurn && selected === item)) return stop()
        select(item)
        start(item, null)
    }

    /** Draws a diagram for the sound chosen: the other instrument's drawing, or its own. */
    const drawFor = (item: Item) => {
        if (!how.bar) return
        // A drawing that isn't an instrument (the circle of fifths) keeps itself.
        if (item.diagram.getAttribute('data-mn-redraw') === 'no') return
        const sound = soundOf(item)
        if (sound !== item.data.sound)
            item.other ??= redrawFor(doc, item.diagram, item.data, options.hand)
        const next = sound === item.data.sound ? item.diagram : (item.other ?? item.diagram)
        // Only while the host leaves the drawing in its wrapper.
        if (next !== item.shown && item.shown.parentNode === item.wrap) {
            item.wrap.replaceChild(next, item.shown)
            item.shown = next
        }
        if (item.caption) item.caption.hidden = item.shown !== item.diagram
    }

    const setSound = (sound: Sound) => {
        // What plays stops first: its notes belong to the drawing that goes away.
        stop()
        settings.chosen = sound
        for (const item of items) drawFor(item)
        changed()
    }

    for (const item of items) {
        const { wrap } = item
        wrap.tabIndex = 0
        wrap.setAttribute('role', 'button')
        // Named by a hidden text, not aria-label: Obsidian shows a tooltip for any element with
        // one, and this one covers the whole drawing.
        const label = html(doc, 'span', 'mn-playable-name', `Play ${item.spoken}`)
        label.id = uniqueId()
        label.hidden = true
        wrap.prepend(label)
        wrap.setAttribute('aria-labelledby', label.id)
        // A press on a diagram is its own: an editor (Obsidian's live preview) must not open the
        // block's source for it.
        wrap.addEventListener('mousedown', (event) => event.stopPropagation())
        wrap.addEventListener('click', (event) => {
            const note = noteAt(event.target)
            if (note && item.shown.contains(note)) playNote(item, note)
            else press(item)
        })
        wrap.addEventListener('keydown', (event) => {
            if (event.target !== wrap) return
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                press(item)
            } else if (event.key === 'Escape') {
                // Whatever the block plays: these diagrams, or its progression in time.
                const here = playing !== null || inTurn
                const others = self.stopOthers?.() ?? false
                if (here) stop()
                if (here || others) event.preventDefault()
            }
        })
    }
    // An app or a page that starts on the other sound (play: { sound }) shows its drawing.
    for (const item of items) drawFor(item)
    // The first diagram is the one the bar plays until another is chosen.
    select(selected)

    const api: GroupApi = {
        get selected() {
            return selected
        },
        // Between two passes of a loop too: the toggle stops it.
        get busy() {
            return playing !== null || inTurn || pause !== null
        },
        get inTurn() {
            return inTurn
        },
        get sound() {
            return soundOf(selected)
        },
        get bpm() {
            return settings.bpm
        },
        set bpm(n: number) {
            settings.bpm = n
        },
        strumOf: (sound: Sound) => strums[sound],
        setStrum(sound: Sound, n: number) {
            strums[sound] = n
        },
        get loop() {
            return settings.loop
        },
        set loop(on: boolean) {
            settings.loop = on
        },
        playSelected: () => start(selected, null),
        playAll,
        stop
    }
    return {
        group: self,
        items,
        api,
        bind: (given: GroupUi) => {
            ui = given
            changed()
        }
    }
}

/** What the bar reads and drives. */
export interface GroupApi {
    readonly selected: Item
    readonly busy: boolean
    readonly inTurn: boolean
    readonly sound: Sound
    bpm: number
    strumOf(sound: Sound): number
    setStrum(sound: Sound, n: number): void
    loop: boolean
    playSelected(): void
    playAll(): void
    stop(): void
}

/** The bar's side: told when something changed. */
export interface GroupUi {
    changed(): void
}

/** The bar of a block's diagrams. Returns a function that stops what plays and frees it. */
export function blockBarFor(
    doc: Document,
    win: Window,
    block: Element,
    diagrams: { diagram: Element; data: DiagramData }[],
    options: PlayOptions
): () => void {
    const {
        group,
        items,
        api: made,
        bind
    } = diagramGroup(doc, win, diagrams, options, {
        bar: true
    })
    const several = items.length > 1
    const bar = playBar(doc, 'mn-block-bar', 'Playback')
    placeBar(block, items[items.length - 1]!.wrap, bar)

    const toggle = html(doc, 'button', 'mn-play-toggle')
    toggle.type = 'button'
    toggle.addEventListener('click', () => (made.busy ? made.stop() : made.playSelected()))
    bar.appendChild(toggle)
    if (several) {
        const all = iconButton(doc, 'mn-play-all', 'Play all in turn', 'all')
        all.addEventListener('click', () => (made.inTurn ? made.stop() : made.playAll()))
        bar.appendChild(all)
    }
    const name = several ? html(doc, 'span', 'mn-play-name') : null
    if (name) bar.appendChild(name)
    bar.appendChild(
        pressedButton(doc, 'mn-play-loop', 'Loop', 'loop', false, (on) => (made.loop = on))
    )
    // The speed of the selected diagram, when it plays several notes: BPM for a scale or a list,
    // the strum's spread for a chord.
    const tempo = items.some((i) => i.data.kind === 'scale' && i.data.pitches.length > 1)
        ? valueSlider(doc, 'Tempo (BPM)', 'BPM', 20, 240, made.bpm, (n) => (made.bpm = n))
        : null
    const strum = items.some((i) => i.data.kind === 'chord' && i.data.pitches.length > 1)
        ? valueSlider(
              doc,
              'Strum (ms between strings)',
              'ms',
              0,
              200,
              made.strumOf(made.sound),
              (n) => made.setStrum(made.sound, n)
          )
        : null
    if (tempo) bar.appendChild(tempo.field)
    if (strum) bar.appendChild(strum.field)
    const sound = choice(
        doc,
        'mn-play-sound',
        'Sound',
        ['guitar', 'piano'] as const,
        made.sound,
        { guitar: 'Guitar', piano: 'Piano' },
        (value) => group.setSound(value === 'piano' ? 'piano' : 'guitar')
    )
    bar.appendChild(sound)
    // The selected diagram (the drawing shown, with its caption); the whole block with Shift or
    // with one diagram (#11).
    if (options.copy !== false)
        bar.append(
            ...copyImageButton(doc, win, (whole) =>
                whole || !several ? block : diagramImage(made.selected.wrap)
            )
        )

    bind({
        changed() {
            const busy = made.busy
            toggle.replaceChildren(icon(doc, busy ? 'stop' : 'play'))
            toggle.setAttribute('aria-label', busy ? 'Stop' : 'Play')
            toggle.title = busy ? 'Stop' : 'Play'
            const item = made.selected
            if (name) name.textContent = item.name
            bar.setAttribute('aria-label', `Play ${item.spoken}`)
            const several = item.data.pitches.length > 1
            if (tempo) tempo.field.hidden = !(several && item.data.kind === 'scale')
            if (strum) {
                strum.field.hidden = !(several && item.data.kind === 'chord')
                strum.show(made.strumOf(made.sound))
            }
            sound.value = made.sound
        }
    })
    return () => group.destroy()
}
