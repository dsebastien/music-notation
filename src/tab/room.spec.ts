/** alphaTab's sound through the room (#103): the hook, and the alphaTab fields it relies on. */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { outputNodeOf, throughRoom } from './room.js'

const node = () => {
    const calls: string[] = []
    return {
        calls,
        connect(to: { name?: string }) {
            calls.push(`connect:${to.name ?? '?'}`)
        },
        disconnect() {
            calls.push('disconnect')
        }
    }
}

/**
 * A context with what the chain needs, enough to see where a node ends up. Its nodes are named
 * in the order they are made: the chain's entry is the first gain.
 */
function context(frozen = false) {
    let made = 0
    const links: string[] = []
    const make = (kind: string) => {
        const name = `${kind}${++made}`
        return {
            name,
            connect(to: { name?: string }) {
                links.push(`${name}>${to.name ?? '?'}`)
            },
            gain: { value: 1, setTargetAtTime() {} },
            threshold: { value: 0 },
            knee: { value: 0 },
            ratio: { value: 0 },
            attack: { value: 0 },
            release: { value: 0 },
            frequency: { value: 0 },
            Q: { value: 0 },
            type: '',
            curve: null,
            oversample: 'none',
            normalize: true,
            buffer: null
        }
    }
    const ctx = {
        links,
        sampleRate: 8000,
        currentTime: 0,
        destination: { name: 'destination' },
        createGain: () => make('gain'),
        createConvolver: () => make('room'),
        createDynamicsCompressor: () => make('limiter'),
        createBiquadFilter: () => make('filter'),
        createWaveShaper: () => make('shaper'),
        createBuffer: (_c: number, length: number) => ({
            getChannelData: () => new Float32Array(length)
        })
    }
    // A context that takes no property of its own: the node is moved, as in the first version.
    return (frozen ? Object.freeze(ctx) : ctx) as unknown as BaseAudioContext & {
        links: string[]
    }
}

/** An alphaTab api as the hook sees it, and timers a test runs by hand. */
function setup(output: object | null) {
    let listener: ((e: { state: unknown }) => void) | null = null
    let ready: (() => void) | null = null
    const api = {
        player: output ? { output } : null,
        playerReady: { on: (f: () => void) => (ready = f) },
        playerStateChanged: { on: (f: (e: { state: unknown }) => void) => (listener = f) }
    }
    const timers: (() => void)[] = []
    const win = {
        setTimeout: (f: () => void) => timers.push(f),
        clearTimeout: () => {}
    } as unknown as Pick<Window, 'setTimeout' | 'clearTimeout'>
    return {
        api: api as never,
        win,
        say: (state: unknown) => listener?.({ state }),
        ready: () => ready?.(),
        run: () => timers.splice(0).forEach((f) => f())
    }
}

