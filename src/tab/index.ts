/**
 * Tabs and scores (#24): ```tab and ```score blocks in alphaTex (or a Guitar Pro / MusicXML file),
 * drawn and played by alphaTab (MPL-2.0, used unmodified). alphaTab isn't bundled here: the app
 * passes the alphaTab module (its UMD build, `window.alphaTab`), so the app decides how it ships
 * (Music Practice embeds it, Publish pages load it from jsDelivr). Also the converters and
 * exporters behind imports (#25), and a soundfont player for the diagrams' playback (#23).
 */
import type * as AT from '@coderline/alphatab'
import { html, svg } from '../render/dom.js'
import type { NoteEvent, NotePlayer, Sound } from '../playback/player.js'

export type AlphaTabModule = typeof AT

/** The alphaTab release these blocks are made for (Publish loads it from jsDelivr). */
export const ALPHATAB_VERSION = '1.8.4'

/** jsDelivr URLs of alphaTab's script, music font and soundfont, for web pages. */
export const alphaTabCdn = (version = ALPHATAB_VERSION) => {
    const base = `https://cdn.jsdelivr.net/npm/@coderline/alphatab@${version}/dist`
    return {
        script: `${base}/alphaTab.min.js`,
        font: `${base}/font/Bravura.woff2`,
        soundFont: `${base}/soundfont/sonivox.sf3`
    }
}

export interface TabAssets {
    /** A URL of alphaTab's script (UMD) to run it in workers; null renders on the main thread. */
    scriptFile?: string | null
    /** The Bravura music font (woff2): a URL or a data URL. */
    font: string
    /** The soundfont: its bytes or a URL. */
    soundFont: Uint8Array | string
}

export interface TabOptions {
    alphaTab: AlphaTabModule
    assets: TabAssets
    /** The bytes of a file a block names (`file: [[Song.gp]]`); null when it can't be found. */
    resolveFile?: (link: string) => Promise<Uint8Array | null>
    /** The player bar (default true). The player itself starts at the first Play. */
    player?: boolean
    /** Called once alphaTab's API exists (before the score is drawn). */
    onApi?: (api: AT.AlphaTabApi) => void
    /**
     * The Tab / Score / Both control in the player bar (default true; Music Practice #83): a click
     * draws the block again in that view, without changing its text. Shown when the score has a
     * stringed staff (drums and piano have no tablature, so they have one view only).
     */
    views?: boolean
    /**
     * Called by **Keep this view** with the view chosen, so the app writes `staves:` in the block.
     * Without it, the control has no Keep this view.
     */
    onKeepView?: (staves: Staves) => void
    /** The view of a block with no `staves:` line (default: the block's language). */
    defaultStaves?: Staves
}

export type Staves = 'tab' | 'score' | 'both'

export interface TabSource {
    staves: Staves
    /** Whether the block has a `staves:` line (else `staves` is the language's default). */
    stavesWritten: boolean
    /** A file to draw instead of alphaTex (`[[Song.gp]]` or a path). */
    file: string | null
    /** Tracks to draw (1-based); all by default. */
    tracks: number[] | null
    /** The alphaTex itself. */
    tex: string
    /** Lines of the block before the alphaTex (settings, blank lines), for error positions. */
    texLine: number
}

const SETTING = /^\s*(staves|file|tracks?)\s*:\s*(.*)$/i

/**
 * A tab block's own settings (lines `staves:`, `file:`, `tracks:` at the top, `//` comments
 * allowed among them), then its alphaTex. ```tab blocks show tablature, ```score blocks standard
 * notation, unless `staves:` says otherwise. Throws a message for the user.
 */
