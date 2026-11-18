/**
 * alphaTab's sound through the library's room and ceiling (#103). alphaTab has no reverb of its
 * own and gives no place to plug one in: each time it starts to play, it makes an output node and
 * connects it to its context's `destination`.
 *
 * So the context gets a `destination` of its own (a property on the object, over the browser's):
 * at each start alphaTab reads it and connects its node to what it gets, the chain's entry for
 * this play, or the speakers for `dry`. The node never sounds outside the chain. A first version
 * moved the node after alphaTab had connected it: the first 20 ms of each play went out
 * directly, then jumped into the chain (whose limiter, gone since, was 6 ms late).
 *
 * When the property can't be set, or the context was made too late for the first play, the node
 * is moved as before. It is in a field alphaTab keeps to itself, and its name differs between
 * alphaTab's builds (the minified one shortens it). So the node is found by what it is: the one
 * audio node the output holds besides its `source` (a public field, like `context`). When nothing
 * is found (another alphaTab, another output), nothing is changed: the sound stays as it was.
 * `room.spec.ts` fails when the alphaTab in use no longer has those public fields, or no longer
 * connects to its context's `destination`.
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

/** alphaTab's context, when it has one already (it makes it when its player opens). */
export function contextOf(player: unknown): BaseAudioContext | null {
    return (player as { output?: OutputLike } | null | undefined)?.output?.context ?? null
}

/** A context whose `destination` is ours: its speakers, and who answers for it now. */
interface Taken {
    speakers: AudioNode
    owner: object | null
    entry: ((speakers: AudioNode) => AudioNode) | null
    /** How many times alphaTab asked for the destination: once per node it connects. */
    asked: number
}

const taken = new WeakMap<BaseAudioContext, Taken>()

/**
 * Sends what alphaTab plays through the room and the ceiling, from now on: at each start, its
 * new output node goes to the chain (through an electric guitar's amplifier when one is asked for
 * and one guitar plays). `dry` gives it the speakers. `look` checks it now, for a play alphaTab
 * starts without saying so (the one-time plays of the diagrams' player); `stop` ends it.
 */
export function throughRoom(
    api: AT.AlphaTabApi,
    playing: (state: unknown) => boolean,
    room: RoomOf,
    win: Pick<Window, 'setTimeout' | 'clearTimeout'>
): { look: () => void; stop: () => void } {
    const routed = new WeakSet<AudioNode>()
    const self = {}
    let timers: number[] = []
    let alive = true
    let mine: Taken | null = null
    /** Where this play's sound goes: the chain's entry, an amplifier before it, or the speakers. */
    const entryFor = (ctx: BaseAudioContext, speakers: AudioNode): AudioNode => {
        let effects: PlayEffects | undefined
        let guitar: GuitarTone | null = null
        try {
            effects = room.effects() ?? undefined
            guitar = room.guitar?.() ?? null
        } catch {
            effects = undefined
        }
        if (effects?.dry) return speakers
        const out = outputFor(ctx, effects, speakers)
        if (out === speakers) return speakers
        const amp = guitar === 'clean' || guitar === 'overdrive' ? ampFor(ctx, effects?.amp) : null
        if (!amp) return out
        amp.output.connect(out)
        return amp.input
    }
    /** Gives alphaTab's context a `destination` that is the chain; true when it has one. */
    const take = (): boolean => {
        const ctx = contextOf(api.player)
        if (!ctx) return false
        const entry = (speakers: AudioNode) => entryFor(ctx, speakers)
        const had = taken.get(ctx)
        if (had) {
            // A context two players share: the last one to play answers for it.
            had.owner = self
            had.entry = entry
            mine = had
            return true
        }
        try {
            const holder: Taken = { speakers: ctx.destination, owner: self, entry, asked: 0 }
            Object.defineProperty(ctx, 'destination', {
                configurable: true,
                get: () => {
                    holder.asked++
                    try {
                        return holder.entry ? holder.entry(holder.speakers) : holder.speakers
                    } catch {
                        return holder.speakers
                    }
                }
            })
            taken.set(ctx, holder)
            mine = holder
            return true
        } catch {
            return false
        }
    }
    /**
     * The older way, for a node alphaTab connected to the speakers itself: the play in progress
     * when the context was taken (`since`: what alphaTab had asked by then), or a context that
     * can't be taken.
     */
    const route = (since: number | null) => {
        if (!alive) return
        const found = outputNodeOf(api.player)
        if (!found || routed.has(found.node)) return
        const holder = taken.get(found.ctx)
        // alphaTab asked for the destination since: this node is in the chain already.
        if (holder && (since === null || holder.asked > since)) return
        try {
            const speakers = holder ? holder.speakers : found.ctx.destination
            const entry = entryFor(found.ctx, speakers)
            // Dry, or no chain in this context: alphaTab's own connection stays.
            if (entry === speakers) return
            found.node.disconnect()
            found.node.connect(entry)
            routed.add(found.node)
        } catch {
            // The node keeps what it had, or is silent until alphaTab makes the next one.
        }
    }
    const look = () => {
        if (!alive) return
        for (const id of timers) win.clearTimeout(id)
        timers = []
        // Taken before this play: alphaTab connects its node to the chain itself.
        const before = contextOf(api.player)
        if (before && taken.has(before) && take()) return
        const since = take() ? (mine?.asked ?? 0) : null
        timers = LOOKS.map((ms) => win.setTimeout(() => route(since), ms))
    }
    take()
    // alphaTab makes its context when its player opens, before it says it is ready.
    const ready = (api as { playerReady?: { on?: (f: () => void) => void } }).playerReady
    if (typeof ready?.on === 'function')
        ready.on(() => {
            if (alive) take()
        })
    api.playerStateChanged.on((e) => {
        if (alive && playing(e.state)) look()
    })
    return {
        look,
        stop() {
            alive = false
            for (const id of timers) win.clearTimeout(id)
            timers = []
            // The context sounds as alphaTab made it again.
            if (mine && mine.owner === self) {
                mine.owner = null
                mine.entry = null
            }
        }
    }
}
