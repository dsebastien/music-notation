/** The keys of the catalog, and the parameters each one's English text asks for. */
import type { en } from './en/index.js'

export type English = typeof en
export type MessageKey = keyof English

/** The `{name}` placeholders of a string. */
type Names<S extends string> = S extends `${string}{${infer N}}${infer Rest}`
    ? N | Names<Rest>
    : never

/** The parameters of a key: none for a plain text, an object with its placeholders otherwise. */
export type MessageParams<K extends MessageKey> = [Names<English[K]>] extends [never]
    ? []
    : [params: { [N in Names<English[K]>]: string | number }]
