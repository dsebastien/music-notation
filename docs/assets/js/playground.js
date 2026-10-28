// The playground: draws the block typed in the textarea, as you type, with the library loaded by
// _includes/head_custom.html. A separate file: the theme minifies page HTML, which joins inline
// script lines.
;(() => {
    const samples = {
        chord: 'G 320003 210003\n---\nC x32010 x32010\n---\nD xx0232 xx0132\n---\nEm 022000 023000',
        keyboard: 'D dorian\nlabels: degrees',
        fretboard: 'scale: A minor pentatonic\nfrets: 5-8\nlabels: intervals',
        chords: '{title: Example}\n{key: G}\n[G]Hello [D/F#]little [Em]world'
    }
    const start = () => {
        const language = document.getElementById('mn-language')
        const source = document.getElementById('mn-source')
        const output = document.getElementById('mn-output')
        const orientation = document.getElementById('mn-orientation')
        const left = document.getElementById('mn-left')
        if (!language || !source || !output || !orientation || !left) return
        let current = null
        const draw = () => {
            const api = window.MusicNotation
            if (!api) {
                setTimeout(draw, 100)
                return
            }
            if (current) current.destroy()
            const options = { voicings: api.lookupGuitarVoicing }
            if (orientation.value) {
                options.orientation = {
                    chord: orientation.value,
                    keyboard: orientation.value,
                    fretboard: orientation.value
                }
            }
            if (left.checked) options.hand = 'left'
            current = api.renderBlock(language.value, source.value, output, options)
        }
        language.addEventListener('change', () => {
            source.value = samples[language.value]
            draw()
        })
        source.addEventListener('input', draw)
        orientation.addEventListener('change', draw)
        left.addEventListener('change', draw)
        draw()
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
})()