export function parseTabSource(language: 'tab' | 'score', source: string): TabSource {
    const lines = source.split(/\r?\n/)
    const out: TabSource = {
        staves: language,
        stavesWritten: false,
        file: null,
        tracks: null,
        tex: '',
        texLine: 0
    }
    let i = 0
    for (; i < lines.length; i++) {
        const line = lines[i]!
        if (!line.trim() || /^\s*\/\//.test(line)) continue
        const m = SETTING.exec(line)
        if (!m) break
        const key = m[1]!.toLowerCase()
        const value = m[2]!.trim()
        if (key === 'staves') {
            const v = value.toLowerCase()
            if (v !== 'tab' && v !== 'score' && v !== 'both') {
                throw new Error(`staves: use tab, score or both, got "${value}"`)
            }
            out.staves = v
            out.stavesWritten = true
        } else if (key === 'file') {
            // [[Song.gp|Alias]], [[Song.gp#Heading]]: the file.
            out.file =
                value
                    .replace(/^!?\[\[|\]\]$/g, '')
                    .split(/[|#]/)[0]!
                    .trim() || null
        } else {
            const tracks = value
                .split(/[\s,]+/)
                .filter(Boolean)
                .map(Number)
            if (!tracks.length || tracks.some((t) => !Number.isInteger(t) || t < 1)) {
                throw new Error(`tracks: use track numbers from 1, got "${value}"`)
            }
            out.tracks = tracks
        }
    }
    while (i < lines.length && !lines[i]!.trim()) i++
    out.texLine = i
    // Only the end is trimmed: columns in alphaTab's messages stay right.
    out.tex = lines.slice(i).join('\n').trimEnd()
    if (!out.file && !out.tex)
        throw new Error('Write the music in alphaTex, or give a file: [[Song.gp]]')
    return out
}

/** alphaTab's message for a mistake, with the first diagnostic's place in the block when known. */
function messageOf(error: unknown, lineOffset: number): string {
    const cause = (error as { cause?: unknown } | null)?.cause ?? error
    for (const kind of ['lexerDiagnostics', 'parserDiagnostics', 'semanticDiagnostics']) {
        const items = (cause as Record<string, { items?: unknown } | undefined> | null)?.[kind]
            ?.items
        if (!Array.isArray(items)) continue
        const first = (
            items as {
                severity?: number
                message?: string
                start?: { line: number; col: number }
            }[]
        ).find((d) => d.severity === 2 && d.message)
        if (first) {
            const at = first.start
                ? `line ${first.start.line + lineOffset}, column ${first.start.col}: `
                : ''
            return `${at}${first.message}`
        }
    }
    return error instanceof Error ? error.message : String(error)
}

/** The staves alphaTab can draw for a staff (the part of `AT.model.Staff` read and set here). */
interface StaffView {
    isPercussion: boolean
    tuning: number[]
    showTablature: boolean
    showStandardNotation: boolean
    showSlash: boolean
    showNumbered: boolean
    /** Bars, with the clef alphaTab draws (0 is its neutral percussion clef). */
    bars?: { clef: number }[]
}

/** alphaTab's `Clef.Neutral`: the percussion clef. */
const NEUTRAL_CLEF = 0

/**
 * Chooses what each staff shows, once the score is loaded (alphaTex or a file) and before it's
 * drawn. alphaTab's stave profile applies to the whole block, so the profile stays Default and
 * the choice is made staff by staff: `tab` shows tablature on stringed staves and notation on the
 * others (drums, piano: they have no tablature, else they'd draw nothing); `score` shows notation
 * only; `both` notation, plus tablature on stringed staves (slash and numbered staves as written).
 */
function chooseStaves(staves: Staves, score: { tracks: { staves: StaffView[] }[] }): void {
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            // Drums written without a clef get the percussion clef, not the default treble.
            if (staff.isPercussion) for (const bar of staff.bars ?? []) bar.clef = NEUTRAL_CLEF
            const stringed = !staff.isPercussion && staff.tuning.length > 0
            if (staves === 'both') {
                staff.showStandardNotation = true
                staff.showTablature = stringed
                continue
            }
            staff.showSlash = false
            staff.showNumbered = false
            staff.showTablature = staves === 'tab' && stringed
            staff.showStandardNotation = !staff.showTablature
        }
    }
}

/** The part of alphaTab's score read and set to hide its default dynamics. */
interface DynamicsView {
    stylesheet: { hideDynamics: boolean }
    tracks: {
        staves: { bars: { voices: { beats: { dynamics: number; isRest: boolean }[] }[] }[] }[]
    }[]
}

/** alphaTab's `DynamicValue.F`: the dynamic of every beat that has none written. */
const DEFAULT_DYNAMIC = 5

/**
 * Hides the dynamics nobody wrote (#66): alphaTab gives every beat forte and draws an "f" at the
 * start of each staff. They stay when a beat has another dynamic, or the alphaTex writes one
 * (`{dy f}`) or `\showDynamics`.
 */
export function hideDefaultDynamics(score: DynamicsView, tex: string | null): void {
    if (tex !== null && /\bdy\b|\\showdynamics/i.test(tex)) return
    const written = score.tracks.some((track) =>
        track.staves.some((staff) =>
            staff.bars.some((bar) =>
                bar.voices.some((voice) =>
                    voice.beats.some((beat) => !beat.isRest && beat.dynamics !== DEFAULT_DYNAMIC)
                )
            )
        )
    )
    if (!written) score.stylesheet.hideDynamics = true
}

/** The line alphaTab draws under every score. */
const CREDIT = 'rendered by alphaTab'

/**
 * Hides the "rendered by alphaTab" line under each score (#66): a part of the drawing of its own,
 * found by its text once drawn (SVG). alphaTab's license (MPL-2.0) doesn't ask for it on screen;
 * its notice stays in alphaTab's script, loaded unmodified.
 */
function hideCredit(api: AT.AlphaTabApi, surface: HTMLElement): void {
    const renderer = (api as Partial<AT.AlphaTabApi>).renderer
    renderer?.partialRenderFinished?.on((e) => {
        // alphaTab reuses the parts' elements: each one shows again unless it's the credit.
        for (const part of surface.querySelectorAll<HTMLElement>('.at-surface > div')) {
            if ((part as { layoutResultId?: string }).layoutResultId !== e.id) continue
            const credit = typeof e.renderResult === 'string' && e.renderResult.includes(CREDIT)
            part.style.visibility = credit ? 'hidden' : ''
        }
    })
}

/**
 * A CSS color as rgba(), whatever the theme wrote (oklch(), color(srgb …), names): alphaTab only
 * reads hex and rgb()/rgba(). Read through a canvas; null when it can't be.
 */
function rgbaOf(doc: Document, color: string, alpha = 1): string | null {
    const canvas = doc.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const data = ctx.getImageData(0, 0, 1, 1).data
    if (data.length < 4) return null
    return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${((data[3]! / 255) * alpha).toFixed(3)})`
}

/** The host's text colors, so the music shows in light and dark themes (alphaTab draws black). */
function colorsOf(el: HTMLElement): Record<string, string> {
    const doc = el.ownerDocument
    const raw = doc.defaultView?.getComputedStyle(el).color || ''
    const fg = (raw && rgbaOf(doc, raw)) || (/^rgba?\(/.test(raw) ? raw : 'rgba(0, 0, 0, 1)')
    const muted = (raw && rgbaOf(doc, raw, 0.6)) || fg
    return {
        mainGlyphColor: fg,
        secondaryGlyphColor: muted,
        scoreInfoColor: fg,
        staffLineColor: muted,
        barSeparatorColor: fg,
        barNumberColor: muted
    }
}

/** Black music on white paper, for printing. */
const PRINT_COLORS = {
    mainGlyphColor: 'rgba(0, 0, 0, 1)',
    secondaryGlyphColor: 'rgba(0, 0, 0, 0.6)',
    scoreInfoColor: 'rgba(0, 0, 0, 1)',
    staffLineColor: 'rgba(0, 0, 0, 0.6)',
    barSeparatorColor: 'rgba(0, 0, 0, 1)',
    barNumberColor: 'rgba(0, 0, 0, 0.6)'
}

/** Prints a drawn score in black on white, whatever the theme. Throws when the app can't print. */
export function printTab(result: TabResult): void {
    if (!result.api) throw new Error('The score is not drawn yet')
    result.api.print(undefined, { display: { resources: PRINT_COLORS } })
}

/**
 * Objects alphaTab checks with `instanceof` (Map, Uint8Array) made in the window it runs in: a
 * popout window has its own constructors.
 */
const local = (doc: Document) => {
    const win = doc.defaultView ?? globalThis
    return {
        map: <K, V>(entries: [K, V][]) => new win.Map<K, V>(entries),
        bytes: (data: Uint8Array) => {
            const copy = new win.Uint8Array(data.length)
            copy.set(data)
            return copy
        }
    }
}

export interface TabResult {
    el: HTMLElement
    /** Resolves once drawn (or failed, or removed), with the message shown when it failed. */
    ready: Promise<{ ok: boolean; error: string | null }>
    /** The alphaTab API, for exports and playback. */
    api: AT.AlphaTabApi | null
    destroy(): void
}

const ICONS = {
    play: 'M4 2.5v11l9-5.5z',
    pause: 'M4 3h3v10H4zM9 3h3v10H9z',
    stop: 'M4 4h8v8H4z',
    loop: 'M3 8a5 5 0 0 1 8.5-3.5L13 6V2.5M13 8a5 5 0 0 1-8.5 3.5L3 10v3.5',
    metronome: 'M6 2h4l3 12H3zM8 11l3-7',
    countIn: 'M3 13h10M5 13V9M8 13V6M11 13V3',
    volume: 'M2 6h3l4-3v10l-4-3H2zM11 5.5a3.5 3.5 0 0 1 0 5'
} as const

function icon(doc: Document, name: keyof typeof ICONS): SVGElement {
    const filled = name === 'play' || name === 'pause' || name === 'stop'
    const root = svg(doc, 'svg', {
        'class': `mn-play-icon${filled ? '' : ' mn-play-icon-loop'}`,
        'viewBox': '0 0 16 16',
        'width': 12,
        'height': 12,
        'aria-hidden': 'true'
    })
    root.appendChild(svg(doc, 'path', { d: ICONS[name] }))
    return root
}

const time = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The player bar under a score: play / pause, stop, loop, metronome, count-in, speed, volume.
 * The player (an audio context, the synthesizer, the soundfont) starts at the first Play, so a
 * note full of tabs costs nothing until one plays.
 */
function playerBar(
    doc: Document,
    api: AT.AlphaTabApi,
    alphaTab: AlphaTabModule,
    assets: TabAssets
): { bar: HTMLElement; failed: (message: string) => void } {
    const bar = html(doc, 'div', 'mn-play mn-tab-bar')
    // A press in the bar is the bar's: an editor (Obsidian's live preview) must not take it as a
    // click on the block, which opens its source.
    bar.addEventListener('mousedown', (event) => event.stopPropagation())
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', 'Playback')
    const state = { loop: false, metronome: false, countIn: false, speed: 1, volume: 1 }
    let started: Promise<boolean> | null = null
    /** Settles the start when playback can't happen (alphaTab reports it as an error). */
    let cantStart: (() => void) | null = null
    /** Turns the player on, loads the soundfont, and waits until it can play. */
    const start = () => {
        started ??= new Promise<boolean>((resolve) => {
            api.playerReady.on(() => resolve(true))
            cantStart = () => resolve(false)
            api.settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer
            api.settings.player.enableCursor = true
            if (typeof assets.soundFont === 'string')
                api.settings.player.soundFont = assets.soundFont
            api.updateSettings()
            if (assets.soundFont instanceof Uint8Array)
                api.loadSoundFont(local(doc).bytes(assets.soundFont), false)
        }).then((ok) => {
            if (ok) {
                api.isLooping = state.loop
                api.metronomeVolume = state.metronome ? 1 : 0
                api.countInVolume = state.countIn ? 1 : 0
                api.playbackSpeed = state.speed
                api.masterVolume = state.volume
            }
            return ok
        })
        return started
    }
    const button = (name: keyof typeof ICONS, label: string, run: () => void) => {
        const b = html(doc, 'button')
        b.type = 'button'
        b.title = label
        b.setAttribute('aria-label', label)
        b.appendChild(icon(doc, name))
        b.addEventListener('click', run)
        bar.appendChild(b)
        return b
    }
    /** Applies a setting to the player when it runs; it's applied at start otherwise. */
    const live = (apply: () => void) => {
        if (api.player) apply()
    }
    const toggle = (
        name: keyof typeof ICONS,
        label: string,
        key: 'loop' | 'metronome' | 'countIn'
    ) => {
        const b = button(name, label, () => {
            state[key] = !state[key]
            live(() => {
                api.isLooping = state.loop
                api.metronomeVolume = state.metronome ? 1 : 0
                api.countInVolume = state.countIn ? 1 : 0
            })
            b.classList.toggle('mn-on', state[key])
            b.setAttribute('aria-pressed', String(state[key]))
        })
        b.setAttribute('aria-pressed', 'false')
    }
    const play = button('play', 'Play', () => {
        void start().then((ok) => {
            if (ok) api.playPause()
        })
    })
    button('stop', 'Stop', () => live(() => api.stop()))
    toggle('loop', 'Loop', 'loop')
    toggle('metronome', 'Metronome', 'metronome')
    toggle('countIn', 'Count-in', 'countIn')
    const slider = (
        label: string,
        mark: string | SVGElement,
        min: number,
        max: number,
        value: number,
        set: (n: number) => void,
        unit = ''
    ) => {
        const field = html(doc, 'label', 'mn-play-field')
        const tag = html(doc, 'span', 'mn-play-label')
        tag.setAttribute('aria-hidden', 'true')
        tag.append(mark)
        const input = html(doc, 'input')
        input.type = 'range'
        input.min = String(min)
        input.max = String(max)
        input.value = String(value)
        input.setAttribute('aria-label', label)
        field.title = `${label}: ${value}${unit}`
        input.addEventListener('input', () => {
            set(Number(input.value))
            field.title = `${label}: ${input.value}${unit}`
        })
        field.append(tag, input)
        bar.appendChild(field)
    }
    slider(
        'Speed',
        '%',
        25,
        150,
        100,
        (n) => {
            state.speed = n / 100
            live(() => (api.playbackSpeed = state.speed))
        },
        '%'
    )
    slider('Volume', icon(doc, 'volume'), 0, 100, 100, (n) => {
        state.volume = n / 100
        live(() => (api.masterVolume = state.volume))
    })
    const position = html(doc, 'span', 'mn-tab-time', '')
    bar.appendChild(position)
    api.playerStateChanged.on((e) => {
        // PlayerState.Playing (the module's enum, compared by value).
        const playing = Number(e.state) === Number(alphaTab.synth.PlayerState.Playing)
        play.replaceChildren(icon(doc, playing ? 'pause' : 'play'))
        play.title = playing ? 'Pause' : 'Play'
        play.setAttribute('aria-label', play.title)
    })
    api.playerPositionChanged.on((e) => {
        position.textContent = `${time(e.currentTime)} / ${time(e.endTime)}`
    })
    return {
        bar,
        // The score stays; only playback is off (no soundfont, no audio).
        failed: (message) => {
            cantStart?.()
            play.disabled = true
            play.title = `Can't play: ${message}`
            play.setAttribute('aria-label', play.title)
        }
    }
}

