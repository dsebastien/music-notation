/** Render a notation block into a host element. Never throws: errors render inline. */
import {
    DIAGRAMS,
    RENDERERS,
    SHARED_KEYS,
    type DiagramLanguage,
    type NotationLanguage,
    type RenderOptions
} from '../blocks/renderers.js'
import {
    parseBlockSource,
    parseRange,
    parseStrings,
    splitParts,
    type BlockSource
} from '../blocks/block-source.js'
import { html } from './dom.js'
import { attachPlayback } from '../playback/controls.js'
import { layoutDefaults, parseHand, parseOrientation } from './layout.js'
import { blockFromProperties } from '../blocks/properties.js'
import { modesOf } from '../theory/scales.js'
import { chordNoteSet, scaleNoteSet } from '../theory/note-set.js'
import { CAGED_SHAPES, positionCount } from '../fretboard/positions.js'
import {
    fingerVoicing,
    generateVoicings,
    MAX_GENERATED_STRINGS,
    type GeneratedVoicing,
    type VoicingOptions
} from '../chord/generate.js'
import { parseFingers, parseFrets } from '../chord/guitar.js'
import { smoothProgression, transition } from '../chord/transitions.js'
import { inversionName, keyTriads, triadVoicings, type Triad } from '../chord/triads.js'
import { parseTuning } from '../fretboard/tuning.js'
import { readChord, suggestChords } from '../theory/chord-name.js'

export const LANGUAGES = Object.keys(RENDERERS) as NotationLanguage[]

export const isNotationLanguage = (language: string): language is NotationLanguage =>
    Object.prototype.hasOwnProperty.call(RENDERERS, language)

const isDiagramLanguage = (language: string): language is DiagramLanguage =>
    Object.prototype.hasOwnProperty.call(DIAGRAMS, language)

/** More diagrams than this in one block is an error, so a page stays quick to draw. */
export const MAX_DIAGRAMS = 32

