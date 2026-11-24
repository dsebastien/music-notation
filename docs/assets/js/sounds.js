// The Sounds page: the same music played by each sound the library has, side by side.
// GeneralUser GS through the sample player (no alphaTab) and through alphaTab, sonivox (the
// soundfont that ships with alphaTab), and the light synthesizer (built in). Each column is drawn
// by window.MusicNotation (the main bundle) or window.MusicNotationTab (the tab bundle), with a
// player of its own.
;(function () {
    var GENERALUSER =
        'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser'

    /** Diagrams and patterns: one row each, one column per sound. */
    var DIAGRAMS = [
        { title: 'A G chord, strummed', language: 'chord', source: 'G' },
        {
            title: 'A C major chord on the piano',
            language: 'chord',
            source: 'C\ninstrument: piano'
        },
        {
            title: 'A strumming pattern',
            language: 'strum',
            source: 'D DU UDU\nchord: Am\ntempo: 90'
        },
        { title: 'A progression', language: 'progression', source: 'I V vi IV\nkey: G' },
        {
            title: 'The A minor pentatonic scale',
            language: 'fretboard',
            source: 'scale: A minor pentatonic\nfrets: 5-8'
        }
    ]

    /** The four guitars (#103): the name a `guitar:` line takes, and what it is. */
    var GUITARS = [
        { tone: 'steel', name: 'Steel-string acoustic', note: 'guitar: steel, the default' },
        { tone: 'nylon', name: 'Classical', note: 'guitar: nylon' },
        { tone: 'clean', name: 'Clean electric', note: 'guitar: clean' },
        { tone: 'overdrive', name: 'Overdriven electric', note: 'guitar: overdrive' }
    ]

    /** What each guitar plays: one row each, one column per guitar. */
    var GUITAR_EXAMPLES = [
        { title: 'An E minor chord, strummed', language: 'chord', source: 'Em' },
        {
            title: 'A strumming pattern on a power chord',
            language: 'strum',
            source: 'D DU UDU\nchord: A5\ntempo: 100'
        }
    ]

    /**
     * Before and after (#103): what the switch of "The room and the amplifier" plays, once per
     * guitar. The switch is read at each play and at each pass of a loop.
     */
    var ROOM_EXAMPLES = [
        {
            title: 'A chord progression, strummed',
            language: 'progression',
            source: 'I V vi IV\nkey: G\ntempo: 90\nstrum: D - D U - U D U'
        },
        {
            title: 'An arpeggio',
            language: 'picking',
            source: 'p i m a m i\ntime: 3/4\nchords: Am Dm E7 Am\ntempo: 80'
        }
    ]

    /** The switch's choices: no effects, the default room, the room and an amplifier. */
    var ROOM_CHOICES = [
        { value: 'dry', label: 'Before: dry' },
        { value: 'room', label: 'After: the room' },
        { value: 'amp', label: 'The room and an amplifier' }
    ]

    /** The amplifier of the switch's third choice: the library has none by default. */
    var AMP = { drive: 0.4, cabinet: true }

    /** A riff with held notes at the end: tabs play through alphaTab only. */
    var RIFF =
        '\\tempo 90\n.\n:8 0.6 3.6 5.6 0.6 3.6 6.6 5.6 0.6 | 0.6 3.6 5.6 3.6 :2 0.6 | :1 (0.6 2.5 2.4 1.3 0.2 0.1)'

    function waitFor(test, then) {
        var tries = 0
        var timer = setInterval(function () {
            var value = test()
            if (value || ++tries > 200) {
                clearInterval(timer)
                then(value || null)
            }
        }, 50)
    }

    function cell(row, heading, note) {
        var div = document.createElement('div')
        div.className = 'mn-sounds-cell'
        var h = document.createElement('div')
        h.className = 'mn-sounds-head'
        h.textContent = heading
        div.appendChild(h)
        if (note) {
            var n = document.createElement('div')
            n.className = 'mn-sounds-note'
            n.textContent = note
            div.appendChild(n)
        }
        row.appendChild(div)
        return div
    }

    /**
     * The four guitars, one column each: every example with GeneralUser GS, then the chord with
     * sonivox and with the light synthesizer. The guitar is the block's own `guitar:` line.
     */
    function guitars(api, sounds) {
        var root = document.getElementById('mn-sounds-guitars')
        if (!root) return
        sounds.forEach(function (sound) {
            sound.examples.forEach(function (example) {
                var h = document.createElement('h3')
                h.textContent = example.title + ': ' + sound.name
                root.appendChild(h)
                var row = document.createElement('div')
                row.className = 'mn-sounds-row'
                root.appendChild(row)
                GUITARS.forEach(function (guitar) {
                    var host = cell(row, guitar.name, guitar.note)
                    api.renderBlock(
                        example.language,
                        example.source + '\nguitar: ' + guitar.tone,
                        host,
                        {
                            voicings: api.lookupGuitarVoicing,
                            play: { player: sound.player },
                            copy: false
                        }
                    )
                })
            })
        })
    }

    /**
     * Before and after (#103): one switch, then every example once per guitar with GeneralUser GS
     * (the sample player), and the riff through alphaTab. Each block asks the switch what to play:
     * `dry`, nothing (the default room), or the room and an amplifier (the two electric guitars
     * only: the library gives no amplifier to the others, nor to a tab).
     */
    function beforeAfter(api, tab, alphaTab, player, assets) {
        var root = document.getElementById('mn-sounds-room')
        if (!root) return
        var chosen = 'room'
        var field = document.createElement('fieldset')
        field.className = 'mn-sounds-switch'
        var legend = document.createElement('legend')
        legend.textContent = 'This section plays'
        field.appendChild(legend)
        ROOM_CHOICES.forEach(function (choice) {
            var label = document.createElement('label')
            var input = document.createElement('input')
            input.type = 'radio'
            input.name = 'mn-sounds-room'
            input.value = choice.value
            input.checked = choice.value === chosen
            input.addEventListener('change', function () {
                if (input.checked) chosen = choice.value
            })
            label.appendChild(input)
            label.appendChild(document.createTextNode(' ' + choice.label))
            field.appendChild(label)
        })
        root.appendChild(field)
        ROOM_EXAMPLES.forEach(function (example) {
            var h = document.createElement('h4')
            h.textContent = example.title
            root.appendChild(h)
            var row = document.createElement('div')
            row.className = 'mn-sounds-row'
            root.appendChild(row)
            GUITARS.forEach(function (guitar) {
                var host = cell(row, guitar.name, guitar.note)
                api.renderBlock(
                    example.language,
                    example.source + '\nguitar: ' + guitar.tone,
                    host,
                    {
                        voicings: api.lookupGuitarVoicing,
                        play: {
                            player: player,
                            dry: function () {
                                return chosen === 'dry'
                            },
                            amp: function () {
                                return chosen === 'amp' ? AMP : null
                            }
                        },
                        copy: false
                    }
                )
            })
        })
        var h = document.createElement('h4')
        h.textContent = 'A riff through alphaTab'
        root.appendChild(h)
        var row = document.createElement('div')
        row.className = 'mn-sounds-row mn-sounds-tabs'
        root.appendChild(row)
        tab.renderTab('tab', RIFF, cell(row, 'GeneralUser GS', 'through alphaTab'), {
            alphaTab: alphaTab,
            assets: assets,
            effects: function () {
                return chosen === 'dry' ? { dry: true } : null
            }
        })
    }

    function start() {
        var root = document.getElementById('mn-sounds')
        var tabs = document.getElementById('mn-sounds-tabs')
        if (!root) return
        waitFor(
            function () {
                return window.MusicNotation && window.MusicNotationTab
            },
            function (ready) {
                if (!ready) {
                    root.textContent =
                        'The library did not load: check your network, then reload the page.'
                    return
                }
                var api = window.MusicNotation
                var tab = window.MusicNotationTab
                var light = api.lightPlayer(window)
                var sampled = api.sampledPlayer(window, GENERALUSER, light)
                var cdn = tab.alphaTabCdn()
                tab.loadAlphaTab().then(
                    function (alphaTab) {
                        var base = { scriptFile: null, font: cdn.font, soundFont: cdn.soundFont }
                        var generaluser = tab.createSoundfontPlayer(
                            alphaTab,
                            Object.assign({ instruments: GENERALUSER }, base),
                            document,
                            light
                        )
                        var sonivox = tab.createSoundfontPlayer(alphaTab, base, document, light)
                        var sounds = [
                            {
                                name: 'GeneralUser GS',
                                note: 'sample player, no alphaTab',
                                player: sampled
                            },
                            {
                                name: 'GeneralUser GS',
                                note: 'through alphaTab',
                                player: generaluser
                            },
                            { name: 'sonivox', note: 'through alphaTab', player: sonivox },
                            { name: 'Light synthesizer', note: 'built in', player: light }
                        ]
                        DIAGRAMS.forEach(function (example) {
                            var h = document.createElement('h3')
                            h.textContent = example.title
                            root.appendChild(h)
                            var row = document.createElement('div')
                            row.className = 'mn-sounds-row'
                            root.appendChild(row)
                            sounds.forEach(function (sound) {
                                var host = cell(row, sound.name, sound.note)
                                api.renderBlock(example.language, example.source, host, {
                                    // Chords by name, as the page's own blocks.
                                    voicings: api.lookupGuitarVoicing,
                                    play: { player: sound.player },
                                    copy: false
                                })
                            })
                        })
                        guitars(api, [
                            { name: 'GeneralUser GS', player: sampled, examples: GUITAR_EXAMPLES },
                            {
                                name: 'sonivox, through alphaTab',
                                player: sonivox,
                                examples: GUITAR_EXAMPLES.slice(0, 1)
                            },
                            {
                                name: 'Light synthesizer',
                                player: light,
                                examples: GUITAR_EXAMPLES.slice(0, 1)
                            }
                        ])
                        beforeAfter(
                            api,
                            tab,
                            alphaTab,
                            sampled,
                            Object.assign({ instruments: GENERALUSER }, base)
                        )
                        if (!tabs) return
                        var row = document.createElement('div')
                        row.className = 'mn-sounds-row mn-sounds-tabs'
                        tabs.appendChild(row)
                        ;[
                            {
                                name: 'GeneralUser GS',
                                assets: Object.assign({ instruments: GENERALUSER }, base)
                            },
                            { name: 'sonivox', assets: base }
                        ].forEach(function (sound) {
                            var host = cell(row, sound.name, 'through alphaTab')
                            tab.renderTab('tab', RIFF, host, {
                                alphaTab: alphaTab,
                                assets: sound.assets
                            })
                        })
                    },
                    function () {
                        root.textContent =
                            'alphaTab did not load: check your network, then reload the page.'
                    }
                )
            }
        )
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
})()
