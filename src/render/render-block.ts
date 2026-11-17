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
import { attachCopy } from '../playback/copy-image.js'
import { blockEngine } from '../playback/engine.js'
import { blockGuitar } from '../playback/guitar-tone.js'
import { attachPick, type PickLayer, type PickOptions } from './pick.js'
import {
    lettersInBlock,
    namingOf,
    quoteAsWritten,
    withNaming,
    type BlockReading,
    type Naming
} from '../theory/naming.js'
import { languageOf } from '../i18n/language.js'
import { t, withLanguage } from '../i18n/translate.js'
import { rootMarkInBlock, rootMarkOf, withRootMark, type RootMark } from './root-mark.js'
import { alignTitleLines, layoutDefaults, parseHand, parseOrientation } from './layout.js'
import { blockFromProperties, DEFAULT_PROPERTY_NAMES, instrumentOf } from '../blocks/properties.js'
import { modesOf } from '../theory/scales.js'
import { resolveScalesFor, scalesForBlock } from '../blocks/scales-for.js'
import { chordField, noteSetOf } from '../blocks/note-set-field.js'
import {
    autoFingeringUnknown,
    isBothHandsFingering,
    standardScaleFingering
} from '../keyboard/scale-fingering.js'
import { chordNoteSet, scaleNoteSet } from '../theory/note-set.js'
import {
    CAGED_SHAPES,
    neckPositions,
    numberingOf,
    MAX_FRET,
    positionCount,
    relativeMinorOf
} from '../fretboard/positions.js'
import { capoTuning, parseCapo } from '../chord/capo.js'
import { STANDARD_TUNING } from '../chord/guitar.js'
import {
    fingerVoicing,
    distinctShapes,
    generateVoicings,
    MAX_GENERATED_STRINGS,
    shapeLabel,
    type GeneratedVoicing,
    type VoicingOptions
} from '../chord/generate.js'
import { parseFingers, parseFrets } from '../chord/guitar.js'
import { smoothProgression, transition } from '../chord/transitions.js'
import type { VoicingLookup } from '../voicings/index.js'
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
    /** The live pick layers (the `pick` option), one per diagram that has one, in page order. */
    picks: PickLayer[]
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function renderBlock(
    language: NotationLanguage,
    source: string,
    host: HTMLElement,
    given: RenderOptions = {}
): RenderResult {
    // The texts of the block (errors, bars, descriptions) come in the block's language (#136).
    return withLanguage(languageOf(given.language) ?? 'en', () =>
        drawBlock(language, source, host, given)
    )
}