export interface RenderResult {
    ok: boolean
    /** The block's container, appended to the host. */
    el: HTMLElement
    /** The message shown when ok is false (every failing diagram's, for a row). */
    error: string | null
    /** Removes what was rendered. */
    destroy(): void
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function renderBlock(
    language: NotationLanguage,
    source: string,
    host: HTMLElement,
    given: RenderOptions = {}
): RenderResult {
    const doc = host.ownerDocument
    const el = html(doc, 'div', `mn-block mn-block-${language}`)
    let error: string | null = null
    // Layout defaults come from apps and pages: keep only valid values ("Left" reads as left).
    const layout = layoutDefaults(given)
    const options: RenderOptions = {
        ...(given ?? {}),
        orientation: layout.orientation ?? {},
        hand: layout.hand ?? 'right'
    }
    let text = source
    // An empty block in a note draws from the note's properties, when they describe one.
    if (!text.trim() && isDiagramLanguage(language)) {
        const fromProperties = propertiesSource(language, options, host)
        if (fromProperties) {
            text = fromProperties
            el.classList.add('mn-from-properties')
        }
    }
    let parts: string[] | null = null
    try {
        parts = isDiagramLanguage(language)
            ? (splitParts(text) ??
              modeParts(language, text) ??
              positionParts(language, text) ??
              transitionParts(language, text) ??
              triadParts(language, text) ??
              voicingParts(language, text))
            : null
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    // An empty block (a template's placeholder, or only separators) draws nothing, not an error.
    if (!text.trim() || parts?.length === 0) {
        el.classList.add('mn-empty')
        host.appendChild(el)
        return { ok: true, el, error: null, destroy: () => el.remove() }
    }
    try {
        if (parts && isDiagramLanguage(language)) {
            error = renderRow(doc, language, parts, el, options)
        } else {
            el.appendChild(RENDERERS[language](doc, text, options))
        }
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    host.appendChild(el)
    // Hear the diagrams: a playback bar on each one that has notes to play.
    const stopPlayback = options.play
        ? attachPlayback(el, typeof options.play === 'object' ? options.play : {})
        : null
    return {
        ok: error === null,
        el,
        error,
        destroy: () => {
            stopPlayback?.()
            el.remove()
        }
    }
}

/** The block as an inline error that says what's wrong. */
function failed(el: HTMLElement, host: HTMLElement, language: string, error: string): RenderResult {
    el.replaceChildren()
    el.classList.add('mn-error')
    el.appendChild(html(el.ownerDocument, 'div', 'mn-error-message', `${language}: ${error}`))
    host.appendChild(el)
    return { ok: false, el, error, destroy: () => el.remove() }
}

/** Properties as given, or what a function of the block's element returns; null when it fails. */
export function resolveProperties(properties: unknown, el: Element): unknown {
    if (typeof properties !== 'function') return properties
    try {
        return (properties as (el: Element) => unknown)(el)
    } catch {
        return null
    }
}

/** An empty block's source from the note's properties (an object, or a function returning one). */
function propertiesSource(
    language: DiagramLanguage,
    options: RenderOptions,
    host: Element
): string | null {
    const properties = resolveProperties(options.properties, host)
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
    // Properties come from notes and pages: a value that throws when read draws nothing.
    try {
        return blockFromProperties(language, properties as Record<string, unknown>, {
            ...(options.propertyNames ? { names: options.propertyNames } : {}),
            ...(options.instrument ? { instrument: options.instrument } : {})
        })
    } catch {
        return null
    }
}

/**
 * `positions: all` (or `1 3 5`) on a fretboard with a scale: one diagram per position, in a row.
 * Boxes for 5-note scales, CAGED shapes for 7-note scales, or 3NPS with `shape: 3nps`. Null when
 * the block has no `positions:`.
 */
function positionParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'fretboard') return null
    let block: BlockSource
    try {
        block = parseBlockSource(source)
    } catch {
        return null
    }
    const value = block.fields.get('positions')?.trim()
    if (value === undefined) return null
    const scale = block.fields.get('scale') ?? block.head
    const set = scale ? scaleNoteSet(scale) : null
    if (!scale || !set) throw new Error('positions needs a scale: e.g. A minor pentatonic')
    const nps = block.fields.get('shape')?.trim().toLowerCase() === '3nps'
    const system = nps ? '3nps' : set.members.length === 5 ? 'box' : 'caged'
    const count = positionCount(set, system)
    const wanted =
        value.toLowerCase() === 'all'
            ? Array.from({ length: count }, (_, i) => i + 1)
            : value.split(/[\s,]+/).map(Number)
    const bad = wanted.find((n) => !Number.isInteger(n) || n < 1 || n > count)
    if (bad !== undefined) {
        throw new Error(`positions: use all, or numbers from 1 to ${count} for ${set.title}`)
    }
    // Shared keys (and columns) go in a shared part; the others repeat in every diagram.
    const shared = SHARED_KEYS.fretboard
    const others = [...block.fields].filter(
        ([key]) => !['positions', 'scale', 'shape', 'position', 'title'].includes(key)
    )
    const header = others
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const own = others
        .filter(([key]) => key !== 'columns' && !shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const diagrams = wanted.map((n) => {
        const at =
            system === 'caged'
                ? [
                      `shape: ${CAGED_SHAPES[n - 1]}`,
                      `title: ${set.title}, ${CAGED_SHAPES[n - 1]} shape`
                  ]
                : system === '3nps'
                  ? ['shape: 3nps', `position: ${n}`, `title: ${set.title}, 3nps ${n}`]
                  : [`position: ${n}`, `title: ${set.title}, box ${n}`]
        return [`scale: ${scale}`, ...at, ...own].join('\n')
    })
    return [...(header.length ? [header.join('\n')] : []), ...diagrams]
}

/** Keys that choose which voicings `voicings:` draws; they don't reach the diagrams. */
const VOICING_FILTERS = [
    'voicings',
    'area',
    'root-string',
    'strings',
    'inversion',
    'stretch',
    'open',
    'gaps'
]

const yes = (text: string | undefined, key: string): boolean | undefined => {
    if (text === undefined || text === '') return undefined
    const value = text.trim().toLowerCase()
    if (['yes', 'true', 'on'].includes(value)) return true
    if (['no', 'false', 'off'].includes(value)) return false
    throw new Error(`${key} must be yes or no, got "${text}"`)
}

/** The last voicing lists, so a block drawn again (scrolling, switching views) doesn't search again. */
const voicingCache = new Map<string, GeneratedVoicing[]>()

function cachedVoicings(symbol: string, options: VoicingOptions): GeneratedVoicing[] {
    const key = JSON.stringify([symbol, options])
    const hit = voicingCache.get(key)
    if (hit) return hit
    const list = generateVoicings(symbol, options)
    voicingCache.set(key, list)
    if (voicingCache.size > 32) voicingCache.delete(voicingCache.keys().next().value!)
    return list
}

/** Keys `voicings:` can't use: it finds the frets itself, and only for fretted instruments. */
const NOT_WITH_VOICINGS = [
    'frets',
    'fingers',
    'voicing',
    'position',
    'base',
    'pitches',
    'notes',
    'fingering'
]

/**
 * `voicings: all` (or a number) on a chord block: the chord's playable voicings, easiest first, in
 * a row (see generateVoicings). Filters: `area`, `root-string`, `strings`, `inversion`, `stretch`,
 * `open`, `gaps`. Null when the block has no `voicings:`.
 */
function voicingParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'chord') return null
    let block: BlockSource
    try {
        block = filled(parseBlockSource(source))
    } catch {
        return null
    }
    const value = block.fields.get('voicings')?.trim()
    if (value === undefined) return null
    const fields = block.fields
    if (fields.has('triads')) throw new Error('Use triads or voicings, not both')
    const instrument = fields.get('instrument')?.toLowerCase()
    if (
        instrument === 'piano' ||
        instrument === 'keyboard' ||
        fields.has('pitches') ||
        fields.has('notes')
    ) {
        throw new Error('voicings are for guitar and other fretted instruments')
    }
    const refused = NOT_WITH_VOICINGS.find((key) => fields.has(key))
    if (refused) throw new Error(`voicings finds the frets itself: remove "${refused}"`)
    const frettish = block.head?.split(/\s+/).find((t, i) => i > 0 && parseFrets(t) !== null)
    if (frettish) throw new Error(`voicings finds the frets itself: remove "${frettish}"`)
    const written = fields.get('symbol') ?? fields.get('chord') ?? block.head ?? fields.get('name')
    if (!written) throw new Error('voicings needs a chord: e.g. A Major')
    const chord = readChord(written)
    if (!chord) throw new Error(`Didn't recognize "${written}": try ${suggestChords(written)}`)
    const tuningText = fields.get('tuning')
    if (instrument && instrument !== 'guitar' && !tuningText) {
        throw new Error(`Unknown instrument "${instrument}": use guitar, or give a tuning`)
    }
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(`Unknown tuning "${tuningText}"`)
    const count = tuning?.length ?? 6
    if (count > MAX_GENERATED_STRINGS) {
        throw new Error(`voicings works on up to ${MAX_GENERATED_STRINGS} strings`)
    }
    const all = value.toLowerCase() === 'all'
    const wanted = all ? MAX_DIAGRAMS : Number(value)
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_DIAGRAMS) {
        throw new Error(`voicings: use all, or a number from 1 to ${MAX_DIAGRAMS}`)
    }
    const options: VoicingOptions = {}
    if (tuning) options.tuning = tuning
    const area = fields.get('area')
    if (area) {
        const range = area.trim().toLowerCase() === 'open' ? 'open' : parseRange(area)
        if (!range || (range !== 'open' && range[1] > 24)) {
            throw new Error(`area: use open, or frets like 5-9 (up to 24), got "${area}"`)
        }
        // Fretted notes start at fret 1: "0-3" means from the nut.
        options.area = range === 'open' ? 'open' : [Math.max(1, range[0]), Math.max(1, range[1])]
    }
    const rootString = fields.get('root-string')
    if (rootString) {
        const n = Number(rootString)
        if (!Number.isInteger(n) || n < 1 || n > count) {
            throw new Error(`root-string: use a string number from 1 (the highest) to ${count}`)
        }
        options.bassString = n
    }
    const strings = fields.get('strings')
    if (strings) options.strings = parseStrings(strings, count)
    const inversion = fields.get('inversion')?.trim().toLowerCase()
    if (inversion) {
        const n = inversion === 'root' ? 0 : Number(inversion)
        if (inversion === 'any') options.inversion = 'any'
        else if (Number.isInteger(n) && n >= 0 && n <= 3) options.inversion = n
        else throw new Error(`inversion: use 0 (root), 1, 2, 3 or any, got "${inversion}"`)
    }
    if (yes(fields.get('stretch'), 'stretch')) options.maxSpan = 5
    const open = yes(fields.get('open'), 'open')
    if (open === false) options.allowOpen = false
    if (yes(fields.get('gaps'), 'gaps')) options.gaps = true
    // Only the strings asked for: three strings make triads.
    if (options.strings) options.minStrings = Math.min(options.strings.length, 4)
    // Seven or eight strings have many more combinations: one widening filter at a time keeps a
    // block quick to draw.
    if (count > 6) {
        if (options.inversion === 'any' && (options.strings?.length ?? count) > 6) {
            throw new Error(
                `On ${count} strings, inversion: any needs six strings or fewer: add e.g. strings: 1-6`
            )
        }
        const wide = [
            options.gaps ? 'gaps' : null,
            options.maxSpan ? 'stretch' : null,
            Array.isArray(options.area) && options.area[1] - options.area[0] > 11
                ? 'a wide area'
                : null
        ].filter((w): w is string => w !== null)
        if (wide.length > 1) {
            throw new Error(`On ${count} strings, use one of ${wide.join(', ')} at a time`)
        }
    }
    const voicings = cachedVoicings(chord.symbol, options).slice(0, wanted)
    if (!voicings.length) throw new Error(noVoicing(written, chord.symbol, options))
    // Shared keys (and columns) go in a shared part; the others repeat in every diagram.
    const shared = SHARED_KEYS.chord
    const others = [...fields].filter(
        ([key]) =>
            !VOICING_FILTERS.includes(key) && !['symbol', 'chord', 'name', 'title'].includes(key)
    )
    const header = others
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const own = others
        .filter(([key]) => key !== 'columns' && !shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const frets = (list: (number | null)[]) =>
        list.some((f) => f !== null && f > 9)
            ? list.map((f) => (f === null ? 'x' : f)).join('-')
            : list.map((f) => (f === null ? 'x' : f)).join('')
    // Each diagram: the block's title (or the chord as written), then the shape.
    const title = fields.get('title') ?? written
    const diagrams = voicings.map((v) =>
        [
            `symbol: ${chord.symbol}`,
            `title: ${title}${v.shape ? `, ${v.shape}` : ''}`,
            `frets: ${frets(v.frets)}`,
            `fingers: ${v.fingers.map((f) => f ?? 'x').join('')}`,
            ...own
        ].join('\n')
    )
    return [...(header.length ? [header.join('\n')] : []), ...diagrams]
}

