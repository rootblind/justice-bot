/* eslint-disable @typescript-eslint/no-explicit-any */
interface Event {
    name: string,
    once?: boolean,
    rest?: boolean,
    execute: (...args: any[]) => any
}

export type { Event };