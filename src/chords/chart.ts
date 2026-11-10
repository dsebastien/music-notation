/** ChordPro songs rendered as HTML charts: chords above the lyrics, transposable. */
import { shown } from '../theory/naming.js'
import { html } from '../render/dom.js'
import { keyMove, keyPrefersFlats, transposeChord, transposeKey } from '../theory/transpose.js'
import type { Segment, Song } from './chordpro.js'
import type { Hand, LayoutDefaults } from '../render/layout.js'
import type { VoicingLookup } from '../voicings/index.js'
import { findKey } from '../theory/find.js'
import { parseChord } from '../theory/chord-symbol.js'
import { chordNoteSet } from '../theory/note-set.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import { soundingChord } from '../chord/capo.js'
import { progressionPitches } from '../playback/progression.js'
import { isCompound, parseTime } from '../strum/pattern.js'
import { findDefinition } from './defines.js'
import {
    chordDiagram,
    chordsUsed,
    missingMessage,
    renderChordsUsed,
    type ChartInstrument,
    type ChordDrawing
} from './chart-diagrams.js'

export interface ChartOptions {
    /** Semitones added to the song's own `{transpose}`. */
    transpose?: number
    /**
     * The chords used row, when the song has no `{diagrams}`: `'top'`, `'bottom'` or `'off'`
     * (the default).
     */
    diagrams?: 'top' | 'bottom' | 'off'
    /** Guitar (default) or piano diagrams, when the song has no `{instrument}`. */
    instrument?: ChartInstrument
    /** Guitar voicings for chords the song doesn't define (see `/voicings`). */
    voicings?: VoicingLookup
    /** Diagram orientation: `chord` for guitar, `keyboard` for piano. */
    orientation?: LayoutDefaults['orientation']
    /** Left-handed guitar diagrams. */
    hand?: Hand
}

const PLACEMENTS = new Set(['top', 'bottom', 'off'])

/** A step of a measured line (#75): a chord and its beats, a held bar, or a bar of silence. */
export type LineStep =
    { segment: number; beats: number } | { hold: number } | { rest: number; segment: number }

/**
 * How long each chord of a lyrics line lasts (#75), in beats as written, or nothing: a line
 * without a bar line `|` plays each chord a bar. On a line with bar lines, the chords between two
 * share the bar: by its beat marks when they add up to the bar's counted beats (a `.` after a chord
 * is one of its beats, `[C]. . . [G].`; a `/` one beat more, `[C] / / [G]`), else evenly (in
 * counted beats when they go round, else in written beats), and
 * a bar with no chord holds the chord before it. A bar whose only chord doesn't play (N.C.) is a
 * bar of silence (a `rest` step, its N.C. segment); in a bar with chords that play, N.C. takes no
 * time. Linear in the line's length. `steps` lists, in order, each chord's beats, each held bar
 * and each silent bar.
 */
export function lineBeats(
    segments: readonly Segment[],
    playable: (chord: string) => boolean,
    beatsPerBar: number,
    perPulse: number
): { measured: boolean; steps: LineStep[] } {
    if (!segments.some((s) => s.text.includes('|'))) return { measured: false, steps: [] }
    const steps: LineStep[] = []
    const counted = Math.max(1, Math.round(beatsPerBar / perPulse))
    let bar: { segment: number; slashes: number; dots: number }[] = []
    // A bar with a chord that doesn't play (N.C.): its segment; with no other chord, a silent bar.
    let silent: number | null = null
    let opened = false
    const close = (ended: boolean) => {
        if (bar.length) {
            const n = bar.length
            const slashed = bar.reduce((sum, c) => sum + 1 + c.slashes, 0)
            const dotted = bar.reduce((sum, c) => sum + c.dots, 0)
            let lengths: number[]
            if (bar.every((c) => c.dots) && dotted === counted)
                lengths = bar.map((c) => c.dots * perPulse)
            else if (bar.some((c) => c.slashes) && slashed === counted)
                lengths = bar.map((c) => (1 + c.slashes) * perPulse)
            else {
                const [whole, unit] = n <= counted ? [counted, perPulse] : [beatsPerBar, 1]
                const base = Math.floor(whole / n)
                const extra = whole % n
                lengths = bar.map((_, i) => Math.max(1, (base + (i < extra ? 1 : 0)) * unit))
            }
            bar.forEach((c, i) => steps.push({ segment: c.segment, beats: lengths[i]! }))
        } else if (silent !== null) steps.push({ rest: beatsPerBar, segment: silent })
        else if (ended && opened) steps.push({ hold: beatsPerBar })
        bar = []
        silent = null
        opened = ended || opened
    }
    segments.forEach((segment, i) => {
        if (segment.chord !== null) {
            if (playable(segment.chord)) bar.push({ segment: i, slashes: 0, dots: 0 })
            else silent ??= i
        }
        for (const ch of segment.text) {
            if (ch === '|') close(true)
            else if (ch === '/' && bar.length) bar[bar.length - 1]!.slashes++
            else if (ch === '.' && bar.length) bar[bar.length - 1]!.dots++
        }
    })
    if (bar.length || silent !== null) close(false)
    return { measured: true, steps }
}