/**
 * `triads: 1-3` on a chord block: the chord's triads on that string set, up the neck (all
 * inversions, or `inversion:`), or with `key: G major` the key's seven triads in one inversion.
 * Dots show intervals unless `labels:` says otherwise. Null when the block has no `triads:`.
 */
function triadParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'chord') return null
    let block: BlockSource
    try {
        block = filled(parseBlockSource(source))
    } catch {
        return null
    }
    const value = block.fields.get('triads')?.trim()
    if (value === undefined) return null
    const fields = block.fields
    if (fields.has('voicings')) throw new Error('Use triads or voicings, not both')
    const refused = NOT_WITH_VOICINGS.find((key) => fields.has(key))
    if (refused) throw new Error(`triads finds the frets itself: remove "${refused}"`)
    const instrument = fields.get('instrument')?.toLowerCase()
    if (instrument && instrument !== 'guitar' && !fields.get('tuning')) {
        throw new Error('triads are for guitar and other fretted instruments: give a tuning')
    }
    const tuningText = fields.get('tuning')
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(`Unknown tuning "${tuningText}"`)
    const count = tuning?.length ?? 6
    const strings = parseStrings(value, count)
    const sorted = [...strings].sort((a, b) => a - b)
    if (sorted.length !== 3 || sorted[2]! - sorted[0]! !== 2) {
        throw new Error(`triads: give three strings next to each other, e.g. 1-3 or 2-4`)
    }
    const inversionText = fields.get('inversion')?.trim().toLowerCase()
    let inversion: number | 'any' | undefined
    if (inversionText) {
        const n = inversionText === 'root' ? 0 : Number(inversionText)
        if (inversionText === 'any') inversion = 'any'
        else if (n === 0 || n === 1 || n === 2) inversion = n
        else
            throw new Error(`inversion: use 0 (root position), 1, 2 or any, got "${inversionText}"`)
    }
    const options = { strings: sorted, ...(tuning ? { tuning } : {}) }
    const keyText = fields.get('key')
    let diagrams: { symbol: string; title: string; triad: Triad }[]
    const head = fields.get('title')
    if (keyText) {
        if (inversion === 'any') throw new Error('With a key, pick one inversion: 0, 1 or 2')
        const triads = keyTriads(keyText, {
            ...options,
            ...(inversion !== undefined ? { inversion } : {})
        })
        if (!triads)
            throw new Error(`Unknown key "${keyText}": use e.g. key: G major or key: E minor`)
        diagrams = triads.map((t) => ({
            symbol: t.symbol,
            title: `${t.numeral} · ${t.symbol}`,
            triad: t.triad
        }))
    } else {
        const written =
            fields.get('symbol') ?? fields.get('chord') ?? block.head ?? fields.get('name')
        if (!written) throw new Error('triads needs a chord (e.g. G) or a key (key: G major)')
        const chord = readChord(written)
        if (!chord) throw new Error(`Didn't recognize "${written}": try ${suggestChords(written)}`)
        const notes = chordNoteSet(chord.symbol)?.members.filter((m) => m.interval !== null).length
        if (notes !== 3) {
            throw new Error(`${chord.symbol} isn't a triad (three notes): try voicings: all`)
        }
        const list = triadVoicings(chord.symbol, {
            ...options,
            ...(inversion !== undefined ? { inversion } : {})
        })
        diagrams = list.slice(0, MAX_DIAGRAMS).map((t) => ({
            symbol: chord.symbol,
            title: `${head ?? written}, ${inversionName(t.inversion)}`,
            triad: t
        }))
    }
    if (!diagrams.length) throw new Error('No triad fits on these strings: try another string set')
    const shared = SHARED_KEYS.chord
    const others = [...fields].filter(
        ([key]) => !['triads', 'key', 'inversion', 'symbol', 'chord', 'name', 'title'].includes(key)
    )
    const header = others
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    // Triad charts show which chord tone each note is.
    if (!fields.has('labels')) header.push('labels: intervals')
    const own = others
        .filter(([key]) => key !== 'columns' && !shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const frets = (list: (number | null)[]) =>
        list.some((f) => f !== null && f > 9)
            ? list.map((f) => (f === null ? 'x' : f)).join('-')
            : list.map((f) => (f === null ? 'x' : f)).join('')
    const parts = diagrams.map((d) =>
        [
            `symbol: ${d.symbol}`,
            `title: ${d.title}`,
            `frets: ${frets(d.triad.frets)}`,
            `fingers: ${d.triad.fingers.map((f) => f ?? 'x').join('')}`,
            ...own
        ].join('\n')
    )
    return [header.join('\n'), ...parts]
}

