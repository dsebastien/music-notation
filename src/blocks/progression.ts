/**
 * The `progression` block (#9): roman numerals ("I V vi IV"), Nashville numbers ("1 5 6m 4") or
 * chord names ("G D Em C") in a key, drawn as the chords with their numerals, optionally their
 * function, and a guitar or piano diagram for each. `---` starts a section in another key.
 */
import { captionsOf } from './captions.js'
import { shown } from '../theory/naming.js'
import { html } from '../render/dom.js'
import { splitParts, type BlockSource } from './block-source.js'
import type { DiagramRenderer, RenderOptions } from './renderers.js'
import { smoothProgression } from '../chord/transitions.js'
import type { VoicingLookup } from '../voicings/index.js'
import { parseTuning } from '../fretboard/tuning.js'
import { pianoOptionsOf, pianoPitches, type PianoVoicingOptions } from '../keyboard/piano-chord.js'
import { voiceLead, voiceLeadVoicings, type LedVoicing } from '../keyboard/voice-leading.js'
import { chordNoteSet } from '../theory/note-set.js'
import { chromaOf, noteOf } from '../theory/pitch.js'
import { findKey } from '../theory/find.js'
import {
    isMinorMode,
    keyNotes,
    keyProblem,
    raisedNashville,
    readKey,
    type MusicalKey
} from '../theory/keys.js'
import {
    isBluesIn,
    numeralOf,
    progressionChord,
    progressionTokens,
    withTonicizations,
    type NumeralOptions,
    type ProgressionChord
} from '../theory/numerals.js'
import { transposeChord, transposeKey } from '../theory/transpose.js'
import {
    HARMONIZE_KINDS,
    harmonize,
    readHarmonyScale,
    type HarmonizeKind,
    type HarmonyScale
} from '../theory/harmonize.js'
import { Note } from 'tonal'
import { STANDARD_TUNING } from '../chord/guitar.js'
import { PROGRESSION_STRUMS, progressionPitches } from '../playback/progression.js'
import { MAX_TEMPO, MIN_TEMPO, parseStrum, parseTime } from '../strum/pattern.js'

/** More chords than this in one block is an error, so a page stays quick to draw. */
const MAX_CHORDS = 32

/** A row of piano chords shares one keyboard range when it spans at most this many octaves. */
const MAX_SHARED_OCTAVES = 3

/** Keys the first part may share with every section. */
const SHARED = [
    'key',
    'transpose',
    'functions',
    'numerals',
    'instrument',
    'diagrams',
    'voice-leading',
    'voicing',
    'octave',
    'hands',
    'tuning',
    'orientation',
    'hand',
    'labels',
    'title',
    'time',
    'tempo',
    'bpm',
    'strum',
    'harmonize',
    'caption'
]

/** Words `harmonize:` takes for each kind (#43). */
const KIND_WORDS: Record<string, HarmonizeKind> = {
    'triad': 'triads',
    'triads': 'triads',
    'seventh': 'sevenths',
    'sevenths': 'sevenths',
    '7th': 'sevenths',
    '7ths': 'sevenths',
    '7': 'sevenths',
    'sus': 'sus',
    'power': 'power',
    '5': 'power'
}

/** Chords drawn by a harmonized section: always one per degree at most. */
const HARMONIZED_CHORDS = 7

const yes = (text: string | undefined, key: string, fallback: boolean): boolean => {
    if (text === undefined || text === '') return fallback
    const value = text.trim().toLowerCase()
    if (['yes', 'true', 'on'].includes(value)) return true
    if (['no', 'false', 'off'].includes(value)) return false
    throw new Error(`${key} must be yes or no, got "${text}"`)
}

const field = (block: BlockSource, name: string) => {
    const value = block.fields.get(name)?.trim()
    return value === '' ? undefined : value
}

/** A key for numerals: major or minor (ionian and aeolian read as such). */
function keyOf(text: string): MusicalKey {
    const key = readKey(text)
    const mode =
        key?.mode === 'ionian' ? 'major' : key?.mode === 'aeolian' ? 'minor' : (key?.mode ?? null)
    if (key && mode !== 'major' && mode !== 'minor') {
        throw new Error(
            `Progression keys are major or minor: write key: ${key.tonic} major or key: ${key.tonic} minor, got "${text}"`
        )
    }
    if (!key || (mode !== 'major' && mode !== 'minor')) {
        throw new Error(`Unknown key "${text}": use e.g. key: G, key: Em or key: F# minor`)
    }
    const read: MusicalKey = { tonic: key.tonic, mode, name: `${key.tonic} ${mode}` }
    const problem = keyProblem(read)
    if (problem) throw new Error(problem)
    return read
}