/** A song's `{time}` as beats/unit ("3/4"); null when it doesn't read. */
function timeOf(text: string | null): string | null {
    if (!text) return null
    try {
        const { beatsPerBar, beatUnit } = parseTime(text)
        return `${beatsPerBar}/${beatUnit}`
    } catch {
        return null
    }
}

const SECTION_LABELS: Record<string, string> = {
    chorus: 'Chorus',
    bridge: 'Bridge',
    tab: 'Tab',
    grid: 'Grid'
}

/** The key a song's chords are likeliest in ("C", "Am"); null when none reads. */
function guessedKey(song: Song): string | null {
    const chords = chordsUsed(song).filter((c) => parseChord(c) && chordNoteSet(c))
    const found = chords.length ? findKey(chords) : null
    return found ? `${found.tonic}${found.mode === 'minor' ? 'm' : ''}` : null
}

/** How a song's chords are shown: its total transposition, key, and each chord as transposed. */
function transposerOf(song: Song, extra: number | undefined) {
    const semitones = song.transpose + (Number.isFinite(extra) ? Math.round(extra!) : 0)
    const key = song.key ? transposeKey(song.key, semitones) : null
    const flats = key ? keyPrefersFlats(key) : undefined
    // Chords move by the interval between the keys (letters kept: G → F#, C → B). Without a
    // {key}, the key the chords are likeliest in, so every chord moves the same way (C F G7 Bb up
    // 1: Db Gb Ab7 Cb, not C# F# G#7 B).
    const from = song.key ?? (semitones % 12 ? guessedKey(song) : null)
    const move = from ? keyMove(from, semitones) : null
    const spelling = move ?? flats
    return {
        semitones,
        key,
        spelling,
        chord: (symbol: string) => transposeChord(symbol, semitones, spelling)
    }
}

/** A song's time signature as beats a bar and beat unit (4/4 when none reads). */
function meterOf(song: Song): { beatsPerBar: number; beatUnit: number; perPulse: number } {
    let beatsPerBar = 4
    let beatUnit = 4
    const time = timeOf(song.time)
    if (time) ({ beatsPerBar, beatUnit } = parseTime(time))
    return { beatsPerBar, beatUnit, perPulse: isCompound(beatsPerBar, beatUnit) ? 3 : 1 }
}

/** What a chart plays in time (#75): its chords as shown, a chord's beats when not a bar. */
export interface ChartChords {
    /**
     * Each chord above the lyrics, in order, with its beats as written when they aren't a bar; a
     * bar of N.C. on a line with bar lines is a bar of silence: `{ chord: null, pitches: [], beats }`.
     */
    chords: { chord: string | null; beats?: number; pitches?: number[] }[]
    beatsPerBar: number
    beatUnit: number
    /** The song's `{tempo}` (20 to 240), else null. */
    tempo: number | null
}

/**
 * The chords a chart plays in time, as its play bar plays them (#75): transposed like the chart
 * (`transpose` adds to the song's own), a bar each, or as its bar lines say. A chord that doesn't
 * read (N.C.) is left out; `{define}` names play. Pass `chords` and the meter to
 * `playProgression`.
 */