const fretsText = (list: readonly (number | null)[]) =>
    list.some((f) => f !== null && f > 9)
        ? list.map((f) => (f === null ? 'x' : f)).join('-')
        : list.map((f) => (f === null ? 'x' : f)).join('')

/** Guitarist string numbers (1 = the highest) of string indexes, for `anchors:` and `guides:`. */
const stringNumbers = (indexes: number[], count: number) => indexes.map((s) => count - s).join(' ')

/** "A x02220", "A Major x02220 x01230" or "A": the chord, and its frets and fingers when given. */
function heldChord(text: string): {
    written: string
    frets: (number | null)[] | null
    fingers: string | null
} {
    const tokens = text.trim().split(/\s+/)
    const at = tokens.findIndex((t, i) => i > 0 && parseFrets(t) !== null)
    if (at < 0) return { written: text.trim(), frets: null, fingers: null }
    return {
        written: tokens.slice(0, at).join(' '),
        frets: parseFrets(tokens[at]!),
        fingers: tokens[at + 1] ?? null
    }
}

/**
 * Chord transitions on a chord block: `from: A x02220` with `to: D` draws the held chord, then the
 * next chord's voicings the hand reaches most easily (`count:`, 3 by default), anchors and guides
 * marked; `progression: G D Em C` draws the voicings that make the whole progression easiest.
 * Null when the block has neither.
 */
function transitionParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'chord') return null
    let block: BlockSource
    try {
        block = filled(parseBlockSource(source))
    } catch {
        return null
    }
    const fields = block.fields
    const fromText = fields.get('from')
    const progressionText = fields.get('progression')
    if (fromText === undefined && progressionText === undefined) {
        if (fields.has('to'))
            throw new Error('Add the chord you hold: from: C (with its frets: from: C x32010)')
        return null
    }
    const instrument = fields.get('instrument')?.toLowerCase()
    if (instrument && instrument !== 'guitar' && !fields.get('tuning')) {
        throw new Error('Transitions are for guitar and other fretted instruments: give a tuning')
    }
    if (fromText !== undefined && progressionText !== undefined) {
        throw new Error('Use from and to, or progression, not both')
    }
    const refused = [...NOT_WITH_VOICINGS, 'voicings', 'triads'].find((key) => fields.has(key))
    if (refused)
        throw new Error(`"${refused}" can't be used with ${fromText ? 'from' : 'progression'}`)
    const tuningText = fields.get('tuning')
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(`Unknown tuning "${tuningText}"`)
    const count = tuning?.length ?? 6
    if (count > MAX_GENERATED_STRINGS) {
        throw new Error(`Transitions work on up to ${MAX_GENERATED_STRINGS} strings`)
    }
    const read = (written: string) => {
        const chord = readChord(written)
        if (!chord) throw new Error(`Didn't recognize "${written}": try ${suggestChords(written)}`)
        return chord.symbol
    }
    const shared = SHARED_KEYS.chord
    const header = [...fields]
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const diagram = (
        symbol: string,
        title: string,
        frets: readonly (number | null)[],
        fingers: readonly (string | null)[] | string | null,
        anchors: number[] = [],
        guides: number[] = []
    ) =>
        [
            `symbol: ${symbol}`,
            `title: ${title}`,
            `frets: ${fretsText(frets)}`,
            ...(fingers
                ? [
                      `fingers: ${typeof fingers === 'string' ? fingers : fingers.map((f) => f ?? 'x').join('')}`
                  ]
                : []),
            ...(anchors.length ? [`anchors: ${stringNumbers(anchors, count)}`] : []),
            ...(guides.length ? [`guides: ${stringNumbers(guides, count)}`] : [])
        ].join('\n')
    const options = tuning ? { tuning } : {}
    if (progressionText !== undefined) {
        const names = (
            /[,|]/.test(progressionText)
                ? progressionText.split(/[,|]/)
                : progressionText.split(/\s+/)
        )
            .map((n) => n.trim())
            .filter(Boolean)
        if (names.length < 2) throw new Error('progression: give two chords or more, e.g. G D Em C')
        if (names.length > MAX_DIAGRAMS)
            throw new Error(`progression: at most ${MAX_DIAGRAMS} chords`)
        const steps = smoothProgression(names.map(read), options)
        if (!steps.length) throw new Error('No playable voicings for this progression')
        return [
            ...(header.length ? [header.join('\n')] : []),
            ...steps.map((s, i) =>
                diagram(s.chord, names[i]!, s.voicing.frets, s.voicing.fingers, s.anchors, s.guides)
            )
        ]
    }
    const toText = fields.get('to')
    if (!toText) throw new Error('Add the next chord: to: D')
    const held = heldChord(fromText!)
    const fromSymbol = read(held.written)
    const fromFrets = held.frets ?? generateVoicings(fromSymbol, options)[0]?.frets ?? null
    if (!fromFrets) throw new Error(`No playable voicing of ${held.written}: add its frets`)
    if (fromFrets.length !== count) {
        throw new Error(
            `"${fretsText(fromFrets)}" has ${fromFrets.length} strings, the tuning ${count}`
        )
    }
    const fromFingers = held.fingers ? parseFingers(held.fingers) : fingerVoicing(fromFrets)
    const howMany = Number(fields.get('count') ?? 3)
    if (!Number.isInteger(howMany) || howMany < 1 || howMany > MAX_DIAGRAMS - 1) {
        throw new Error(`count: use a number from 1 to ${MAX_DIAGRAMS - 1}`)
    }
    const steps = transition(fromFrets, read(toText), {
        ...options,
        ...(fromFingers ? { fromFingers } : {})
    }).slice(0, howMany)
    if (!steps.length) throw new Error(`No playable voicing of ${toText}`)
    return [
        ...(header.length ? [header.join('\n')] : []),
        diagram(fromSymbol, held.written, fromFrets, held.fingers ?? fromFingers),
        ...steps.map((s, i) =>
            diagram(
                read(toText),
                howMany > 1 ? `${toText}, ${i + 1}` : toText,
                s.voicing.frets,
                s.voicing.fingers,
                s.anchors,
                s.guides
            )
        )
    ]
}

