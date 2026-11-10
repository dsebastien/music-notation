---
title: Playground
nav_order: 4
---

# Playground

Write a block and hear it. Pick an example, or press **Surprise me**, then change it: the drawing follows as you type, and the bar under it plays it. Click a diagram to hear it, or a dot or a key to hear one note.

Try a capo on a chord, `voicings: all`, a strumming pattern of your own, or a progression in another key. **Copy as Markdown** gives you the block for a note (in Obsidian with the Music Practice plugin, or on an Obsidian Publish site). **Copy link** shares exactly what you see. **Download SVG** and **Download PNG** save the drawing as an image; the picture button on the bar copies it (Shift+click: the whole block). Nothing leaves your browser.

<div markdown="0" class="mn-playground">
<div class="mn-playground-controls">
    <label>Example
        <select id="mn-example"><option value="">Your own</option></select>
    </label>
    <button type="button" id="mn-surprise">Surprise me</button>
</div>
<div class="mn-playground-controls">
    <label>Block
        <select id="mn-language">
            <option value="chord">chord</option>
            <option value="keyboard">keyboard</option>
            <option value="fretboard">fretboard</option>
            <option value="chords">chords</option>
            <option value="strum">strum</option>
            <option value="picking">picking</option>
            <option value="progression">progression</option>
            <option value="circle">circle</option>
            <option value="tab">tab</option>
            <option value="score">score</option>
        </select>
    </label>
    <label>Orientation
        <select id="mn-orientation">
            <option value="">Default</option>
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
        </select>
    </label>
    <label>Note names
        <select id="mn-naming">
            <option value="">Letters (C D E)</option>
            <option value="solfege">Solfège (Do Ré Mi)</option>
            <option value="german">German (H for B)</option>
        </select>
    </label>
    <label><input type="checkbox" id="mn-left" /> Left-handed</label>
</div>
<textarea id="mn-source" rows="8" aria-label="Block source" spellcheck="false"></textarea>
<div class="mn-playground-controls">
    <button type="button" id="mn-copy-markdown">Copy as Markdown</button>
    <button type="button" id="mn-copy-link">Copy link</button>
    <button type="button" id="mn-download-svg" hidden>Download SVG</button>
    <button type="button" id="mn-download-png" hidden>Download PNG</button>
    <span id="mn-said" aria-live="polite"></span>
</div>
<div id="mn-output" class="mn-live"></div>
<script src="{{ '/assets/js/playground.js' | relative_url }}"></script>
</div>

The orientation, the hand and the note names are defaults: a block's own `orientation:`, `hand:` and `naming:` lines win. Every key is in [Blocks](blocks.html).
