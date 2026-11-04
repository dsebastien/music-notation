/**
 * Hands a timed play bar to the app (#77): its kind, drawing and tempo, a slot for the app's
 * controls, and the tempo changes. Pure DOM; no-op without `PlayOptions.timedBar`.
 */
import { html } from '../render/dom.js'
import type { PlayOptions, TimedBar } from './controls.js'

export interface AppBar {
    /** To call when the bar's tempo changes. */
    tempoChanged(bpm: number): void
    /** Frees what the app set up (its returned function). */
    free(): void
}

const NONE: AppBar = { tempoChanged() {}, free() {} }

export function handToApp(
    options: PlayOptions,
    bar: HTMLElement,
    info: Pick<TimedBar, 'kind' | 'drawing' | 'compound' | 'tempo'>
): AppBar {
    const hook = options.timedBar
    if (!hook) return NONE
    const listeners = new Set<(bpm: number) => void>()
    let slot: HTMLElement | null = null
    const timed: TimedBar = {
        ...info,
        element: bar,
        onTempo(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        add(control) {
            if (!slot) {
                slot = html(bar.ownerDocument, 'span', 'mn-play-app')
                bar.appendChild(slot)
            }
            slot.appendChild(control)
        }
    }
    let free: (() => void) | null = null
    try {
        const given = hook(timed)
        if (typeof given === 'function') free = given
    } catch {
        // The app's mistake: the bar stays as the library drew it.
    }
    return {
        tempoChanged(bpm) {
            for (const listener of [...listeners]) {
                try {
                    listener(bpm)
                } catch {
                    // An app listener that fails doesn't stop the others or the bar.
                }
            }
        },
        free() {
            listeners.clear()
            try {
                free?.()
            } catch {
                // Already gone.
            }
            free = null
        }
    }
}