/** Whether a score has a staff with tablature (stringed, not drums) among the tracks drawn. */
function hasTablature(score: { tracks: { staves: StaffView[] }[] }, tracks: number[] | null) {
    return score.tracks.some(
        (track, i) =>
            (!tracks || tracks.includes(i + 1)) &&
            track.staves.some((staff) => !staff.isPercussion && staff.tuning.length > 0)
    )
}

const VIEWS: { staves: Staves; label: string; what: string }[] = [
    { staves: 'tab', label: 'Tab', what: 'tablature' },
    { staves: 'score', label: 'Score', what: 'standard notation' },
    { staves: 'both', label: 'Both', what: 'standard notation and tablature' }
]

/**
 * The view control of the player bar (Music Practice #83): Tab, Score, Both, the view drawn
 * pressed. `own` is the block's view (its `staves:` line, else the default, which the button's
 * title says). A click calls `choose`; **Keep this view** (only with `keep`) shows while the view
 * drawn isn't the block's own, and calls `keep` with it.
 */
function viewControl(
    doc: Document,
    own: { staves: Staves; written: boolean },
    choose: (staves: Staves) => void,
    keep?: (staves: Staves) => void
): HTMLElement {
    const group = html(doc, 'span', 'mn-tab-views')
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', 'View')
    let current = own.staves
    const keepButton = keep ? html(doc, 'button', 'mn-tab-keep', 'Keep this view') : null
    const buttons = VIEWS.map(({ staves, label, what }) => {
        const b = html(doc, 'button', 'mn-tab-view', label)
        b.type = 'button'
        b.dataset['staves'] = staves
        const mine =
            staves !== own.staves
                ? ''
                : own.written
                  ? ` (this block's staves: line)`
                  : ' (the default: the block has no staves: line)'
        b.title = `Draw as ${what}${mine}`
        b.addEventListener('click', () => {
            if (staves === current) return
            current = staves
            show()
            choose(staves)
        })
        group.appendChild(b)
        return b
    })
    const show = () => {
        for (const b of buttons) {
            const on = b.dataset['staves'] === current
            b.classList.toggle('mn-on', on)
            b.setAttribute('aria-pressed', String(on))
        }
        if (keepButton) {
            keepButton.hidden = current === own.staves
            keepButton.title = `Write staves: ${current} at the top of the block`
        }
    }
    if (keepButton && keep) {
        keepButton.type = 'button'
        keepButton.addEventListener('click', () => keep(current))
        group.appendChild(keepButton)
    }
    show()
    return group
}

