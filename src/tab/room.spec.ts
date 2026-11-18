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

/** A context with what the chain needs, enough to see where a node ends up. */
function context() {
    const make = (name: string) => ({
        name,
        connect() {},
        gain: { value: 1, setTargetAtTime() {} },
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        normalize: true,
        buffer: null
    })
    return {
        sampleRate: 8000,
        currentTime: 0,
        destination: { name: 'destination' },
        createGain: () => make('chain'),
        createConvolver: () => make('room'),
        createDynamicsCompressor: () => make('limiter'),
        createBuffer: (_c: number, length: number) => ({
            getChannelData: () => new Float32Array(length)
        })
    } as unknown as BaseAudioContext
}

/** An alphaTab api as the hook sees it, and timers a test runs by hand. */
function setup(output: object | null) {
    let listener: ((e: { state: unknown }) => void) | null = null
    const api = {
        player: output ? { output } : null,
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
        const output = { context: context(), _worklet: worklet }
        const { api, win, say, run } = setup(output)
        throughRoom(api, (state) => state === 'playing', { effects: () => null }, win)
        say('paused')
        run()
        expect(worklet.calls).toEqual([])
        say('playing')
        run()
        expect(worklet.calls).toEqual(['disconnect', 'connect:chain'])
        // The next play makes a new node: it is taken too; the old one is left alone.
        const next = node()
        output._worklet = next
        say('playing')
        run()
        expect(next.calls).toEqual(['disconnect', 'connect:chain'])
        expect(worklet.calls).toHaveLength(2)
    })

    it('waits for a node that alphaTab makes a little later', () => {
        const output: { context: BaseAudioContext; _worklet: ReturnType<typeof node> | null } = {
            context: context(),
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
        expect(worklet.calls).toEqual(['disconnect', 'connect:chain'])
    })

    it("leaves alphaTab's own connection for dry, without a node, and once it is stopped", () => {
        const dry = node()
        const first = setup({ context: context(), _worklet: dry })
        throughRoom(first.api, () => true, { effects: () => ({ dry: true }) }, first.win)
        first.say('playing')
        first.run()
        expect(dry.calls).toEqual([])
        const none = setup(null)
        throughRoom(none.api, () => true, { effects: () => null }, none.win)
        none.say('playing')
        none.run()
        const stopped = node()
        const last = setup({ context: context(), _worklet: stopped })
        const room = throughRoom(last.api, () => true, { effects: () => null }, last.win)
        room.stop()
        last.say('playing')
        room.look()
        last.run()
        expect(stopped.calls).toEqual([])
    })

    it('looks when asked, for a play alphaTab starts without saying so', () => {
        const worklet = node()
        const { api, win, run } = setup({ context: context(), _worklet: worklet })
        const room = throughRoom(api, () => false, { effects: () => null }, win)
        room.look()
        run()
        expect(worklet.calls).toEqual(['disconnect', 'connect:chain'])
    })

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
    })
})
