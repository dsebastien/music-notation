# Changelog

## 0.9.0 (2026-11-03)

- **Diagrams that sound like an instrument**: guitar chords strum 12 ms a string, and piano chords sound together. Before, guitar chords strummed 40 ms a string. Each note has its own loudness (the top note of a piano chord, the bass of a guitar chord, the tonics of a scale). Notes fade out after their end instead of stopping dead, and the light synthesizer varies each note a little. Stop fades out in about 10 ms (#59).
- **Strums that sound like a player**: down strums are louder than up strums, and the beats are stressed, beat 1 the most. Accents, ghost strums and muted strums each have their own level. Each strum varies a little, and differently on each pass of a loop. Muted strums sound as a short chuck (a muted guitar in the soundfont). The count-in is a click, with its downbeat higher than the other beats (#59).
- **Swing and shuffle in strumming patterns**: `swing: yes` plays the second 8th of each beat on the third triplet, the way swing and blues are played. `swing: 60%` sets a lighter swing (50 is straight, 75 the most). With `subdivision: 16ths`, the 16ths swing in pairs. The grid says "Swing", "Swing 60%" or "16th swing", and the pattern plays and lights up with the swing. Swing doesn't work with 6/8 or with triplets, and the block says so. In triplets, a pattern written as strums only, without `-` for the empty slots, is a shuffle: down on the beat, up on the third triplet (#65).
- **Strumming in 6/8, 9/8 and 12/8 counts the beat you tap**: the tempo now counts dotted quarters, 60 by default (three 8ths a beat, so 180 8ths a minute). Before, it counted 8ths: a `tempo:` you already wrote now plays three times as fast. The count that starts each dotted beat is bold, and strums on it are stressed (1 and 4 in 6/8; 1, 4 and 7 in 9/8; 1, 4, 7 and 10 in 12/8). The count-in clicks each 8th: 1 is the strongest, then the other dotted beats. 3/8 still counts 8ths (#65).
- **Strums that don't fit a bar say so**: strums written without bar lines that run past a bar and fill less than half of the next one are now a mistake. A pattern that drew before can now show a message instead. The message says how many slots a bar has and asks for a `|` where each bar ends, or names the time that fits (`D DU UDU` in 3/4 is a 4/4 pattern) (#65).
- **Tab blocks draw every part**: every part now draws right away. Before, a tab or score block drew nothing when the window wasn't on screen while it loaded: another desktop, a background tab, a PDF export (Music Practice #82). Tab blocks also no longer show alphaTab's default "f" and its credit line.
- **Tab view control**: when a track has tablature, the tab player bar has Tab, Score and Both. A click redraws the score without stopping playback. Apps can offer **Keep this view**, which writes the view in the block (Music Practice #83).
- **Text tabs keep their rhythm and techniques**: the text tab converter reads note lengths from the spacing, so Smoke on the Water comes out as written. It finds the meter from the typical bar (3/4, 6/8, 12/8, else 4/4), joins bars split across rows, and turns pickups into a pickup bar. Bends, releases, hammer-ons, pull-offs, slides, vibrato, dead notes, natural harmonics and palm-mute lines become effects. A one-string tab now draws on a six-string guitar (#66, #70).
- **Scales play from their tonic**: a scale, mode, arpeggio or list with a root plays from its lowest tonic up to the highest note drawn, down to the lowest, and back to the tonic. Every note drawn still plays. A note list with exact keys (`notes: C4 E4 G4`) plays in the order written, then back (#61).
- **Keyboard scales from tonic to tonic**: a keyboard that draws a scale or mode without `range:` now shows two octaves from the tonic: C major C4 to C6, D dorian D4 to D6, A minor pentatonic A3 to A5. Before, every scale was drawn on C4 to B5. Each part of a `modes:` row starts on its own tonic. A `range:` you wrote is kept.
- **A keyboard chord plays one voicing**: a keyboard that lights a chord in every octave (`chord: G7`) now plays one voicing, struck together, and lights only its keys: G7 is G4 B4 D5 F5. Before, it played every key it lit. A fingered keyboard chord plays its fingered keys (#61).
- **Keyboard arpeggios**: `arpeggio: Am7` on a keyboard draws the chord's notes over two octaves from the root (A3 to A5).
- **Automatic scale fingering**: `fingering: auto` on a keyboard scale gives the standard method-book fingering of every major, natural minor, harmonic minor and melodic minor scale. `fingering: auto left` gives the left hand's, an octave lower. Without a range, fingers go on both octaves. A fingering you write for one octave continues its pattern on the second (Bb major `2 1 2 3 1 2 3 4` puts 4 on the middle Bb).
- **More chords fingered automatically**: `fingering: auto` now fingers seventh and sixth chords and their inversions (four notes 1 2 3 5, or 1 2 4 5 with a second on top). It also fingers chords with the third in the bass with both hands (D/F#: 5, then 1 3 5), and rootless and shell voicings.
- **Piano voice leading, closer to a pianist's**: each voice moves to its own note of the next chord, as little as it can, and a tie goes to the voicing with more common tones. Shell and rootless voicings in a progression switch forms on their own (rootless A and B, shells R-3 and the new `shell R-7`), unless you write `voice-leading: no`. Rootless voicings start in octave 3. Half-diminished chords get them now, and so do dominant sus chords (G7sus4 B: F A C D). A shell or rootless voicing that would sound muddy low on the piano takes its other form. `voice-leading: yes` now works with `hands: left+right` (the root in the left hand, the chords led in the right) and with `voicing: open`.
- **Rootless voicings in a key**: `key: C minor` takes a dominant's 9th and 13th, and a half-diminished chord's 9th, from the key: G7 in C minor is F Ab B Eb. `resolves-to: Cm` says where a dominant goes. When it goes to a minor chord a fifth below, it takes the b13. A progression sets both for you. A major or minor triad in a rootless progression is its 6/9 chord (C: E G A D), so the I of `ii7 V7 I` gets a rootless voicing too.
- **Both hands, fixed**: with `hands: left+right`, shells now lead the right hand by step in a minor ii-V-i too. A minor iiø7 V7 i7 is B2 + D4 A4, E2 + D4 G#4, A2 + C4 G4. Before, the right hand jumped to G#4 D5. A bass line written with slash chords keeps its steps: C G/B Am C/G F is C3 B2 A2 G2 F2. Before, C/G jumped up to G3. A triad with both hands keeps its whole root-position triad in the right hand (C/E: E3 + C4 E4 G4).
- **Piano chords, clearer**: an inverted chord is titled with its slash name (C/E). Before, it read "(1st inversion)". The hands are marked by one bracket each, LH and RH. Before, an L or R sat under each key. The right hand doesn't double a bass that is the third or the seventh (D/F#: F#3 + D4 A4); a triad with both hands is the exception above. A piano chord switched to the guitar sound becomes a guitar grip you can play, with its bass for inversions.
- **Functions in progressions**: `functions: yes` names more of what chords do. bII is a neapolitan chord. A diminished chord a half step below a chord of the key is a secondary dominant (F#dim7 in C: vii°7/V). A local ii-V-I to a chord outside the key is a tonicization (Blue Bossa: Ebm7 Ab7 Dbmaj7 reads ii7/bII V7/bII bIImaj7). The ii before a secondary dominant is part of it too: Gm7 C7 F in C reads ii7/IV V7/IV IV. Before, Gm7 was a borrowed v7. A diminished chord that goes down a half step is a passing chord: in C/E Ebdim7 Dm7, Ebdim7 reads biii°7, passing. Before, it read vii°7/iii. In a minor key, VII is a dominant (VII to i is the aeolian cadence). VI stays a subdominant, and so does a mode's own bVII.
- **Numerals read more**: figured bass after a numeral is an inversion (`I6` is C/E, `I64` C/G, `V65` G7/B, `N6` Db/F), and `Iadd6` is C6. Nashville numbers raise every extension (2-⁷, 1maj⁷, 5⁷sus⁴), typed or worked out from chord names.
- **Keys and scales found better**: a progression of chord names can be in a mode: `Dm C G` is "Key: D dorian", i bVII IV. A dominant-seventh blues reads I7 IV7 V7, with "(blues)" on the key line. Secondary dominants and turnarounds count for the key (All of Me reads C major). `scales-for-notes:` gives exact pentatonics (`scales-for-notes: C D E G A` is C major pentatonic). A blues gets the blues scale, the minor pentatonic and the mixolydian. A list of notes takes its first note as the tonic.
- **Circle of fifths in minor**: a minor key now marks the harmonic minor's V (V7 with sevenths), as cadences play it. Before, it marked v. `dominant: minor` marks v instead (#68).
- **Transposing a chart without a key**: `{transpose}` in a ChordPro chart without `{key}` now moves every chord the same way, from the key its chords give (#68).
- **Chord names follow their spelling**: chords named from notes follow how the notes are written (Db F B Eb is Db9). A symbol over pitches spells them (`Cdim7` labels its A as Bbb).
- **Guitar voicings checked**: every chord the voicing database hands out is checked against its chord. Wrong ones are fixed (B is x24442, Cmaj7 x32000) or left out. The shapes teachers use come first (Cmaj7 x32000, Dm7 xx0211, A9 x02423, the Hendrix grip for 7#9). Generated voicings have no unison and no pinky barre, and lower positions come first (Bb x13331 before 688766). Dim7 voicings may have any chord note lowest. The pinky may still barre the two highest strings in 6/9 grips (E6/9 022122).
- **Guitar diagrams, clearer**: a barre shows its finger number once, and keeps its bar on a full barre with note or interval labels. Muted strings are a bolder x. Shapes are named "C shape" to "D shape". Inlays that a note dot would partly cover are left out. Both E strings show the same notes in CAGED scale positions. Double sharps and flats on guitar dots are written as the plain note (F## is G). Every dot, open string and note has a click area centered on it, so a click plays the note you aimed at (#67, #69).
- **Diagrams and screen readers**: every diagram is named for screen readers without an `aria-label` on the SVG. Before, hovering a diagram in Obsidian threw an error in the console.
- A press on a diagram's playback bar no longer opens the block in the editor.
- `check --describe` lists each barre of a chord diagram.
- For apps: the app's `bpm` counts quarter notes in every meter, and a pattern without `tempo:` keeps that speed in the beat it counts (90 is 60 dotted quarters in 6/8). The `strum` play option is the guitar's (piano chords stay a block); `strum: { guitar, piano }` sets each. `NoteEvent.kind` (`muted`, `click`) for percussive notes. `HarmonicFunction` has `neapolitan`, `tonicization` and `passing`. Tabs: `TabOptions.views`, `onKeepView`, `defaultStaves`, and `TabSource.stavesWritten`. New exports: `scaleRun`, `DEFAULT_STRUM`, `PluckOptions`, `standardScaleFingering`, `scaleFingers`, `ScaleHand`, `parseSwing`, `isCompound`, `STRUM_STRESS`, `strumVelocity`, `tempoOf`, `bluesTonic`, `BLUES_SCALES`, `isBluesIn`, `withTonicizations`, `NumeralOptions` (`byDegree`), `voiceLeadVoicings`, `voiceMotion`, `VoiceLeadOptions`, `LedVoicing`, `ShellForm`, `isBarreVoicing`, `barreKind`. `SequenceOptions.root`. `voicingShape` takes its `fingers` argument again (ignored). `detectChordFromPitches(midis, names?)` follows the names given.

## 0.8.0 (2026-11-03)

- **Follow the notes**: while a chord, keyboard or fretboard plays, each note lights up on the drawing when you hear it: the dot, the key or the string's mark. A strummed chord lights its strings from the low one up, and a clicked note lights only what you clicked. Stop or a new sound turns every light off (#41).
- In `tab` and `score` blocks, a line now follows the beat while the music plays, and the notes that sound light up in the player bar's accent color. Before, neither showed: alphaTab ships no style for its cursor and highlight.
- **Strumming patterns**: a new `strum` block draws a pattern on a beat grid, with the counts, an arrow for each strum, accents (`D>`), muted strums (`X`), ghost strums (`(U)`) and chord changes (`[G]`). Write it the way you find it on the web: `D - D U - U D U`, `D DU UDU`, `DDUUDU` and `↓ ↓↑ ↑↓↑` all work, in 4/4, 3/4, 6/8 or 12/8, with 8ths, 16ths or triplets. A chord line above the pattern works too (#8).
- **Hear the strumming**: with playback on, a bar under the pattern plays it over its chords, with loop, a count-in, tempo (20–240 BPM) and volume. Down strums go from the low string up, up strums from the high strings down; accents are louder, ghost strums soft and muted strums short. The slot that plays is lit (#22).
- **Which scale fits**: `scales-for: G D Em C` on a keyboard or a fretboard draws the scale that fits a song's chords (G major here), and `scales-for-notes:` does the same for a list of notes. The title names the scale, and any notes outside it (#42).
- **A chord over a scale**: give both `scale:` and `chord:` and the scale stays drawn, with the chord's notes solid and the other notes hollow: the notes to aim for when you solo over that chord. With `position:` or `positions:`, you get the scale's positions with the chord tones marked (#48).
- **Progressions**: a new `progression` block writes a progression once and shows its chords in any key, each with its numeral and a diagram. It reads roman numerals (`I V vi IV`, `ii7 V7 Imaj7`, `bVII`, `V/V`, `I/3`), Nashville numbers (`1 5 6m 4`) and chord names, and finds the key when you don't give one. `functions: yes` names each chord's function, `transpose:` moves the key, and `---` starts a section in a new key. Guitar diagrams use the voicings that make the whole progression easiest; piano chords are in root position, or follow `voice-leading: yes` or a piano voicing (#9).
- **Circle of fifths**: a new `circle` block draws the 12 major keys, their relative minors and the diminished chords, with each key signature. The chosen key's chords are tinted, with their numerals, in any mode, as triads or sevenths. With playback on, a click plays a key or a chord, and the play button plays the key's scale (#44).
- **Capo**: `capo: 2` on a `chord` or `fretboard` block draws a capo bar and a "Capo 2" caption. Frets count from the capo, the way players read them, so an A shape is still `x02220`; `frets-from: nut` counts them from the nut and draws the real neck. Root marks, note labels and playback use the notes that sound, and `sounds: yes` adds the sounding chord to the caption ("Capo 2, sounds B") (#6).
- **Arpeggios**: `arpeggio: Am7` draws a chord's notes on a fretboard, labeled with intervals. `position:`, `shape:` and `positions: all` draw its CAGED shapes, one at a time or up the neck, with the same rules as scale positions (#20).
- **Piano voicings**: piano chords from a symbol take `inversion` (C in `first` inversion is E4 G4 C5), `octave`, `voicing` (`close`, `open`, `shell`, `rootless A`, `rootless B`), `hands: left+right` (the bass in the left hand, with an L or R under each key) and `fingering: auto`. A `chord` row can share them (#16).
- **Chord diagrams in ChordPro charts**: `{diagrams}` draws every chord the chart uses as a row above the song, in the order they first appear (`{diagrams: bottom}` puts it under). The row is off by default, so existing charts don't change. `{define}` gives a chord's shape in ChordPro 6 syntax (`base-fret`, `frets`, `fingers`, `keys`, `copy`), `{chord: Am}` draws one chord where it is written, and `{instrument: piano}` draws piano diagrams. With `{capo}`, guitar diagrams show the shapes you play and piano diagrams the chords that sound, titled "G (sounds A)". A `{define}` or `{chord}` with a mistake shows a message at the top of the chart, and `check` reports it (#10).
- **More text tabs**: the text tab converter reads drum tabs (`HH|x-x-x-x-|`) as a drum track, strings numbered `1|` to `6|`, one named string or a few, text after the last bar line (`| let ring`, `|x2`) as a note on the last beat, and systems with no blank line between them. Before, numbered strings were read as notes, a tab with only `e B G D` came out an octave too low, drum tabs and single lines weren't read, and text after the last bar line dropped its whole string (#37).
- Transposed chords are spelled for the new key. A ChordPro chart with `{key: G}` moved down a half step now gives F# B C#, and D/F# becomes C#/E#. Before, it gave Gb B Db. Charts without a key are unchanged.
- In `tab` blocks, each staff gets what suits it: tablature for guitars and basses, notation for drums, in alphaTex and in Guitar Pro files. Before, a drum track drew nothing in a `tab` block. Drum staves get the percussion clef; before, drums written in alphaTex without a clef got a treble clef.
- Chord symbols take double sharps and double flats on roots and basses: `F##dim` (or `Fxdim`), `Ebb`.
- Obsidian Publish: `strum`, `progression` and `circle` are new block languages. Add them to the language list in your `publish.js` (see the guide's Publish page), or those blocks stay code.
- For apps: `followNotes`, `noteTargets`, `PLAYING_CLASS` and `START_WAIT` light notes for your own players. A `NotePlayer` gets `onStart` in its play options (call it when the notes really start sounding) and can set `reportsStart: true` so the bar waits for it; a `NoteEvent` can carry a `velocity` (1–127). Strumming: `parseStrum`, `formatStrum`, `renderStrum`, `playStrum`, `strumEvents`, `scoreOf`, `strumVoicing`. Harmony: `findScales`, `findKey`, `inKey`, `scalesForChord`, `chordsInScale`, `readKey`, `keyNotes`, `keySignature`, `keyChords`, `parentMajor`, `keyProblem`, `progressionChords`, `readNumeral`, `numeralOf`, `harmonicFunction`, `voiceLead`, `renderCircle`. Capo: `soundingChord`, `soundsLike`, `fretsFromCapo`, `capoTuning`, `parseCapo`, `parseFretsFrom`, `capoCaption`, `MAX_CAPO`, and the `capo`, `fretsFrom`, `sounds` and `caption` options of `renderGuitarDiagram` and `renderFretboard`. Piano: `pianoVoicing`, `pianoPitches`, `triadFingering`, and `hands` on `renderKeyboard`. Arpeggios: `isArpeggio`. ChordPro: the `chartDiagrams` render option, `renderChart`'s `diagrams` and `instrument` options, `chordsUsed`, `parseDefinition`. `transposeChord` takes `keyMove(key, semitones)` as its third argument to spell chords for the new key.

## 0.7.0 (2026-11-03)

- **The other instrument, drawn**: the play bar's sound menu now redraws the diagram for the instrument you choose, with the same notes. If something is playing, it stops first. A guitar chord or a fretboard becomes a keyboard with those exact keys, and a keyboard becomes a fretboard. The title, the root and the note, degree or interval labels come along. Choose the diagram's own instrument to get its drawing back. A click on a note plays it on either drawing.
- **Piano through the soundfont**: the soundfont player now plays piano, not only guitar. Before, in apps that use it (Music Practice does), keyboards and piano chords played nothing, and choosing Piano on a fretboard changed nothing.
- A scale on a fretboard or a keyboard now plays every note drawn, from the lowest to the highest and back down, with the top note once. Before, it played only from its lowest root to its highest one, so the dots outside the roots stayed silent: A minor pentatonic box 1 dropped its top C5, and boxes 2 to 4 played 6 of their 12 dots.
- **Fingering on note lists**: `fingering:` works on keyboard note lists, one finger per note in the order written, so you can draw five-finger and hand positions. `notes: C D E F G` with `fingering: 1 2 3 4 5` puts fingers 1 to 5 on C4 to G4, and `labels:` works as for scales. Before, the line was ignored (#55).
- `root:` in a `chord` block is now an error that says it only applies to note lists on fretboards and keyboards. Before, it did nothing (#56).
- Five notes or more that only move by steps within an octave are no longer named as a chord: `C4 D4 E4 F4 G4` is a hand position, not Dm11/C, and gets no root marks. Chords with a step in them keep their names, from Cadd9 and Csus2 to four-note jazz clusters such as Cmaj9/B (#57).
- For apps: `sequenceOf` no longer takes a root, and diagrams no longer carry `data-mn-root`.

## 0.6.0 (2026-11-03)

- **A root for note lists**: `root: C` gives a list of notes (`notes: C Eb Gb A`) a root, on fretboards and keyboards. `labels: intervals` and `labels: degrees` then count from it, and the root gets the root color when it is in the list. It doesn't have to be (#33).
- **Positions in neck order**: `positions: all` draws a scale's positions up the neck, each one at or above the one before. A minor pentatonic's boxes 4 and 5 now sit at frets 12–15 and 14–17, not 0–3 and 2–5. A list of positions (`positions: 1 3`) keeps those frets (#34).
- **One position where you want it**: a single `position:` with `frets:` is drawn inside those frets, so `position: 4` with `frets: 10-17` is box 4 at frets 12–15. When no octave of it fits, the block says so (#34).
- **Numbering from the relative minor**: `numbering: minor` counts a major pentatonic's positions from its relative minor, as many courses do. A major pentatonic's position 1 is then box 1 of F# minor pentatonic, and the titles add "(from F#m)" (#34).
- **Check your notes**: `npx @dsebastien/music-notation check notes/` (or `bunx`) draws every notation block of your Markdown files and lists the mistakes, one per line. It exits with 0 when every block draws, 1 when a block has a mistake, and 2 when the command itself is wrong. `--describe` prints what each block draws, and `--json` prints the same as JSON. Like Obsidian, it ignores blocks in comments and in indented code, and it counts empty blocks apart, not as mistakes (#35).
- For apps and tools: diagrams carry data attributes that describe what they draw (`data-mn-string`, `data-mn-fret`, `data-mn-note`, `data-mn-chord`, `data-mn-set`, `data-mn-frets`, `data-mn-key`).

## 0.5.3 (2026-11-03)

- Chord symbols written the way chord sheets on the web write them now work: alterations in parentheses (`C7(b9)`, `C7(b5,#9)`, and `C(#5)` for C augmented) and spellings like `Cmaj7b5`, `C-5`, `Cm6/9` and `Csus2sus4` (#40).
- A sharp or flat at the start of a group in parentheses never changes the chord's root: `C(b9)` is not a chord, and the block says what to write instead. Only whole groups are read, so `C,` and `C()` are not chords either, and a lyric line with commas (`G, D, Em, C`) stays lyrics in the chord-sheet import (#40).
- A `chord` block with only a symbol no longer shows an error when the built-in voicing database doesn't have the chord. It draws the 4 easiest voicings the library finds instead (#40). `C7alt` now gets the database's own voicings, and `Cmaj7b5` and `Cmmaj9` keep theirs.
- Diagrams that the app moves to another window (Obsidian popout windows) now play through that window. When you press play, the play bar asks for the player of the window the diagram is in, not the one it was drawn in.

## 0.5.2 (2026-11-02)

- Keyboard scale fingering (`fingering:`) no longer disappears when you add `labels:`. The labels stay on the keys, and the finger numbers get their own row under them (#28).
- With a `range:` that leaves out middle C's octave, the fingering is now drawn. It starts on the first root inside the range, and every octave in the range stays lit (#28).
- Chords named from their frets: maj7 and m7 shell voicings without a fifth now get a name (`3x44xx` is Gmaj7, `x313xx` is Cm7) (#29).
- 13th grips that leave out the 5th, 9th and 11th are named too (`020120` is E13, `3x3455` is G13) (#30).
- A slash chord's bass is spelled the way the chord spells it: `x12010` is C7/Bb, not C7/A# (#31).
- The altered scale is spelled without double sharps: G# altered is G# A B C D E F# (R b2 b3 b4 b5 b6 b7), not G# A A## B# C## E F# (#32).
- The options of the playback bar's sound dropdown are readable in dark themes (#36).
- The speed and volume knobs of the playback bar sit on the middle of their slider on every page, light pages and Obsidian Publish included. 0.5.1 fixed them in Obsidian but put them below the track on light pages (#39).

## 0.5.1 (2026-11-02)

- The volume and speed knobs of the playback bar now sit on their slider in Obsidian, whose own styles had moved them up.
- After a click on a slider, its knob no longer keeps Obsidian's focus ring (keyboard focus still shows it).
- For apps: the `player` function of the `play` option gets the diagram's window, so a player can belong to the window the diagram is in (Obsidian popouts).

## 0.5.0 (2026-11-02)

- **Triads**: `triads: 1-3` in a `chord` block draws a chord's close triads on three strings, up the neck, with their inversion; `key: G major` with `triads: 1-3` draws the seven triads of a key. `labels: intervals` writes R, 3, 5 in the dots. Fretboards take `strings: 1-3` to show only those strings.
- **Chord transitions**: `from: C x32010` and `to: Am` draw the chord you hold and the next chord's voicings your hand reaches most easily. Fingers that stay down have a ring, and fingers that slide (3 frets at most) a dashed one. The library also says what to do in plain words. `progression: G D Em C` picks the voicings that make a whole progression easiest.
- **Hear the diagrams**: the `play` option adds a bar at the bottom of each chord, keyboard and fretboard diagram (on hover, or a tap on phones), with play, loop, speed, volume and a guitar or piano sound. Chords strum, scales go up and down from root to root, and a click on a dot or a key plays that note. The sound is a small synthesizer computed in the browser, or a soundfont the app passes in.
- **Tabs and scores**: `@dsebastien/music-notation/tab` draws `tab` and `score` blocks in alphaTex, or Guitar Pro and MusicXML files, with [alphaTab](https://alphatab.net), which the app passes in. It shows tablature, notation or both, in the page's colors, with a player (play, loop, metronome, count-in, speed, volume) whose sound loads at the first Play. `printTab` prints a score in black on white. It works in Obsidian popout windows.
- **Imports and exports**: converts score files to alphaTex, text tabs to alphaTex (bar lines, repeat signs, two-digit frets, bass and 7-string tunings), and chord sheets to ChordPro (chords over lyrics, `Intro: G D Em C`, repeat marks). Exports to Guitar Pro 7 and MIDI.
- **Obsidian Publish**: a second bundle, `music-notation.tab.min.js`, draws tab and score blocks. `publish.js` loads it only on pages that have them (see the guide's Publish page). Diagrams get the playback bar there too (`play: false` turns it off).

## 0.4.0 (2026-10-29)

- **Every way to play a chord**: `voicings: all` (or `voicings: 6`) in a `chord` block draws every playable voicing of the chord in a row, the easiest first: the open chords you learn first, then E- and A-shape barres, the CAGED shapes and the rest. Each one is fingered and titled with its shape.
- **Narrow them down**: `area: 5-9` (or `open`), `root-string: 5`, `strings: 1-3` (triads on the top strings), `inversion: 1` (or `any`), `stretch: yes`, `open: no`, `gaps: yes`. Works on any tuning up to 8 strings: `tuning: ukulele` gives the usual ukulele shapes.
- For apps: `generateVoicings(chord, options)`, `fingerVoicing(frets)` (fingers for any voicing) and `voicingShape(frets, chord)`.
- `C7alt` (and `Calt`) are read as altered dominant chords.

## 0.3.0 (2026-10-29)

- **Chords in words**: `A Major`, `F Sharp Minor 7`, `C Major over G` work wherever a chord symbol does, and stay the title. A chord the library doesn't recognize says what to write instead.
- **Chords recognized from their notes**: `frets: x02220` alone (or `pitches:`) draws an A chord, named and with its root marked.
- **Scales and modes**: the usual names (`Natural minor`, `Blues`, `Major pentatonic`), the notes that define a mode in their own color, `compare: major` to see what changes, `modes: C major` for every mode of a key.
- **Positions on the neck**: pentatonic boxes, CAGED shapes and three notes per string, one at a time (`position: 2`, `shape: E`, `shape: 3nps`) or all in a row (`positions: all`).
- **Scale fingering** on keyboards: `fingering: 1 2 3 1 2 3 4 5`.
- **Blocks from a note's properties**: an empty block draws what the note's properties say (chord symbol, frets, fingers; scale root, type and shape), in apps and on Obsidian Publish (`window.musicNotationOptions.properties`).
- **Changes to existing blocks**: modes and blues scales now mark their characteristic notes (`highlight: none` turns it off); chord blocks with only frets or pitches now get a title and root marks.

## 0.2.0 (2026-10-28)

- Several diagrams in one block: separate them with `---` to draw a song's chords, a progression or a scale's positions side by side. Settings shared by every diagram go first; `columns: 3` draws a grid. A mistake in one diagram no longer hides the others.
- `orientation: horizontal` turns guitar chords sideways (high string on top, as in tabs); `orientation: vertical` stands fretboards up (nut on top) and draws keyboards with their low notes at the bottom.
- `hand: left` mirrors guitar chords and fretboards for left-handed players.
- Apps can set the default orientation and hand (`orientation`, `hand` render options); Obsidian Publish sites through `window.musicNotationOptions`.
- Long titles no longer get cut off on narrow diagrams.
- The 12th-fret double dot shows as two dots on 4-string fretboards (bass, ukulele).

## 0.1.3 (2026-10-28)

- Fixes the ES module build of 0.1.2: `import … from '@dsebastien/music-notation'` failed (the entry exported names it didn't define). The browser bundle for Obsidian Publish was not affected.

## 0.1.2 (2026-10-28)

- Every common way to write a chord now draws: `CΔ7`, `Cmin6`, `CM9`, `Cø7`, `Cm(maj7)`, `C7b9`, `Cm11`… on piano, and as guitar voicings when the database has one.
- An empty block (a template's placeholder) draws nothing instead of an error.
- The guide has live examples, an examples gallery and a playground: https://dsebastien.github.io/music-notation/

## 0.1.1 (2026-10-28)

- `chord` blocks that name their chord with `name: A` (instead of `symbol: A`) now mark the chord's root notes too.

## 0.1.0 (2026-10-28)

First release: music notation from small text blocks, as SVG and HTML.

- `chord`: guitar chord diagrams (frets, fingers, barres, position, root marks, any tuning), about 2,000 voicings to pick from by symbol, and piano chords from a symbol or pitches, with fingering.
- `keyboard`: a piano keyboard with the notes of a scale, a chord or a list; labels as notes, degrees or intervals.
- `fretboard`: a guitar neck with the notes of a scale, a chord or a list, in any tuning.
- `chords`: ChordPro charts (chords over lyrics, sections, comments), transposable.
- A browser bundle for Obsidian Publish that draws every block on the page.