describe("alphaTab's output node (#103)", () => {
    it('is found by what it is, whatever alphaTab names its field', () => {
        const ctx = context()
        const worklet = node()
        const script = node()
        // The readable build, the minified build (a shortened name), the older script output.
        expect(outputNodeOf({ output: { context: ctx, _worklet: worklet } })?.node).toBe(
            worklet as never
        )
        expect(outputNodeOf({ output: { context: ctx, ip: worklet } })?.node).toBe(worklet as never)
        expect(outputNodeOf({ output: { context: ctx, _audioNode: script } })?.node).toBe(
            script as never
        )
        // Never its silent source, which also connects.
        const source = { ...node(), start() {} }
        expect(
            outputNodeOf({ output: { context: ctx, buffer: {}, source, Xq: null, ip: worklet } })
                ?.node
        ).toBe(worklet as never)
        expect(outputNodeOf({ output: { context: ctx, source } })).toBeNull()
        for (const none of [
            null,
            {},
            { output: {} },
            { output: { context: ctx } },
            { output: { _worklet: worklet } },
            { output: { context: ctx, _worklet: {} } }
        ])
            expect(outputNodeOf(none)).toBeNull()
    })

    it('goes to the chain each time alphaTab starts to play, once per node', () => {
        const worklet = node()
        const output = { context: context(true), _worklet: worklet }
        const { api, win, say, run } = setup(output)
        throughRoom(api, (state) => state === 'playing', { effects: () => null }, win)
        say('paused')
        run()
        expect(worklet.calls).toEqual([])
        say('playing')
        run()
        expect(worklet.calls).toEqual(['disconnect', 'connect:gain1'])
        // The next play makes a new node: it is taken too; the old one is left alone.
        const next = node()
        output._worklet = next
        say('playing')
        run()
        expect(next.calls).toEqual(['disconnect', 'connect:gain1'])
        expect(worklet.calls).toHaveLength(2)
    })

    it('waits for a node that alphaTab makes a little later', () => {
        const output: { context: BaseAudioContext; _worklet: ReturnType<typeof node> | null } = {
            context: context(true),
            _worklet: null
        }
        const { api, win, say } = setup(output)
        const timers: (() => void)[] = []
        const late = { ...win, setTimeout: (f: () => void) => timers.push(f) } as never
        throughRoom(api, () => true, { effects: () => null }, late)
        say('playing')
        expect(timers.length).toBeGreaterThan(3)
        timers[0]!()
        const worklet = node()
        output._worklet = worklet
        timers[1]!()
        timers[2]!()
        expect(worklet.calls).toEqual(['disconnect', 'connect:gain1'])
    })

    it("leaves alphaTab's own connection for dry, without a node, and once it is stopped", () => {
        const dry = node()
        const first = setup({ context: context(true), _worklet: dry })
        throughRoom(first.api, () => true, { effects: () => ({ dry: true }) }, first.win)
        first.say('playing')
        first.run()
        expect(dry.calls).toEqual([])
        const none = setup(null)
        throughRoom(none.api, () => true, { effects: () => null }, none.win)
        none.say('playing')
        none.run()
        const stopped = node()
        const last = setup({ context: context(true), _worklet: stopped })
        const room = throughRoom(last.api, () => true, { effects: () => null }, last.win)
        room.stop()
        last.say('playing')
        room.look()
        last.run()
        expect(stopped.calls).toEqual([])
    })

    it('looks when asked, for a play alphaTab starts without saying so', () => {
        const worklet = node()
        const { api, win, run } = setup({ context: context(true), _worklet: worklet })
        const room = throughRoom(api, () => false, { effects: () => null }, win)
        room.look()
        run()
        expect(worklet.calls).toEqual(['disconnect', 'connect:gain1'])
    })
})

