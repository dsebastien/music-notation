// Prototype for music-notation #58: four playback UIs over the real released bundle.
// The library draws the diagrams (with its own bar turned off: play: false); this file adds each
// design's controls and plays through the library's public API (sequenceOf, lightPlayer,
// noteTargets, followNotes), so the buttons make the same sound as the real bar.
;(() => {
    const FRAME = document.body.classList.contains('p-frame')
    // What plays now, and the controls that show it.
    let current = null
    const listeners = new Set()
    let decorate = () => {}

    // The same content in every design.
    const CONTENT = [
        { title: 'A single chord', blocks: [['chord', 'A x02220 x01230']] },
        { title: 'A row of voicings', blocks: [['chord', 'C\nvoicings: 6']] },
        {
            title: 'A two-octave keyboard scale',
            blocks: [['keyboard', 'scale: D major\nfingering: auto']]
        },
        {
            title: 'A fretboard position',
            blocks: [['fretboard', 'scale: A minor pentatonic\nposition: 1']]
        },
        {
            title: 'A page with 20+ small diagrams',
            blocks: [
                [
                    'chord',
                    'columns: 8\n---\nG 320003\n---\nC x32010\n---\nD xx0232\n---\nEm 022000\n---\nAm x02210\n---\nE 022100\n---\nA x02220\n---\nDm xx0231'
                ],
                [
                    'chord',
                    'columns: 8\n---\nCmaj7\n---\nDm7\n---\nEm7\n---\nFmaj7\n---\nG7\n---\nAm7\n---\nBm7b5\n---\nE7'
                ],
                ['fretboard', 'scale: A minor pentatonic\npositions: all']
            ]
        }
    ]

    const DESIGNS = {
        a: {
            name: 'A · A strip under each diagram',
            note: "A slim row under each diagram, outside the drawing: play/stop, loop and the speed. Volume and sound move to the app's settings. Faint until the pointer or focus is on the diagram; always full on touch screens. A dot or a key plays its note."
        },
        b: {
            name: "B · A play button in each diagram's title row",
            note: 'A small ▶ above each diagram (in a title row added over it, never on it). ⋯ opens the other settings inline, pushing the diagram down instead of covering it. A dot or a key plays its note.'
        },
        c: {
            name: 'C · One bar under each block (decided)',
            note: "One bar under the whole block, also for a single diagram: play, play all in turn (one beat between diagrams, the loop button starts over), loop, the speed and the sound. Volume lives in the app's settings only. Click a diagram (or Space or Enter on it) to select and hear it; a dot or a key plays its note."
        },
        d: {
            name: 'D · Click the diagram; settings off the page',
            note: "No controls on the page. Click a diagram (or focus it and press Space or Enter) to play or stop it; a dot or a key plays its note. The ♪ button stands for the app's place for settings: Music Practice's side panel or Settings → Playback, a site option on Publish."
        }
    }

    // ---- Page -------------------------------------------------------------------------------

    const main = document.getElementById('main')
    const section = (design) => {
        const panel = document.createElement('section')
        panel.className = 'p-panel'
        panel.dataset.design = design
        if (DESIGNS[design]) {
            const h = document.createElement('h1')
            h.textContent = DESIGNS[design].name
            const p = document.createElement('p')
            p.className = 'p-note'
            p.textContent = DESIGNS[design].note
            panel.append(h, p)
        }
        for (const part of CONTENT) {
            const h = document.createElement('h2')
            h.textContent = part.title
            panel.appendChild(h)
            for (const [lang, src] of part.blocks) {
                const pre = document.createElement('pre')
                const code = document.createElement('code')
                code.className = `language-${lang}`
                code.textContent = src
                pre.appendChild(code)
                panel.appendChild(pre)
            }
        }
        main.appendChild(panel)
        return panel
    }

    if (FRAME) {
        section('today')
        if (location.hash === '#dark') document.body.className = 'theme-dark p-frame'
        window.addEventListener('message', (e) => {
            if (e.data?.theme) document.body.className = `theme-${e.data.theme} p-frame`
        })
        load()
        return
    }

    const panels = {}
    const today = document.createElement('section')
    today.className = 'p-panel'
    today.dataset.design = 'today'
    today.innerHTML =
        '<h1>Today · the hover bar (released 0.13)</h1><p class="p-note">The bar sits over the bottom of each diagram and shows on hover, focus or a tap. Point at a diagram: on chord diagrams and short keyboards it covers dots, keys and labels, and moving to reach them brings it back.</p>'
    const frame = document.createElement('iframe')
    frame.src = 'today.html'
    frame.title = 'Today: the hover bar'
    frame.className = 'p-today'
    today.appendChild(frame)
    main.appendChild(today)
    panels.today = today
    for (const key of Object.keys(DESIGNS)) panels[key] = section(key)

    const tabs = [...document.querySelectorAll('[data-tab]')]
    const select = (key) => {
        stopAll()
        for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.tab === key))
        for (const [k, p] of Object.entries(panels)) p.hidden = k !== key
        history.replaceState(null, '', `#${key}`)
        decorate(key)
    }
    tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.tab)))
    select(location.hash.slice(1) in panels ? location.hash.slice(1) : 'today')

    const dark = document.getElementById('dark')
    const theme = () => {
        const name = dark.checked ? 'dark' : 'light'
        document.body.className = `theme-${name}`
        frame.contentWindow?.postMessage({ theme: name }, '*')
    }
    dark.addEventListener('change', theme)
    frame.addEventListener('load', theme)

    // Each design is set up the first time its tab shows: it measures its diagrams.
    let loaded = false
    const decorated = new Set()
    decorate = (key) => {
        if (!loaded || decorated.has(key) || !DECORATE[key]) return
        decorated.add(key)
        DECORATE[key](panels[key])
    }
    load(() => {
        loaded = true
        decorate(location.hash.slice(1))
    })

    // ---- Library ----------------------------------------------------------------------------

    function load(then) {
        const s = document.createElement('script')
        s.src = 'music-notation.publish.min.js'
        s.onload = () => {
            // The bundle renders on load and on changes: wait until every block has drawn.
            const want = document.querySelectorAll('pre > code[class^="language-"]').length
            const wait = () => {
                const done = document.querySelectorAll('[data-mp-rendered]').length
                if (done >= want || !then) {
                    setTimeout(() => then?.(), 50)
                } else setTimeout(wait, 50)
            }
            wait()
        }
        document.head.appendChild(s)
    }

    const MN = () => window.MusicNotation
    let lightPlayer = null
    const player = () => (lightPlayer ??= MN().lightPlayer(window))

    // What the app's settings would hold (Music Practice: Settings → Playback).
    const appSettings = { volume: 0.8, bpm: 90, strum: 12, sound: null, loop: false }

    const dataOf = (svg) => {
        const pitches = (svg.getAttribute('data-mn-pitches') ?? '')
            .split(' ')
            .filter(Boolean)
            .map(Number)
        const root = svg.querySelector('.mn-root[data-midi]')
        return {
            pitches,
            kind: svg.getAttribute('data-mn-play') === 'chord' ? 'chord' : 'scale',
            sound: svg.getAttribute('data-mn-sound') === 'piano' ? 'piano' : 'guitar',
            root: root ? Number(root.getAttribute('data-midi')) % 12 : null
        }
    }
    const nameOf = (svg) => svg.querySelector('title')?.textContent?.trim() || 'diagram'

    const changed = () => listeners.forEach((f) => f())
    function stopAll() {
        if (!current) return
        const c = current
        current = null
        c.stop()
        changed()
    }
    /** Plays a diagram's notes (a chord strummed, a scale up and down), with its notes lit. */
    function playDiagram(svg, s = appSettings, after) {
        stopAll()
        const d = dataOf(svg)
        if (!d.pitches.length) return
        const sound = s.sound ?? d.sound
        const events = MN().sequenceOf(d.kind, d.pitches, {
            bpm: s.bpm,
            strum: sound === 'piano' ? 0 : s.strum,
            root: d.root,
            sound
        })
        const follower = MN().followNotes(
            window,
            svg,
            MN().noteTargets(svg, events, d.kind),
            events,
            300
        )
        let handle = null
        const me = {
            svg,
            stop() {
                handle?.stop()
                follower.stop()
            }
        }
        current = me
        handle = player().play(events, {
            sound,
            volume: s.volume,
            onStart: () => follower.heard(),
            onEnd: () => {
                follower.stop()
                if (current !== me) return
                current = null
                if (s.loop && svg.isConnected) playDiagram(svg, s, after)
                else {
                    changed()
                    after?.()
                }
            }
        })
        changed()
    }
    const playing = (svg) => current?.svg === svg

    // A dot or a key plays its note, in every design.
    document.addEventListener(
        'click',
        (event) => {
            const svg = event.target.closest?.('svg[data-mn-pitches]')
            if (!svg || svg.closest('[data-design="today"]')) return
            const target =
                event.target.closest('[data-midi]') ??
                event.target.closest('.mn-mark')?.querySelector('[data-midi]')
            if (!target) return
            event.stopPropagation()
            stopAll()
            const midi = Number(target.getAttribute('data-midi'))
            const events = [{ midi, time: 0, duration: 1.5 }]
            const follower = MN().followNotes(window, svg, [[target]], events, 300)
            const handle = player().play(events, {
                sound: appSettings.sound ?? dataOf(svg).sound,
                volume: appSettings.volume,
                onStart: () => follower.heard(),
                onEnd: () => follower.stop()
            })
            current = { svg: null, stop: () => (handle.stop(), follower.stop()) }
        },
        true
    )

    // ---- Shared controls --------------------------------------------------------------------

    const el = (tag, cls, text) => {
        const e = document.createElement(tag)
        if (cls) e.className = cls
        if (text != null) e.textContent = text
        return e
    }
    const button = (cls, label, text) => {
        const b = el('button', `p-btn ${cls}`, text)
        b.type = 'button'
        b.setAttribute('aria-label', label)
        b.title = label
        return b
    }
    const slider = (label, mark, min, max, value, set) => {
        const f = el('label', 'p-field')
        f.title = `${label}: ${value}`
        const m = el('span', 'p-mark', mark)
        m.setAttribute('aria-hidden', 'true')
        const i = el('input')
        i.type = 'range'
        i.min = min
        i.max = max
        i.value = value
        i.setAttribute('aria-label', label)
        i.addEventListener('input', () => {
            set(Number(i.value))
            f.title = `${label}: ${i.value}`
        })
        f.append(m, i)
        return f
    }
    const soundSelect = (s) => {
        const sel = el('select', 'p-select')
        sel.setAttribute('aria-label', 'Sound')
        for (const [v, t] of [
            ['', 'Own sound'],
            ['guitar', 'Guitar'],
            ['piano', 'Piano']
        ]) {
            const o = el('option', null, t)
            o.value = v
            sel.appendChild(o)
        }
        sel.addEventListener('change', () => (s.sound = sel.value || null))
        return sel
    }
    // The sound switch as on today's bar: Guitar or Piano, starting on the diagram's own.
    const instrumentSelect = (s, own) => {
        const sel = el('select', 'p-select')
        sel.setAttribute('aria-label', 'Sound')
        for (const [v, t] of [
            ['guitar', 'Guitar'],
            ['piano', 'Piano']
        ]) {
            const o = el('option', null, t)
            o.value = v
            o.selected = v === own
            sel.appendChild(o)
        }
        sel.addEventListener('change', () => (s.sound = sel.value === own ? null : sel.value))
        return sel
    }
    const speedFor = (svg, s) =>
        dataOf(svg).kind === 'scale'
            ? slider('Tempo (BPM)', '♩', 20, 240, s.bpm, (n) => (s.bpm = n))
            : slider('Strum (ms between strings)', '≋', 0, 200, s.strum, (n) => (s.strum = n))
    const loopButton = (s) => {
        const b = button('p-loop', 'Loop', '↻')
        b.setAttribute('aria-pressed', 'false')
        b.addEventListener('click', () => {
            s.loop = !s.loop
            b.setAttribute('aria-pressed', String(s.loop))
        })
        return b
    }
    const playButton = (label, isOn, toggle) => {
        const b = button('p-play', label, '▶')
        const show = () => {
            const on = isOn()
            b.textContent = on ? '■' : '▶'
            b.setAttribute('aria-label', on ? 'Stop' : label)
            b.title = on ? 'Stop' : label
        }
        b.addEventListener('click', () => {
            toggle()
            show()
        })
        listeners.add(show)
        show()
        return b
    }
    const diagramsOf = (panel) => [...panel.querySelectorAll('svg[data-mn-pitches]')]

    // ---- The designs ------------------------------------------------------------------------

    const DECORATE = {
        // A: a strip under each diagram.
        a(panel) {
            for (const svg of diagramsOf(panel)) {
                const s = { ...appSettings }
                const strip = el('div', 'p-strip')
                strip.setAttribute('role', 'group')
                strip.setAttribute('aria-label', `Play ${nameOf(svg)}`)
                strip.append(
                    playButton(
                        `Play ${nameOf(svg)}`,
                        () => playing(svg),
                        () => (playing(svg) ? stopAll() : playDiagram(svg, s))
                    ),
                    loopButton(s)
                )
                // A narrow diagram (dense rows) keeps play and loop only: the speed goes to the settings.
                if (dataOf(svg).pitches.length > 1 && svg.getBoundingClientRect().width >= 170)
                    strip.appendChild(speedFor(svg, s))
                const holder = el('div', 'p-a-holder')
                svg.replaceWith(holder)
                holder.append(svg, strip)
            }
        },

        // B: a play button in a title row above each diagram; ⋯ opens the rest inline.
        b(panel) {
            for (const svg of diagramsOf(panel)) {
                const s = { ...appSettings }
                const head = el('div', 'p-head')
                const more = button('p-more', `Playback settings for ${nameOf(svg)}`, '⋯')
                more.setAttribute('aria-expanded', 'false')
                const drawer = el('div', 'p-drawer')
                drawer.hidden = true
                drawer.append(loopButton(s))
                if (dataOf(svg).pitches.length > 1) drawer.appendChild(speedFor(svg, s))
                drawer.append(
                    slider('Volume', '🔈', 0, 100, s.volume * 100, (n) => (s.volume = n / 100)),
                    soundSelect(s)
                )
                more.addEventListener('click', () => {
                    drawer.hidden = !drawer.hidden
                    more.setAttribute('aria-expanded', String(!drawer.hidden))
                })
                head.append(
                    playButton(
                        `Play ${nameOf(svg)}`,
                        () => playing(svg),
                        () => (playing(svg) ? stopAll() : playDiagram(svg, s))
                    ),
                    el('span', 'p-head-fill'),
                    more
                )
                const holder = el('div', 'p-b-holder')
                svg.replaceWith(holder)
                holder.append(head, drawer, svg)
            }
        },

        // C: one bar per block; click a diagram to select and hear it.
        c(panel) {
            for (const block of panel.querySelectorAll('.mn-block')) {
                const svgs = [...block.querySelectorAll('svg[data-mn-pitches]')]
                if (!svgs.length) continue
                const s = { ...appSettings }
                let selected = svgs[0]
                let inTurn = false
                const bar = el('div', 'p-bar')
                bar.setAttribute('role', 'group')
                const label = el('span', 'p-target')
                const mark = () => {
                    svgs.forEach((x) =>
                        x.classList.toggle('p-selected', svgs.length > 1 && x === selected)
                    )
                    label.textContent = svgs.length > 1 ? nameOf(selected) : ''
                    bar.setAttribute('aria-label', `Play ${nameOf(selected)}`)
                }
                const busy = () => inTurn || svgs.some(playing)
                const go = (svg) => {
                    clearTimeout(pause)
                    inTurn = false
                    selected = svg
                    mark()
                    playing(svg) ? stopAll() : playDiagram(svg, s)
                }
                const stopBlock = () => {
                    inTurn = false
                    clearTimeout(pause)
                    stopAll()
                }
                // In turn, one beat (at the bar's tempo) between diagrams; the loop button starts over.
                let pause = null
                const all = (i = 0) => {
                    if (!inTurn) return
                    if (i >= svgs.length) {
                        if (!s.loop) {
                            inTurn = false
                            return changed()
                        }
                        i = 0
                    }
                    selected = svgs[i]
                    mark()
                    playDiagram(svgs[i], { ...s, loop: false }, () => {
                        pause = setTimeout(() => all(i + 1), 60000 / s.bpm)
                    })
                }
                bar.append(
                    playButton('Play', busy, () =>
                        busy() ? stopBlock() : playDiagram(selected, s)
                    )
                )
                if (svgs.length > 1) {
                    const b = button('p-all', 'Play all in turn', '▶▶')
                    b.addEventListener('click', () => {
                        stopBlock()
                        inTurn = true
                        all(0)
                    })
                    bar.append(b)
                }
                // No volume: it lives in the app's settings. The sound switch stays (the library redraws
                // the diagram for the other instrument; not in this prototype).
                bar.append(
                    label,
                    loopButton(s),
                    speedFor(selected, s),
                    instrumentSelect(s, dataOf(svgs[0]).sound)
                )
                // Below the block (after the drawing: the bundle pairs the hidden <pre> with the drawing
                // right after it, so nothing may come between those two).
                block.after(bar)
                for (const svg of svgs) {
                    svg.classList.add('p-clickable')
                    svg.setAttribute('tabindex', '0')
                    svg.addEventListener('click', () => go(svg))
                    svg.addEventListener('keydown', (e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault()
                            go(svg)
                        }
                    })
                }
                mark()
            }
        },

        // D: the diagram itself is the button; settings in one place off the page.
        d(panel) {
            let first = true
            for (const svg of diagramsOf(panel)) {
                svg.classList.add('p-clickable', 'p-d')
                svg.setAttribute('tabindex', '0')
                svg.setAttribute('aria-roledescription', 'playable diagram')
                const go = () => (playing(svg) ? stopAll() : playDiagram(svg, appSettings))
                svg.addEventListener('click', go)
                svg.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        go()
                    }
                    if (e.key === 'Escape') stopAll()
                })
                listeners.add(() => svg.classList.toggle('p-now', playing(svg)))
                if (first) {
                    first = false
                    const hint = el(
                        'p',
                        'p-hint',
                        'Tip: click a diagram to hear it, a dot or a key to hear one note. Space or Enter plays the focused diagram, Esc stops.'
                    )
                    const blk = svg.closest('.mn-block')
                    ;(blk.previousElementSibling?.tagName === 'PRE'
                        ? blk.previousElementSibling
                        : blk
                    ).before(hint)
                }
            }
            const fab = button('p-fab', 'Playback settings', '♪')
            fab.setAttribute('aria-expanded', 'false')
            const sheet = el('div', 'p-sheet')
            sheet.hidden = true
            sheet.setAttribute('role', 'dialog')
            sheet.setAttribute('aria-label', 'Playback settings')
            sheet.append(
                el('strong', null, "Playback (the app's settings)"),
                loopButton(appSettings),
                slider('Tempo (BPM)', '♩', 20, 240, appSettings.bpm, (n) => (appSettings.bpm = n)),
                slider(
                    'Strum (ms)',
                    '≋',
                    0,
                    200,
                    appSettings.strum,
                    (n) => (appSettings.strum = n)
                ),
                slider(
                    'Volume',
                    '🔈',
                    0,
                    100,
                    appSettings.volume * 100,
                    (n) => (appSettings.volume = n / 100)
                ),
                soundSelect(appSettings)
            )
            fab.addEventListener('click', () => {
                sheet.hidden = !sheet.hidden
                fab.setAttribute('aria-expanded', String(!sheet.hidden))
            })
            panel.append(fab, sheet)
        }
    }
})()
