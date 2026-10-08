export type IdGenerator = () => string

/** Web Crypto is available in both modern browsers and Node, without the DOM. */
export const createId: IdGenerator = () => globalThis.crypto.randomUUID()