export function chartChords(song: Song, options: { transpose?: number } = {}): ChartChords {
    const { chord } = transposerOf(song, options.transpose)
    const { beatsPerBar, beatUnit, perPulse } = meterOf(song)
    const playable = (written: string) => {
        const shown = chord(written)
        return Boolean(
            findDefinition(song.definitions, written)?.diagram ||
            (parseChord(shown) && chordNoteSet(shown))
        )
    }
    const chords: ChartChords['chords'] = []
    const hold = (beats: number) => {
        const last = chords[chords.length - 1]
        if (last) last.beats = (last.beats ?? beatsPerBar) + beats
    }
    for (const section of song.sections)
        for (const line of section.lines) {
            if (line.kind !== 'lyrics') continue
            const { measured, steps } = lineBeats(line.segments, playable, beatsPerBar, perPulse)
            if (!measured) {
                for (const s of line.segments)
                    if (s.chord !== null && playable(s.chord))
                        chords.push({ chord: chord(s.chord) })
                continue
            }
            for (const step of steps) {
                if ('hold' in step) hold(step.hold)
                else if ('rest' in step) chords.push({ chord: null, pitches: [], beats: step.rest })
                else
                    chords.push({
                        chord: chord(line.segments[step.segment]!.chord!),
                        beats: step.beats
                    })
            }
        }
    const tempo = Number(song.tempo)
    return {
        chords,
        beatsPerBar,
        beatUnit,
        tempo: song.tempo && Number.isFinite(tempo) && tempo >= 20 && tempo <= 240 ? tempo : null
    }
}