/** "G major" moved by semitones, spelled the usual way (Db, not C#); a found mode keeps its mode
 * (D dorian up 2 is E dorian). */
function transposed(key: MusicalKey, semitones: number): MusicalKey {
    if (!semitones) return key
    const minor = isMinorMode(key.mode)
    const moved = keyOf(transposeKey(`${key.tonic}${minor ? 'm' : ''}`, semitones))
    if (key.mode === 'major' || key.mode === 'minor') return moved
    return { tonic: moved.tonic, mode: key.mode, name: `${moved.tonic} ${key.mode}` }
}

const unread = (token: string) =>
    new Error(
        `Didn't read "${token}": write roman numerals (I V vi IV, bVII, V7, V/V, I6, V65), Nashville numbers (1 5 6m 4) or chords (G D Em C)`
    )

const isNashville = (token: string) => /^[b#♭♯]?[1-7]/.test(token)

interface Section {
    key: MusicalKey
    /** Found from the chords: the other likely keys, when it isn't clear. */
    others: string[]
    chords: ProgressionChord[]
    /** A dominant-seventh blues on the key's tonic: I7 and IV7 are the key's own chords. */
    blues: boolean
    block: BlockSource
    /** The key line's name when it isn't the key's (a harmonized scale: "A harmonic minor"). */
    name?: string
    /** A line under the key: degrees a harmonized scale leaves out. */
    note?: string
}

const FIELD = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/

/**
 * A section's source: `key: value` lines, and the chords on the lines that aren't (before, after
 * or between the keys; several lines are one progression, in order).
 */
function sourceOf(part: string): BlockSource {
    const fields = new Map<string, string>()
    const lines: string[] = []
    for (const raw of part.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line) continue
        const m = FIELD.exec(line)
        if (m) fields.set(m[1]!.toLowerCase(), m[2]!.trim())
        else lines.push(line)
    }
    return { head: lines.length ? lines.join(' ') : null, fields }
}

/** A section's chords as written. */
const chordsText = (block: BlockSource): string | undefined =>
    block.head ?? field(block, 'progression') ?? field(block, 'chords')

/**
 * A harmonized section (#43): the chords of the scale in `key:`, any 7-note scale, as numerals of
 * the key the scale is written in, transposed.
 */
