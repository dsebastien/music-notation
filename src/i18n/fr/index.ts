/**
 * The French table: one entry per English key (the type enforces it). Style of Obsidian's French
 * interface: infinitives for buttons and commands, "vous" where a person is addressed, sentence
 * case.
 */
import type { MessageKey } from '../messages.js'
import { frCore } from './core.js'

export const fr: Record<MessageKey, string> = {
    ...frCore
}