describe("alphaTab's context: its destination is the chain (#103)", () => {
    const name = (n: unknown) => (n as { name: string }).name

    it('gives the chain to alphaTab before it connects its node: nothing to move', () => {
        const ctx = context()
        const worklet = node()
        const { api, win, say, run } = setup({ context: ctx, _worklet: worklet })
        throughRoom(api, () => true, { effects: () => null }, win)
        // What alphaTab does at each start: `worklet.connect(ctx.destination)`.
        expect(name(ctx.destination)).toBe('gain1')
        expect(ctx.links[ctx.links.length - 1]).toBe('shaper7>destination')
        say('playing')
        run()
        expect(worklet.calls).toEqual([])
    })

    it('reads the effects at each start: the speakers for dry, the chain again after', () => {
        const ctx = context()
        let dry = true
        const { api, win } = setup({ context: ctx })
        throughRoom(api, () => true, { effects: () => (dry ? { dry: true } : null) }, win)
        expect(name(ctx.destination)).toBe('destination')
        expect(ctx.links).toEqual([])
        dry = false
        expect(name(ctx.destination)).toBe('gain1')
        dry = true
        expect(name(ctx.destination)).toBe('destination')
    })

    it("puts an electric guitar's amplifier before the chain, and none for other guitars", () => {
        const ctx = context()
        let guitar: 'steel' | 'overdrive' = 'overdrive'
        const { api, win } = setup({ context: ctx })
        throughRoom(
            api,
            () => true,
            { effects: () => ({ amp: { cabinet: true } }), guitar: () => guitar },
            win
        )
        // The chain is made first (7 nodes), then the amplifier: its entry, 4 filters, a level.
        expect(name(ctx.destination)).toBe('gain8')
        expect(ctx.links[ctx.links.length - 1]).toBe('gain13>gain1')
        guitar = 'steel'
        expect(name(ctx.destination)).toBe('gain1')
    })

    it('takes the context when the player is ready, and gives it back when stopped', () => {
        const output: { context: BaseAudioContext | null } = { context: null }
        const { api, win, ready } = setup(output)
        const room = throughRoom(api, () => true, { effects: () => null }, win)
        const ctx = context()
        output.context = ctx
        expect(name(ctx.destination)).toBe('destination')
        ready()
        expect(name(ctx.destination)).toBe('gain1')
        room.stop()
        expect(name(ctx.destination)).toBe('destination')
    })

    it('moves the node of a play that began before the context was taken, and only that one', () => {
        const output: { context: BaseAudioContext | null; _worklet: ReturnType<typeof node> } = {
            context: null,
            _worklet: node()
        }
        const { api, win, say, run } = setup(output)
        throughRoom(api, () => true, { effects: () => null }, win)
        // alphaTab made its context and connected its node to the speakers, then said it plays.
        const ctx = context()
        output.context = ctx
        const first = output._worklet
        say('playing')
        run()
        expect(first.calls).toEqual(['disconnect', 'connect:gain1'])
        // The next start asks the context: its node is in the chain, nothing is moved.
        const next = node()
        output._worklet = next
        expect(name(ctx.destination)).toBe('gain1')
        say('playing')
        run()
        expect(next.calls).toEqual([])
    })

    it('leaves a node alone when alphaTab asked the context after it was taken', () => {
        const output: { context: BaseAudioContext | null; _worklet: ReturnType<typeof node> } = {
            context: null,
            _worklet: node()
        }
        const { api, win, say, run } = setup(output)
        throughRoom(api, () => true, { effects: () => null }, win)
        const ctx = context()
        output.context = ctx
        say('playing')
        // alphaTab connects its node after it said it plays (the worklet loads first).
        expect(name(ctx.destination)).toBe('gain1')
        run()
        expect(output._worklet.calls).toEqual([])
    })

    it('answers for the last player to play when two share a context', () => {
        const ctx = context()
        const one = setup({ context: ctx })
        const two = setup({ context: ctx })
        const first = throughRoom(one.api, () => true, { effects: () => ({ dry: true }) }, one.win)
        throughRoom(two.api, () => true, { effects: () => null }, two.win)
        expect(name(ctx.destination)).toBe('gain1')
        one.say('playing')
        expect(name(ctx.destination)).toBe('destination')
        two.say('playing')
        expect(name(ctx.destination)).toBe('gain1')
        // The first one stops: the context is still the second's.
        first.stop()
        expect(name(ctx.destination)).toBe('gain1')
    })
})

describe('the alphaTab the library is built with (#103)', () => {
    it('still fits the alphaTab the library is built with, in both of its builds', () => {
        // The hook relies on how alphaTab's output is made: public `context` and `source`, and
        // one output node kept in a field and connected to the destination at each start. When
        // this fails after an alphaTab update, read its output classes again.
        const read = (file: string) =>
            readFileSync(
                new URL(`../../node_modules/@coderline/alphatab/dist/${file}`, import.meta.url),
                'utf8'
            )
        const readable = read('alphaTab.core.mjs')
        expect(readable).toContain('this._worklet = worklet;')
        expect(readable).toContain('worklet.connect(ctx.destination);')
        expect(readable).toContain('this._audioNode = ctx.createScriptProcessor(')
        expect(readable).toContain('this._audioNode.connect(ctx.destination, 0, 0);')
        expect(readable).toMatch(
            /class AlphaSynthWebAudioOutputBase \{[\s\S]{0,200}\bcontext = null;\s*buffer = null;\s*source = null;/
        )
        // The minified build shortens private names and keeps the public ones.
        const minified = read('alphaTab.core.min.mjs')
        expect(minified).not.toContain('_worklet')
        expect(minified).toContain('context=null;buffer=null;source=null;')
        expect(minified).toContain('get output()')
        // Both outputs ask their context for its destination at each start, in both builds.
        expect(minified.match(/\.connect\(\w+\.destination[,)]/g)?.length).toBeGreaterThanOrEqual(2)
    })
})
