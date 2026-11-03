export {
    renderBlock,
    LANGUAGES,
    isNotationLanguage,
    MAX_DIAGRAMS,
    type RenderResult
} from './render/render-block.js'
export {
    parseOrientation,
    parseHand,
    layoutDefaults,
    type Orientation,
    type Hand,
    type LayoutDefaults
} from './render/layout.js'
export type { RenderOptions, NotationLanguage } from './blocks/renderers.js'
export { STYLES, injectStyles } from './styles.js'
export {
    renderGuitarDiagram,
    parseFrets,
    parseFingers,
    baseFretOf,
    STANDARD_TUNING,
    capoCaption,
    type FrettedVoicing,
    type GuitarDiagramOptions
} from './chord/guitar.js'
export {
    soundingChord,
    soundsLike,
    fretsFromCapo,
    capoTuning,
    parseCapo,
    parseFretsFrom,
    MAX_CAPO,
    type FretsFrom
} from './chord/capo.js'
export {
    generateVoicings,
    fingerVoicing,
    voicingShape,
    MAX_GENERATED_STRINGS,
    type GeneratedVoicing,
    type VoicingOptions,
    type VoicingShape
} from './chord/generate.js'
export {
    sequenceOf,
    lengthOf,
    lightPlayer,
    pluckedString,
    pianoTone,
    DEFAULT_SEQUENCE,
    type NoteEvent,
    type NotePlayer,
    type PlayHandle,
    type PlayKind,
    type Sound,
    type SequenceOptions
} from './playback/player.js'
export { attachPlayback, type PlayOptions } from './playback/controls.js'
export {
    followNotes,
    noteTargets,
    PLAYING_CLASS,
    START_WAIT,
    type Follower
} from './playback/follow.js'
export {
    transition,
    smoothProgression,
    type TransitionStep,
    type TransitionOptions,
    type ProgressionStep,
    type ProgressionOptions
} from './chord/transitions.js'
export {
    triadVoicings,
    keyTriads,
    parseKey,
    inversionName,
    type Triad,
    type TriadOptions,
    type KeyTriad
} from './chord/triads.js'
export {
    renderKeyboard,
    parseKeyRange,
    keyRangeOf,
    type KeyboardOptions
} from './keyboard/keyboard.js'
export {
    pianoVoicing,
    pianoPitches,
    triadFingering,
    type PianoVoicing,
    type PianoVoicingOptions,
    type PianoVoicingStyle,
    type PianoHands,
    type RootlessForm,
    type ShellForm
} from './keyboard/piano-chord.js'
export { renderFretboard, type FretboardOptions } from './fretboard/fretboard.js'
export { parseTuning } from './fretboard/tuning.js'
export {
    parseChordPro,
    parseLyrics,
    type Song,
    type Section,
    type Line,
    type Segment,
    type ChordDefinition
} from './chords/chordpro.js'
export { renderChart, type ChartOptions } from './chords/chart.js'
export { chordsUsed } from './chords/chart-diagrams.js'
export { parseDefinition } from './chords/defines.js'
export { parseChord, type ParsedChord } from './theory/chord-symbol.js'
export {
    chromaOf,
    midiOf,
    nameOf,
    noteOf,
    isFlat,
    SHARP_NAMES,
    FLAT_NAMES
} from './theory/pitch.js'
export { transposeChord, transposeKey, keyPrefersFlats, keyMove } from './theory/transpose.js'
export type { KeyMove } from './theory/transpose.js'
export {
    chordNoteSet,
    scaleNoteSet,
    listNoteSet,
    memberOf,
    labelOf,
    intervalLabel,
    type NoteSet,
    type NoteSetMember,
    type NoteLabel
} from './theory/note-set.js'
export type { VoicingLookup } from './voicings/index.js'
export { parseChordName, readChord, suggestChords } from './theory/chord-name.js'
export {
    detectChordFromFrets,
    detectChordFromPitches,
    type DetectedChord
} from './theory/detect.js'
export {
    scaleName,
    modesOf,
    scaleTypes,
    characteristicIntervals,
    isScaleWithoutRoot
} from './theory/scales.js'
export {
    scalePosition,
    neckPositions,
    isArpeggio,
    positionCount,
    CAGED_SHAPES,
    MAX_FRET,
    type Cell,
    type Numbering,
    type PositionOptions,
    type PositionSystem
} from './fretboard/positions.js'
export {
    blockFromProperties,
    instrumentOf,
    DEFAULT_PROPERTY_NAMES,
    type PropertyNames,
    type Instrument
} from './blocks/properties.js'
export { textTabToAlphaTex } from './convert/text-tab.js'
export { chordSheetToChordPro } from './convert/chord-sheet.js'
export {
    parseStrum,
    formatStrum,
    countOf,
    parseTime,
    parseSubdivision,
    MAX_STRUM_BARS,
    type StrumPattern,
    type StrumSlot,
    type Stroke,
    type Subdivision
} from './strum/pattern.js'
export { renderStrum, type StrumOptions } from './strum/render.js'
export { strumVoicing, DEFAULT_STRUM_CHORD } from './strum/voicing.js'
export {
    playStrum,
    strumEvents,
    scoreOf,
    STRUM_VELOCITY,
    type PlayStrumOptions,
    type StrumEventOptions,
    type StrumScore
} from './strum/play.js'
export {
    findScales,
    findKey,
    inKey,
    scalesForChord,
    chordsInScale,
    type ScaleMatch,
    type FindScalesOptions,
    type KeyCandidate,
    type FoundKey,
    type ScaleChord
} from './theory/find.js'
export {
    readKey,
    keyNotes,
    keySignature,
    keyChords,
    parentMajor,
    signatureText,
    keyProblem,
    MAX_SIGNATURE,
    MODES,
    type Mode,
    type MusicalKey,
    type KeySignature,
    type KeyChord
} from './theory/keys.js'
export {
    progressionChords,
    progressionChord,
    readNumeral,
    numeralOf,
    harmonicFunction,
    type ProgressionChord,
    type HarmonicFunction
} from './theory/numerals.js'
export {
    voiceLead,
    voiceLeadVoicings,
    voiceMotion,
    type VoiceLeadOptions,
    type LedVoicing
} from './keyboard/voice-leading.js'
export { renderCircle, type CircleOptions } from './circle/circle.js'
