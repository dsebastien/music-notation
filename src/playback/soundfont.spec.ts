import { describe, expect, it } from 'bun:test'
import { readSoundfont, regionsFor } from './soundfont.js'
import { amount, range, soundfontBytes, type Fixture } from './soundfont.fixture.js'

/** One instrument, one sample on every key: the least a soundfont holds. */
const simple = (zone: [number, number][] = [], preset: [number, number][] = []): Fixture => ({
    name: 'Steel Guitar',
    program: 25,
    preset: [[...preset, [41, 0]]],
    instruments: [[[...zone, [53, 0]]]],
    samples: [{ name: 'E3', data: [1, 2, 3, 4, 5, 6], loop: [2, 5], rate: 24000, key: 52 }]
})
const region = (fixture: Fixture) => readSoundfont(soundfontBytes(fixture)).presets[0]!.regions[0]!

describe('reading a soundfont for the sample player (#109)', () => {
    it('reads the preset and its samples', () => {
        const font = readSoundfont(soundfontBytes(simple()))
        expect(font.presets.map((p) => [p.name, p.bank, p.program, p.regions.length])).toEqual([
            ['Steel Guitar', 0, 25, 1]
        ])
        expect(font.samples).toEqual([
            {
                name: 'E3',
                start: 0,
                end: 6,
                // From the sample's own start.
                loopStart: 2,
                loopEnd: 5,
                rate: 24000,
                key: 52,
                correction: 0,
                compressed: false
            }
        ])
        // The points themselves.
        expect([...font.data.subarray(0, 4)]).toEqual([1, 0, 2, 0])
    })

    it('a compressed sample is found by its bytes; a sample without a key plays as key 60', () => {
        const font = readSoundfont(
            soundfontBytes({
                preset: [[[41, 0]]],
                instruments: [[[[53, 0]], [[53, 1]]]],
                samples: [
                    { name: 'ogg', data: [79, 103, 103, 83, 0], loop: [10, 20], compressed: true },
                    { name: 'raw', data: [7, 8], key: 255, correction: -3 }
                ]
            })
        )
        expect(font.samples[0]).toMatchObject({ start: 0, end: 5, loopStart: 10, loopEnd: 20 })
        expect(font.samples[0]!.compressed).toBe(true)
        // Uncompressed points start on an even byte: byte 6 is point 3.
        expect(font.samples[1]).toMatchObject({ start: 3, end: 5, key: 60, correction: -3 })
        expect(font.samples[1]!.compressed).toBe(false)
    })

    it('a zone without ranges plays every key and velocity, at the defaults', () => {
        expect(region(simple())).toEqual({
            loKey: 0,
            hiKey: 127,
            loVel: 0,
            hiVel: 127,
            sample: 0,
            rootKey: 52,
            tune: 0,
            scale: 100,
            attenuation: 0,
            // No loop unless the zone asks for it.
            loop: false,
            attack: 0,
            hold: 0,
            decay: 0,
            sustain: 0,
            release: 0,
            filter: null,
            filterQ: 0,
            filterEnvelope: { amount: 0, attack: 0, hold: 0, decay: 0, sustain: 1 }
        })
    })

    it("the zone's values: its pitch, its loop, its envelope, its filter", () => {
        const r = region(
            simple([
                [8, 9000],
                [9, 60],
                [11, 900],
                [28, 2400],
                [29, 800],
                [34, 1200],
                [35, 0],
                [36, 2400],
                [37, 960],
                [38, amount(-1200)],
                [48, 30],
                [51, amount(-1)],
                [52, 7],
                [54, 1],
                [56, 50],
                [58, 40]
            ])
        )
        // The key that plays the sample as it is, in place of the sample's own.
        expect(r.rootKey).toBe(40)
        // A semitone down, 7 cents up.
        expect(r.tune).toBe(-93)
        expect(r.scale).toBe(50)
        // Centibels.
        expect(r.attenuation).toBe(3)
        expect(r.loop).toBe(true)
        // Timecents: 1200 is 2 s, 0 is 1 s, 2400 is 4 s, -1200 is half a second.
        expect([r.attack, r.hold, r.decay, r.release]).toEqual([2, 1, 4, 0.5])
        expect(r.sustain).toBe(96)
        // 9,000 cents above 8.176 Hz.
        expect(Math.round(r.filter!)).toBe(1480)
        expect(r.filterQ).toBe(6)
        expect(r.filterEnvelope.amount).toBe(900)
        expect(r.filterEnvelope.decay).toBe(4)
        // 800 thousandths are taken off: a fifth stays.
        expect(r.filterEnvelope.sustain).toBeCloseTo(0.2)
    })

    it('a sample with no loop points does not loop, whatever the zone says', () => {
        const fixture = simple([[54, 1]])
        fixture.samples[0]!.loop = [0, 0]
        expect(region(fixture).loop).toBe(false)
    })

    it("an instrument's global zone gives the defaults of its other zones", () => {
        const font = readSoundfont(
            soundfontBytes({
                preset: [[[41, 0]]],
                instruments: [
                    [
                        // The global zone: no sample.
                        [
                            [36, 1200],
                            [48, 50]
                        ],
                        [
                            [43, range(0, 59)],
                            [53, 0]
                        ],
                        // Its own attenuation wins.
                        [
                            [43, range(60, 127)],
                            [48, 10],
                            [53, 0]
                        ]
                    ]
                ],
                samples: [{ name: 's', data: [1, 2] }]
            })
        )
        const regions = font.presets[0]!.regions
        expect(regions.map((r) => [r.loKey, r.hiKey, r.attenuation, r.decay])).toEqual([
            [0, 59, 5, 2],
            [60, 127, 1, 2]
        ])
    })

    it("a preset's values are added, and its ranges cut the instrument's", () => {
        const font = readSoundfont(
            soundfontBytes({
                preset: [
                    // The preset's global zone: a gain of 16.6 dB (an attenuation below zero).
                    [[48, amount(-166)]],
                    [
                        [43, range(40, 80)],
                        [44, range(0, 100)],
                        [41, 0]
                    ],
                    // This zone's own attenuation replaces the global zone's.
                    [
                        [48, amount(-20)],
                        [52, 5],
                        [41, 1]
                    ]
                ],
                instruments: [
                    [
                        [
                            [43, range(0, 60)],
                            [48, 30],
                            [53, 0]
                        ],
                        // Out of the preset zone's keys: not played.
                        [
                            [43, range(90, 127)],
                            [53, 0]
                        ]
                    ],
                    [
                        [
                            [48, 30],
                            [52, 2],
                            [53, 0]
                        ]
                    ]
                ],
                samples: [{ name: 's', data: [1, 2] }]
            })
        )
        const regions = font.presets[0]!.regions
        expect(regions.length).toBe(2)
        expect(regions[0]).toMatchObject({ loKey: 40, hiKey: 60, loVel: 0, hiVel: 100 })
        // 3 dB taken off by the instrument, 16.6 dB given back by the preset.
        expect(regions[0]!.attenuation).toBeCloseTo(-13.6)
        expect(regions[1]!.attenuation).toBeCloseTo(1)
        expect(regions[1]!.tune).toBe(7)
    })

    it("refuses what isn't a soundfont", () => {
        expect(() => readSoundfont(new Uint8Array(40))).toThrow('Not a soundfont')
        expect(() => readSoundfont(soundfontBytes(simple()).subarray(0, 60))).toThrow()
    })
})

describe('the regions a note plays (#109)', () => {
    it('every region whose keys and velocities hold the note', () => {
        const font = readSoundfont(
            soundfontBytes({
                preset: [[[41, 0]]],
                instruments: [
                    [
                        [
                            [43, range(0, 59)],
                            [53, 0]
                        ],
                        [
                            [43, range(60, 127)],
                            [44, range(0, 99)],
                            [53, 1]
                        ],
                        [
                            [43, range(60, 127)],
                            [44, range(100, 127)],
                            [53, 2]
                        ],
                        // A second layer on the high keys.
                        [
                            [43, range(72, 127)],
                            [53, 0]
                        ]
                    ]
                ],
                samples: [
                    { name: 'low', data: [1] },
                    { name: 'soft', data: [2] },
                    { name: 'hard', data: [3] }
                ]
            })
        )
        const preset = font.presets[0]!
        const names = (key: number, velocity: number) =>
            regionsFor(preset, key, velocity).map((r) => font.samples[r.sample]!.name)
        expect(names(40, 100)).toEqual(['low'])
        expect(names(60, 80)).toEqual(['soft'])
        expect(names(60, 100)).toEqual(['hard'])
        expect(names(80, 127)).toEqual(['hard', 'low'])
    })
})
