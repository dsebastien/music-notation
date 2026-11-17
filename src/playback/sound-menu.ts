/**
 * The Sound menu of the play bars (#103): the four guitars, then the piano. A guitar chosen here
 * comes before the block's `guitar:` line and the app's or page's guitar, for the block the bar
 * is in, until it is drawn again. Nothing is stored.
 */

import type { Translator } from '../i18n/translate.js'
import { html } from '../render/dom.js'
import { guitarFor, type PlayOptions } from './controls.js'
import { chooseGuitar, DEFAULT_GUITAR_TONE, GUITAR_TONES, type GuitarTone } from './guitar-tone.js'
import type { Sound } from './player.js'

/** An entry of the menu: a guitar, or the piano. */
export type SoundChoice = GuitarTone | 'piano'

export interface SoundMenu {
    el: HTMLSelectElement
    /** Shows what plays now: the piano, or the guitar in effect (an app's setting may have changed). */
    show(): void
}

/**
 * The menu of a bar that plays `played` (the drawing, or each diagram's wrapper). `sound` is the
 * bar's sound now; `set` gives it the instrument chosen.
 */
export function soundMenu(
    doc: Document,
    tr: Translator,
    options: PlayOptions,
    played: () => Element[],
    sound: () => Sound,
    set: (sound: Sound) => void
): SoundMenu {
    const el = html(doc, 'select', 'mn-play-sound')
    const label = tr('playback.sound')
    el.setAttribute('aria-label', label)
    el.title = label
    const names: Record<SoundChoice, string> = {
        steel: tr('playback.guitar.steel'),
        nylon: tr('playback.guitar.nylon'),
        clean: tr('playback.guitar.clean'),
        overdrive: tr('playback.guitar.overdrive'),
        piano: tr('playback.piano')
    }
    for (const value of [...GUITAR_TONES, 'piano'] as const) {
        const option = html(doc, 'option', undefined, names[value])
        option.value = value
        el.appendChild(option)
    }
    const show = () => {
        el.value =
            sound() === 'piano' ? 'piano' : (guitarFor(options, played()[0]) ?? DEFAULT_GUITAR_TONE)
    }
    el.addEventListener('change', () => {
        const guitar = GUITAR_TONES.find((tone) => tone === el.value)
        // A value that is no entry of the menu (set by a script) changes nothing.
        if (!guitar && el.value !== 'piano') return show()
        if (guitar) for (const element of played()) chooseGuitar(element, guitar)
        const next: Sound = guitar ? 'guitar' : 'piano'
        // The same instrument keeps what plays: the guitar chosen is heard at the next play.
        if (next !== sound()) set(next)
    })
    // The closed menu says what plays before it opens.
    el.addEventListener('pointerdown', show)
    el.addEventListener('focus', show)
    show()
    return { el, show }
}