function drawBlock(
    language: NotationLanguage,
    source: string,
    host: HTMLElement,
    given: RenderOptions
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
    // A chart's chord diagrams: guitar or piano, from the note's tags when the options don't say.
    if (language === 'chords' && !options.instrument) {
        const instrument = chartInstrument(options, host)
        if (instrument) options.instrument = instrument
    }
    let text = source
    // An empty block in a note draws from the note's properties, when they describe one.
    if (
        !text.trim() &&
        (isDiagramLanguage(language) || language === 'strum' || language === 'picking')
    ) {
        const fromProperties = propertiesSource(language, options, host)
        if (fromProperties) {
            text = fromProperties
            el.classList.add('mn-from-properties')
        }
    }
    // The block's wish for an engine (#124): its `engine:` line (`{engine: …}` in a chart), kept
    // on the block for its bars and taken out of the text, so no parser has to know it.
    try {
        const wish = blockEngine(text, language === 'chords')
        text = wish.source
        if (wish.engine) el.setAttribute('data-mn-engine', wish.engine)
        // The block's guitar (#103): its `guitar:` line, kept and taken out the same way.
        const tone = blockGuitar(text, language === 'chords')
        text = tone.source
        if (tone.guitar) el.setAttribute('data-mn-guitar', tone.guitar)
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    // Names in solfège or German are read into letters first (#12); the drawing shows them in
    // the block's naming.
    // The block's own `naming:` line reads and shows; the app's option only shows (#12), so an
    // app's default never reads an existing note's B as B flat.
    let reading: BlockReading
    try {
        reading = lettersInBlock(language, text)
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    text = reading.text
    const naming: Naming = reading.naming ?? namingOf(options.naming) ?? 'letters'
    if (naming !== 'letters') el.setAttribute('data-mn-naming', naming)
    // The root as a shape too (#14): the block's own `root-mark:` line, else the app's option.
    let rootMark: RootMark
    try {
        const marking = rootMarkInBlock(language, text)
        text = marking.text
        rootMark = marking.mark ?? rootMarkOf(options.rootMark) ?? 'color'
    } catch (e) {
        return failed(el, host, language, messageOf(e))
    }
    if (rootMark !== 'color') el.setAttribute('data-mn-root-mark', rootMark)
    // Messages quote what the user wrote ("H dorian"), not what it was read as.
    const quoted = (e: unknown) => quoteAsWritten(messageOf(e), reading.changes)
    const draw = (): RenderResult => {
        let parts: string[] | null
        try {
            // scales-for first: the keys that split a block into a row need its scale.
            if ((language === 'fretboard' || language === 'keyboard') && !splitParts(text))
                text = resolveScalesFor(text)
            parts = isDiagramLanguage(language)
                ? (splitParts(text) ??
                  modeParts(language, text) ??
                  positionParts(language, text) ??
                  handParts(language, text) ??
                  transitionParts(language, text, options.voicings) ??
                  triadParts(language, text) ??
                  voicingParts(language, text))
                : null
        } catch (e) {
            return failed(el, host, language, quoted(e))
        }
        // An empty block (a template's placeholder, or only separators) draws nothing, not an error.
        if (!text.trim() || parts?.length === 0) {
            el.classList.add('mn-empty')
            host.appendChild(el)
            return { ok: true, el, error: null, picks: [], destroy: () => el.remove() }
        }
        try {
            if (parts && isDiagramLanguage(language)) {
                error = renderRow(doc, language, parts, el, options)
                // Each diagram's message quotes what the user wrote (#12).
                if (error !== null && reading.changes.length) {
                    error = quoteAsWritten(error, reading.changes)
                    for (const m of el.querySelectorAll('.mn-error-message'))
                        m.textContent = quoteAsWritten(m.textContent ?? '', reading.changes)
                }
            } else {
                el.appendChild(RENDERERS[language](doc, text, options))
                // A chart still draws around directives it couldn't read, and {chord} diagrams it
                // couldn't draw; they make the block not ok.
                const warnings = [
                    ...el.querySelectorAll(
                        '.mn-chart > .mn-error-message, .mn-chart-chord > .mn-error-message'
                    )
                ]
                // A wrong {naming: …} directive is one of them (#12).
                if (reading.warning) {
                    const chart = el.querySelector('.mn-chart')
                    chart?.insertBefore(
                        html(doc, 'div', 'mn-error-message', reading.warning),
                        chart.firstChild
                    )
                    if (chart) warnings.unshift(chart.firstElementChild!)
                }
                if (warnings.length) error = warnings.map((w) => w.textContent ?? '').join('; ')
            }
        } catch (e) {
            return failed(el, host, language, quoted(e))
        }
        // Titles wrap instead of widening a diagram (#74): every diagram of the block gets the room
        // of its longest title, so the necks of a row line up.
        alignTitleLines(el.querySelectorAll('svg.mn-guitar-chord, svg.mn-fretboard'))
        host.appendChild(el)
        // A fretboard exercise's tab (#47): the app draws it, once the block is on the page (its
        // colors come from the page); else its source stays for the tab bundle of web pages.
        const freeTabs: (() => void)[] = []
        if (options.tab) {
            for (const pre of el.querySelectorAll<HTMLElement>('pre.mn-exercise')) {
                const holder = html(doc, 'div', 'mn-exercise-tab')
                for (const { name, value } of [...pre.attributes]) {
                    if (name.startsWith('data-mn-')) holder.setAttribute(name, value)
                }
                pre.replaceWith(holder)
                try {
                    const free = options.tab(pre.textContent ?? '', holder)
                    if (typeof free === 'function') freeTabs.push(free)
                } catch {
                    // The app couldn't draw it: the source shows instead.
                    holder.replaceWith(pre)
                }
            }
        }
        // The pick layer (Music Practice #73): live on each diagram that drew one.
        const picks = options.pick
            ? [...el.querySelectorAll('svg[data-mn-pick]')].map((svg) =>
                  attachPick(svg, pickOptions(options))
              )
            : []
        // Hear the diagrams: a playback bar on each one that has notes to play.
        // Copy as image (#11) is on the play bars, or on a bar of its own without playback.
        // Full screen (#113) is on the same bars.
        const copy = options.copy !== false
        const fullScreen = options.fullScreen !== false
        const stopPlayback = options.play
            ? attachPlayback(el, {
                  // Redraws for guitar follow the page's hand unless the app says (#60).
                  hand: options.hand,
                  ...(typeof options.play === 'object' ? options.play : {}),
                  copy,
                  fullScreen
              })
            : copy || fullScreen
              ? attachCopy(el, undefined, { copy, fullScreen })
              : null
        return {
            ok: error === null,
            el,
            error,
            picks,
            destroy: () => {
                stopPlayback?.()
                for (const layer of picks) layer.destroy()
                for (const free of freeTabs) free()
                el.remove()
            }
        }
    }

    /** The pick options: `play: true` plays picks on the block's `play` options (its player, volume). */
    function pickOptions(options: RenderOptions): PickOptions {
        const pick = typeof options.pick === 'object' ? options.pick : {}
        if (pick.play !== true) return pick
        return { ...pick, play: typeof options.play === 'object' ? options.play : true }
    }
    return withNaming(naming, () => withRootMark(rootMark, draw), reading.titles)
}

/** The block as an inline error that says what's wrong. */
function failed(el: HTMLElement, host: HTMLElement, language: string, error: string): RenderResult {
    el.replaceChildren()
    el.classList.add('mn-error')
    el.appendChild(html(el.ownerDocument, 'div', 'mn-error-message', `${language}: ${error}`))
    host.appendChild(el)
    return { ok: false, el, error, picks: [], destroy: () => el.remove() }
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

/** The instrument the note's tags name (piano, else guitar); null without properties. */
function chartInstrument(
    options: RenderOptions,
    host: Element
): RenderOptions['instrument'] | null {
    const properties = resolveProperties(options.properties, host)
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
    try {
        return instrumentOf(properties as Record<string, unknown>, {
            ...DEFAULT_PROPERTY_NAMES,
            ...options.propertyNames
        })
    } catch {
        return null
    }
}

/** An empty block's source from the note's properties (an object, or a function returning one). */
function propertiesSource(
    language: DiagramLanguage | 'strum' | 'picking',
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
 * Boxes for 5-note scales, CAGED shapes for 7-note scales, or 3NPS with `shape: 3nps`. Positions
 * follow the neck: each diagram gets the frets `neckPositions` puts it at (a list picks from that
 * layout). With `numbering: minor`, a major pentatonic's positions count from its relative minor
 * and their titles say so. Null when the block has no `positions:`.
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
    if (block.fields.has('exercise')) {
        throw new Error(t('render.positions.exerciseOne'))
    }
    // A scale, or a chord: its arpeggio (`arpeggio: Am7`, `chord: Am7`, or a shorthand chord).
    const chordText = chordField(block)
    const scaleText = block.fields.get('scale') ?? (chordText === undefined ? block.head : null)
    const scaleSet = scaleText ? scaleNoteSet(scaleText) : null
    const written = scaleSet ? scaleText! : (chordText ?? block.head)
    const set = scaleSet ?? (written ? chordNoteSet(written) : null)
    if (!written || !set) {
        throw new Error(t('render.positions.needsSet'))
    }
    const arpeggio = !scaleSet
    const shape = block.fields.get('shape')?.trim().toLowerCase()
    if (arpeggio && shape === '3nps') {
        throw new Error(t('render.positions.arpeggioCaged'))
    }
    const system =
        shape === '3nps' ? '3nps' : !arpeggio && set.members.length === 5 ? 'box' : 'caged'
    const count = positionCount(set, system)
    const wanted =
        value.toLowerCase() === 'all'
            ? Array.from({ length: count }, (_, i) => i + 1)
            : value.split(/[\s,]+/).map(Number)
    const bad = wanted.find((n) => !Number.isInteger(n) || n < 1 || n > count)
    if (bad !== undefined) {
        throw new Error(t('render.positions.range', { count, title: set.title }))
    }
    // Up the neck, each position at or above the one before; an unknown tuning fails in the diagram.
    const tuningText = block.fields.get('tuning')
    // numbering: minor numbers a major pentatonic's positions from its relative minor.
    const numbering = numberingOf(block.fields.get('numbering'), set, system)
    // With a capo, positions are found from it as if it were the nut (an invalid capo fails in
    // the diagram); their frets count from it unless they count from the nut.
    const capo = capoIn(block)
    const shift = block.fields.get('frets-from')?.trim().toLowerCase() === 'nut' ? capo : 0
    const neck = neckPositions(
        set,
        capoTuning((tuningText && parseTuning(tuningText)) || STANDARD_TUNING, capo),
        system,
        numbering,
        MAX_FRET - capo
    )
    const numbered = numbering === 'minor' ? ['numbering: minor'] : []
    // Short, so the titles don't widen every diagram of the row.
    const from =
        numbering === 'minor'
            ? t('render.positions.fromMinor', { root: relativeMinorOf(set) ?? '' })
            : ''
    const fretsOf = (n: number) => {
        const cells = neck[n - 1]
        if (!cells?.length) return []
        const frets = cells.map((c) => c.fret + shift)
        return [`frets: ${Math.min(...frets)}-${Math.max(...frets)}`]
    }
    // Shared keys (and columns) go in a shared part; the others repeat in every diagram.
    const shared = SHARED_KEYS.fretboard
    const others = [...block.fields].filter(
        ([key]) =>
            ![
                'positions',
                'scale',
                'arpeggio',
                'chord',
                'shape',
                'position',
                'numbering',
                'title',
                'frets'
            ].includes(key)
    )
    const header = others
        .filter(([key]) => key === 'columns' || shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const own = others
        .filter(([key]) => key !== 'columns' && !shared.includes(key))
        .map(([key, v]) => `${key}: ${v}`)
    const name = arpeggio ? t('render.positions.arpeggioTitle', { title: set.title }) : set.title
    const diagrams = wanted.map((n) => {
        const at =
            system === 'caged'
                ? [
                      `shape: ${CAGED_SHAPES[n - 1]}`,
                      `title: ${t('render.positions.shapeTitle', { name, shape: CAGED_SHAPES[n - 1]! })}`
                  ]
                : system === '3nps'
                  ? [
                        'shape: 3nps',
                        `position: ${n}`,
                        `title: ${t('render.positions.npsTitle', { name, n, from })}`
                    ]
                  : [
                        `position: ${n}`,
                        `title: ${t('render.positions.boxTitle', { name, n, from })}`
                    ]
        const what = arpeggio ? `arpeggio: ${written}` : `scale: ${written}`
        // A chord over the scale (#48) marks its tones in every position.
        const over = !arpeggio && chordText ? [`chord: ${chordText}`] : []
        return [what, ...over, ...at, ...numbered, ...fretsOf(n), ...own].join('\n')
    })
    return [...(header.length ? [header.join('\n')] : []), ...diagrams]
}

/**
 * `fingering: auto both` on a keyboard scale (#49): two keyboards in a column (or the columns
 * written), the right hand's standard fingering, then the left hand's an octave lower, as
 * `fingering: auto` and `auto left` draw them alone. A title is kept, with the hand after it.
 * A scale without a standard fingering, or no scale, fails once for the block. Null when the
 * block doesn't ask for both hands.
 */
function handParts(language: DiagramLanguage, source: string): string[] | null {
    if (language !== 'keyboard') return null
    let block: BlockSource
    try {
        block = parseBlockSource(source)
    } catch {
        return null
    }
    const fingering = block.fields.get('fingering')
    if (fingering === undefined || !isBothHandsFingering(fingering)) return null
    // scales-for first: both hands play the scale it finds.
    block = scalesForBlock(block)
    const set = noteSetOf(block)
    if (set.root === null || set.list || set.pitches || !set.scaleType) {
        throw new Error(t('keyboard.fingering.autoNeedsScale'))
    }
    if (!standardScaleFingering(set.root, set.scaleType, 'right')) {
        throw new Error(autoFingeringUnknown(set.title))
    }
    const title = block.fields.get('title')?.trim()
    const others = [...block.fields]
        .filter(([key]) => !['fingering', 'title', 'columns'].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
    const head = block.head ? [block.head] : []
    const hand = (side: 'right' | 'left') =>
        [
            ...head,
            ...others,
            `fingering: auto ${side}`,
            ...(title
                ? [
                      `title: ${t('render.fingering.handTitle', { title, hand: t(side === 'left' ? 'render.hand.left' : 'render.hand.right') })}`
                  ]
                : [])
        ].join('\n')
    const columns = block.fields.get('columns')?.trim() || '1'
    return [`columns: ${columns}`, hand('right'), hand('left')]
}

/** A block's capo fret (0 without one, or when it isn't valid: the diagram says so). */
function capoIn(block: BlockSource): number {
    const text = block.fields.get('capo')
    if (!text?.trim()) return 0
    try {
        return parseCapo(text)
    } catch {
        return 0
    }
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
    throw new Error(t('render.yesNo', { key, text }))
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
    if (fields.has('triads')) throw new Error(t('render.voicings.notBoth'))
    const instrument = fields.get('instrument')?.toLowerCase()
    if (
        instrument === 'piano' ||
        instrument === 'keyboard' ||
        fields.has('pitches') ||
        fields.has('notes')
    ) {
        throw new Error(t('render.voicings.fretted'))
    }
    // Once for the block, not in every diagram it expands into.
    if (fields.get('root')?.trim()) throw new Error(t('render.rootListsOnly'))
    const refused = NOT_WITH_VOICINGS.find((key) => fields.has(key))
    if (refused) throw new Error(t('render.voicings.noFrets', { value: refused }))
    const frettish = block.head?.split(/\s+/).find((t, i) => i > 0 && parseFrets(t) !== null)
    if (frettish) throw new Error(t('render.voicings.noFrets', { value: frettish }))
    const written = fields.get('symbol') ?? fields.get('chord') ?? block.head ?? fields.get('name')
    if (!written) throw new Error(t('render.voicings.needsChord'))
    const chord = readChord(written)
    if (!chord) throw new Error(unknownChord(written))
    const tuningText = fields.get('tuning')
    if (instrument && instrument !== 'guitar' && !tuningText) {
        throw new Error(t('render.voicings.instrument', { instrument }))
    }
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(t('render.tuning', { text: tuningText }))
    const count = tuning?.length ?? 6
    if (count > MAX_GENERATED_STRINGS) {
        throw new Error(t('render.voicings.maxStrings', { max: MAX_GENERATED_STRINGS }))
    }
    const all = value.toLowerCase() === 'all'
    const wanted = all ? MAX_DIAGRAMS : Number(value)
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_DIAGRAMS) {
        throw new Error(t('render.voicings.count', { max: MAX_DIAGRAMS }))
    }
    const options: VoicingOptions = {}
    if (tuning) options.tuning = tuning
    const area = fields.get('area')
    if (area) {
        const range = area.trim().toLowerCase() === 'open' ? 'open' : parseRange(area)
        if (!range || (range !== 'open' && range[1] > 24)) {
            throw new Error(t('render.voicings.area', { area }))
        }
        // Fretted notes start at fret 1: "0-3" means from the nut.
        options.area = range === 'open' ? 'open' : [Math.max(1, range[0]), Math.max(1, range[1])]
    }
    const rootString = fields.get('root-string')
    if (rootString) {
        const n = Number(rootString)
        if (!Number.isInteger(n) || n < 1 || n > count) {
            throw new Error(t('render.voicings.rootString', { count }))
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
        else throw new Error(t('render.voicings.inversion', { inversion }))
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
            throw new Error(t('render.voicings.manyStringsAny', { count }))
        }
        const wide = [
            options.gaps ? 'gaps' : null,
            options.maxSpan ? 'stretch' : null,
            Array.isArray(options.area) && options.area[1] - options.area[0] > 11
                ? t('render.voicings.wideArea')
                : null
        ].filter((w): w is string => w !== null)
        if (wide.length > 1) {
            throw new Error(t('render.voicings.oneWidening', { count, list: wide.join(', ') }))
        }
    }
    // One diagram per shape, the easiest ones, drawn up the neck (#72).
    const voicings = distinctShapes(
        cachedVoicings(chord.symbol, options),
        wanted,
        options.tuning ?? STANDARD_TUNING
    )
    if (!voicings.length) throw new Error(noVoicing(written, chord.symbol, options))
    // Shared keys (and columns) go in a shared part; the others repeat in every diagram.
    const shared = SHARED_KEYS.chord
    const others = [...fields].filter(
        ([key]) =>
            !VOICING_FILTERS.includes(key) &&
            // The frets are found as played from the capo: frets-from is for frets you write.
            !['symbol', 'chord', 'name', 'title', 'frets-from'].includes(key)
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
            `title: ${title}${v.shape ? `, ${shapeLabel(v.shape)}` : ''}`,
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
    if (fields.has('voicings')) throw new Error(t('render.voicings.notBoth'))
    // Once for the block, not in every diagram it expands into.
    if (fields.get('root')?.trim()) throw new Error(t('render.rootListsOnly'))
    const refused = NOT_WITH_VOICINGS.find((key) => fields.has(key))
    if (refused) throw new Error(t('render.triads.noFrets', { value: refused }))
    const instrument = fields.get('instrument')?.toLowerCase()
    if (instrument && instrument !== 'guitar' && !fields.get('tuning')) {
        throw new Error(t('render.triads.fretted'))
    }
    const tuningText = fields.get('tuning')
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(t('render.tuning', { text: tuningText }))
    const count = tuning?.length ?? 6
    const strings = parseStrings(value, count)
    const sorted = [...strings].sort((a, b) => a - b)
    if (sorted.length !== 3 || sorted[2]! - sorted[0]! !== 2) {
        throw new Error(t('render.triads.strings'))
    }
    const inversionText = fields.get('inversion')?.trim().toLowerCase()
    let inversion: number | 'any' | undefined
    if (inversionText) {
        const n = inversionText === 'root' ? 0 : Number(inversionText)
        if (inversionText === 'any') inversion = 'any'
        else if (n === 0 || n === 1 || n === 2) inversion = n
        else throw new Error(t('render.triads.inversion', { inversion: inversionText }))
    }
    const options = { strings: sorted, ...(tuning ? { tuning } : {}) }
    const keyText = fields.get('key')
    let diagrams: { symbol: string; title: string; triad: Triad }[]
    const head = fields.get('title')
    if (keyText) {
        if (inversion === 'any') throw new Error(t('render.triads.keyInversion'))
        const triads = keyTriads(keyText, {
            ...options,
            ...(inversion !== undefined ? { inversion } : {})
        })
        if (!triads) throw new Error(t('render.triads.key', { text: keyText }))
        diagrams = triads.map((item) => ({
            symbol: item.symbol,
            title: `${item.numeral} · ${item.symbol}`,
            triad: item.triad
        }))
    } else {
        const written =
            fields.get('symbol') ?? fields.get('chord') ?? block.head ?? fields.get('name')
        if (!written) throw new Error(t('render.triads.needsChord'))
        const chord = readChord(written)
        if (!chord) throw new Error(unknownChord(written))
        const notes = chordNoteSet(chord.symbol)?.members.filter((m) => m.interval !== null).length
        if (notes !== 3) {
            throw new Error(t('render.triads.notTriad', { symbol: chord.symbol }))
        }
        const list = triadVoicings(chord.symbol, {
            ...options,
            ...(inversion !== undefined ? { inversion } : {})
        })
        diagrams = list.slice(0, MAX_DIAGRAMS).map((item) => ({
            symbol: chord.symbol,
            title: `${head ?? written}, ${inversionName(item.inversion)}`,
            triad: item
        }))
    }
    if (!diagrams.length) throw new Error(t('render.triads.none'))
    const shared = SHARED_KEYS.chord
    const others = [...fields].filter(
        ([key]) =>
            ![
                'triads',
                'key',
                'inversion',
                'symbol',
                'chord',
                'name',
                'title',
                // The frets are found as played from the capo: frets-from is for frets you write.
                'frets-from'
            ].includes(key)
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
function transitionParts(
    language: DiagramLanguage,
    source: string,
    voicings?: VoicingLookup
): string[] | null {
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
        if (fields.has('to')) throw new Error(t('render.transitions.needsFrom'))
        return null
    }
    const instrument = fields.get('instrument')?.toLowerCase()
    if (instrument && instrument !== 'guitar' && !fields.get('tuning')) {
        throw new Error(t('render.transitions.fretted'))
    }
    if (fromText !== undefined && progressionText !== undefined) {
        throw new Error(t('render.transitions.notBoth'))
    }
    // Once for the block, not in every diagram it expands into.
    if (fields.get('root')?.trim()) throw new Error(t('render.rootListsOnly'))
    const refused = [...NOT_WITH_VOICINGS, 'voicings', 'triads'].find((key) => fields.has(key))
    if (refused)
        throw new Error(
            t('render.transitions.refused', {
                key: refused,
                with: fromText ? 'from' : 'progression'
            })
        )
    const tuningText = fields.get('tuning')
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(t('render.tuning', { text: tuningText }))
    const count = tuning?.length ?? 6
    if (count > MAX_GENERATED_STRINGS) {
        throw new Error(t('render.transitions.maxStrings', { max: MAX_GENERATED_STRINGS }))
    }
    const read = (written: string) => {
        const chord = readChord(written)
        if (!chord) throw new Error(unknownChord(written))
        return chord.symbol
    }
    const shared = SHARED_KEYS.chord
    // Held and found frets count from the capo, as played: frets-from doesn't apply.
    const header = [...fields]
        .filter(([key]) => key === 'columns' || (shared.includes(key) && key !== 'frets-from'))
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
        if (names.length < 2) throw new Error(t('render.transitions.twoChords'))
        if (names.length > MAX_DIAGRAMS)
            throw new Error(t('render.transitions.maxChords', { max: MAX_DIAGRAMS }))
        const steps = smoothProgression(names.map(read), {
            ...options,
            ...(voicings ? { voicings } : {})
        })
        if (!steps.length) throw new Error(t('render.transitions.noVoicings'))
        return [
            ...(header.length ? [header.join('\n')] : []),
            ...steps.map((s, i) =>
                diagram(s.chord, names[i]!, s.voicing.frets, s.voicing.fingers, s.anchors, s.guides)
            )
        ]
    }
    const toText = fields.get('to')
    if (!toText) throw new Error(t('render.transitions.needsTo'))
    const held = heldChord(fromText!)
    const fromSymbol = read(held.written)
    const fromFrets = held.frets ?? generateVoicings(fromSymbol, options)[0]?.frets ?? null
    if (!fromFrets) throw new Error(t('render.transitions.noHeld', { chord: held.written }))
    if (fromFrets.length !== count) {
        throw new Error(
            t('render.transitions.stringCount', {
                frets: fretsText(fromFrets),
                have: fromFrets.length,
                count
            })
        )
    }
    const fromFingers = held.fingers ? parseFingers(held.fingers) : fingerVoicing(fromFrets)
    const howMany = Number(fields.get('count') ?? 3)
    if (!Number.isInteger(howMany) || howMany < 1 || howMany > MAX_DIAGRAMS - 1) {
        throw new Error(t('render.transitions.count', { max: MAX_DIAGRAMS - 1 }))
    }
    const steps = transition(fromFrets, read(toText), {
        ...options,
        ...(fromFingers ? { fromFingers } : {})
    }).slice(0, howMany)
    if (!steps.length) throw new Error(t('render.transitions.noTarget', { chord: toText }))
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

/** The message for a chord the library doesn't know, with what it might have meant. */
const unknownChord = (written: string): string =>
    t('render.unknownChord', { written, suggestions: suggestChords(written) })

/** Why no voicing fits, saying which filter to change. */
function noVoicing(written: string, symbol: string, options: VoicingOptions): string {
    const strings = options.strings
    const contiguous = strings
        ? [...strings].sort((a, b) => a - b).every((n, i, all) => i === 0 || n === all[i - 1]! + 1)
        : true
    if (strings && !contiguous && !options.gaps) {
        return t('render.noVoicing.gaps', { strings: strings.join(' ') })
    }
    if (strings && options.bassString !== undefined && !strings.includes(options.bassString)) {
        return t('render.noVoicing.rootString', {
            string: options.bassString,
            strings: strings.join(' ')
        })
    }
    const notes = chordNoteSet(symbol)?.members.filter((m) => m.interval !== null).length ?? 0
    if (typeof options.inversion === 'number' && options.inversion >= notes) {
        return t('render.noVoicing.inversion', { symbol, notes, max: notes - 1 })
    }
    if (options.bassString !== undefined) {
        return t('render.noVoicing.bass', { chord: written, string: options.bassString })
    }
    return t('render.noVoicing.none', { chord: written })
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
    if (!modes) throw new Error(t('render.modes.none', { value }))
    const shared = SHARED_KEYS[language]
    const others = [...block.fields].filter(([key]) => key !== 'modes')
    const refused = others.find(([key]) => key !== 'columns' && !shared.includes(key))
    if (refused || block.head) {
        throw new Error(
            t('render.modes.refused', {
                key: refused?.[0] ?? block.head ?? '',
                allowed: `${shared.join(', ')}, columns`
            })
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
        t('render.row.notShared', {
            key: others[0]!,
            allowed: `${shared.join(', ')}, columns`
        })
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
        throw new Error(t('render.row.columns', { text }))
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
        throw new Error(t('render.row.needsDiagram'))
    }
    if (header) checkShared(header)
    if (diagrams.length > MAX_DIAGRAMS) {
        throw new Error(t('render.row.max', { max: MAX_DIAGRAMS, found: diagrams.length }))
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
                throw new Error(t('render.row.columnsShared'))
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
                throw new Error(t('render.row.ownRow', { key: directive }))
            }
            if (block.fields.has('exercise') || shared.some(([key]) => key === 'exercise')) {
                throw new Error(t('render.row.exercise'))
            }
            // The diagram's own keys win over the shared ones.
            const fields = new Map([...shared, ...block.fields])
            cell.appendChild(DIAGRAMS[language](doc, { head: block.head, fields }, options))
        } catch (e) {
            let message = t('render.row.diagram', { n: i + 1, message: messageOf(e) })
            // A first part meant as shared settings but holding another key draws as a diagram.
            // (An exercise's own message says what to do.)
            if (
                i === 0 &&
                !header &&
                sharesSomething(language, part) &&
                !/^\s*exercise\s*:/im.test(part)
            ) {
                message += t('render.row.sharedHint', {
                    allowed: `${SHARED_KEYS[language].join(', ')}, columns`
                })
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
