/** English texts: render, fretboard, keyboard and circle. Keys `diagrams.<dir>.<name>`; placeholders `{name}`. */
export const enDiagrams = {
    // render/layout
    'render.layout.orientation': 'Unknown orientation "{text}": use vertical or horizontal',
    'render.layout.hand': 'Unknown hand "{text}": use left or right',
    // render/root-mark
    'render.rootMark.invalid': 'root-mark: write color or shape, got "{text}"',
    // render/render-block: shared
    'render.rootListsOnly':
        'root only applies to lists of notes on fretboards and keyboards (notes: C E G with root: C): a chord has its own root',
    'render.unknownChord': 'Didn\'t recognize "{written}": try {suggestions}',
    'render.tuning': 'Unknown tuning "{text}"',
    'render.yesNo': '{key} must be yes or no, got "{text}"',
    'render.hand.left': 'left hand',
    'render.hand.right': 'right hand',
    // render/render-block: positions
    'render.positions.exerciseOne':
        'exercise plays one position: write position: 1 (not positions:)',
    'render.positions.needsSet':
        'positions needs a scale or a chord: e.g. A minor pentatonic or arpeggio: Am7',
    'render.positions.arpeggioCaged': 'Arpeggios use CAGED shapes, not 3nps: leave shape out',
    'render.positions.range': 'positions: use all, or numbers from 1 to {count} for {title}',
    'render.positions.fromMinor': ' (from {root}m)',
    'render.positions.arpeggioTitle': '{title} arpeggio',
    'render.positions.shapeTitle': '{name}, {shape} shape',
    'render.positions.npsTitle': '{name}, 3nps {n}{from}',
    'render.positions.boxTitle': '{name}, box {n}{from}',
    // render/render-block: fingering and hands
    'render.fingering.handTitle': '{title}, {hand}',
    // render/render-block: voicings
    'render.voicings.notBoth': 'Use triads or voicings, not both',
    'render.voicings.fretted': 'voicings are for guitar and other fretted instruments',
    'render.voicings.noFrets': 'voicings finds the frets itself: remove "{value}"',
    'render.voicings.needsChord': 'voicings needs a chord: e.g. A Major',
    'render.voicings.instrument': 'Unknown instrument "{instrument}": use guitar, or give a tuning',
    'render.voicings.maxStrings': 'voicings works on up to {max} strings',
    'render.voicings.count': 'voicings: use all, or a number from 1 to {max}',
    'render.voicings.area': 'area: use open, or frets like 5-9 (up to 24), got "{area}"',
    'render.voicings.rootString':
        'root-string: use a string number from 1 (the highest) to {count}',
    'render.voicings.inversion': 'inversion: use 0 (root), 1, 2, 3 or any, got "{inversion}"',
    'render.voicings.manyStringsAny':
        'On {count} strings, inversion: any needs six strings or fewer: add e.g. strings: 1-6',
    'render.voicings.wideArea': 'a wide area',
    'render.voicings.oneWidening': 'On {count} strings, use one of {list} at a time',
    // render/render-block: no voicing
    'render.noVoicing.gaps': "strings {strings} aren't next to each other: add gaps: yes",
    'render.noVoicing.rootString': "root-string {string} isn't among strings {strings}",
    'render.noVoicing.inversion': '{symbol} has {notes} notes: inversion goes up to {max}',
    'render.noVoicing.bass':
        'No voicing of {chord} has its bass on string {string}: try another root-string',
    'render.noVoicing.none':
        'No playable voicing of {chord} fits: widen the area, allow open strings or add stretch: yes',
    // render/render-block: triads
    'render.triads.noFrets': 'triads finds the frets itself: remove "{value}"',
    'render.triads.fretted': 'triads are for guitar and other fretted instruments: give a tuning',
    'render.triads.strings': 'triads: give three strings next to each other, e.g. 1-3 or 2-4',
    'render.triads.inversion': 'inversion: use 0 (root position), 1, 2 or any, got "{inversion}"',
    'render.triads.keyInversion': 'With a key, pick one inversion: 0, 1 or 2',
    'render.triads.key': 'Unknown key "{text}": use e.g. key: G major or key: E minor',
    'render.triads.needsChord': 'triads needs a chord (e.g. G) or a key (key: G major)',
    'render.triads.notTriad': "{symbol} isn't a triad (three notes): try voicings: all",
    'render.triads.none': 'No triad fits on these strings: try another string set',
    // render/render-block: transitions
    'render.transitions.needsFrom':
        'Add the chord you hold: from: C (with its frets: from: C x32010)',
    'render.transitions.fretted':
        'Transitions are for guitar and other fretted instruments: give a tuning',
    'render.transitions.notBoth': 'Use from and to, or progression, not both',
    'render.transitions.refused': '"{key}" can\'t be used with {with}',
    'render.transitions.maxStrings': 'Transitions work on up to {max} strings',
    'render.transitions.twoChords': 'progression: give two chords or more, e.g. G D Em C',
    'render.transitions.maxChords': 'progression: at most {max} chords',
    'render.transitions.noVoicings': 'No playable voicings for this progression',
    'render.transitions.needsTo': 'Add the next chord: to: D',
    'render.transitions.noHeld': 'No playable voicing of {chord}: add its frets',
    'render.transitions.stringCount': '"{frets}" has {have} strings, the tuning {count}',
    'render.transitions.count': 'count: use a number from 1 to {max}',
    'render.transitions.noTarget': 'No playable voicing of {chord}',
    // render/render-block: modes
    'render.modes.none': '"{value}" has no modes: use e.g. modes: C major',
    'render.modes.refused': '"{key}" can\'t be used with modes: only {allowed}',
    // render/render-block: rows
    'render.row.notShared':
        '"{key}" can\'t be shared: move it to a diagram. Shared settings: {allowed}',
    'render.row.columns': 'columns must be a whole number from 1 to 12, got "{text}"',
    'render.row.needsDiagram':
        'Add a diagram after the shared settings: a "---" line, then the diagram',
    'render.row.max': 'At most {max} diagrams per block, found {found}',
    'render.row.columnsShared': '"columns" goes in the shared settings, before the first "---"',
    'render.row.ownRow': '"{key}" draws its own row: use it in a block of its own',
    'render.row.exercise': 'exercise draws a tab under one diagram: use it in a block of its own',
    'render.row.diagram': 'diagram {n}: {message}',
    'render.row.sharedHint': ' (shared settings before the first "---" may only hold: {allowed})',
    // fretboard/fretboard
    'fretboard.capo': 'Capo {fret}',
    'fretboard.title': 'Fretboard: {title}',
    'fretboard.note.open': '{note} open',
    'fretboard.note.fret': '{note} at fret {fret}',
    'fretboard.note.root': ' (root)',
    'fretboard.string': 'String {n} ({name}): {notes}.',
    'fretboard.pick.open': 'String {string}, open',
    'fretboard.pick.fret': 'String {string}, fret {fret}',
    // fretboard/exercise
    'fretboard.exercise.direction': 'exercise: use up, down or up-down, got "{text}"',
    'fretboard.exercise.rhythm': 'rhythm: use 8ths, triplets or 16ths, got "{text}"',
    'fretboard.exercise.scale': 'Unknown scale "{text}"',
    'fretboard.exercise.chord': 'Unknown chord "{text}"',
    'fretboard.exercise.needsSet':
        'An exercise needs a scale or an arpeggio: e.g. scale: A minor or arpeggio: Am7',
    'fretboard.exercise.arpeggioCaged':
        'Arpeggios use CAGED shapes: position 1 to 5, or shape: E, D, C, A or G (not 3nps)',
    'fretboard.exercise.positions':
        '{title} has {count} {system} positions: use position 1 to {count}',
    'fretboard.exercise.tuning': 'Unknown tuning "{text}"',
    'fretboard.exercise.capo': 'capo: use a fret from 1 to 12 (0 for none), got {text}',
    // fretboard/positions
    'fretboard.positions.numbering':
        'numbering: use minor (positions from the relative minor), got "{text}"',
    'fretboard.positions.numberingPentatonic':
        'numbering: minor is for major pentatonic positions (e.g. A major pentatonic), not {title}',
    'fretboard.positions.numberingCaged':
        'numbering: minor numbers boxes and 3nps positions, not CAGED shapes',
    'fretboard.positions.position': 'position must be a whole number from 1, got "{text}"',
    'fretboard.positions.shape': 'Unknown shape "{text}": use C, A, G, E, D or 3nps',
    // keyboard/scale-fingering
    'keyboard.fingering.finger':
        'fingering: fingers go from 1 (thumb) to 5 (little finger), got "{text}"',
    'keyboard.fingering.autoNeedsScale':
        'fingering: auto goes with a major or minor scale (scale: G major): write one finger per note, e.g. fingering: 1 2 3 4 5',
    'keyboard.fingering.autoUnknown':
        'fingering: auto knows the major, natural minor, harmonic minor and melodic minor scales: write the fingers for {scale}, root to root, e.g. fingering: 1 2 3 1 2 3 4 5',
    // keyboard/piano-chord
    'keyboard.piano.shell':
        'Shell voicings need a third and a seventh or sixth (C7, Cmaj7, Cm7, C6): {symbol} has none',
    'keyboard.piano.rootless':
        'Rootless voicings are for major, minor, dominant (sus4 too) and half-diminished seventh or sixth chords and major or minor triads (Cmaj7, Cm7, C7, C7sus4, Cm7b5, C6, C, Cm): not {symbol}',
    'keyboard.piano.octave': 'octave: use a number from 0 to 8, got "{text}"',
    'keyboard.piano.inversion': 'inversion: use 0 (root position), 1, 2 or 3, got "{text}"',
    'keyboard.piano.slashInversion': '{symbol} already says its bass: leave inversion out',
    'keyboard.piano.inversionStyle': 'inversion goes with close or open voicings, not {style}',
    'keyboard.piano.inversionMax': '{symbol} has {notes} notes: inversion goes up to {max}',
    'keyboard.piano.open': 'Open voicings need three notes or more: {symbol} has {notes}',
    'keyboard.piano.offKeys':
        "octave {octave} puts {symbol} off the piano's keys: try octave 3 or 4",
    'keyboard.piano.inversionWord':
        'inversion: use root, first, second, third (or 0 to 3), got "{text}"',
    'keyboard.piano.octaveMiddle':
        'octave: use a number from 0 to 8 (4 is middle C\'s), got "{text}"',
    'keyboard.piano.voicing':
        'voicing: use close, open, shell, shell R-7, rootless A or rootless B, got "{text}"',
    'keyboard.piano.key': 'Unknown key "{text}": use e.g. key: C minor or key: Eb',
    'keyboard.piano.resolvesTo': 'resolves-to: write a chord, e.g. resolves-to: Cm, got "{text}"',
    'keyboard.piano.hands': 'hands: use left+right, left or right, got "{text}"',
    // keyboard/keyboard
    'keyboard.title': 'Keyboard: {title}',
    'keyboard.hand': '{hand}: {keys}',
    'keyboard.handMark.left': 'LH',
    'keyboard.handMark.right': 'RH',
    'keyboard.whiteKey': 'White key {n}',
    'keyboard.blackKey': 'Black key {n}',
    'keyboard.lit.root': 'root',
    'keyboard.lit.finger': 'finger {finger}',
    'keyboard.lit.keys': 'Keys: {keys}.',
    // circle
    'circle.label': 'Circle of fifths, {key}: {signature}{accidentals}; chords: {chords}',
    'circle.or': 'or',
    'circle.mode.major': 'major',
    'circle.mode.minor': 'minor',
    'circle.mode.ionian': 'ionian',
    'circle.mode.dorian': 'dorian',
    'circle.mode.phrygian': 'phrygian',
    'circle.mode.lydian': 'lydian',
    'circle.mode.mixolydian': 'mixolydian',
    'circle.mode.aeolian': 'aeolian',
    'circle.mode.locrian': 'locrian',
    'circle.key': 'Unknown key "{text}": use e.g. key: G, key: Em or key: D dorian',
    'circle.mode':
        'Unknown mode "{text}": use major, minor, dorian, phrygian, lydian, mixolydian or locrian',
    'circle.modeTwice':
        "key: {key} already says {mode}: leave out mode or write the key's note alone",
    'circle.chords': 'chords: use triads or sevenths, got "{text}"',
    'circle.dominant':
        'dominant: use major (V, from the harmonic minor) or minor (v), got "{text}"',
    'keyboard.piano.unknownChord': 'Unknown chord "{symbol}"'
} as const
