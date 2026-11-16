/**
 * English texts: strumming and picking patterns, image export. Keys `<dir>.<topic>.<name>`;
 * placeholders `{name}`. Block syntax (keys, values, what to write) stays as written here.
 */
export const enTimed = {
    // --- strum/pattern.ts: reading a pattern -------------------------------------------------
    'strum.time.invalid': 'Invalid time "{text}": use e.g. time: 4/4, 3/4 or 6/8',
    'strum.swing.invalid':
        'Invalid swing "{text}": write swing: yes (a triplet swing, a shuffle), no, or a percentage from 50 (straight) to 75, e.g. swing: 60%',
    'strum.subdivision.invalid': 'Invalid subdivision "{text}": use 8ths, 16ths or triplets',
    'strum.triplets.quarterBeat68':
        'Triplets need a quarter-note beat (time: 4/4, 3/4…); for a 6/8 feel use time: 6/8 with 8ths',
    'strum.triplets.quarterBeat':
        'Triplets need a quarter-note beat (time: 4/4, 3/4…); for this time use 8ths or 16ths',
    'strum.subdivision.tooLong': '8ths are longer than a beat of x/{unit}: use subdivision: 16ths',
    'strum.chord.notRecognizedTry': 'Didn\'t recognize the chord "{chord}": try {suggestions}',
    'strum.chord.empty': 'Empty chord "[]": write the chord inside, e.g. [G]',
    'strum.chord.notRecognized': 'Didn\'t recognize the chord "{chord}"',
    'strum.line.bracketMissing': 'Missing "]" after "{text}": write e.g. [G]',
    'strum.line.barInGhost': 'A bar line inside ( ): close the ghost strums first',
    'strum.line.accentAndGhost': 'A strum is either accented (D>) or a ghost strum ((D)), not both',
    'strum.line.ghostNested': "Ghost strums can't be nested: write (U), not ((U))",
    'strum.line.parenUnopened': '")" without "(": write a ghost strum as (U)',
    'strum.help':
        'write D or ↓ (down), U or ↑ (up), X (muted), - (no strum), > after a strum for an accent, (U) for a ghost strum, [G] for a chord change',
    'strum.line.notUnderstood': 'Didn\'t understand "{char}" in "{line}": {help}',
    'strum.line.accentNeedsStrum': 'An accent needs a strum: write D> or U>',
    'strum.line.ghostNoRests': 'Write ghost strums as (D) or (U), without rests inside',
    'strum.line.parenUnclosed': 'Missing ")" in "{line}": write a ghost strum as (U)',
    'strum.line.chordEndsPattern':
        'The chord [{chord}] ends the pattern: put it before a strum or a -',
    'strum.pattern.chordLineAlone':
        'A chord line needs a pattern line under it, e.g. D - D U - U D U',
    'strum.pattern.missing': 'Write a strumming pattern, e.g. D - D U - U D U (or D DU UDU)',
    'strum.key.unknown':
        'Unknown key "{key}": use time, subdivision, swing, chord, tempo, tuning, title or pattern',
    'strum.swing.withTriplets':
        'Triplets and swing are two ways to write a shuffle: keep subdivision: triplets (D - U on each beat), or write 8ths with swing: yes',
    'strum.swing.compound':
        '{time} already has three {unit} a beat: remove swing: (it swings 8ths or 16ths in 4/4, 3/4, 2/4…)',
    'strum.swing.oneSlot':
        'Swing plays pairs of slots inside a beat, and a beat of {time} in {subdivision} has one slot: write subdivision: 16ths, or time: 4/4',
    'strum.tempo.invalid':
        'Invalid tempo "{text}": use beats a minute from {min} to {max}, e.g. tempo: 90',
    'strum.bars.tooMany': 'At most {max} bars in one pattern: split it into several blocks',
    'strum.chord.pastEnd':
        'The chord {chord} is past the end of its pattern line: move it over a strum',
    // How many bars and slots a line takes ("1 bar and 2 slots").
    'strum.count.bar.one': '{n} bar',
    'strum.count.bar.other': '{n} bars',
    'strum.count.slot.one': '{n} slot',
    'strum.count.slot.other': '{n} slots',
    'strum.count.barsAndSlots': '{bars} and {slots}',
    'strum.count.spill':
        '{time} in {subdivision} has {perBar} slots a bar, but "{written}" takes {slots} ({count}): put a | where each bar ends{orTime}',
    'strum.count.spillOrTime': ', or write {time}',
    'strum.count.mismatch':
        '{time} in {subdivision} has {perBar} slots a bar, but "{written}" has {n}: fill each bar with - (no strum){alternatives}',
    // The alternatives after it: " or write time: 3/4", ", subdivision: 16ths", " or subdivision: 16ths".
    'strum.count.alternative.first': ' or write {item}',
    'strum.count.alternative.next': ', {item}',
    'strum.count.alternative.last': ' or {item}',
    'strum.note.one':
        'Read as {read}, then {n} beat with no strum: write a symbol for every slot (- for no strum) to place the strums yourself.',
    'strum.note.other':
        'Read as {read}, then {n} beats with no strum: write a symbol for every slot (- for no strum) to place the strums yourself.',

    // --- strum/render.ts, strum/play.ts --------------------------------------------------------
    'strum.feel.swing': 'Swing',
    'strum.feel.swingPercent': 'Swing {percent}%',
    'strum.feel.swing16': '16th swing',
    'strum.feel.swing16Percent': '16th swing {percent}%',
    'strum.name': 'Strumming pattern {written}, {time}, {subdivision}{feel}',
    'strum.name.titled': '{title}: strumming pattern {written}, {time}, {subdivision}{feel}',
    'strum.name.feel': ', {feel}',
    'strum.tuning.unknown':
        'Unknown tuning "{tuning}": use e.g. tuning: standard, drop d, ukulele or E2 A2 D3 G3 B3 E4',
    'strum.tuning.tooManyStrings': 'At most 12 strings',
    'strum.tuning.unknownGiven': 'Unknown tuning "{tuning}"',

    // --- picking/pattern.ts, render.ts, voicing.ts ------------------------------------------
    'picking.help':
        "write p (the thumb on the bass), p' (the alternate bass), i, m, a (strings 3, 2, 1), a string number from 1 (the highest), - for a rest, + between notes picked together (p+a)",
    'picking.token.notUnderstood': 'Didn\'t understand "{token}": {help}',
    'picking.string.missing':
        "String {n} doesn't exist: strings go from 1 (the highest) to {strings}",
    'picking.bar.slots':
        'A bar of {time} in {subdivision} has {perBar} slots, found {found}{between}: add notes or rests (-) so each bar has {perBar}, or change time:',
    'picking.bar.betweenBarLines': ' between bar lines',
    'picking.key.unknown':
        'Unknown key "{key}": use time, subdivision, swing, chord, chords, tempo, tuning, title or pattern',
    'picking.swing.pairs':
        'Swing plays pairs of 8ths or 16ths inside a beat: remove swing:, or write time: 4/4 with 8ths',
    'picking.tempo.invalid':
        'Invalid tempo "{text}": use beats a minute from {min} to {max}, e.g. tempo: 80',
    'picking.pattern.twice': 'Write the pattern once: as pattern: or as pattern lines, not both',
    'picking.pattern.missing':
        'Write a pattern: a line such as p i m a p i m a, or pattern: travis, alternate bass or 1-2-3-4',
    'picking.chords.tooMany': 'At most {max} chords, found {found}',
    'picking.tuning.unknown':
        'Unknown tuning "{tuning}": use e.g. tuning: standard, drop d, open g or E2 A2 D3 G3 B3 E4',
    'picking.name': 'Picking pattern {written}, {time}, {subdivision}{over}',
    'picking.name.titled': '{title}: picking pattern {written}, {time}, {subdivision}{over}',
    'picking.name.over': ', over {chords}',
    'picking.voicing.none': 'No playable voicing of {chord} for this tuning',

    // --- export/image.ts -------------------------------------------------------------------------
    'export.image.title': 'Music notation'
} as const
