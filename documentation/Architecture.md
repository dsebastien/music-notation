# Architecture

```
src/
  theory/      pitch classes, chord symbols and names in words, chord detection, scales and modes, transposition, note sets (tonal)
  blocks/      block source parsing, one renderer per language (RENDERERS), blocks from note properties
  chord/       guitar diagram (SVG); voicing generator, fingering and shape names (generate.ts)
  keyboard/    piano keyboard (SVG)
  fretboard/   fretboard (SVG), tunings, scale positions
  chords/      ChordPro parser, chart (HTML)
  voicings/    guitar voicing lookup (chords-db), own entry point
  render/      DOM helpers, layout (orientation, hand, neck frame), renderBlock (never throws; rows)
  publish/     renderAll / autoRender; auto.ts = the browser bundle
  styles.css   one stylesheet, CSS variables defaulting to Obsidian's
```

- **Entry points**: `.` (everything but the voicing data), `./voicings`, `./publish`; `dist/music-notation.publish.min.js` (IIFE: styles, voicings, auto-render, `window.MusicNotation`); `dist/music-notation.css`.
- **Build** (`scripts/build.ts`): Bun.build ESM with dependencies external and no code splitting (each entry self-contained; `scripts/check-dist.ts` imports every entry in Node after the build); a minified IIFE bundle for Publish; declarations from `tsc -p tsconfig.build.json`.
- **Voicings**: `generateVoicings` searches string by string (each string's chord tones within the hand's span, pruned when a voicing can't be finished), then checks the bass, fingers it (`fingerVoicing`: a search over notes and barres per fret), names the shape (CAGED by sliding the voicing to the nut) and scores it. No data: the chord's notes come from tonal. `voicings:` blocks expand into a row in `render-block.ts`, with the last 32 lists cached.
- **Rendering**: renderers build SVG/HTML with `doc.createElement(NS)` from the host's document; classes prefixed `mn-`; no inline colors, so themes apply.
- **Tests**: `bun test` with happy-dom (`src/test-setup.ts`).
