/**
 * alphaTab's sound through the library's room and limiter (#103). alphaTab has no reverb of its
 * own and gives no place to plug one in: each time it starts to play, it makes an output node and
 * connects it to the speakers. This takes that node and connects it to the chain instead.
 *
 * The node is in a field alphaTab keeps to itself, and its name differs between alphaTab's builds
 * (the minified one shortens it). So the node is found by what it is: the one audio node the
 * output holds besides its `source` (a public field, like `context`). When nothing is found
 * (another alphaTab, another output), nothing is changed: the sound stays as it was.
 * `room.spec.ts` fails when the alphaTab in use no longer has those public fields.
 */
import type * as AT from '@coderline/alphatab'
import { ampFor, outputFor, type PlayEffects } from '../playback/effects.js'
import type { GuitarTone } from '../playback/guitar-tone.js'

/** What alphaTab's output holds, as far as this module reads it. */
interface OutputLike {
    context?: BaseAudioContext | null
    /** The silent source that feeds alphaTab's output node: not the node to take. */
    source?: unknown
    [field: string]: unknown
}

/** A node that makes or passes sound on, and isn't a source to start (alphaTab's feeder). */
const isOutputNode = (value: unknown): value is AudioNode =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AudioNode).connect === 'function' &&
    typeof (value as AudioNode).disconnect === 'function' &&
    !('start' in value)

/** What plays now, read when alphaTab starts: its effects, and its guitar for the amplifier. */
export interface RoomOf {
    effects: () => PlayEffects | null | undefined
    /** The one guitar that plays (the diagrams' player); none for a score with its own tracks. */
    guitar?: () => GuitarTone | null | undefined
}

/** When to look for alphaTab's node after it says it plays (ms): it makes the node a bit later. */
const LOOKS = [0, 20, 60, 150, 400, 1000]

/** The output node alphaTab made for this play, and its context; null when it isn't there (yet). */
export function outputNodeOf(player: unknown): { ctx: BaseAudioContext; node: AudioNode } | null {
    const output = (player as { output?: OutputLike } | null | undefined)?.output
    const ctx = output?.context
    if (!output || !ctx) return null
    for (const field of Object.keys(output)) {
        const value = output[field]
        if (value !== output.source && value !== ctx && isOutputNode(value))
            return { ctx, node: value }
    }
    return null
}

/**
 * Sends what alphaTab plays through the room and the limiter, from now on: at each start, its
 * new output node goes to the chain (through an electric guitar's amplifier when one is asked for
 * and one guitar plays). `dry` leaves alphaTab's own connection. `look` does it now, for a play
 * alphaTab starts without saying so (the one-time plays of the diagrams' player); `stop` ends it.
 */
export function throughRoom(
    api: AT.AlphaTabApi,
    playing: (state: unknown) => boolean,
    room: RoomOf,
    win: Pick<Window, 'setTimeout' | 'clearTimeout'>
): { look: () => void; stop: () => void } {
    const routed = new WeakSet<AudioNode>()
    let timers: number[] = []
    let alive = true
    const route = () => {
        if (!alive) return
        const found = outputNodeOf(api.player)
        if (!found || routed.has(found.node)) return
        let effects: PlayEffects | undefined
        let guitar: GuitarTone | null = null
        try {
            effects = room.effects() ?? undefined
            guitar = room.guitar?.() ?? null
        } catch {
            effects = undefined
        }
        if (effects?.dry) return
        try {
            const out = outputFor(found.ctx, effects)
            // No chain in this context: alphaTab's own connection stays.
            if (out === found.ctx.destination) return
            const amp =
                guitar === 'clean' || guitar === 'overdrive'
                    ? ampFor(found.ctx, effects?.amp)
                    : null
            found.node.disconnect()
            if (amp) {
                found.node.connect(amp.input)
                amp.output.connect(out)
            } else found.node.connect(out)
            routed.add(found.node)
        } catch {
            // The node keeps what it had, or is silent until alphaTab makes the next one.
        }
    }
    const look = () => {
        if (!alive) return
        for (const id of timers) win.clearTimeout(id)
        timers = LOOKS.map((ms) => win.setTimeout(route, ms))
    }
    api.playerStateChanged.on((e) => {
        if (alive && playing(e.state)) look()
    })
    return {
        look,
        stop() {
            alive = false
            for (const id of timers) win.clearTimeout(id)
            timers = []
        }
    }
}