/**
 * Draws a ```tab or ```score block into `host`, with its player bar. Never throws and `ready`
 * never rejects: a mistake (in the alphaTex, a missing or unreadable file, no alphaTab) shows an
 * inline message; an empty block draws nothing.
 */
export function renderTab(
    language: 'tab' | 'score',
    source: string,
    host: HTMLElement,
    options: TabOptions
): TabResult {
    const doc = host.ownerDocument
    const el = html(doc, 'div', `mn-block mn-block-${language} mn-tab`)
    host.appendChild(el)
    let api: AT.AlphaTabApi | null = null
    let gone = false
    let settled = false
    let settle: (result: { ok: boolean; error: string | null }) => void = () => {}
    const ready = new Promise<{ ok: boolean; error: string | null }>((resolve) => {
        settle = (result) => {
            if (settled) return
            settled = true
            resolve(result)
        }
    })
    const fail = (message: string) => {
        el.replaceChildren(html(doc, 'div', 'mn-error-message', `${language}: ${message}`))
        el.classList.add('mn-error')
        settle({ ok: false, error: message })
    }
    if (!source.trim()) {
        el.classList.add('mn-empty')
        settle({ ok: true, error: null })
    } else {
        void (async () => {
            // The caller may still be placing `el` on the page: colors are read once it's there.
            await Promise.resolve()
            const parsed = parseTabSource(language, source)
            // The block's own view, and the one drawn (the view control changes it, #83).
            const own = {
                staves: parsed.stavesWritten
                    ? parsed.staves
                    : (options.defaultStaves ?? parsed.staves),
                written: parsed.stavesWritten
            }
            let view = own.staves
            let tablature = false
            const at = options.alphaTab
            if (!at?.AlphaTabApi) throw new Error("alphaTab isn't loaded")
            const surface = html(doc, 'div', 'mn-tab-surface')
            el.appendChild(surface)
            const { assets } = options
            const made = local(doc)
            const settings: AT.json.SettingsJson = {
                core: {
                    useWorkers: Boolean(assets.scriptFile),
                    ...(assets.scriptFile ? { scriptFile: assets.scriptFile } : {}),
                    smuflFontSources: made.map([[at.FontFileFormat.Woff2, assets.font]]),
                    logLevel: at.LogLevel.Warning,
                    // Every part of the drawing is drawn right away (#82). Lazy loading draws a
                    // part only once an IntersectionObserver sees it, and that observer never
                    // reports while the page isn't painted (an Obsidian window on another
                    // desktop, a background tab, a PDF export): the parts stayed empty, the
                    // block blank, with no error. A block is a few systems: drawing it all is
                    // cheap.
                    enableLazyLoading: false
                },
                display: {
                    // Default: what each staff shows is set when the score loads (chooseStaves).
                    staveProfile: 'Default',
                    resources: colorsOf(el)
                },
                // The player starts at the first Play (playerBar).
                player: { playerMode: at.PlayerMode.Disabled, enableUserInteraction: true }
            }
            const current = new at.AlphaTabApi(surface, settings)
            api = current
            if (gone) {
                current.destroy()
                return
            }
            options.onApi?.(current)
            /** Slash and numbered staves as written: `both` shows them again after a switch. */
            let written: { showSlash: boolean; showNumbered: boolean }[] = []
            current.scoreLoaded.on((score) => {
                written = score.tracks.flatMap((t) =>
                    t.staves.map((s) => ({ showSlash: s.showSlash, showNumbered: s.showNumbered }))
                )
                chooseStaves(view, score)
                tablature = hasTablature(score, parsed.tracks)
                hideDefaultDynamics(score, parsed.file ? null : parsed.tex)
            })
            hideCredit(current, surface)
            let bar: ReturnType<typeof playerBar> | null = null
            current.renderFinished.on(() => {
                if (settled || gone) return
                if (options.player !== false) {
                    bar = playerBar(doc, current, at, assets)
                    el.appendChild(bar.bar)
                    // Drums and piano have one view only: no control then.
                    if (options.views !== false && tablature)
                        bar.bar.appendChild(
                            viewControl(
                                doc,
                                own,
                                (staves) => {
                                    // Drawn again from the loaded score: the player, its song
                                    // and soundfont stay (only the staves change, not the sound).
                                    view = staves
                                    const score = current.score
                                    if (gone || !score) return
                                    const all = score.tracks.flatMap((t) => t.staves)
                                    all.forEach((staff, i) => Object.assign(staff, written[i]))
                                    chooseStaves(staves, score)
                                    current.render()
                                },
                                options.onKeepView
                            )
                        )
                    // Touch screens have no hover: a tap on the score shows the bar.
                    el.addEventListener('pointerdown', (event) => {
                        if (
                            event.pointerType !== 'touch' ||
                            bar?.bar.contains(event.target as Node)
                        )
                            return
                        el.classList.toggle('mn-play-open')
                    })
                }
                settle({ ok: true, error: null })
            })
            current.error.on((e: Error) => {
                const message = messageOf(e, parsed.texLine)
                // Drawn already: only playback failed (the soundfont, the audio); the score stays.
                if (settled) bar?.failed(message)
                else fail(message)
            })
            // All tracks unless the block names some.
            const tracks = parsed.tracks?.map((t) => t - 1)
            if (parsed.file) {
                let bytes: Uint8Array | null
                try {
                    bytes = options.resolveFile ? await options.resolveFile(parsed.file) : null
                } catch (e) {
                    throw new Error(
                        `Couldn't read "${parsed.file}": ${e instanceof Error ? e.message : String(e)}`
                    )
                }
                if (gone) return
                if (!bytes) throw new Error(`Couldn't find the file "${parsed.file}"`)
                const loaded = current.load(made.bytes(bytes), tracks)
                if (!loaded)
                    throw new Error(
                        `Couldn't read "${parsed.file}": not a score file alphaTab knows`
                    )
            } else {
                current.tex(parsed.tex, tracks ?? 'all')
            }
        })().catch((e: unknown) => {
            if (!gone) fail(e instanceof Error ? e.message : String(e))
        })
    }
    return {
        el,
        ready,
        get api() {
            return api
        },
        destroy() {
            gone = true
            try {
                api?.destroy()
            } catch {
                // Already gone.
            }
            el.remove()
            settle({ ok: false, error: null })
        }
    }
}

