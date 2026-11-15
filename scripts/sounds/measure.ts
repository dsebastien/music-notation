/**
 * The loudness of a soundfont's preset (#108, #119): a fixed phrase rendered by alphaTab's own
 * synthesizer (its audio export, no audio device), then its RMS and peak in dBFS. The same code
 * plays the tabs, so the number is what a reader hears.
 */
import * as alphaTab from '@coderline/alphatab'

const B = String.fromCharCode(92)

/** Single notes low to high, then a chord: what a diagram or a riff sends. */
const PHRASE = ':4 C3 G3 C4 E4 | G4 C5 E5 G5 | (C3 G3 C4 E4).1'

const emitter = () => ({ on() {}, off() {}, trigger() {} })
/** An audio output that plays nothing: the export doesn't use it. */
const silent = {
    sampleRate: 44100,
    open() {},
    play() {},
    destroy() {},
    pause() {},
    addSamples() {},
    resetSamples() {},
    activate() {},
    ready: emitter(),
    samplesPlayed: emitter(),
    sampleRequest: emitter(),
    enumerateOutputDevices: () => Promise.resolve([]),
    setOutputDevice: () => Promise.resolve(),
    getOutputDevice: () => Promise.resolve(null)
}

const midiOf = (program: number, phrase: string): alphaTab.midi.MidiFile => {
    const tex = `${B}tempo 100\n${B}instrument ${program}\n.\n${phrase}`
    const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex)
    const midi = new alphaTab.midi.MidiFile()
    new alphaTab.midi.MidiFileGenerator(
        score,
        new alphaTab.Settings(),
        new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)
    ).generate()
    return midi
}

export interface Loudness {
    /** dBFS; -Infinity when nothing sounded. */
    rms: number
    peak: number
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** One long note, as a phrase: the MIDI note `midi` (60 is C4). */
export const noteOf = (midi: number): string => `:1 ${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

/** A phrase (the test phrase by default) on `program`, played with `soundFont` at full volume. */
export function loudness(soundFont: Uint8Array, program: number, phrase = PHRASE): Loudness {
    return loudnessOfMidi(soundFont, midiOf(program, phrase))
}

/** Two bars of kick, hi-hat and snare on the percussion channel: what a drum kit is heard on. */
export function drumPattern(): alphaTab.midi.MidiFile {
    const midi = new alphaTab.midi.MidiFile()
    const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)
    handler.addTempo(0, 100)
    // The percussion channel takes the drum kit only once told.
    handler.addProgramChange(0, 0, 9, 0)
    const eighth = midi.division / 2
    const keys = [36, 42, 38, 42, 36, 42, 38, 42]
    for (let i = 0; i < 16; i++) handler.addNote(0, i * eighth, eighth, keys[i % 8]!, 100, 9)
    return midi
}

/** Eight metronome clicks (key 33 of the percussion channel). */
export function clickPattern(): alphaTab.midi.MidiFile {
    const midi = new alphaTab.midi.MidiFile()
    const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true)
    handler.addTempo(0, 100)
    handler.addProgramChange(0, 0, 9, 0)
    for (let i = 0; i < 8; i++) handler.addNote(0, i * midi.division, midi.division / 2, 33, 100, 9)
    return midi
}

/** A song played with `soundFont` at full volume: its RMS and peak. */
export function loudnessOfMidi(soundFont: Uint8Array, midi: alphaTab.midi.MidiFile): Loudness {
    const synth = new alphaTab.synth.AlphaSynth(
        silent as unknown as ConstructorParameters<typeof alphaTab.synth.AlphaSynth>[0],
        500
    )
    const options = new alphaTab.synth.AudioExportOptions()
    options.sampleRate = 44100
    options.masterVolume = 1
    options.metronomeVolume = 0
    options.soundFonts = [soundFont]
    const exporter = synth.exportAudio(options, midi, [], new Map())
    let sum = 0
    let n = 0
    let peak = 0
    for (;;) {
        const chunk = exporter.render(500)
        if (!chunk) break
        for (const v of chunk.samples) {
            sum += v * v
            n++
            const a = Math.abs(v)
            if (a > peak) peak = a
        }
        if (chunk.currentTime >= chunk.endTime) break
    }
    return { rms: 10 * Math.log10(sum / Math.max(1, n)), peak: 20 * Math.log10(peak) }
}
