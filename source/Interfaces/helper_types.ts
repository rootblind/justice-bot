interface PresenceConfig {
    status: string,
    delay: number, // in seconds
    type: number
}

interface PresencePreset {
    Playing: string[],
    Listening: string[],
    Watching: string[]
}

type PresencePresetKey = keyof PresencePreset

export type {
    PresenceConfig,
    PresencePreset,
    PresencePresetKey
};