/** Why no voicing fits, saying which filter to change. */
function noVoicing(written: string, symbol: string, options: VoicingOptions): string {
    const strings = options.strings
    const contiguous = strings
        ? [...strings].sort((a, b) => a - b).every((n, i, all) => i === 0 || n === all[i - 1]! + 1)
        : true
    if (strings && !contiguous && !options.gaps) {
        return `strings ${strings.join(' ')} aren't next to each other: add gaps: yes`
    }
    if (strings && options.bassString !== undefined && !strings.includes(options.bassString)) {
        return `root-string ${options.bassString} isn't among strings ${strings.join(' ')}`
    }
    const notes = chordNoteSet(symbol)?.members.filter((m) => m.interval !== null).length ?? 0
    if (typeof options.inversion === 'number' && options.inversion >= notes) {
        return `${symbol} has ${notes} notes: inversion goes up to ${notes - 1}`
    }
    if (options.bassString !== undefined) {
        return `No voicing of ${written} has its bass on string ${options.bassString}: try another root-string`
    }
    return `No playable voicing of ${written} fits: widen the area, allow open strings or add stretch: yes`
}

/**
 * `modes: C major` on a fretboard or keyboard: one diagram per mode, in a row, with the block's
 * other keys shared. Null when the block has no `modes:`.
 */
