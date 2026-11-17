/** English texts: the play bars, the copy and full screen controls, tabs and scores. */
export const enPlay = {
    // playback/block-bar.ts: the bar of a block's diagrams
    'playback.bar': 'Playback',
    'playback.diagram': 'Diagram',
    'playback.place': '({n} of {total})',
    'playback.playItem': 'Play {name}',
    'playback.playAll': 'Play all in turn',
    'playback.play': 'Play',
    'playback.stop': 'Stop',
    'playback.loop': 'Loop',
    'playback.countIn': 'Count-in',
    'playback.click': 'Click',
    'playback.sound': 'Sound',
    'playback.guitar': 'Guitar',
    'playback.guitar.steel': 'Guitar (steel)',
    'playback.guitar.nylon': 'Guitar (nylon)',
    'playback.guitar.clean': 'Guitar (clean)',
    'playback.guitar.overdrive': 'Guitar (overdrive)',
    'playback.piano': 'Piano',
    'playback.simplify': 'Simplify',
    'playback.simplified': 'Simplified',
    'playback.simplify.hint': 'Show easier chords',
    'playback.simplified.hint': 'Show the chords as written',
    'playback.tempo': 'Tempo (BPM)',
    'playback.unit.bpm': 'BPM',
    'playback.unit.ms': 'ms',
    'playback.strum': 'Strum (ms between strings)',
    'playback.dotted': 'counts dotted quarters',

    // playback/strum-bar.ts, picking-bar.ts, progression-bar.ts: the bars in time
    'playback.strumPattern.bar': 'Play the strumming pattern',
    'playback.picking.bar': 'Play the picking pattern',
    'playback.progression.bar': 'Play the chords in time',
    'playback.progression.play': 'Play in time',
    'playback.strumChoice': 'Strum',
    'playback.strum.beats': 'On the beats',
    'playback.strum.bar': 'Once a bar',
    'playback.strum.arpeggio': 'Arpeggio',
    'playback.strum.pattern': 'Pattern',

    // playback/copy-image.ts
    'playback.copy.button': 'Copy as image',
    'playback.copy.hint': 'Shift+click copies the whole block',
    'playback.copy.bar': 'Image',
    'playback.copy.copied': 'Copied',
    'playback.copy.refused': 'Allow clipboard access for this page, then try again.',
    'playback.copy.unsupported':
        "This browser can't copy images: use a recent Chrome, Edge, Safari or Firefox.",
    'playback.copy.failed': "The image couldn't be made.",

    // playback/full-screen.ts
    'playback.full.enter': 'Full screen',
    'playback.full.exit': 'Exit full screen',

    // playback/controls.ts: a diagram redrawn for the other instrument
    'playback.redraw.sounds': '{heading} (sounds {chord})',
    'playback.redraw.guitar': '{name}, drawn for guitar',
    'playback.redraw.piano': '{name}, drawn for piano',

    // playback/engine.ts, tab/index.ts: the `engine:` line
    'playback.engine.invalid': 'engine: use generaluser, sonivox or light, got "{value}"',
    'playback.guitar.invalid': 'guitar: use steel, nylon, clean or overdrive, got "{value}"',

    // tab/index.ts: the lines at the top of a tab or score block
    'tab.source.staves': 'staves: use tab, score or both, got "{value}"',
    'tab.source.layout': 'layout: use page or line, got "{value}"',
    'tab.source.names': 'names: use on or off, got "{value}"',
    'tab.source.tracks': 'tracks: use track numbers from 1, got "{value}"',
    'tab.source.empty': 'Write the music in alphaTex, or give a file: {example}',

    // tab/index.ts: messages
    'tab.sound.loadFailed': "Couldn't load the soundfont ({url})",
    'tab.error.at': 'line {line}, column {column}: ',
    'tab.error.textTab': "Couldn't draw this text tab: {message}",
    'tab.error.fileRead': 'Couldn\'t read "{file}": {message}',
    'tab.error.fileMissing': 'Couldn\'t find the file "{file}"',
    'tab.error.fileUnknown': 'Couldn\'t read "{file}": not a score file alphaTab knows',

    // tab/index.ts: the player bar
    'tab.player.cantPlay': "Can't play: {message}",
    'tab.player.metronome': 'Metronome',
    'tab.player.pause': 'Pause',
    'tab.names': 'Note names',
    'tab.follow': 'Follow the music',
    'tab.followPaused': 'Follow the music (paused while you scroll: Play or click to follow again)',

    // tab/index.ts: the view switch
    'tab.view.group': 'View',
    'tab.view.tab': 'Tab',
    'tab.view.score': 'Score',
    'tab.view.both': 'Both',
    'tab.view.whatTab': 'tablature',
    'tab.view.whatScore': 'standard notation',
    'tab.view.whatBoth': 'standard notation and tablature',
    'tab.view.drawAs': 'Draw as {what}',
    'tab.view.drawAsWritten': "Draw as {what} (this block's staves: line)",
    'tab.view.drawAsDefault': 'Draw as {what} (the default: the block has no staves: line)',
    'tab.view.keep': 'Keep this view',
    'tab.view.keepTitle': 'Write staves: {staves} at the top of the block',

    // tab/tempo.ts
    'tab.tempo.group': 'Tempo',
    'tab.tempo.slower': 'Slower',
    'tab.tempo.faster': 'Faster',
    'tab.tempo.toPercent': 'Show the speed in percent',
    'tab.tempo.toBpm': 'Show the speed in BPM',
    'tab.tempo.reset': 'Back to 100 %',
    'tab.tempo.inBpm': 'Tempo in BPM',
    'tab.tempo.inPercent': 'Speed in percent',
    'tab.tempo.title': 'Tempo: {bpm} BPM, {percent} % of {tempo} BPM',
    'tab.tempo.speedTitle': 'Speed: {percent} %'
} as const
