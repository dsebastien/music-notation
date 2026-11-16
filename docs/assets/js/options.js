// The guide's page options, read by the library's bundles: every example plays GeneralUser GS,
// one small file per instrument, from the sounds package on jsDelivr (a page loads only what it plays).
window.musicNotationOptions = Object.assign({}, window.musicNotationOptions, {
    play: {
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser'
    }
})