export function renderChart(doc: Document, song: Song, options: ChartOptions = {}): HTMLElement {
    const { semitones, key, spelling, chord } = transposerOf(song, options.transpose)
    const meter = meterOf(song)
    const drawing: ChordDrawing = {
        instrument: song.instrument ?? (options.instrument === 'piano' ? 'piano' : 'guitar'),
        ...(options.voicings ? { voicings: options.voicings } : {}),
        ...(options.orientation ? { orientation: options.orientation } : {}),
        ...(options.hand ? { hand: options.hand } : {})
    }
    const placement =
        song.diagrams ?? (PLACEMENTS.has(options.diagrams as string) ? options.diagrams! : 'off')
    // The chart's line says "Capo N": a row right under it doesn't say it again; a row at the
    // bottom, far from that line, does.
    const used = (capoCaption: boolean) =>
        renderChordsUsed(doc, song, {
            ...drawing,
            semitones,
            capoCaption,
            ...(spelling === undefined ? {} : { spelling })
        })

    const root = html(doc, 'div', 'mn-chart')
    // Played in time from its bar (#46): each chord above the lyrics a bar, in order.
    root.setAttribute('data-mn-progression-play', '')
    root.setAttribute('data-mn-sound', drawing.instrument === 'piano' ? 'piano' : 'guitar')
    const time = timeOf(song.time)
    if (time) root.setAttribute('data-mn-time', time)
    const tempo = Number(song.tempo)
    if (song.tempo && Number.isFinite(tempo) && tempo >= 20 && tempo <= 240)
        root.setAttribute('data-mn-tempo', String(Math.round(tempo)))
    let bars = 0
    // The last chord played, to hold through a bar with no chord (#75).
    let last: { mark: Element; beats: number | null } | null = null
    const setBeats = (mark: Element, beats: number) => {
        mark.setAttribute('data-mn-beats', String(beats))
        last = { mark, beats }
    }
    const sounds = new Map<string, string | null>()
    // What a chord sounds: its diagram's notes (the song's shape, the capo), else the strum's.
    const soundOf = (written: string, shown: string): string | null => {
        const known = sounds.get(shown)
        if (known !== undefined) return known
        let pitches: string | null
        try {
            pitches =
                chordDiagram(doc, shown, findDefinition(song.definitions, written), semitones, {
                    ...drawing,
                    ...(song.capo ? { capo: song.capo } : {})
                })?.getAttribute('data-mn-pitches') ?? null
        } catch {
            pitches = null
        }
        if (!pitches && parseChord(shown) && chordNoteSet(shown)) {
            try {
                const sounding = song.capo ? soundingChord(shown, song.capo) : shown
                pitches = progressionPitches(
                    sounding,
                    drawing.instrument,
                    STANDARD_TUNING,
                    options.voicings
                ).join(' ')
            } catch {
                pitches = null
            }
        }
        sounds.set(shown, pitches || null)
        return pitches || null
    }
    if (song.title || song.subtitle || song.artist) {
        const header = html(doc, 'div', 'mn-chart-header')
        if (song.title) header.appendChild(html(doc, 'div', 'mn-chart-title', song.title))
        const by = [song.subtitle, song.artist].filter(Boolean).join(' · ')
        if (by) header.appendChild(html(doc, 'div', 'mn-chart-subtitle', by))
        root.appendChild(header)
    }
    const meta = [
        key ? shown(`Key ${key}`) : null,
        song.capo ? `Capo ${song.capo}` : null,
        song.tempo ? `${song.tempo} BPM` : null,
        song.time ? song.time : null,
        semitones % 12 ? `Transposed ${semitones > 0 ? '+' : ''}${semitones}` : null
    ].filter((m): m is string => m !== null)
    if (meta.length) root.appendChild(html(doc, 'div', 'mn-chart-meta', meta.join(' · ')))
    // Directives the chart couldn't read: what to write instead, and the rest still draws.
    for (const warning of song.warnings) {
        root.appendChild(html(doc, 'div', 'mn-error-message', warning))
    }
    if (placement === 'top') {
        const row = used(false)
        if (row) root.appendChild(row)
    }

    for (const section of song.sections) {
        const el = html(doc, 'div', `mn-section mn-section-${section.kind}`)
        const label = section.label ?? SECTION_LABELS[section.kind]
        if (label) el.appendChild(html(doc, 'div', 'mn-section-label', label))
        for (const line of section.lines) {
            if (line.kind === 'empty') el.appendChild(html(doc, 'div', 'mn-line mn-line-empty'))
            else if (line.kind === 'comment')
                el.appendChild(html(doc, 'div', 'mn-line mn-comment', line.text))
            else if (line.kind === 'text')
                el.appendChild(html(doc, 'pre', 'mn-line mn-pre', line.text))
            else if (line.kind === 'chord') {
                // In place: transposed only when written in brackets ({chord: [Am]}), as ChordPro does.
                const { definition } = line
                if (!definition.diagram) continue
                const moved = definition.transposable ? semitones : 0
                const shown = transposeChord(definition.name, moved, spelling)
                const inline = html(doc, 'div', 'mn-line mn-chart-chord')
                let diagram: SVGElement | null
                try {
                    // Under a capo, played and drawn like the chords used row.
                    diagram = chordDiagram(doc, shown, definition, moved, {
                        ...drawing,
                        ...(song.capo ? { capo: song.capo } : {})
                    })
                } catch {
                    diagram = null
                }
                inline.appendChild(
                    diagram ??
                        html(
                            doc,
                            'div',
                            'mn-error-message',
                            missingMessage([shown], drawing.instrument)
                        )
                )
                el.appendChild(inline)
            } else {
                const row = html(doc, 'div', 'mn-line')
                const chordsOnly = line.segments.every((s) => !s.text.trim())
                if (chordsOnly) row.classList.add('mn-chords-only')
                // Bar lines say how long each chord lasts (#75); else a chord a bar.
                const timing = lineBeats(
                    line.segments,
                    (written) => soundOf(written, chord(written)) !== null,
                    meter.beatsPerBar,
                    meter.perPulse
                )
                const marks = new Map<number, Element>()
                // A bar of N.C. on a measured line is a bar of silence: its mark is a bar too.
                const rests = new Map<number, number>()
                for (const step of timing.steps)
                    if ('rest' in step) rests.set(step.segment, step.rest)
                line.segments.forEach((segment, index) => {
                    const seg = html(doc, 'span', 'mn-seg')
                    const mark = html(
                        doc,
                        'span',
                        'mn-chord',
                        segment.chord === null ? '' : shown(chord(segment.chord))
                    )
                    if (segment.chord !== null) {
                        const shown = chord(segment.chord)
                        const voicing = soundOf(segment.chord, shown)
                        if (voicing) {
                            mark.setAttribute('data-mn-bar', String(bars++))
                            mark.setAttribute('data-mn-chord', shown)
                            mark.setAttribute('data-mn-voicing', voicing)
                            marks.set(index, mark)
                            if (!timing.measured) last = { mark, beats: null }
                        } else if (rests.has(index)) {
                            mark.setAttribute('data-mn-bar', String(bars++))
                            mark.setAttribute('data-mn-rest', '')
                            marks.set(index, mark)
                        }
                    }
                    seg.appendChild(mark)
                    seg.appendChild(
                        html(doc, 'span', 'mn-lyric', segment.text || (chordsOnly ? '' : ' '))
                    )
                    row.appendChild(seg)
                })
                for (const step of timing.steps) {
                    const held = last as { mark: Element; beats: number | null } | null
                    if ('hold' in step) {
                        if (held) setBeats(held.mark, (held.beats ?? meter.beatsPerBar) + step.hold)
                    } else if ('rest' in step) {
                        const mark = marks.get(step.segment)
                        if (mark) setBeats(mark, step.rest)
                    } else {
                        const mark = marks.get(step.segment)
                        if (mark) setBeats(mark, step.beats)
                    }
                }
                el.appendChild(row)
            }
        }
        root.appendChild(el)
    }
    if (placement === 'bottom') {
        const row = used(true)
        if (row) root.appendChild(row)
    }
    return root
}