/** General MIDI programs for the diagrams' sounds. */
const PROGRAMS: Record<Sound, number> = { guitar: 25, piano: 0 }
/**
 * Percussive notes (`NoteEvent.kind`): a muted string on GM program 28, Electric Guitar (muted),
 * on its own channel; a click on the percussion channel, GM key 33 (Metronome Click, the key
 * alphaTab's metronome uses, so it's always loaded).
 */
const MUTED = { channel: 1, program: 28 }
const CLICK = { channel: 9, key: 33 }

/**
 * Seconds the song goes on after the last note ends, so the soundfont's release rings: alphaTab
 * silences every note the moment a song ends.
 */
const SOUNDFONT_TAIL = 0.5

/**
 * Diagram playback through alphaTab's synthesizer and soundfont (realistic sound): a NotePlayer
 * for the `play` render option. `api` is an alphaTab API used only for this (not a score's: its
 * song would stop), with its soundfont loaded and a song that uses both sounds (guitar, program
 * 25, and piano, program 0): alphaTab only loads the presets its song uses.
 */
export function soundfontPlayer(
    alphaTab: AlphaTabModule,
    api: () => AT.AlphaTabApi | null
): NotePlayer {
    return {
        reportsStart: true,
        play(events: NoteEvent[], { sound, volume, onEnd, onStart }) {
            const current = api()
            const player = current?.player
            if (!current || !player) throw new Error('The soundfont player is not ready')
            const midi = new alphaTab.midi.MidiFile()
            const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)
            // At 60 beats a minute, a quarter note (division ticks) lasts a second.
            const ticks = (seconds: number) => Math.round(seconds * midi.division)
            handler.addTempo(0, 60)
            handler.addProgramChange(0, 0, 0, PROGRAMS[sound])
            if (sound === 'guitar' && events.some((e) => e.kind === 'muted'))
                handler.addProgramChange(0, 0, MUTED.channel, MUTED.program)
            // The percussion channel takes the drum kit only once told (else it plays preset 0).
            if (events.some((e) => e.kind === 'click'))
                handler.addProgramChange(0, 0, CLICK.channel, 0)
            const level = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8
            current.masterVolume = level
            for (const e of events) {
                // Velocity (1–127) as given, 100 by default.
                const velocity =
                    e.velocity === undefined || !Number.isFinite(e.velocity)
                        ? 100
                        : Math.round(Math.min(127, Math.max(1, e.velocity)))
                // A muted strum's dead strings on the muted guitar, a click on the percussion channel.
                const channel =
                    e.kind === 'click'
                        ? CLICK.channel
                        : e.kind === 'muted' && sound === 'guitar'
                          ? MUTED.channel
                          : 0
                handler.addNote(
                    0,
                    ticks(e.time),
                    Math.max(1, ticks(e.duration)),
                    e.kind === 'click' ? CLICK.key : e.midi,
                    velocity,
                    channel
                )
            }
            const end = Math.max(...events.map((e) => e.time + e.duration), 0)
            // The song ends after the release: a pedal-up that changes nothing.
            handler.addControlChange(
                0,
                ticks(end + SOUNDFONT_TAIL),
                0,
                alphaTab.midi.ControllerType.HoldPedal,
                0
            )
            current.playbackSpeed = 1
            player.playOneTimeMidiFile(midi)
            let stopped = false
            // The synthesizer starts the song right away: its notes sound from now.
            queueMicrotask(() => {
                if (!stopped) onStart?.()
            })
            const timer = setTimeout(() => onEnd?.(), (end + 0.2) * 1000)
            return {
                stop() {
                    stopped = true
                    clearTimeout(timer)
                    player.stop()
                }
            }
        }
    }
}

