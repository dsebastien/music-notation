# Architecture

```
src/
  theory/      pitch classes, chord symbols, transposition, note sets (tonal)
  blocks/      block source parsing, one renderer per language (RENDERERS)
  chord/       guitar diagram (SVG)
  keyboard/    piano keyboard (SVG)
  fretboard/   fretboard (SVG), tunings
  chords/      ChordPro parser, chart (HTML)
  voicings/    guitar voicing lookup (chords-db), own entry point
  render/      DOM helpers, renderBlock (never throws)
  publish/     renderAll / autoRender; auto.ts = the browser bundle
  styles.css   one stylesheet, CSS variables defaulting to Obsidian's
```

- **Entry points**: `.` (everything but the voicing data), `./voicings`, `./publish`; `dist/music-notation.publish.min.js` (IIFE: styles, voicings, auto-render, `window.MusicNotation`); `dist/music-notation.css`.
- **Build** (`scripts/build.ts`): Bun.build ESM with dependencies external and code splitting; a minified IIFE bundle for Publish; declarations from `tsc -p tsconfig.build.json`.
- **Rendering**: renderers build SVG/HTML with `doc.createElement(NS)` from the host's document; classes prefixed `mn-`; no inline colors, so themes apply.
- **Tests**: `bun test` with happy-dom (`src/test-setup.ts`).