function harmonizedSectionOf(block: BlockSource, kindText: string): Section {
    const kind = KIND_WORDS[kindText.toLowerCase()]
    if (!kind || !HARMONIZE_KINDS.includes(kind)) {
        throw new Error(`harmonize: write triads, sevenths, sus or power, got "${kindText}"`)
    }
    const written = chordsText(block)
    if (written) {
        throw new Error(
            `harmonize draws the chords of the scale: leave out the chords (${written})`
        )
    }
    const keyText = field(block, 'key')
    if (!keyText) throw new Error('Add the scale: e.g. key: A harmonic minor')
    const shift = Number(field(block, 'transpose') ?? 0)
    if (!Number.isInteger(shift)) {
        throw new Error(`transpose must be a whole number of semitones, e.g. transpose: -2`)
    }
    let scale = readHarmonyScale(keyText)
    if ('error' in scale) throw new Error(scale.error)
    if (shift) {
        // The tonic moves as its major or minor key would (usual spelling), the scale type stays.
        const { tonic, mode } = scale.key
        const moved = transposeKey(`${tonic}${isMinorMode(mode) ? 'm' : ''}`, shift).replace(
            /m$/,
            ''
        )
        const type = scale.name.slice(tonic.length).trim()
        // A mode can need another spelling than its major or minor key gives (Eb locrian needs 8
        // flats, D# locrian 5 sharps): of the two spellings that read, the one with fewer
        // accidentals.
        const spellings = [...new Set([moved, Note.enharmonic(moved)])].map((t) =>
            readHarmonyScale(`${t} ${type}`)
        )
        const valid = spellings.filter((sp): sp is HarmonyScale => !('error' in sp))
        const accidentals = (sp: HarmonyScale) => sp.notes.join('').replace(/[^#b]/g, '').length
        const best = valid.sort((a, b) => accidentals(a) - accidentals(b))[0]
        if (!best) throw new Error((spellings[0] as { error: string }).error)
        scale = best
    }
    const harmonized = harmonize(scale.name, { kind })!
    const chords: ProgressionChord[] = harmonized.chords.map((c) => ({
        written: c.numeral,
        symbol: c.symbol,
        numeral: c.numeral,
        nashville: c.nashville,
        function: c.function
    }))
    const left = harmonized.skipped.map((s) => `degree ${s.degree} (${s.note}), ${s.reason}`)
    return {
        key: harmonized.key,
        others: [],
        chords,
        blues: false,
        block,
        name: harmonized.name,
        ...(left.length ? { note: `Left out: ${left.join('; ')}` } : {})
    }
}

/**
 * The kind a section is harmonized with (#43): undefined when it isn't (no key, or `harmonize:
 * none`, which cancels a shared one). An empty `harmonize:` says what to write.
 */
function harmonizeText(block: BlockSource): string | undefined {
    if (!block.fields.has('harmonize')) return undefined
    const text = field(block, 'harmonize')
    if (text === undefined) {
        throw new Error('harmonize: write triads, sevenths, sus or power, got nothing')
    }
    return text.toLowerCase() === 'none' ? undefined : text
}

/** One section's chords in its key, transposed. */
function sectionOf(block: BlockSource): Section {
    const kindText = harmonizeText(block)
    if (kindText) return harmonizedSectionOf(block, kindText)
    const text = chordsText(block)
    if (!text) {
        throw new Error('Add the chords: e.g. I V vi IV with key: G, 1 5 6m 4, or G D Em C')
    }
    const tokens = progressionTokens(text)
    const shift = Number(field(block, 'transpose') ?? 0)
    if (!Number.isInteger(shift)) {
        throw new Error(`transpose must be a whole number of semitones, e.g. transpose: -2`)
    }
    const keyText = field(block, 'key')
    const names = tokens.every((t) => /^[A-G]/.test(t))
    let key: MusicalKey
    let others: string[] = []
    if (keyText) key = keyOf(keyText)
    else if (names) {
        // Chord names without a key: the likeliest key names their numerals.
        const found = findKey(tokens)
        if (!found) throw unread(tokens.find((t) => !chordNoteSet(t)) ?? text)
        // A mode the chords play in (Dm C G: D dorian) names their numerals from its tonic.
        key = found.modal ?? { tonic: found.tonic, mode: found.mode, name: found.name }
        if (!found.clear) others = found.candidates.slice(1, 3).map((c) => c.name)
    } else throw new Error('Add the key: e.g. key: G or key: E minor')
    const to = transposed(key, shift)
    // Chord names move by the interval between the keys, so they keep their letters in it.
    const move = { from: key.tonic, to: to.tonic }
    const read = (options: NumeralOptions) =>
        tokens.map((token) => {
            // Numerals follow the key; chord names move with it.
            const chord = /^[A-G]/.test(token)
                ? progressionChord(shift ? transposeChord(token, shift, move) : token, to, options)
                : progressionChord(token, to, options)
            if (!chord) throw unread(token)
            return chord
        })
    let chords = read({})
    // A blues on the key's tonic (A7 D7 E7 in A): I7 and IV7, as blues players read them.
    const blues = isBluesIn(
        chords.map((c) => c.symbol),
        to
    )
    // Else local ii-V-I moves read from each chord and the next (Ebm7 Ab7 Dbmaj7: ii-V-I in Db).
    chords = blues ? read({ blues }) : withTonicizations(chords, to)
    others = blues ? [] : others.map((name) => (shift ? transposed(keyOf(name), shift).name : name))
    return { key: to, others, chords, blues, block }
}

/**
 * One keyboard range for a row of piano chords (whole octaves around all their keys, as one
 * chord's keyboard would be), so every keyboard has the same width: "C4-B5". Null when a chord
 * doesn't voice, or the row would span more than MAX_SHARED_OCTAVES (each chord keeps its own).
 */
function sharedRange(pitches: (number[] | null)[]): string | null {
    if (!pitches.length || pitches.some((p) => !p?.length)) return null
    const all = pitches.flat() as number[]
    const low = Math.min(...all)
    const high = Math.max(...all)
    const from = low - (((low % 12) + 12) % 12)
    const to = high + 11 - (((high % 12) + 12) % 12)
    if ((to - from + 1) / 12 > MAX_SHARED_OCTAVES) return null
    return `${noteOf(from)}-${noteOf(to)}`
}

/**
 * Open voicings span more than an octave: without an `octave`, each chord's lowest note goes
 * within F3 to E4 (octave 3 for roots F to B, 4 for C to E), so a progression doesn't climb (Am7
 * is A3 E4 G4 C5, not A4 to C6). Undefined when the octave is the block's.
 */
function openOctave(symbol: string, options: PianoVoicingOptions): number | undefined {
    if (options.voicing !== 'open' || options.octave !== undefined) return undefined
    const root = chordNoteSet(symbol)?.root
    return root === undefined || root === null ? undefined : root >= 5 ? 3 : 4
}

/** Each chord's piano keys as its diagram will draw them; null for one that doesn't voice. */
function pianoKeysOf(
    symbols: string[],
    options: PianoVoicingOptions,
    key: readonly number[]
): (number[] | null)[] {
    return symbols.map((symbol, i) => {
        try {
            const next = symbols[i + 1]
            const octave = openOctave(symbol, options)
            return pianoPitches(symbol, {
                ...options,
                key,
                ...(next ? { resolvesTo: next } : {}),
                ...(octave !== undefined ? { octave } : {})
            }).pitches
        } catch {
            return null
        }
    })
}

/** Guitar voicings that make the section easiest to play, or null when one can't be found. */
function guitarVoicings(
    symbols: string[],
    tuningText: string | undefined,
    voicings: VoicingLookup | undefined
) {
    const tuning = tuningText ? parseTuning(tuningText) : null
    if (tuningText && !tuning) throw new Error(`Unknown tuning "${tuningText}"`)
    const steps = smoothProgression(symbols, {
        ...(tuning ? { tuning } : {}),
        ...(voicings ? { voicings } : {})
    })
    return steps.length === symbols.length ? steps : null
}

const fretsText = (list: readonly (number | null)[]) =>
    list.some((f) => f !== null && f > 9)
        ? list.map((f) => (f === null ? 'x' : f)).join('-')
        : list.map((f) => (f === null ? 'x' : f)).join('')

/** A diagram's block: its chord, frets or pitches, and the block's layout keys. */
function diagramBlock(block: BlockSource, lines: [string, string][]): BlockSource {
    const fields = new Map<string, string>(lines)
    // `caption: fingering` (#80): each diagram's fingering in words, in the voicing drawn.
    for (const key of ['orientation', 'hand', 'labels', 'tuning', 'caption']) {
        const value = field(block, key)
        if (value !== undefined) fields.set(key, value)
    }
    return { head: null, fields }
}

/** A chord's notes for the play bar, as MIDI numbers; null when it has none. */
function soundOf(
    symbol: string,
    piano: boolean,
    tuningText: string | undefined,
    options: RenderOptions
): string | null {
    try {
        const tuning = (tuningText ? parseTuning(tuningText) : null) ?? STANDARD_TUNING
        const pitches = progressionPitches(
            symbol,
            piano ? 'piano' : 'guitar',
            tuning,
            options.voicings
        )
        return pitches.length ? pitches.join(' ') : null
    } catch {
        return null
    }
}

/**
 * The play bar's settings (#46): `time:` (4/4 by default), `tempo:` or `bpm:` (20–240, counted
 * beats a minute), `strum:` (beats, bar, arpeggio, or a strumming pattern). Throws a message.
 */
function playSettingsOf(fields: Map<string, string>): [string, string][] {
    const get = (key: string) => {
        const value = fields.get(key)?.trim()
        return value ? value : undefined
    }
    const settings: [string, string][] = []
    const time = get('time')
    if (time) {
        const { beatsPerBar, beatUnit } = parseTime(time)
        settings.push(['data-mn-time', `${beatsPerBar}/${beatUnit}`])
    }
    const tempoText = get('tempo') ?? get('bpm')
    if (tempoText) {
        const tempo = Number(tempoText)
        if (!Number.isFinite(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO)
            throw new Error(
                `tempo: write beats a minute from ${MIN_TEMPO} to ${MAX_TEMPO}, got "${tempoText}"`
            )
        settings.push(['data-mn-tempo', String(Math.round(tempo))])
    }
    const strum = get('strum')
    if (strum) {
        const plain = strum.toLowerCase()
        if (!(PROGRESSION_STRUMS as readonly string[]).includes(plain)) {
            try {
                parseStrum(`${time ? `time: ${time}\n` : ''}${strum}`)
            } catch (e) {
                throw new Error(
                    `strum: write beats, bar, arpeggio or a strumming pattern (D DU UDU): ${e instanceof Error ? e.message : String(e)}`,
                    { cause: e }
                )
            }
        }
        settings.push([
            'data-mn-strum',
            PROGRESSION_STRUMS.includes(plain as never) ? plain : strum
        ])
    }
    return settings
}

function renderSection(
    doc: Document,
    section: Section,
    options: RenderOptions,
    renderChord: DiagramRenderer
): HTMLElement {
    const { block, chords } = section
    const el = html(doc, 'div', 'mn-progression-section')
    // The key, so numerals can be read (and a found key checked).
    const others = section.others.length ? ` (or ${section.others.join(', ')})` : ''
    const blues = section.blues ? ' (blues)' : ''
    el.appendChild(
        html(
            doc,
            'div',
            'mn-progression-key',
            shown(`Key: ${section.name ?? section.key.name}${blues}${others}`)
        )
    )
    if (section.note) el.appendChild(html(doc, 'div', 'mn-progression-note', shown(section.note)))
    const instrument = (field(block, 'instrument') ?? options.instrument ?? 'guitar').toLowerCase()
    if (!['guitar', 'piano', 'keyboard'].includes(instrument)) {
        throw new Error(`Unknown instrument "${instrument}": use guitar or piano`)
    }
    const piano = instrument !== 'guitar'
    const diagrams = yes(field(block, 'diagrams'), 'diagrams', true)
    // Checked once for the block (each diagram would say it again).
    captionsOf(block)
    const functions = yes(field(block, 'functions'), 'functions', false)
    const leading = field(block, 'voice-leading')
    const led = yes(leading, 'voice-leading', false)
    const style = (
        field(block, 'numerals') ??
        (chords.every((c) => isNashville(c.written)) ? 'nashville' : 'roman')
    ).toLowerCase()
    if (!['roman', 'nashville', 'none'].includes(style)) {
        throw new Error(`numerals: use roman, nashville or none, got "${style}"`)
    }
    if (led && !piano) throw new Error('voice-leading is for piano: add instrument: piano')
    // Piano voicings (#16) for every chord: a style, an octave, hands.
    const pianoKeys = (['voicing', 'octave', 'hands'] as const).filter((k) => field(block, k))
    if (pianoKeys.length && !piano) {
        throw new Error(`${pianoKeys[0]} is for piano chords: add instrument: piano`)
    }
    // A value that can't be read is the block's mistake, not each chord's.
    const pianoOptions = pianoKeys.length ? pianoOptionsOf((key) => field(block, key)) : {}
    // Rootless voicings take the key's 9ths and 13ths (G7 in C minor: Ab and Eb).
    const keyChromas = keyNotes(section.key).map((n) => chromaOf(n)!)
    // Shell and rootless voicings move least from chord to chord unless voice-leading: no (#63):
    // the forms alternate (rootless A and B, shells R-3 and R-7) around middle C.
    const styled =
        pianoOptions.voicing === 'shell' || pianoOptions.voicing === 'rootless'
            ? pianoOptions.voicing
            : null
    const ledStyled = styled !== null && (leading === undefined || led)
    // Close and open voicings lead too; with both hands, a left-hand bass goes under each chord.
    const open = pianoOptions.voicing === 'open'
    const bass = pianoOptions.hands === 'left+right'
    if (led && !styled) {
        // Every voicing style leads: only an octave, or one hand alone, doesn't go with it.
        const other = pianoKeys.find((k) => k !== 'voicing' && !(k === 'hands' && bass))
        if (other) {
            throw new Error(
                other === 'hands'
                    ? 'voice-leading goes with hands: left+right (a left-hand bass under each chord), not left or right alone'
                    : `Use voice-leading or ${other}, not both`
            )
        }
    }
    const symbols = chords.map((c) => c.symbol)
    const guitar =
        diagrams && !piano
            ? guitarVoicings(symbols, field(block, 'tuning'), options.voicings)
            : null
    const pitches = diagrams && piano && led && !styled ? voiceLead(symbols, { open, bass }) : null
    const voiced: (LedVoicing | null)[] | null =
        diagrams && piano && ledStyled
            ? voiceLeadVoicings(symbols, {
                  voicing: styled,
                  ...((pianoOptions.rootless ?? pianoOptions.shell)
                      ? { form: (pianoOptions.rootless ?? pianoOptions.shell)! }
                      : {}),
                  ...(pianoOptions.octave !== undefined ? { octave: pianoOptions.octave } : {}),
                  ...(pianoOptions.hands ? { hands: pianoOptions.hands } : {}),
                  key: keyChromas
              })
            : null
    // Piano keyboards of a row share one range, so they have the same width.
    const range =
        diagrams && piano
            ? sharedRange(
                  pitches ??
                      voiced?.map((v) => v?.pitches ?? null) ??
                      pianoKeysOf(symbols, pianoOptions, keyChromas)
              )
            : null
    const row = html(doc, 'div', 'mn-row mn-progression-chords')
    chords.forEach((chord, i) => {
        const cell = html(doc, 'div', 'mn-cell mn-progression-chord')
        cell.setAttribute('data-mn-chord', chord.symbol)
        const numeral =
            style === 'none'
                ? null
                : style === 'nashville'
                  ? isNashville(chord.written)
                      ? raisedNashville(chord.written)
                      : chord.nashville
                  : isNashville(chord.written)
                    ? numeralOf(chord.symbol, section.key, 'roman', { blues: section.blues })!
                    : chord.numeral
        if (numeral) cell.appendChild(html(doc, 'div', 'mn-progression-numeral', numeral))
        if (diagrams) {
            try {
                const lines: [string, string][] = [
                    ['symbol', chord.symbol],
                    ['title', chord.symbol]
                ]
                if (piano) {
                    lines.push(['instrument', 'piano'])
                    // Rootless voicings in the key, a dominant knowing where it goes.
                    lines.push(['key', section.key.name])
                    const next = chords[i + 1]?.symbol
                    if (next) lines.push(['resolves-to', next])
                    const led = voiced?.[i]?.options
                    if (led) {
                        // The form and octave voice leading chose, as the chord block reads them.
                        const form = led.rootless ?? led.shell
                        lines.push(['voicing', `${led.voicing} ${form}`])
                        lines.push(['octave', String(led.octave)])
                        if (led.hands) lines.push(['hands', led.hands])
                    } else if (!pitches) {
                        // Voice-led keys (below) are the keys to play: the block's voicing
                        // (close, the only one voice-leading allows) isn't passed on with them.
                        for (const key of pianoKeys) lines.push([key, field(block, key)!])
                        const octave = openOctave(chord.symbol, pianoOptions)
                        if (octave !== undefined) lines.push(['octave', String(octave)])
                    }
                    if (range) lines.push(['range', range])
                    const midi = pitches?.[i]
                    if (midi) {
                        const set = chordNoteSet(chord.symbol)
                        // Each pitch with the chord's own spelling (Bb, not A#).
                        const spelled = midi.map((m) => {
                            const name = set?.members.find((x) => x.chroma === m % 12)?.name
                            return name ? `${name}${Math.floor(m / 12) - 1}` : noteOf(m)
                        })
                        lines.push(['pitches', spelled.join(' ')])
                        // The bass in the left hand, the voice-led chord in the right.
                        if (bass) lines.push(['hands', 'left+right'])
                    }
                } else if (guitar) {
                    lines.push(['frets', fretsText(guitar[i]!.voicing.frets)])
                    lines.push([
                        'fingers',
                        guitar[i]!.voicing.fingers.map((f) => f ?? 'x').join('')
                    ])
                }
                cell.appendChild(renderChord(doc, diagramBlock(block, lines), options))
            } catch (e) {
                cell.appendChild(html(doc, 'div', 'mn-progression-name', shown(chord.symbol)))
                cell.appendChild(
                    html(doc, 'div', 'mn-error-message', e instanceof Error ? e.message : String(e))
                )
            }
        } else cell.appendChild(html(doc, 'div', 'mn-progression-name', shown(chord.symbol)))
        if (functions) {
            cell.appendChild(html(doc, 'div', 'mn-progression-function', chord.function))
        }
        // What the block's play bar sounds for this chord (#46): the diagram's notes, else the
        // strum's guitar voicing (a piano voicing on piano).
        const drawn = cell.querySelector('svg[data-mn-pitches]')?.getAttribute('data-mn-pitches')
        const voicing = drawn ?? soundOf(chord.symbol, piano, field(block, 'tuning'), options)
        if (voicing) cell.setAttribute('data-mn-voicing', voicing)
        cell.setAttribute('data-mn-sound', piano ? 'piano' : 'guitar')
        row.appendChild(cell)
    })
    el.appendChild(row)
    return el
}

/**
 * The `progression` block. Diagrams are drawn by the chord block's renderer, passed in (so this
 * module doesn't import the registry that lists it).
 */
export function renderProgression(
    doc: Document,
    source: string,
    options: RenderOptions,
    renderChord: DiagramRenderer
): Element {
    const parts = splitParts(source) ?? [source]
    const blocks = parts.map(sourceOf)
    // A first part with no chords and only shared keys holds the settings of every section. With
    // `harmonize:` and a `key:` it is a harmonized section of its own (#43): the chords it draws
    // are its scale's, and its harmonize doesn't reach the sections after it.
    const first = blocks[0]
    const harmonizedFirst =
        first !== undefined && first.fields.has('harmonize') && field(first, 'key') !== undefined
    const sharedOnly =
        blocks.length > 1 &&
        first !== undefined &&
        first.head === null &&
        !harmonizedFirst &&
        !first.fields.has('progression') &&
        !first.fields.has('chords') &&
        [...first.fields.keys()].every((k) => SHARED.includes(k))
    const shared = sharedOnly ? first.fields : new Map<string, string>()
    const own = sharedOnly ? blocks.slice(1) : blocks
    if (!own.length) throw new Error('Add the chords after the shared settings, after a "---" line')
    const merged = own.map((b) => ({ head: b.head, fields: new Map([...shared, ...b.fields]) }))
    // Counted before any chord is read: finding the key of hundreds of chords takes a while.
    const count = merged.reduce(
        (n, b) =>
            n +
            (harmonizeText(b) ? HARMONIZED_CHORDS : progressionTokens(chordsText(b) ?? '').length),
        0
    )
    if (count > MAX_CHORDS)
        throw new Error(`At most ${MAX_CHORDS} chords per block, found ${count}`)
    const sections = merged.map(sectionOf)
    const el = html(doc, 'div', 'mn-progression')
    // Played in time from its bar (#46): one chord a bar, every section in turn.
    el.setAttribute('data-mn-progression-play', '')
    for (const [name, value] of playSettingsOf(merged[0]!.fields)) el.setAttribute(name, value)
    // One title for the block (shared, or a single section's); else each section's own.
    const blockTitle =
        shared.get('title') ?? (own.length === 1 ? field(own[0]!, 'title') : undefined)
    if (blockTitle) el.appendChild(html(doc, 'div', 'mn-progression-title', blockTitle))
    sections.forEach((section, i) => {
        const title = blockTitle === undefined ? field(own[i]!, 'title') : undefined
        if (title) el.appendChild(html(doc, 'div', 'mn-progression-section-title', title))
        el.appendChild(renderSection(doc, section, options, renderChord))
    })
    el.querySelectorAll('.mn-progression-chord').forEach((cell, i) =>
        cell.setAttribute('data-mn-bar', String(i))
    )
    // The first section's instrument sounds the bar.
    const sound = el.querySelector('.mn-progression-chord')?.getAttribute('data-mn-sound')
    el.setAttribute('data-mn-sound', sound === 'piano' ? 'piano' : 'guitar')
    return el
}
