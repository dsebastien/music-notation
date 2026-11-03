/**
 * A ChordPro subset: metadata directives, sections (verse, chorus, bridge, tab, grid), comments,
 * `[C]` chords inside lyrics, `{transpose: n}`, chord definitions (`{define}`, `{chord}`) and the
 * chords used row (`{diagrams}`). Unknown directives are ignored.
 */
import { findDefinition, parseDefinition, type ChordDefinition } from './defines.js'

export type { ChordDefinition } from './defines.js'

export interface Segment {
    chord: string | null
    text: string
}

export type Line =
    | { kind: 'lyrics'; segments: Segment[] }
    | { kind: 'comment'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'empty' }
    /** `{chord: …}`: a chord diagram drawn in place. */
    | { kind: 'chord'; definition: ChordDefinition }

export interface Section {
    kind: 'verse' | 'chorus' | 'bridge' | 'tab' | 'grid' | 'none'
    label: string | null
    lines: Line[]
}

export interface Song {
    title: string | null
    subtitle: string | null
    artist: string | null
    key: string | null
    capo: number | null
    tempo: string | null
    time: string | null
    transpose: number
    sections: Section[]
    /** `{define: …}` shapes, in order (a later one of the same name wins). */
    definitions: ChordDefinition[]
    /** `{diagrams}`: where the chords used row goes; null when the song doesn't say. */
    diagrams: 'top' | 'bottom' | 'off' | null
    /** `{instrument: piano}` (not part of ChordPro): which diagrams the chart draws. */
    instrument: 'guitar' | 'piano' | null
    /** Directives the chart couldn't read, each with what to write instead. */
    warnings: string[]
}

const ALIASES: Record<string, string> = {
    t: 'title',
    st: 'subtitle',
    c: 'comment',
    ci: 'comment',
    comment_italic: 'comment',
    cb: 'comment',
    comment_box: 'comment',
    highlight: 'comment',
    soc: 'start_of_chorus',
    eoc: 'end_of_chorus',
    sov: 'start_of_verse',
    eov: 'end_of_verse',
    sob: 'start_of_bridge',
    eob: 'end_of_bridge',
    sot: 'start_of_tab',
    eot: 'end_of_tab',
    sog: 'start_of_grid',
    eog: 'end_of_grid'
}

/** `{diagrams}` values: on (or no value) puts the row on top, where songbooks show it. */
const DIAGRAMS = new Map<string, NonNullable<Song['diagrams']>>([
    ['', 'top'],
    ['on', 'top'],
    ['top', 'top'],
    ['right', 'top'],
    ['bottom', 'bottom'],
    ['below', 'bottom'],
    ['off', 'off']
])

const INSTRUMENTS = new Map<string, NonNullable<Song['instrument']>>([
    ['guitar', 'guitar'],
    ['piano', 'piano'],
    ['keyboard', 'piano']
])

const SECTION_KINDS = new Set(['verse', 'chorus', 'bridge', 'tab', 'grid'])

/** Split "[C]Hello [G]world" into chord/text segments. */
export function parseLyrics(line: string): Segment[] {
    const segments: Segment[] = []
    const re = /\[([^\]]*)\]/g
    let last = 0
    let chord: string | null = null
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
        const text = line.slice(last, m.index)
        if (text || chord !== null) segments.push({ chord, text })
        chord = m[1]!.trim()
        last = m.index + m[0].length
    }
    const rest = line.slice(last)
    if (rest || chord !== null) segments.push({ chord, text: rest })
    return segments
}

/**
 * "{title: Song}", "{soc}", "{start_of_verse Verse 2}" → name and value; null when the line isn't
 * a directive. No backtracking regex: one malformed line must never freeze the page.
 */
