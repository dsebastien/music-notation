---
title: Check your notes
nav_order: 7
---

# Check your notes

Want to know which blocks have a mistake without opening every note? The `check` command draws every block of your Markdown notes with the same code as Obsidian and Publish, and lists the mistakes. It needs Node 20 or later.

```bash
npx @dsebastien/music-notation check notes/*.md
bunx @dsebastien/music-notation check notes/
```

Pass it files, folders (it reads every Markdown file inside) or globs (`"notes/**/*.md"`). Each mistake takes one line, with the line number of the block's opening fence:

```text
notes/Chords.md:17: chord: Didn't recognize "Hm7": try A, Am, A7 or A Major
notes/Chords.md:39: chord: diagram 2: "x" has 1 fingers for 6 strings
1 file, 8 blocks: 6 ok, 2 with errors, 0 skipped, 0 empty
```

The exit code is 0 when every block draws, 1 when a block has a mistake, and 2 when the command itself is wrong (an unknown option, a file that doesn't exist).

It finds blocks in ``` and ~~~ fences, in callouts and in lists. It ignores blocks inside `%% %%` and `<!-- -->` comments and in indented code (a fence indented by 4 spaces outside a list), because Obsidian doesn't draw them. For tab and score blocks, it checks only the settings lines, because the music itself needs alphaTab.

The last line of the output counts the blocks. **Empty** blocks have nothing in them, so they draw nothing. Templates often have them, and they are not mistakes. **Skipped** blocks are the ones the check can't draw. An empty diagram block in a note with properties is one: Obsidian draws it from those properties, and the check doesn't read them. A tab or score block whose settings lines are fine is another, since its music needs alphaTab.

## What a block draws

`--describe` prints what every block draws: titles, chord names, the note and label of each dot or key, the frets or keys shown, and each barre of a chord diagram (`barre 1 at fret 1, strings 6 to 1`). Use it to check that a diagram shows what the text says.

```text
notes/Pentatonic.md:69: fretboard: ok
  1. fretboard, "A minor pentatonic, box 1", A minor pentatonic, frets 5-8, tuning E A D G B E
     string 6 (E): 5 A2 "R" root, 8 C3 "b3"
     string 5 (A): 5 D3 "4", 7 E3 "5"
     ...
```

`--json` prints the same as JSON, for scripts and AI agents: every block, its status and its diagrams, and a summary.
