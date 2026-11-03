/**
 * Blocks from a note's properties: an empty ```chord block in a chord note, ```fretboard /
 * ```keyboard in a scale or arpeggio note (and ```fretboard in a guitar chord note: its
 * arpeggio), or ```strum in a strumming pattern note, draws what the note's frontmatter says, so
 * the body repeats nothing. Used by Music Practice in Obsidian and by the Publish bundle with the
 * page's properties. The arpeggio and strum rules are Music Practice's own (#56, #58): a note
 * draws the same in Obsidian and on Obsidian Publish.
 */
import { readChord } from '../theory/chord-name.js'

/** Property names, as Music Practice and the Obsidian Starter Kit write them by default. */
export interface PropertyNames {
    chordSymbol: string
    frets: string
    fingers: string
    /** First fret shown (guitar); 0 or empty means computed. */
    position: string
    pitches: string
    fingering: string
    scaleRoot: string
    scaleType: string
    /** Chord or scale shape ("Open", "Box 2", "CAGED E", "3NPS"). */
    shape: string
    fingeringRight: string
    tags: string
    /** Strumming patterns: the pattern ("D DU UDU", or one bar per list item). */
    strumPattern: string
    /** Strumming patterns: the time signature ("3/4", "6/8"). */
    timeSignature: string
    /** Strumming patterns: the feel ("straight", "swing", "60%"). */
    strumFeel: string
    /** The current BPM: a strumming pattern's tempo (20 to 240). */
    bpmCurrent: string
}

export const DEFAULT_PROPERTY_NAMES: PropertyNames = {
    chordSymbol: 'chord_symbol',
    frets: 'frets',
    fingers: 'fingers',
    position: 'position',
    pitches: 'pitches',
    fingering: 'fingering',
    scaleRoot: 'scale_root',
    scaleType: 'scale_type',
    shape: 'shape',
    fingeringRight: 'fingering_rh',
    tags: 'tags',
    strumPattern: 'strum_pattern',
    timeSignature: 'time_signature',
    strumFeel: 'strum_feel',
    bpmCurrent: 'bpm_current'
}

export type Instrument = 'guitar' | 'piano'

type Properties = Record<string, unknown>

/** A property as one line of text: lists joined, line breaks removed (a value is never two keys). */
function text(properties: Properties, name: string): string | undefined {
    const value = properties[name]
    const out = Array.isArray(value)
        ? value.filter((v) => v !== null && v !== undefined).join(' ')
        : typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : undefined
    const line = out?.replace(/[\r\n]+/g, ' ').trim()
    return line ? line : undefined
}

/** A note's tags as a list: a list, or a string split on spaces and commas. */
function tagsOf(properties: Properties, names: PropertyNames): unknown[] {
    const tags = properties[names.tags]
    return Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[\s,]+/) : []
}

/**
 * The kind of a music note, from its type tag as Music Practice reads it: the last segment of
 * `type/music/<subject>/<kind>` (or `type/music/<kind>`), lowercased: `arpeggio`, `chord`,
 * `strum`. Null without such a tag.
 */
