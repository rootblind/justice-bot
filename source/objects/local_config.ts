import { GUILD_PLANS } from "./plans.js"
import { LocalConfigToxicPatterns, toxic_patterns } from "./trigger_words.js"

export const local_config: LocalConfig = {
    sources: {
        system_directories: ["error_dumps", "temp", "backup-db", "assets", "assets/avatar"],
        cron_tasks: "./cron_tasks.js",
        on_ready_tasks: "./on_ready_tasks.js",
        presence_config: "./source/objects/presence-config.json",
        default_presence_presets: "./source/objects/default-presence-presets.json",
        custom_presence_presets: "./source/objects/custom-presence-presets.json",
        flag_data: "./source/flag_data.csv",
        error_dumps: "./error_dumps",
        event_hooks: "./event_hooks.js",
        attach_collectors: "./attach_collectors.js"
    },

    rules: {
        toxic_pattern: toxic_patterns,
        guild_plans: GUILD_PLANS
    }
}

export interface LocalConfig {
    sources: LocalConfigSources,
    rules: LocalConfigRules
}
export type GuildPlansConfig = typeof GUILD_PLANS;
export interface LocalConfigRules {
    toxic_pattern: LocalConfigToxicPatterns,
    guild_plans: GuildPlansConfig
}
export interface LocalConfigSources {
  system_directories: string[],
  cron_tasks: string,
  on_ready_tasks: string,
  presence_config: string,
  default_presence_presets: string,
  custom_presence_presets: string,
  flag_data: string,
  error_dumps: string,
  event_hooks: string,
  attach_collectors: string
}
export interface LocalConfigPresenceState {
    status: "enable" | "disable",
    delay: number,
    type: number
}

