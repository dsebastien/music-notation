/**
 * Live volume (#85): a play that is sounding follows the app's volume. The app calls
 * `volumeChanged()` when its volume changes; each live play reads its volume again and, when it
 * differs, gives it to its notes at once (`PlayHandle.setVolume`). Before, the volume was read only
 * when a play or a loop pass started.
 */
import type { PlayHandle } from './player.js'

const listeners = new Set<() => void>()

/** A volume between 0 and 1; anything else is null (ignored). */
const level = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null

/** The app's volume changed: every play that sounds reads its volume again and applies it. */
export function volumeChanged(): void {
    for (const listener of [...listeners]) {
        try {
            listener()
        } catch {
            // A volume that can't be read keeps the level it has.
        }
    }
}

/**
 * Follows the volume for a live play: `read` gives the volume now, `handles` the plays that may
 * still sound. Returns the function that stops following (call it when the play stops or ends).
 */
export function followVolume(
    read: () => number,
    handles: () => Iterable<PlayHandle>,
    start: number
): () => void {
    let last = level(start)
    const listener = () => {
        const now = level(read())
        if (now === null || now === last) return
        last = now
        for (const h of handles()) h.setVolume?.(now)
    }
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
