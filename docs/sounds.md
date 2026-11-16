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

One page option decides: `play: { instruments: '<folder URL>' }` names a folder of instrument files.

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

On an Obsidian Publish site, the page options go at the top of `publish.js`: see [Obsidian Publish](publish.md). The sounds package has a guide of its own: [music-notation-sounds](https://dsebastien.github.io/music-notation-sounds/).

<script src="{{ '/assets/js/sounds.js' | relative_url }}"></script>
