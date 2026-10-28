---
title: Playground
nav_order: 4
---

# Playground

Pick a block type, write its source, and see it drawn as you type. Separate diagrams with `---`. The orientation and left-handed options are defaults: a block's own `orientation` and `hand` win. Nothing leaves your browser.

<div markdown="0">
<p>
    <label for="mn-language">Block</label>
    <select id="mn-language">
        <option value="chord">chord</option>
        <option value="keyboard">keyboard</option>
        <option value="fretboard">fretboard</option>
        <option value="chords">chords</option>
    </select>
    <label for="mn-orientation">Orientation</label>
    <select id="mn-orientation">
        <option value="">Default</option>
        <option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option>
    </select>
    <label><input type="checkbox" id="mn-left" /> Left-handed</label>
</p>
<textarea id="mn-source" rows="8" style="width: 100%; font-family: monospace">A x02220 x01230</textarea>
<div id="mn-output" class="mn-live"></div>
<script src="{{ '/assets/js/playground.js' | relative_url }}"></script>
</div>