function modeParts(language: DiagramLanguage, source: string): string[] | null {
    if (language === 'chord') return null
    let block: BlockSource
    try {
        block = parseBlockSource(source)
    } catch {
        return null
    }
    const value = block.fields.get('modes')
    if (value === undefined) return null
    const modes = modesOf(value)
    if (!modes) throw new Error(`"${value}" has no modes: use e.g. modes: C major`)
    const shared = SHARED_KEYS[language]
    const others = [...block.fields].filter(([key]) => key !== 'modes')
    const refused = others.find(([key]) => key !== 'columns' && !shared.includes(key))
    if (refused || block.head) {
        throw new Error(
            `"${refused?.[0] ?? block.head}" can't be used with modes: only ${shared.join(', ')}, columns`
        )
    }
    // Every mode by its own name (C ionian, A aeolian), so their characteristic notes show.
    const named = modes.map((m) =>
        m.replace(/^(\S+) major$/, '$1 ionian').replace(/^(\S+) minor$/, '$1 aeolian')
    )
    const header = others.map(([key, v]) => `${key}: ${v}`).join('\n')
    return [...(header ? [header] : []), ...named.map((m) => `scale: ${m}\ntitle: ${m}`)]
}

/** A block's keys without the empty ones (`labels:` alone says nothing). */
const filled = (block: BlockSource): BlockSource => ({
    head: block.head,
    fields: new Map([...block.fields].filter(([, value]) => value !== ''))
})

/**
 * The row's shared settings: a first part with no shorthand that holds `columns` or only shareable
 * keys. With `columns`, any other key is refused by name (a diagram can't hide there).
 */
