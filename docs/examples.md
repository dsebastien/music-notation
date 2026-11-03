---
title: Examples
nav_order: 3
---

# Examples

Each block below is drawn live by the library, from the source shown above it. Copy a source into a note to use it.

## Guitar chords

Open chords, by symbol, frets and fingers:

````markdown
```chord
C x32010 x32010
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">C x32010 x32010</code></pre></div>

````markdown
```chord
G 320003 210003
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">G 320003 210003</code></pre></div>

A barre chord (the same finger across several strings draws a barre):

````markdown
```chord
F 133211 134211
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">F 133211 134211</code></pre></div>

Up the neck, with frets above 9 separated by dashes:

````markdown
```chord
symbol: A
frets: x-12-14-14-14-12
fingers: x-1-2-3-4-1
title: A (12th fret)
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">symbol: A
frets: x-12-14-14-14-12
fingers: x-1-2-3-4-1
title: A (12th fret)</code></pre></div>

By symbol only: the most common voicing from the built-in database, or another one with `voicing`:

````markdown
```chord
Cmaj7
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">Cmaj7</code></pre></div>

````markdown
```chord
Cmaj7
voicing: 3
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">Cmaj7
voicing: 3</code></pre></div>

Another tuning:

````markdown
```chord
symbol: Dsus4
frets: 000000
tuning: DADGAD
title: Dsus4 (DADGAD)
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">symbol: Dsus4
frets: 000000
tuning: DADGAD
title: Dsus4 (DADGAD)</code></pre></div>

A ukulele chord:

````markdown
```chord
symbol: C
frets: 0003
fingers: 0003
tuning: ukulele
title: C (ukulele)
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">symbol: C
frets: 0003
fingers: 0003
tuning: ukulele
title: C (ukulele)</code></pre></div>

## Capo

An A shape with a capo on fret 2. You still read it as `x02220`, and the caption says what it sounds:

````markdown
```chord
A x02220 x01230
capo: 2
sounds: yes
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">A x02220 x01230
capo: 2
sounds: yes</code></pre></div>

A song's shapes on capo 2, shared by the row: the A, D and E shapes sound B, E and F#.

````markdown
```chord
capo: 2
sounds: yes
---
A x02220 x01230
---
D xx0232 xx0132
---
E 022100 023100
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">capo: 2
sounds: yes
---
A x02220 x01230
---
D xx0232 xx0132
---
E 022100 023100</code></pre></div>

