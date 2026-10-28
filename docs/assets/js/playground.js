// The playground: draws the block typed in the textarea, as you type, with the library loaded by
// _includes/head_custom.html. A separate file: the theme minifies page HTML, which joins inline
// script lines.
;(() => {
    const samples = {
        chord: 'A x02220 x01230',
        keyboard: 'D dorian\nlabels: degrees',
        fretboard: 'scale: A minor pentatonic\nfrets: 5-8\nlabels: intervals',
        chords: '{title: Example}\n{key: G}\n[G]Hello [D/F#]little [Em]world'
    }
    const start = () => {
        const language = document.getElementById('mn-language')
        const source = document.getElementById('mn-source')
        const output = document.getElementById('mn-output')
        if (!language || !source || !output) return
        let current = null
        const draw = () => {
            const api = window.MusicNotation
            if (!api) {
                setTimeout(draw, 100)
                return
            }
            if (current) current.destroy()
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
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
})()
