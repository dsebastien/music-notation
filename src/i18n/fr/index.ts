/**
 * The French table: one entry per English key (the type enforces it). Style of Obsidian's French
 * interface: infinitives for buttons and commands, "vous" where a person is addressed, sentence
 * case.
 */
import type { MessageKey } from '../messages.js'
import { frDiagrams } from './diagrams.js'
import { frParse } from './parse.js'
import { frPlay } from './play.js'
import { frTimed } from './timed.js'

export const fr: Record<MessageKey, string> = {
    ...frParse,
    ...frDiagrams,
    ...frTimed,
    ...frPlay
}
