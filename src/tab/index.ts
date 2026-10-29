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
    /** The player bar (default true). */
    player?: boolean
}

export type Staves = 'tab' | 'score' | 'both'

export interface TabSource {
    staves: Staves
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
 * A tab block's own settings (lines `staves:`, `file:`, `tracks:` at the top), then its alphaTex.
 * ```tab blocks show tablature, ```score blocks standard notation, unless `staves:` says
 * otherwise. Throws a message for the user.
 */
export function parseTabSource(language: 'tab' | 'score', source: string): TabSource {
    const lines = source.split(/\r?\n/)
    const out: TabSource = { staves: language, file: null, tracks: null, tex: '', texLine: 0 }
    let i = 0
    for (; i < lines.length; i++) {
        const line = lines[i]!
        if (!line.trim()) continue
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
        } else if (key === 'file') {
            out.file =
                value
                    .replace(/^!?\[\[|\]\]$/g, '')
                    .split('|')[0]!
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
    out.tex = lines.slice(i).join('\n').trim()
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

const PROFILE: Record<Staves, string> = { tab: 'Tab', score: 'Score', both: 'ScoreTab' }

/** The host's text colors, so the music shows in light and dark themes (alphaTab draws black). */
function colorsOf(el: HTMLElement): Record<string, string> {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el)
    const fg = style?.color || 'rgb(0, 0, 0)'
    const muted = fg.replace(/^rgb\((.*)\)$/, 'rgba($1, 0.6)')
    return {
        mainGlyphColor: fg,
        secondaryGlyphColor: muted,
        scoreInfoColor: fg,
        staffLineColor: muted,
        barSeparatorColor: fg,
        barNumberColor: muted
    }
}

export interface TabResult {
    el: HTMLElement
    /** Resolves once drawn (or failed), with the message shown when it failed. */
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

/** The player bar under a score: play / pause, stop, loop, metronome, count-in, speed, volume. */
function playerBar(doc: Document, api: AT.AlphaTabApi): HTMLElement {
    const bar = html(doc, 'div', 'mn-play mn-tab-bar')
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', 'Playback')
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
    const toggle = (name: keyof typeof ICONS, label: string, set: (on: boolean) => void) => {
        let on = false
        const b = button(name, label, () => {
            on = !on
            set(on)
            b.classList.toggle('mn-on', on)
            b.setAttribute('aria-pressed', String(on))
        })
        b.setAttribute('aria-pressed', 'false')
    }
    const play = button('play', 'Play', () => api.playPause())
    button('stop', 'Stop', () => api.stop())
    toggle('loop', 'Loop', (on) => (api.isLooping = on))
    toggle('metronome', 'Metronome', (on) => (api.metronomeVolume = on ? 1 : 0))
    toggle('countIn', 'Count-in', (on) => (api.countInVolume = on ? 1 : 0))
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
    slider('Speed', '%', 25, 150, 100, (n) => (api.playbackSpeed = n / 100), '%')
    slider('Volume', icon(doc, 'volume'), 0, 100, 100, (n) => (api.masterVolume = n / 100))
    const position = html(doc, 'span', 'mn-tab-time', '0:00 / 0:00')
    bar.appendChild(position)
    api.playerStateChanged.on((e) => {
        // PlayerState.Playing (the module isn't at hand here).
        const playing = Number(e.state) === 1
        play.replaceChildren(icon(doc, playing ? 'pause' : 'play'))
        play.title = playing ? 'Pause' : 'Play'
        play.setAttribute('aria-label', play.title)
    })
    api.playerPositionChanged.on((e) => {
        position.textContent = `${time(e.currentTime)} / ${time(e.endTime)}`
    })
    return bar
}

/**
 * Draws a ```tab or ```score block into `host`, with its player bar. Never throws: a mistake (in
 * the alphaTex, a missing file) shows an inline message.
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
    const fail = (message: string) => {
        el.replaceChildren(html(doc, 'div', 'mn-error-message', `${language}: ${message}`))
        el.classList.add('mn-error')
        return { ok: false, error: message }
    }
    const ready = (async () => {
        let parsed: TabSource
        try {
            parsed = parseTabSource(language, source)
        } catch (e) {
            return fail(e instanceof Error ? e.message : String(e))
        }
        const at = options.alphaTab
        const surface = html(doc, 'div', 'mn-tab-surface')
        el.appendChild(surface)
        const { assets } = options
        const settings: AT.json.SettingsJson = {
            core: {
                useWorkers: Boolean(assets.scriptFile),
                ...(assets.scriptFile ? { scriptFile: assets.scriptFile } : {}),
                smuflFontSources: new Map([[at.FontFileFormat.Woff2, assets.font]]),
                logLevel: at.LogLevel.Warning,
                ...(parsed.tracks ? { tracks: parsed.tracks.map((t) => t - 1) } : {})
            },
            display: {
                staveProfile: PROFILE[parsed.staves] as unknown as AT.StaveProfile,
                resources: colorsOf(el)
            },
            player: {
                playerMode:
                    options.player === false
                        ? at.PlayerMode.Disabled
                        : at.PlayerMode.EnabledSynthesizer,
                enableCursor: true,
                enableUserInteraction: true,
                ...(typeof assets.soundFont === 'string' ? { soundFont: assets.soundFont } : {})
            }
        }
        try {
            api = new at.AlphaTabApi(surface, settings)
        } catch (e) {
            return fail(e instanceof Error ? e.message : String(e))
        }
        const current = api
        const done = new Promise<{ ok: boolean; error: string | null }>((resolve) => {
            current.renderFinished.on(() => resolve({ ok: true, error: null }))
            current.error.on((e: Error) => resolve(fail(messageOf(e, parsed.texLine))))
        })
        if (options.player !== false && assets.soundFont instanceof Uint8Array) {
            current.loadSoundFont(assets.soundFont, false)
        }
        if (parsed.file) {
            const bytes = options.resolveFile ? await options.resolveFile(parsed.file) : null
            if (!bytes) return fail(`Couldn't find the file "${parsed.file}"`)
            current.load(
                bytes,
                parsed.tracks?.map((t) => t - 1)
            )
        } else {
            current.tex(parsed.tex)
        }
        const result = await done
        if (result.ok && options.player !== false) {
            el.appendChild(playerBar(doc, current))
            // Touch screens have no hover: a tap on the score shows the bar.
            el.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'touch') el.classList.toggle('mn-play-open')
            })
        }
        return result
    })()
    return {
        el,
        ready,
        get api() {
            return api
        },
        destroy() {
            try {
                api?.destroy()
            } catch {
                // Already gone.
            }
            el.remove()
        }
    }
}

/** General MIDI programs for the diagrams' sounds. */
const PROGRAMS: Record<Sound, number> = { guitar: 25, piano: 0 }

/**
 * Diagram playback through alphaTab's synthesizer and soundfont (realistic sound): a NotePlayer
 * for the `play` render option. `api` is any alphaTab API whose soundfont is loaded.
 */
export function soundfontPlayer(
    alphaTab: AlphaTabModule,
    api: () => AT.AlphaTabApi | null
): NotePlayer {
    return {
        play(events: NoteEvent[], { sound, volume, onEnd }) {
            const current = api()
            const player = current?.player
            if (!current || !player) return { stop() {} }
            const midi = new alphaTab.midi.MidiFile()
            const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)
            // At 60 beats a minute, a quarter note (division ticks) lasts a second.
            const ticks = (seconds: number) => Math.round(seconds * midi.division)
            handler.addTempo(0, 60)
            handler.addProgramChange(0, 0, 0, PROGRAMS[sound])
            const velocity = Math.round(40 + 87 * Math.min(1, Math.max(0, volume)))
            for (const e of events) {
                handler.addNote(
                    0,
                    ticks(e.time),
                    Math.max(1, ticks(e.duration)),
                    e.midi,
                    velocity,
                    0
                )
            }
            const end = Math.max(...events.map((e) => e.time + e.duration), 0)
            player.playOneTimeMidiFile(midi)
            const timer = setTimeout(() => onEnd?.(), (end + 0.2) * 1000)
            return {
                stop() {
                    clearTimeout(timer)
                    player.stop()
                }
            }
        }
    }
}

/**
 * A soundfont player that makes its own hidden alphaTab instance on the first play (for pages
 * and notes without a tab block). The first notes wait for the soundfont.
 */
export function createSoundfontPlayer(
    alphaTab: AlphaTabModule,
    assets: TabAssets,
    doc: Document
): NotePlayer {
    let api: AT.AlphaTabApi | null = null
    let ready: Promise<void> | null = null
    const start = () => {
        if (ready) return ready
        const host = html(doc, 'div', 'mn-tab-hidden')
        host.setAttribute('aria-hidden', 'true')
        doc.body.appendChild(host)
        api = new alphaTab.AlphaTabApi(host, {
            core: {
                useWorkers: Boolean(assets.scriptFile),
                ...(assets.scriptFile ? { scriptFile: assets.scriptFile } : {}),
                smuflFontSources: new Map([[alphaTab.FontFileFormat.Woff2, assets.font]])
            },
            player: {
                playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
                ...(typeof assets.soundFont === 'string' ? { soundFont: assets.soundFont } : {})
            }
        })
        const current = api
        ready = new Promise<void>((resolve) => {
            current.soundFontLoaded.on(() => resolve())
            current.error.on(() => resolve())
        })
        if (assets.soundFont instanceof Uint8Array) current.loadSoundFont(assets.soundFont, false)
        // The player needs a song loaded to be ready: one rest.
        current.tex('r')
        return ready
    }
    const inner = soundfontPlayer(alphaTab, () => api)
    return {
        play(events, options) {
            let handle: { stop(): void } | null = null
            let stopped = false
            void start().then(() => {
                if (!stopped) handle = inner.play(events, options)
            })
            return {
                stop() {
                    stopped = true
                    handle?.stop()
                }
            }
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
