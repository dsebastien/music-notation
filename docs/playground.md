---
title: Playground
nav_order: 4
---

# Playground

Pick a block type, write its source, and see it drawn as you type. Nothing leaves your browser.

<div markdown="0">
<p>
    <label for="mn-language">Block</label>
    <select id="mn-language">
        <option value="chord">chord</option>
        <option value="keyboard">keyboard</option>
        <option value="fretboard">fretboard</option>
        <option value="chords">chords</option>
    </select>
</p>
<textarea id="mn-source" rows="8" style="width: 100%; font-family: monospace">A x02220 x01230</textarea>
<div id="mn-output" class="mn-live"></div>
<script src="{{ '/assets/js/playground.js' | relative_url }}"></script>
</div>
