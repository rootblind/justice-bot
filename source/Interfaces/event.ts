/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The interface for events to be written in the respected format
 */
interface Event {
    name: string,
    once?: boolean,
    rest?: boolean,
    execute: (...args: any[]) => any
}

export type { Event };