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