A fretboard with a capo on 2. The A major pentatonic is the open G major pentatonic shape, played from the capo; the strings are named by what they sound (F# B E A C# F#):

````markdown
```fretboard
A major pentatonic
frets: 0-5
capo: 2
labels: intervals
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">A major pentatonic
frets: 0-5
capo: 2
labels: intervals</code></pre></div>

## All the ways to play a chord

Every E minor voicing in the first position:

````markdown
```chord
Em
voicings: all
area: open
columns: 6
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">Em
voicings: all
area: open
columns: 6</code></pre></div>

G major triads on the three highest strings, in every inversion:

````markdown
```chord
G
voicings: all
strings: 1-3
inversion: any
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">G
voicings: all
strings: 1-3
inversion: any</code></pre></div>

F with the root on the A string:

````markdown
```chord
F
voicings: 4
root-string: 5
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">F
voicings: 4
root-string: 5</code></pre></div>

C on a ukulele:

````markdown
```chord
C
voicings: 4
tuning: ukulele
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">C
voicings: 4
tuning: ukulele</code></pre></div>

## Triads and transitions

D major triads on the middle strings:

````markdown
```chord
D
triads: 2-4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">D
triads: 2-4</code></pre></div>

The seven triads of G major on the three highest strings, in first inversion:

````markdown
```chord
key: G major
triads: 1-3
inversion: 1
columns: 7
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">key: G major
triads: 1-3
inversion: 1
columns: 7</code></pre></div>

The easiest voicings from G to C, then a whole progression:

````markdown
```chord
from: G 320003
to: C
count: 3
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">from: G 320003
to: C
count: 3</code></pre></div>

````markdown
```chord
progression: A, D, E, A
columns: 4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">progression: A, D, E, A
columns: 4</code></pre></div>

## Tabs and scores

A riff in tablature:

````markdown
```tab
\tempo 90
.
:8 5.4 7.4 5.3 7.3 | 5.4 7.4 5.3 7.3 | 0.6 3.6 5.6 3.6 0.6 r r r
```
````

<div class="mn-live" markdown="0"><pre><code class="language-tab">\tempo 90
.
:8 5.4 7.4 5.3 7.3 | 5.4 7.4 5.3 7.3 | 0.6 3.6 5.6 3.6 0.6 r r r</code></pre></div>

A scale in notation and tablature:

````markdown
```score
staves: both
:8 3.5 5.5 2.4 3.4 5.4 2.3 4.3 5.3
```
````

<div class="mn-live" markdown="0"><pre><code class="language-score">staves: both
:8 3.5 5.5 2.4 3.4 5.4 2.3 4.3 5.3</code></pre></div>

## Chords in words, and chords recognized

Written the way chord notes are titled:

````markdown
```chord
F Sharp Minor 7 x-x-4-6-5-5 x-x-1-3-2-2
---
B Flat Major x13331 x12341
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">F Sharp Minor 7 x-x-4-6-5-5 x-x-1-3-2-2
---
B Flat Major x13331 x12341</code></pre></div>

Only frets: the library names the chord.

````markdown
```chord
frets: x02210
---
frets: xx0212
---
frets: 320001
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">frets: x02210
---
frets: xx0212
---
frets: 320001</code></pre></div>

Shell voicings (no 5th), 13th grips and slash chords get a name too:

````markdown
```chord
frets: 3x44xx
---
frets: x313xx
---
frets: 020120
---
frets: x12010
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">frets: 3x44xx
---
frets: x313xx
---
frets: 020120
---
frets: x12010</code></pre></div>

## Piano chords

From a symbol, in root position from middle C:

````markdown
```chord
Am7
instrument: piano
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">Am7
instrument: piano</code></pre></div>

A slash chord with fingering (the bass goes an octave below):

````markdown
```chord
C/G
instrument: piano
fingering: 5-1-2-4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">C/G
instrument: piano
fingering: 5-1-2-4</code></pre></div>

Exact pitches, for an inversion:

````markdown
```chord
symbol: C
pitches: E4 G4 C5
fingering: 1-2-5
title: C (first inversion)
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">symbol: C
pitches: E4 G4 C5
fingering: 1-2-5
title: C (first inversion)</code></pre></div>

## Piano voicings

C in its three inversions:

````markdown
```chord
instrument: piano
columns: 3
---
C
title: Root position
---
C
inversion: first
title: First inversion
---
C
inversion: second
title: Second inversion
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">instrument: piano
columns: 3
---
C
title: Root position
---
C
inversion: first
title: First inversion
---
C
inversion: second
title: Second inversion</code></pre></div>

Shell voicings: root, third and seventh, no fifth.

````markdown
```chord
instrument: piano
voicing: shell
---
Cmaj7
---
C7
---
Cm7
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">instrument: piano
voicing: shell
---
Cmaj7
---
C7
---
Cm7</code></pre></div>

A ii-V-I in C with rootless voicings, forms A, B and A. The hand barely moves, and the intervals show the added 9th and 13th:

````markdown
```chord
instrument: piano
labels: intervals
---
Dm7
voicing: rootless A
---
G7
voicing: rootless B
---
Cmaj7
voicing: rootless A
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">instrument: piano
labels: intervals
---
Dm7
voicing: rootless A
---
G7
voicing: rootless B
---
Cmaj7
voicing: rootless A</code></pre></div>

Both hands: the root in the left hand, the chord in the right, with the usual fingers:

````markdown
```chord
G
instrument: piano
hands: left+right
fingering: auto
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">G
instrument: piano
hands: left+right
fingering: auto</code></pre></div>

## Keyboards

A scale with its degrees:

````markdown
```keyboard
scale: E harmonic minor
labels: degrees
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">scale: E harmonic minor
labels: degrees</code></pre></div>

A chord with its intervals:

````markdown
```keyboard
chord: G7
labels: intervals
range: C3-B4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">chord: G7
labels: intervals
range: C3-B4</code></pre></div>

## Fretboards

The A minor pentatonic box, with intervals:

````markdown
```fretboard
scale: A minor pentatonic
frets: 5-8
labels: intervals
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">scale: A minor pentatonic
frets: 5-8
labels: intervals</code></pre></div>

The G major scale over the first 12 frets:

````markdown
```fretboard
scale: G major
frets: 0-12
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">scale: G major
frets: 0-12</code></pre></div>

Every E on the neck, in Drop D:

````markdown
```fretboard
notes: E
tuning: Drop D
frets: 0-12
labels: none
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">notes: E
tuning: Drop D
frets: 0-12
labels: none</code></pre></div>

## Arpeggios

The five CAGED shapes of Am7, up the neck, labeled with intervals:

````markdown
```fretboard
arpeggio: Am7
positions: all
columns: 3
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">arpeggio: Am7
positions: all
columns: 3</code></pre></div>

## Rows and grids

A song's chords, with fingers:

````markdown
```chord
G 320003 210003
---
Em 022000 023000
---
C x32010 x32010
---
D xx0232 xx0132
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">G 320003 210003
---
Em 022000 023000
---
C x32010 x32010
---
D xx0232 xx0132</code></pre></div>

The I–IV–V in A on piano, in a grid:

````markdown
```chord
instrument: piano
columns: 3
---
A
---
D
---
E7
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">instrument: piano
columns: 3
---
A
---
D
---
E7</code></pre></div>

The first three positions of the A minor pentatonic, standing up:

````markdown
```fretboard
orientation: vertical
labels: intervals
---
A minor pentatonic
frets: 5-8
---
A minor pentatonic
frets: 7-10
---
A minor pentatonic
frets: 9-13
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">orientation: vertical
labels: intervals
---
A minor pentatonic
frets: 5-8
---
A minor pentatonic
frets: 7-10
---
A minor pentatonic
frets: 9-13</code></pre></div>

## Scales and modes

Every mode of C major, with its characteristic note:

````markdown
```keyboard
modes: C major
range: C4-B4
columns: 4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">modes: C major
range: C4-B4
columns: 4</code></pre></div>

D dorian against D natural minor: the major sixth (B) is what changes.

````markdown
```fretboard
D dorian
compare: natural minor
frets: 3-7
labels: intervals
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">D dorian
compare: natural minor
frets: 3-7
labels: intervals</code></pre></div>

The five boxes of the A minor pentatonic:

````markdown
```fretboard
A minor pentatonic
positions: all
labels: intervals
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">A minor pentatonic
positions: all
labels: intervals</code></pre></div>

The C major scale in its five CAGED shapes, from the E shape up the neck:

````markdown
```fretboard
C major
positions: all
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">C major
positions: all</code></pre></div>

C major with its fingering, right hand:

````markdown
```keyboard
C major
fingering: 1 2 3 1 2 3 4 5
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">C major
fingering: 1 2 3 1 2 3 4 5</code></pre></div>

Degrees on the keys and the fingers in a row under them, over two octaves:

````markdown
```keyboard
C major
fingering: 1 2 3 1 2 3 4 5
labels: degrees
range: C3-B4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">C major
fingering: 1 2 3 1 2 3 4 5
labels: degrees
range: C3-B4</code></pre></div>

## Scales over chords

Dm7 over the A minor pentatonic. Its chord tones are solid, the scale's other notes hollow, and the F (in Dm7, not in the scale) is faint:

````markdown
```fretboard
scale: A minor pentatonic
chord: Dm7
frets: 5-8
labels: intervals
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">scale: A minor pentatonic
chord: Dm7
frets: 5-8
labels: intervals</code></pre></div>

With a position: C major in the E shape, with the G7 notes to aim for when you solo over the V chord:

````markdown
```fretboard
scale: C major
chord: G7
position: 1
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">scale: C major
chord: G7
position: 1</code></pre></div>

The scale that fits a song's chords. For Am Dm E7, it's A harmonic minor (E7's G# isn't in A natural minor):

````markdown
```keyboard
scales-for: Am Dm E7
range: C4-B4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">scales-for: Am Dm E7
range: C4-B4</code></pre></div>

When no scale holds every chord note, the title says which notes are outside: E minor for Em C D B7, with B7's D# outside.

````markdown
```fretboard
scales-for: Em C D B7
frets: 0-5
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">scales-for: Em C D B7
frets: 0-5</code></pre></div>

## Progressions

The four chords of pop, I V vi IV in G, with the guitar voicings that make the whole thing easiest to play:

````markdown
```progression
I V vi IV
key: G
```
````

<div class="mn-live" markdown="0"><pre><code class="language-progression">I V vi IV
key: G</code></pre></div>

A jazz ii-V-I in C on piano: rootless voicings in the right hand, the root in the left.

````markdown
```progression
ii7 V7 Imaj7
key: C
instrument: piano
voicing: rootless A
hands: left+right
```
````

<div class="mn-live" markdown="0"><pre><code class="language-progression">ii7 V7 Imaj7
key: C
instrument: piano
voicing: rootless A
hands: left+right</code></pre></div>

A minor progression, i bVI bIII bVII in E minor (Em C G D), with each chord's function written under it:

````markdown
```progression
i bVI bIII bVII
key: E minor
functions: yes
```
````

<div class="mn-live" markdown="0"><pre><code class="language-progression">i bVI bIII bVII
key: E minor
functions: yes</code></pre></div>

Nashville numbers: the 1 6m 2m 5⁷ turnaround in D. Type `57` and it shows as 5⁷:

````markdown
```progression
1 6m 2m 57
key: D
```
````

<div class="mn-live" markdown="0"><pre><code class="language-progression">1 6m 2m 57
key: D</code></pre></div>

Chord names without a key: the block finds the likeliest one (A minor here) and shows it, with the other keys it could be.

````markdown
```progression
Am F C G
```
````

<div class="mn-live" markdown="0"><pre><code class="language-progression">Am F C G</code></pre></div>

## Circle of fifths

D major: its chords are tinted, with their numerals, and its IV and V (G and A) stand out.

````markdown
```circle
key: D
```
````

<div class="mn-live" markdown="0"><pre><code class="language-circle">key: D</code></pre></div>

A dorian: the same wheel, with the chords of the mode. The major IV (D) is the chord that sets dorian apart from A minor.

````markdown
```circle
key: A dorian
```
````

<div class="mn-live" markdown="0"><pre><code class="language-circle">key: A dorian</code></pre></div>

## Strumming patterns

The classic folk and pop pattern (down, down-up, up-down-up), over G, C, D and back to G:

````markdown
```strum
[G]D - D U - U D U | [C]D - D U - U D U | [D]D - D U - U D U | [G]D - D U - U D U
tempo: 100
```
````

<div class="mn-live" markdown="0"><pre><code class="language-strum">[G]D - D U - U D U | [C]D - D U - U D U | [D]D - D U - U D U | [G]D - D U - U D U
tempo: 100</code></pre></div>

A waltz in 3/4:

````markdown
```strum
[C]D - D U D U | [G7]D - D U D U
time: 3/4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-strum">[C]D - D U D U | [G7]D - D U D U
time: 3/4</code></pre></div>

Ska: up strums on every off-beat, and nothing on the beat.

````markdown
```strum
- U - U - U - U
chord: C
tempo: 140
```
````

<div class="mn-live" markdown="0"><pre><code class="language-strum">- U - U - U - U
chord: C
tempo: 140</code></pre></div>

Funk in 16ths: accents on 1 and 3, muted chucks on 2 and 4.

````markdown
```strum
D> U D U X U D U D> U D U X U D U
subdivision: 16ths
chord: E9
tempo: 95
```
````

<div class="mn-live" markdown="0"><pre><code class="language-strum">D&gt; U D U X U D U D&gt; U D U X U D U
subdivision: 16ths
chord: E9
tempo: 95</code></pre></div>

A 6/8 ballad, the down strums on 1 and 4:

````markdown
```strum
[Am]D - U D - U | [C]D - U D - U
time: 6/8
```
````

<div class="mn-live" markdown="0"><pre><code class="language-strum">[Am]D - U D - U | [C]D - U D - U
time: 6/8</code></pre></div>

## Left-handed

````markdown
```chord
hand: left
---
C x32010 x32010
---
F 133211 134211
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">hand: left
---
C x32010 x32010
---
F 133211 134211</code></pre></div>

````markdown
```fretboard
E minor pentatonic
frets: 0-5
hand: left
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">E minor pentatonic
frets: 0-5
hand: left</code></pre></div>

## Chord charts

A chart transposed up a whole step (chords and key move, spelled for the new key):

````markdown
```chords
{title: Morning Song}
{artist: Practice Example}
{key: G}
{transpose: 2}

[G]Coffee on the [D/F#]table, [Em]sunlight on the [C]floor
[G]Strings a little [D]out of tune, I [C]tune them [D]once more

{start_of_chorus}
[C]Play it [G]slow, [D]play it [Em]right
[C]One more [G]time, [D]then call it a [G]night
{end_of_chorus}

{comment: Repeat the chorus, slower}
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chords">{title: Morning Song}
{artist: Practice Example}
{key: G}
{transpose: 2}

[G]Coffee on the [D/F#]table, [Em]sunlight on the [C]floor
[G]Strings a little [D]out of tune, I [C]tune them [D]once more

{start_of_chorus}
[C]Play it [G]slow, [D]play it [Em]right
[C]One more [G]time, [D]then call it a [G]night
{end_of_chorus}

{comment: Repeat the chorus, slower}</code></pre></div>

A chart with its chord diagrams on top, two shapes from `{define}` (Cadd9 and Dsus4) and a capo on 2. The diagrams show the shapes you play, with the capo drawn:

````markdown
```chords
{title: Harbour Lights}
{artist: Practice Example}
{key: G}
{capo: 2}
{diagrams: on}
{define: Cadd9 base-fret 1 frets x 3 2 0 3 3 fingers 0 2 1 0 3 4}
{define: Dsus4 base-fret 1 frets x x 0 2 3 3 fingers 0 0 0 1 3 4}

{start_of_verse}
[G]Boats come in at [Cadd9]evening, [Em]lanterns on the [D]tide
[G]Ropes around the [Cadd9]bollards, [Em]nets hung out to [Dsus4]dry [D]
{end_of_verse}

{start_of_chorus}
[Cadd9]Harbour lights, [G]bring them home
[Em]One more night, [Dsus4]then [D]home
{end_of_chorus}
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chords">{title: Harbour Lights}
{artist: Practice Example}
{key: G}
{capo: 2}
{diagrams: on}
{define: Cadd9 base-fret 1 frets x 3 2 0 3 3 fingers 0 2 1 0 3 4}
{define: Dsus4 base-fret 1 frets x x 0 2 3 3 fingers 0 0 0 1 3 4}

{start_of_verse}
[G]Boats come in at [Cadd9]evening, [Em]lanterns on the [D]tide
[G]Ropes around the [Cadd9]bollards, [Em]nets hung out to [Dsus4]dry [D]
{end_of_verse}

{start_of_chorus}
[Cadd9]Harbour lights, [G]bring them home
[Em]One more night, [Dsus4]then [D]home
{end_of_chorus}</code></pre></div>

## Mistakes

A block with a mistake explains what to write instead:

````markdown
```chord
A
instrument: banjo
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">A
instrument: banjo</code></pre></div>