export function kindOf(properties: Properties, names: PropertyNames): string | null {
    for (const tag of tagsOf(properties, names)) {
        if (typeof tag !== 'string') continue
        const m = /^type\/music\/(?:[^/\s]+\/)?([^/\s]+)$/i.exec(tag.trim().replace(/^#/, ''))
        if (m) return m[1]!.toLowerCase()
    }
    return null
}

/** Piano when a tag has a `piano` segment (`type/music/piano/chord`), else guitar. */
export function instrumentOf(properties: Properties, names: PropertyNames): Instrument {
    return tagsOf(properties, names).some(
        (t) => typeof t === 'string' && /(^|\/)piano(\/|$)/i.test(t.replace(/^#/, ''))
    )
        ? 'piano'
        : 'guitar'
}

/** "Box 2" → position 2, "CAGED E" → shape E, "3NPS" → 3nps; chord shapes ("Open") say nothing. */
function scaleShape(shape: string | undefined): string[] {
    if (!shape) return []
    const box = /^(?:box|position)\s*(\d+)$/i.exec(shape)
    if (box) return [`position: ${box[1]}`]
    const caged = /^(?:caged\s*)?([CAGED])(?:\s*shape)?$/i.exec(shape)
    if (caged) return [`shape: ${caged[1]!.toUpperCase()}`]
    const nps = /^3\s*nps(?:\s*(\d+))?$/i.exec(shape)
    if (nps) return ['shape: 3nps', ...(nps[1] ? [`position: ${nps[1]}`] : [])]
    return []
}

/** A property as one line of text, Music Practice's way: a string, a number, or a list's first value. */
function first(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (Array.isArray(value)) return first(value[0])
    return ''
}

/** The CAGED letter of a shape value: "E", "CAGED E", "E shape", "E-shape barre" → "E". */
function cagedShape(value: unknown): string | null {
    const m = /^(?:caged\s+)?([cagedCAGED])(?:\s*-?\s*shape\b.*)?$/i.exec(first(value))
    return m ? m[1]!.toUpperCase() : null
}

/** The note's chord as the library reads it ("A Minor 7" → "Am7"); null when it doesn't. */
function chordOf(properties: Properties, names: PropertyNames): string | null {
    const value = first(properties[names.chordSymbol])
    return value ? (readChord(value)?.symbol ?? null) : null
}

/**
 * An arpeggio note's block, or a guitar chord note's empty fretboard: `arpeggio: <chord>`, with
 * `shape: <CAGED letter>` on guitar when the note's shape is one. Arpeggio notes draw on a
 * ```fretboard (guitar) or a ```keyboard (piano). Null for other notes and blocks.
 */
function arpeggioSource(
    language: string,
    properties: Properties,
    names: PropertyNames,
    instrument: Instrument
): string | null {
    const kind = kindOf(properties, names)
    const guitar = instrument !== 'piano'
    const fits =
        (kind === 'arpeggio' && language === (guitar ? 'fretboard' : 'keyboard')) ||
        (kind === 'chord' && guitar && language === 'fretboard')
    if (!fits) return null
    const chord = chordOf(properties, names)
    if (!chord) return null
    const shape = guitar ? cagedShape(properties[names.shape]) : null
    return [`arpeggio: ${chord}`, ...(shape ? [`shape: ${shape}`] : [])].join('\n')
}

/** `swing:` for a feel: "swing" or "shuffle" swings, "60%" sets the ratio, others are straight. */
function swingOf(feel: unknown): string | null {
    const value = first(feel).toLowerCase()
    if (/^(swing|swung|shuffle)/.test(value)) return 'yes'
    const percent = /^(\d{2})\s*%$/.exec(value)
    return percent ? `${percent[1]}%` : null
}

/** A time signature the strum block reads: "6/8", "3/4", "C", "cut". */
const TIME = /^(\d{1,2}\/\d{1,2}|c|cut)$/i

/**
 * A strumming pattern note's ```strum block: its pattern (one bar per line when it's a list), then
 * its time signature, feel (swing), chord and current BPM as the tempo (20 to 240). Null without
 * a pattern.
 */
function strumSource(properties: Properties, names: PropertyNames): string | null {
    const raw = properties[names.strumPattern]
    const bars = (Array.isArray(raw) ? raw : [raw])
        .map((line) => first(line))
        .flatMap((line) => line.split(/\r?\n/))
        .map((line) => line.trim())
        .filter(Boolean)
    if (!bars.length) return null
    const time = first(properties[names.timeSignature])
    const swing = swingOf(properties[names.strumFeel])
    const chord = chordOf(properties, names)
    const bpm = Number(first(properties[names.bpmCurrent]))
    return [
        ...bars,
        ...(TIME.test(time) ? [`time: ${time}`] : []),
        ...(swing ? [`swing: ${swing}`] : []),
        ...(chord ? [`chord: ${chord}`] : []),
        ...(Number.isInteger(bpm) && bpm >= 20 && bpm <= 240 ? [`tempo: ${bpm}`] : [])
    ].join('\n')
}

/**
 * The source of a block drawn from a note's properties; null when they don't describe one (a chord
 * block in a scale note, a chord note with no chord yet).
 */
export function blockFromProperties(
    language: string,
    properties: Properties,
    options: { names?: Partial<PropertyNames>; instrument?: Instrument } = {}
): string | null {
    const names = { ...DEFAULT_PROPERTY_NAMES, ...options.names }
    const instrument = options.instrument ?? instrumentOf(properties, names)
    const get = (name: string) => text(properties, name)
    const lines: string[] = []
    if (language === 'strum') return strumSource(properties, names)
    if (language === 'chord') {
        const symbol = get(names.chordSymbol)
        if (symbol) lines.push(`symbol: ${symbol}`)
        if (instrument === 'piano') {
            const pitches = get(names.pitches)
            if (!symbol && !pitches) return null
            lines.push('instrument: piano')
            if (pitches) lines.push(`pitches: ${pitches}`)
            const fingering = get(names.fingering)
            if (fingering) lines.push(`fingering: ${fingering}`)
            return lines.join('\n')
        }
        // Unquoted in YAML, "022100" is the number 22100: put the leading zeros back (6 strings).
        const padded = (name: string, length: number) => {
            const value = properties[name]
            const plain = get(name)
            return typeof value === 'number' && plain && plain.length < length
                ? plain.padStart(length, '0')
                : plain
        }
        const frets = padded(names.frets, 6)
        if (!symbol && !frets) return null
        if (frets) lines.push(`frets: ${frets}`)
        const fingers = padded(names.fingers, frets?.length ?? 6)
        if (fingers && frets) lines.push(`fingers: ${fingers}`)
        const position = Number(get(names.position))
        if (frets && Number.isInteger(position) && position >= 1)
            lines.push(`position: ${position}`)
        return lines.join('\n')
    }
    if (language === 'fretboard' || language === 'keyboard') {
        // An arpeggio note, or a guitar chord note's fretboard: its chord's arpeggio.
        const arpeggio = arpeggioSource(language, properties, names, instrument)
        if (arpeggio) return arpeggio
        // "C#/Db" (a root with its other spelling): the first.
        const root = get(names.scaleRoot)?.split('/')[0]?.trim()
        const type = get(names.scaleType)
        if (!root || !type) return null
        lines.push(`scale: ${root} ${type}`)
        if (language === 'fretboard') lines.push(...scaleShape(get(names.shape)))
        else {
            const fingering = get(names.fingeringRight)
            if (fingering) lines.push(`fingering: ${fingering}`)
        }
        return lines.join('\n')
    }
    return null
}