/** A soundfont player with its own hidden alphaTab instance; `destroy` frees it. */
export interface SoundfontPlayer extends NotePlayer {
    destroy(): void
}

/**
 * A soundfont player that makes its own hidden alphaTab instance on the first play (for pages
 * and notes without a tab block, and so a score's song isn't stopped). The first notes wait for
 * the soundfont; when it can't load, notes play through `fallback`.
 */
export function createSoundfontPlayer(
    alphaTab: AlphaTabModule,
    assets: TabAssets,
    doc: Document,
    fallback?: NotePlayer
): SoundfontPlayer {
    let api: AT.AlphaTabApi | null = null
    let host: HTMLElement | null = null
    let ready: Promise<boolean> | null = null
    const start = () => {
        if (ready) return ready
        host = html(doc, 'div', 'mn-tab-hidden')
        host.setAttribute('aria-hidden', 'true')
        doc.body.appendChild(host)
        const made = local(doc)
        api = new alphaTab.AlphaTabApi(host, {
            core: {
                useWorkers: Boolean(assets.scriptFile),
                ...(assets.scriptFile ? { scriptFile: assets.scriptFile } : {}),
                smuflFontSources: made.map([[alphaTab.FontFileFormat.Woff2, assets.font]])
            },
            player: {
                playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
                ...(typeof assets.soundFont === 'string' ? { soundFont: assets.soundFont } : {})
            }
        })
        const current = api
        // Ready once the soundfont is in and the player has its song (alphaTab loads the presets
        // then; playing before that is silent, and the song loading later cuts it). A player that
        // never says it's ready plays anyway after a few seconds.
        ready = new Promise<boolean>((resolve) => {
            let soundFont = false
            let player = !current.playerReady
            const settle = () => {
                if (soundFont && player) resolve(true)
            }
            current.soundFontLoaded.on(() => {
                soundFont = true
                settle()
                setTimeout(() => {
                    player = true
                    settle()
                }, 4000)
            })
            current.playerReady?.on(() => {
                player = true
                settle()
            })
            current.error.on(() => resolve(false))
        })
        if (assets.soundFont instanceof Uint8Array)
            current.loadSoundFont(made.bytes(assets.soundFont), false)
        // The player needs a song loaded to be ready, and alphaTab loads only the soundfont presets
        // its song uses: one rest per diagram sound (and the muted guitar of muted strums), else
        // piano would play nothing.
        current.tex(
            `\\track "Guitar" \\instrument ${PROGRAMS.guitar} r \\track "Piano" \\instrument ${PROGRAMS.piano} r \\track "Muted" \\instrument ${MUTED.program} r`
        )
        return ready
    }
    const inner = soundfontPlayer(alphaTab, () => api)
    return {
        // Its notes start once the soundfont is in: `onStart` says when (the fallback's too).
        reportsStart: true,
        play(events, options) {
            let handle: { stop(): void } | null = null
            let stopped = false
            void start().then((ok) => {
                if (stopped) return
                try {
                    if (ok) {
                        handle = inner.play(events, options)
                        return
                    }
                } catch {
                    // Falls through to the fallback.
                }
                if (!fallback) return
                handle = fallback.play(events, options)
                // A fallback that doesn't say when it starts starts now.
                if (!fallback.reportsStart) options.onStart?.()
            })
            return {
                stop() {
                    stopped = true
                    handle?.stop()
                }
            }
        },
        destroy() {
            try {
                api?.destroy()
            } catch {
                // Already gone.
            }
            host?.remove()
            api = null
            ready = null
        }
    }
}

