// The playground: draws the block typed in the textarea as you type, with play bars, like a real
// page. The library is loaded by _includes/head_custom.html (the main bundle draws diagrams, the
// tab bundle tabs and scores). A separate file: the theme minifies page HTML, which joins inline
// script lines.
;(() => {
    const EXAMPLES = [
        {
            language: 'chord',
            name: 'Campfire chords: G, C, D, Em',
            source: 'G 320003 210003\n---\nC x32010 x32010\n---\nD xx0232 xx0132\n---\nEm 022000 023000'
        },
        {
            language: 'chord',
            name: 'Capo 3: the chords you hear',
            source: 'capo: 3\nsounds: title\n---\nEm 022000 023000\n---\nC x32010 x32010\n---\nG 320003 210003\n---\nD xx0232 xx0132'
        },
        { language: 'chord', name: 'Six ways to play A', source: 'A Major\nvoicings: 6' },
        {
            language: 'chord',
            name: 'The easiest way from C to Am',
            source: 'from: C x32010\nto: Am'
        },
        {
            language: 'chord',
            name: 'Triads of G major on the top strings',
            source: 'key: G major\ntriads: 1-3\ninversion: 1\ncolumns: 7'
        },
        {
            language: 'chord',
            name: 'How to play it, in words',
            source: 'F 133211 134211\ncaption: fingering'
        },
        {
            language: 'chord',
            name: 'What a chord is made of: its formula',
            source: 'Am7 x02010 x02010\ncaption: formula\nroot-mark: shape'
        },
        {
            language: 'fretboard',
            name: 'A scale’s formula and steps',
            source: 'A minor pentatonic\nposition: 1\ncaption: formula'
        },
        {
            language: 'chord',
            name: 'Piano: shell voicings',
            source: 'instrument: piano\nvoicing: shell\n---\nCmaj7\n---\nC7\n---\nCm7'
        },
        {
            language: 'chord',
            name: 'Ukulele and DADGAD',
            source: 'symbol: C\nfrets: 0003\nfingers: 0003\ntuning: ukulele\ntitle: C (ukulele)\n---\nsymbol: Dsus4\nfrets: 000000\ntuning: DADGAD\ntitle: Dsus4 (DADGAD)'
        },
        {
            language: 'keyboard',
            name: 'The seven modes of C major',
            source: 'modes: C major\ncolumns: 4'
        },
        {
            language: 'keyboard',
            name: "G major with both hands' fingering",
            source: 'scale: G major\nfingering: auto both'
        },
        {
            language: 'keyboard',
            name: 'Which scales fit Am Dm E7?',
            source: 'scales-for: Am Dm E7\nrange: C4-B4'
        },
        {
            language: 'fretboard',
            name: 'The five pentatonic boxes',
            source: 'A minor pentatonic\npositions: all\ncolumns: 3'
        },
        {
            language: 'fretboard',
            name: 'Am7 arpeggio up the neck',
            source: 'arpeggio: Am7\npositions: all\ncolumns: 3'
        },
        {
            language: 'fretboard',
            name: 'Blues box over Dm7',
            source: 'scale: A minor pentatonic\nchord: Dm7\nfrets: 5-8\nlabels: intervals'
        },
        {
            language: 'fretboard',
            name: 'Do Ré Mi on the neck',
            source: 'C major\nposition: 1\nlabels: notes\nnaming: solfege'
        },
        {
            language: 'chords',
            name: 'A song with its chord diagrams',
            source: '{title: Example}\n{diagrams: on}\n{define: F base-fret 1 frets 1 3 3 2 1 1 fingers 1 3 4 2 1 1}\n\n[C]Hello [F]little [G]world, [C]hello'
        },
        {
            language: 'chords',
            name: 'A riff in bars',
            source: '{title: Riff}\n{time: 4/4}\n| [E5]. . . . | [G5]. . [A5]. . |\n| [E5]. . . . | [G5]. . [D5]. [A5]. |'
        },
        {
            language: 'strum',
            name: 'Old faithful, with chord changes',
            source: '[G]D - D U [C]- U D U\ntitle: Old faithful'
        },
        { language: 'strum', name: 'A swung shuffle', source: 'D DU UDU\nswing: yes\nchord: E7' },
        {
            language: 'strum',
            name: 'Funk sixteenths',
            source: 'D> U D U X U D U D> U D U X U D U\nsubdivision: 16ths\nchord: E9\ntempo: 95'
        },
        {
            language: 'picking',
            name: 'Travis picking',
            source: 'pattern: travis\nchords: C Am F G\ntempo: 80'
        },
        {
            language: 'progression',
            name: 'The pop progression, in G',
            source: 'I V vi IV\nkey: G\nfunctions: yes'
        },
        {
            language: 'progression',
            name: 'Strum along at 80 BPM',
            source: 'I vi IV V\nkey: G\ntime: 4/4\ntempo: 80\nstrum: D - D U - U D U'
        },
        {
            language: 'progression',
            name: 'Jazz ii-V-I, rootless piano',
            source: 'ii7 V7 Imaj7\nkey: C\ninstrument: piano\nvoicing: rootless A\nhands: left+right'
        },
        {
            language: 'progression',
            name: 'Every chord of A harmonic minor',
            source: 'key: A harmonic minor\nharmonize: sevenths'
        },
        { language: 'circle', name: 'The circle of fifths in G', source: 'key: G' },
        { language: 'circle', name: 'A dorian on the wheel', source: 'key: A dorian' },
        {
            language: 'tab',
            name: 'A riff',
            source: '\\title "Riff"\n\\tempo 100\n.\n:8 0.6 3.6 5.6 0.6 3.6 6.6 5.6 r | 0.6 3.6 5.6 3.6 0.6 r r r'
        },
        {
            language: 'score',
            name: 'Chords on a staff and a tab',
            source: 'staves: both\n:4 (0.1 1.2 0.3 2.4 3.5).2 (3.1 0.2 0.3 0.4 2.5 3.6).2'
        }
    ]
    const TAB = ['tab', 'score']
    const $ = (id) => document.getElementById(id)

    const start = () => {
        const language = $('mn-language')
        const example = $('mn-example')
        const source = $('mn-source')
        const output = $('mn-output')
        const orientation = $('mn-orientation')
        const left = $('mn-left')
        const naming = $('mn-naming')
        const rootShape = $('mn-root-shape')
        const surprise = $('mn-surprise')
        const copyLink = $('mn-copy-link')
        const copyMarkdown = $('mn-copy-markdown')
        const said = $('mn-said')
        if (!language || !example || !source || !output || !orientation || !left || !naming) return

        // The examples, grouped by block.
        for (const lang of [...new Set(EXAMPLES.map((e) => e.language))]) {
            const group = document.createElement('optgroup')
            group.label = lang
            EXAMPLES.forEach((e, i) => {
                if (e.language !== lang) return
                const option = document.createElement('option')
                option.value = String(i)
                option.textContent = e.name
                group.appendChild(option)
            })
            example.appendChild(group)
        }

        let current = null
        let timer = null
        const clear = () => {
            if (current) current.destroy()
            current = null
            output.replaceChildren()
        }
        const draw = () => {
            const api = window.MusicNotation
            if (!api) {
                setTimeout(draw, 100)
                return
            }
            clear()
            if (TAB.includes(language.value)) {
                // Tabs and scores: a code block the tab bundle finds and draws, with its player.
                const pre = document.createElement('pre')
                const code = document.createElement('code')
                code.className = `language-${language.value}`
                code.textContent = source.value
                pre.appendChild(code)
                output.appendChild(pre)
                return
            }
            const options = {
                voicings: api.lookupGuitarVoicing,
                // Play bars, as on any page: the soundfont once the tab bundle has it, else the
                // light synthesizer.
                play: { player: () => window.musicNotationSoundfontPlayer || null }
            }
            if (orientation.value) {
                options.orientation = {
                    chord: orientation.value,
                    keyboard: orientation.value,
                    fretboard: orientation.value
                }
            }
            if (left.checked) options.hand = 'left'
            if (naming.value) options.naming = naming.value
            if (rootShape && rootShape.checked) options.rootMark = 'shape'
            current = api.renderBlock(language.value, source.value, output, options)
        }
        // While typing, the block redraws once you pause (a redraw stops what plays).
        const later = () => {
            clearTimeout(timer)
            timer = setTimeout(() => {
                draw()
                remember()
            }, 250)
        }

        // The block, its source and the options live in the address: a link shows the same block.
        const remember = () => {
            const params = new URLSearchParams({ block: language.value, source: source.value })
            if (orientation.value) params.set('orientation', orientation.value)
            if (left.checked) params.set('hand', 'left')
            if (naming.value) params.set('naming', naming.value)
            if (rootShape && rootShape.checked) params.set('root', 'shape')
            history.replaceState(null, '', `#${params.toString()}`)
        }
        const recall = () => {
            const params = new URLSearchParams(location.hash.slice(1))
            const block = params.get('block')
            if (!block || ![...language.options].some((o) => o.value === block)) return false
            language.value = block
            source.value = params.get('source') || ''
            orientation.value = params.get('orientation') || ''
            left.checked = params.get('hand') === 'left'
            naming.value = params.get('naming') || ''
            if (rootShape) rootShape.checked = params.get('root') === 'shape'
            return true
        }
        const use = (i) => {
            const e = EXAMPLES[i]
            if (!e) return
            language.value = e.language
            source.value = e.source
            example.value = String(i)
            draw()
            remember()
        }
        const say = (text) => {
            if (!said) return
            said.textContent = text
            setTimeout(() => {
                if (said.textContent === text) said.textContent = ''
            }, 2000)
        }
        const copy = (text, done) => {
            if (!navigator.clipboard) return say('Copying is not available here')
            navigator.clipboard.writeText(text).then(
                () => say(done),
                () => say('Could not copy')
            )
        }

        example.addEventListener('change', () => use(Number(example.value)))
        language.addEventListener('change', () => {
            // A new block type starts from its first example.
            use(EXAMPLES.findIndex((e) => e.language === language.value))
        })
        source.addEventListener('input', () => {
            example.value = ''
            later()
        })
        for (const control of [orientation, left, naming, rootShape].filter(Boolean))
            control.addEventListener('change', () => {
                draw()
                remember()
            })
        if (surprise)
            surprise.addEventListener('click', () => {
                // Another example than the one shown.
                let i = Math.floor(Math.random() * EXAMPLES.length)
                if (String(i) === example.value) i = (i + 1) % EXAMPLES.length
                use(i)
            })
        if (copyLink) copyLink.addEventListener('click', () => copy(location.href, 'Link copied'))
        if (copyMarkdown)
            copyMarkdown.addEventListener('click', () =>
                copy(
                    `\`\`\`${language.value}\n${source.value}\n\`\`\`\n`,
                    'Copied: paste it in a note'
                )
            )

        if (recall()) draw()
        else use(0)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
})()