function headerOf(language: DiagramLanguage, part: string | undefined): BlockSource | null {
    if (part === undefined) return null
    let block: BlockSource
    try {
        block = filled(parseBlockSource(part))
    } catch {
        return null
    }
    if (block.head !== null) return null
    const shared = SHARED_KEYS[language]
    const others = [...block.fields.keys()].filter(
        (key) => key !== 'columns' && !shared.includes(key)
    )
    if (!others.length) return block.fields.size ? block : null
    if (!block.fields.has('columns')) return null
    throw new Error(
        `"${others[0]}" can't be shared: move it to a diagram. Shared settings: ${shared.join(', ')}, columns`
    )
}

/** Checks the shared settings once, rather than once per diagram. */
function checkShared(header: BlockSource): void {
    const orientation = header.fields.get('orientation')
    if (orientation !== undefined) parseOrientation(orientation)
    const hand = header.fields.get('hand')
    if (hand !== undefined) parseHand(hand)
}

/** Whether a part with no shorthand holds a shareable key (it may have been meant as settings). */
function sharesSomething(language: DiagramLanguage, part: string): boolean {
    try {
        const block = parseBlockSource(part)
        return (
            block.head === null &&
            [...block.fields.keys()].some((k) => SHARED_KEYS[language].includes(k))
        )
    } catch {
        return false
    }
}

function columnsOf(header: BlockSource | null): number | null {
    const text = header?.fields.get('columns')
    if (text === undefined) return null
    const n = Number(text)
    if (!Number.isInteger(n) || n < 1 || n > 12) {
        throw new Error(`columns must be a whole number from 1 to 12, got "${text}"`)
    }
    return n
}

/**
 * Several diagrams in a row (or a grid), each in its own cell. A diagram with a mistake shows its
 * message in its cell and the others still draw. Returns the failing diagrams' messages, or null.
 */
function renderRow(
    doc: Document,
    language: DiagramLanguage,
    parts: string[],
    el: HTMLElement,
    options: RenderOptions
): string | null {
    const header = headerOf(language, parts[0])
    const diagrams = header ? parts.slice(1) : parts
    if (header && !diagrams.length) {
        throw new Error('Add a diagram after the shared settings: a "---" line, then the diagram')
    }
    if (header) checkShared(header)
    if (diagrams.length > MAX_DIAGRAMS) {
        throw new Error(`At most ${MAX_DIAGRAMS} diagrams per block, found ${diagrams.length}`)
    }
    const columns = columnsOf(header)
    const shared = [...(header?.fields ?? [])].filter(([key]) => key !== 'columns')
    const row = html(doc, 'div', columns ? `mn-grid mn-cols-${columns}` : 'mn-row')
    const errors: string[] = []
    diagrams.forEach((part, i) => {
        const cell = html(doc, 'div', 'mn-cell')
        try {
            const block = filled(parseBlockSource(part))
            if (block.fields.has('columns')) {
                throw new Error('"columns" goes in the shared settings, before the first "---"')
            }
            const directive = [
                'positions',
                'modes',
                'voicings',
                'triads',
                'from',
                'progression'
            ].find((key) => block.fields.has(key))
            if (directive) {
                throw new Error(`"${directive}" draws its own row: use it in a block of its own`)
            }
            // The diagram's own keys win over the shared ones.
            const fields = new Map([...shared, ...block.fields])
            cell.appendChild(DIAGRAMS[language](doc, { head: block.head, fields }, options))
        } catch (e) {
            let message = `diagram ${i + 1}: ${messageOf(e)}`
            // A first part meant as shared settings but holding another key draws as a diagram.
            if (i === 0 && !header && sharesSomething(language, part)) {
                message += ` (shared settings before the first "---" may only hold: ${SHARED_KEYS[language].join(', ')}, columns)`
            }
            errors.push(message)
            cell.classList.add('mn-error')
            cell.appendChild(html(doc, 'div', 'mn-error-message', `${language}, ${message}`))
        }
        row.appendChild(cell)
    })
    el.appendChild(row)
    return errors.length ? errors.join('; ') : null
}
