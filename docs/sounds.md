---
title: Sounds
nav_order: 5
---

# Sounds

The library can play the same music with different sounds. This page plays them side by side, so you can hear what your pages will sound like before you pick one. Click any diagram, or press play on the bar under it. Headphones help.

| Sound             | What it is                                                                                                                                                                                         | What a page downloads                                                                                                                | When the library uses it                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GeneralUser GS    | [GeneralUser GS](https://www.schristiancollins.com/generaluser) 2.0.3, by S. Christian Collins, cut into one small soundfont per instrument by the npm package `@dsebastien/music-notation-sounds` | Only what it plays: 112 KB for a steel-string guitar, 392 KB for a grand piano, plus a 3 KB index. The whole bank would be 30.82 MB. | When the page options name a folder of instrument files (`play: { instruments }`)                                                                  |
| sonivox           | The small General MIDI soundfont that ships with alphaTab: one file for every instrument                                                                                                           | 954 KB, the whole file, at the first Play. It plays through alphaTab, about 1.2 MB of script, loaded on pages with tabs or scores.   | When the page names no folder of instrument files: tabs and scores, and the diagrams on pages with tabs                                            |
| Light synthesizer | Built into the library: a computed plucked string for guitar, and a simple piano                                                                                                                   | Nothing                                                                                                                              | Diagrams on a page with no tabs and no folder of instrument files. It is also the fallback when files can't be read. It can't play tabs or scores. |

GeneralUser GS plays two ways. On pages of diagrams without tabs, the library's own sample player plays it, and no alphaTab is loaded: a first guitar chord is about 115 KB. On pages with tabs or scores, alphaTab plays it, and the diagrams there use alphaTab too.

## Diagrams, patterns and progressions

Each example below is drawn four times, once per column: GeneralUser GS through the sample player (no alphaTab), GeneralUser GS through alphaTab, sonivox through alphaTab, and the light synthesizer. Play the same row across, and the only thing that changes is the sound.

<div markdown="0" id="mn-sounds"></div>

## A riff through alphaTab

Tabs and scores always play through alphaTab, so this one has two columns: GeneralUser GS and sonivox. The riff ends on a chord held for a whole bar, so you also hear how each sound holds a note.

<div markdown="0" id="mn-sounds-tabs"></div>

## Which one plays on your pages

Each sound has an engine, with a name you can write:

| Engine        | Sound                     | What the page needs                                                                                   |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `generaluser` | GeneralUser GS            | A folder of instrument files: `play: { instruments: '<folder URL>' }`                                 |
| `sonivox`     | sonivox, through alphaTab | alphaTab. It's there once the tab bundle is loaded, so on pages that have a `tab` or a `score` block. |
| `light`       | The light synthesizer     | Nothing. It's always there.                                                                           |

The library tries them in this order, always: `generaluser`, then `sonivox`, then `light`. It skips an engine the page doesn't have. So no network, or a missing file, never means silence: the next engine plays.

Each engine plays the guitar a page or a block chooses (`play: { guitar: 'nylon' }`, or a [`guitar:` line](blocks.md#which-guitar-plays)). `generaluser` reads that guitar's own file at its first use, so a page that plays only nylon chords never reads the steel-string guitar. `sonivox` plays the guitar's General MIDI program. The light synthesizer plucks each guitar its own way: nylon is darker and fades sooner, the electric guitars ring longer, and the overdriven one keeps its level while the string fades. The guitars play without effects (no amplifier, cabinet or reverb): the overdriven guitar is the soundfont's overdriven guitar sample, or the light synthesizer's version of it.

In a listening test, GeneralUser GS sounded better than sonivox. So this guide plays it on every page: its page options name the sounds package's `generaluser` folder on jsDelivr, pinned to a version.

```js
window.musicNotationOptions = {
    play: {
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser'
    }
}
```

The library itself has no address for these files. That's by design: it doesn't depend on a CDN. Your site chooses where its files come from, its own host or a CDN. Without `instruments`, tabs play sonivox (and so do the diagrams on pages with tabs), and diagrams everywhere else play the light synthesizer.

### Choose an engine

The fallback order was always there. Now you can also choose.

A page chooses with `play: { engine }` in `window.musicNotationOptions`: `'generaluser'`, `'sonivox'` or `'light'`. The library tries that engine first, then the fallback order. Say your site names an `instruments` folder, but you want a fast page with nothing to download. Set `engine: 'light'`:

```js
window.musicNotationOptions = {
    play: {
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser',
        engine: 'light'
    }
}
```

A block can ask for an engine too, with an `engine:` line. In a `chord` block:

```text
Am
engine: sonivox
```

Every block takes it: `chord`, `keyboard`, `fretboard`, `strum`, `picking`, `progression` and `circle`, and `tab` and `score` blocks at the top, with `staves:`, `file:` and `tracks:`. In a `chords` chart, write it as a directive, `{engine: light}`, since a line without braces is lyrics there. The block's wish comes before the page's choice. It's handy for a demo, or to compare sounds.

The line is a wish. When the page or the app can't give that engine, the fallback order applies and nothing breaks. So a note with `engine:` stays portable. A wrong value shows what to write: `engine: use generaluser, sonivox or light, got "loud"`.

Two cases fall back on purpose:

- Tabs and scores can't play through the light synthesizer: it doesn't play a score. A tab with `engine: light`, or a page with `engine: 'light'`, plays its tabs with the best sound there is: `generaluser` when the page has the instrument files, else `sonivox`.
- A diagram with `engine: sonivox` on a page with no tab block falls back. alphaTab isn't loaded there, and the library won't load 1 MB of script for one chord.

Why a page option and a block line? The library keeps two choices apart. What the music is belongs to the note. Which engine plays it belongs to the reader's side, the page or the app, because that depends on the network and the device. The music stays the same.

On an Obsidian Publish site, the page options go at the top of `publish.js`: see [Obsidian Publish](publish.md). The sounds package has a guide of its own: [music-notation-sounds](https://dsebastien.github.io/music-notation-sounds/).

<script src="{{ '/assets/js/sounds.js' | relative_url }}"></script>
