import { describe, expect, it } from 'bun:test'
import {
    filesOf,
    instrumentSounds,
    pageInstruments,
    soundsOfScore,
    type InstrumentIndex,
    type InstrumentSource
} from './instruments.js'

const index: InstrumentIndex = {
    programs: { '0': { file: 'p000.sf3' }, '25': { file: 'p025.sf3' }, '30': { file: 'p030.sf3' } },
    drums: { file: 'drums.sf3' },
    click: { file: 'click.sf3' }
}
const bytes = (text: string) => new TextEncoder().encode(text)

/** A folder in memory, and the files asked of it. */
function folder(files: Record<string, Uint8Array | null>) {
    const asked: string[] = []
    const source: InstrumentSource = (file) => {
        asked.push(file)
        return Promise.resolve(files[file] ?? null)
    }
    return { source, asked }
}
const all = {
    'index.json': bytes(JSON.stringify(index)),
    'p000.sf3': bytes('piano'),
    'p025.sf3': bytes('steel'),
    'p030.sf3': bytes('distortion'),
    'drums.sf3': bytes('kit'),
    'click.sf3': bytes('click')
}
const names = (list: Uint8Array[] | null) => list?.map((b) => new TextDecoder().decode(b)) ?? null

describe("a web page's instrument folder (#124)", () => {
    it('is the folder the page names, and nothing else', () => {
        expect(
            pageInstruments({ play: { instruments: 'https://my.site/sounds/generaluser' } })
        ).toBe('https://my.site/sounds/generaluser')
        expect(pageInstruments({ play: { instruments: '  /sounds  ' } })).toBe('/sounds')
        // No folder named: the library has no address of its own.
        for (const options of [
            undefined,
            null,
            {},
            { play: false },
            { play: {} },
            { play: { volume: 0.5 } },
            { play: { instruments: '' } },
            { play: { instruments: 12 } },
            { instruments: '/sounds' }
        ])
            expect(pageInstruments(options)).toBeUndefined()
    })
})

describe('what a score plays (#108)', () => {
    it('its programs, once each, and whether it has drums', () => {
        const track = (program: number, isPercussion = false) => ({
            isPercussion,
            playbackInfo: { program }
        })
        expect(soundsOfScore({ tracks: [track(30), track(25), track(30)] })).toEqual({
            programs: [25, 30],
            drums: false
        })
        // A drum track's program is the kit's, not an instrument.
        expect(soundsOfScore({ tracks: [track(33), track(0, true)] })).toEqual({
            programs: [33],
            drums: true
        })
    })
})

describe('the files of what plays (#108)', () => {
    it('each program, then the click when nothing plays drums', () => {
        expect(filesOf(index, { programs: [25], drums: false })).toEqual(['p025.sf3', 'click.sf3'])
        expect(filesOf(index, { programs: [0, 30], drums: false })).toEqual([
            'p000.sf3',
            'p030.sf3',
            'click.sf3'
        ])
    })

    it('no click for sounds added to a player that has it', () => {
        expect(filesOf(index, { programs: [0], drums: false, click: false })).toEqual(['p000.sf3'])
    })

    it('the drum kit instead of the click (the click is in it)', () => {
        expect(filesOf(index, { programs: [25], drums: true })).toEqual(['p025.sf3', 'drums.sf3'])
    })

    it('nothing when the folder lacks a sound: the whole soundfont plays', () => {
        expect(filesOf(index, { programs: [25, 40], drums: false })).toBeNull()
        expect(filesOf({ programs: index.programs }, { programs: [25], drums: true })).toBeNull()
        // No click file: the instruments alone.
        expect(filesOf({ programs: index.programs }, { programs: [25], drums: false })).toEqual([
            'p025.sf3'
        ])
    })
})

describe('reading the instrument files (#108)', () => {
    it('reads the index, then only the files of what plays', async () => {
        const { source, asked } = folder(all)
        const got = await instrumentSounds(source, { programs: [25], drums: false }, window)
        expect(names(got)).toEqual(['steel', 'click'])
        expect(asked).toEqual(['index.json', 'p025.sf3', 'click.sf3'])
    })

    it('reads each file once for a page, whatever the number of blocks', async () => {
        const { source, asked } = folder(all)
        await instrumentSounds(source, { programs: [25], drums: false }, window)
        const again = await instrumentSounds(source, { programs: [25, 30], drums: false }, window)
        expect(names(again)).toEqual(['steel', 'distortion', 'click'])
        expect(asked).toEqual(['index.json', 'p025.sf3', 'click.sf3', 'p030.sf3'])
    })

    it('gives nothing when the index is missing or broken, and tries again later', async () => {
        const files: Record<string, Uint8Array | null> = { ...all, 'index.json': null }
        const { source, asked } = folder(files)
        expect(await instrumentSounds(source, { programs: [25], drums: false }, window)).toBeNull()
        files['index.json'] = bytes('not json')
        expect(await instrumentSounds(source, { programs: [25], drums: false }, window)).toBeNull()
        files['index.json'] = bytes('{"something": 1}')
        expect(await instrumentSounds(source, { programs: [25], drums: false }, window)).toBeNull()
        files['index.json'] = all['index.json']
        const got = await instrumentSounds(source, { programs: [25], drums: false }, window)
        expect(names(got)).toEqual(['steel', 'click'])
        expect(asked.filter((f) => f === 'index.json').length).toBe(4)
    })

    it('gives nothing when one file is missing (nothing is half loaded), and tries it again', async () => {
        const files: Record<string, Uint8Array | null> = { ...all, 'p030.sf3': null }
        const { source, asked } = folder(files)
        const sounds = { programs: [25, 30], drums: false }
        expect(await instrumentSounds(source, sounds, window)).toBeNull()
        files['p030.sf3'] = all['p030.sf3']
        expect(names(await instrumentSounds(source, sounds, window))).toEqual([
            'steel',
            'distortion',
            'click'
        ])
        // The guitar that was read is not read again; the missing file is.
        expect(asked.filter((f) => f === 'p025.sf3').length).toBe(1)
        expect(asked.filter((f) => f === 'p030.sf3').length).toBe(2)
    })

    it('a source that throws is a file it does not have', async () => {
        const source: InstrumentSource = () => Promise.reject(new Error('no disk'))
        expect(await instrumentSounds(source, { programs: [25], drums: false }, window)).toBeNull()
    })

    it('a folder URL is fetched: its index, then its files', async () => {
        const asked: string[] = []
        const original = window.fetch.bind(window)
        window.fetch = ((url: string) => {
            asked.push(url)
            const file = url.split('/').pop()!
            const body = url.includes('/gugs/')
                ? (all as Record<string, Uint8Array>)[file]
                : undefined
            return Promise.resolve(
                body
                    ? new Response(body as unknown as BodyInit)
                    : new Response('no', { status: 404 })
            )
        }) as unknown as typeof window.fetch
        try {
            const got = await instrumentSounds(
                'https://sounds.example/gugs/',
                { programs: [0], drums: true },
                window
            )
            expect(names(got)).toEqual(['piano', 'kit'])
            expect(asked).toEqual([
                'https://sounds.example/gugs/index.json',
                'https://sounds.example/gugs/p000.sf3',
                'https://sounds.example/gugs/drums.sf3'
            ])
            // A folder without what is asked: nothing.
            expect(
                await instrumentSounds(
                    'https://sounds.example/none',
                    { programs: [0], drums: false },
                    window
                )
            ).toBeNull()
        } finally {
            window.fetch = original
        }
    })
})