function parseDirective(line: string): { name: string; value: string } | null {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null
    const inner = trimmed.slice(1, -1).trim()
    const m = /^[\w-]+/.exec(inner)
    if (!m) return null
    const rest = inner.slice(m[0].length)
    if (rest && !/^[\s:]/.test(rest)) return null
    return { name: m[0].toLowerCase(), value: rest.replace(/^\s*:?/, '').trim() }
}

export function parseChordPro(source: string): Song {
    const song: Song = {
        title: null,
        subtitle: null,
        artist: null,
        key: null,
        capo: null,
        tempo: null,
        time: null,
        transpose: 0,
        sections: [],
        definitions: [],
        diagrams: null,
        instrument: null,
        warnings: []
    }
    let section: Section = { kind: 'none', label: null, lines: [] }
    const open = (kind: Section['kind'], label: string | null) => {
        if (section.lines.length || section.kind !== 'none') song.sections.push(section)
        section = { kind, label, lines: [] }
    }

    for (const raw of source.split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '')
        if (/^\s*#/.test(line)) continue
        const directive = parseDirective(line)
        if (directive) {
            const { name, value } = directive
            const key = ALIASES[name] ?? name
            const start = /^start_of_(\w+)$/.exec(key)
            const end = /^end_of_(\w+)$/.exec(key)
            if (start) {
                const kind = SECTION_KINDS.has(start[1]!) ? (start[1] as Section['kind']) : 'verse'
                open(kind, value.replace(/^label\s*=\s*"?|"$/g, '') || null)
            } else if (end) {
                open('none', null)
            } else if (key === 'comment') {
                section.lines.push({ kind: 'comment', text: value })
            } else if (
                key === 'title' ||
                key === 'subtitle' ||
                key === 'artist' ||
                key === 'key' ||
                key === 'tempo' ||
                key === 'time'
            ) {
                song[key] = value || null
            } else if (key === 'capo') {
                const capo = Number(value)
                song.capo = Number.isInteger(capo) && capo > 0 ? capo : null
            } else if (key === 'transpose') {
                const semitones = Number(value)
                if (Number.isInteger(semitones)) song.transpose = semitones
            } else if (key === 'define' || key === 'chord') {
                const { definition, problems } = parseDefinition(value, song.definitions, key)
                song.warnings.push(...problems)
                if (definition && key === 'define') song.definitions.push(definition)
                else if (definition) {
                    // A known chord by name: the song's own shape for it, when it has one.
                    const known =
                        !definition.frets && !definition.keys && !definition.copy
                            ? findDefinition(song.definitions, definition.name)
                            : undefined
                    section.lines.push({
                        kind: 'chord',
                        definition: known
                            ? {
                                  ...known,
                                  name: definition.name,
                                  transposable: definition.transposable,
                                  display: definition.display ?? known.display,
                                  diagram: definition.diagram && known.diagram
                              }
                            : definition
                    })
                }
            } else if (key === 'diagrams') {
                const placement = DIAGRAMS.get(value.toLowerCase())
                if (placement) song.diagrams = placement
                else song.warnings.push(`{diagrams: ${value}}: use on, off, top or bottom`)
            } else if (key === 'instrument') {
                const instrument = INSTRUMENTS.get(value.toLowerCase())
                if (instrument) song.instrument = instrument
                else song.warnings.push(`{instrument: ${value}}: use guitar or piano`)
            }
            continue
        }
        if (!line.trim()) section.lines.push({ kind: 'empty' })
        else if (section.kind === 'tab' || section.kind === 'grid')
            section.lines.push({ kind: 'text', text: line })
        else section.lines.push({ kind: 'lyrics', segments: parseLyrics(line) })
    }
    open('none', null)
    // Leading and trailing blank lines carry no meaning.
    for (const s of song.sections) {
        while (s.lines[0]?.kind === 'empty') s.lines.shift()
        while (s.lines[s.lines.length - 1]?.kind === 'empty') s.lines.pop()
    }
    song.sections = song.sections.filter((s) => s.lines.length || s.label)
    return song
}
