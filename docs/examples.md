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

From G to C, the easiest voicings, then a whole progression:

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