/** A score file's alphaTex (Guitar Pro 3–8, MusicXML, Capella), for inline imports. */
export function scoreToAlphaTex(alphaTab: AlphaTabModule, bytes: Uint8Array): string {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes)
    return new alphaTab.exporter.AlphaTexExporter().exportToString(score)
}

const scoreOf = (alphaTab: AlphaTabModule, music: string | Uint8Array) =>
    typeof music === 'string'
        ? alphaTab.importer.ScoreLoader.loadAlphaTex(music)
        : alphaTab.importer.ScoreLoader.loadScoreFromBytes(music)

/** A Guitar Pro 7 file of alphaTex or a score file. */
export function exportGp7(alphaTab: AlphaTabModule, music: string | Uint8Array): Uint8Array {
    return new alphaTab.exporter.Gp7Exporter().export(scoreOf(alphaTab, music))
}

/** A MIDI file of alphaTex or a score file. */
export function exportMidi(alphaTab: AlphaTabModule, music: string | Uint8Array): Uint8Array {
    const score = scoreOf(alphaTab, music)
    const midi = new alphaTab.midi.MidiFile()
    const settings = new alphaTab.Settings()
    new alphaTab.midi.MidiFileGenerator(
        score,
        settings,
        new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)
    ).generate()
    return midi.toBinary()
}

export { textTabToAlphaTex } from '../convert/text-tab.js'
export { chordSheetToChordPro } from '../convert/chord-sheet.js'
