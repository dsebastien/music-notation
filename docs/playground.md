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
<script>
    ;(() => {
        const samples = {
            chord: 'A x02220 x01230',
            keyboard: 'D dorian\nlabels: degrees',
            fretboard: 'scale: A minor pentatonic\nfrets: 5-8\nlabels: intervals',
            chords: '{title: Example}\n{key: G}\n[G]Hello [D/F#]little [Em]world'
        }
        const language = document.getElementById('mn-language')
        const source = document.getElementById('mn-source')
        const output = document.getElementById('mn-output')
        let current = null
        const draw = () => {
            const api = window.MusicNotation
            if (!api) return void setTimeout(draw, 100)
            current?.destroy()
            current = api.renderBlock(language.value, source.value, output, {
                voicings: api.lookupGuitarVoicing
            })
        }
        language.addEventListener('change', () => {
            source.value = samples[language.value]
            draw()
        })
        source.addEventListener('input', draw)
        draw()
    })()
</script>
</div>
