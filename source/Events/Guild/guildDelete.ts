import type { Guild } from "discord.js";
import type { Event } from "../../Interfaces/event";
import DatabaseRepo from "../../Repositories/database_repository.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type guildDeleteHook = (guild: Guild) => Promise<void>;
const hooks: guildDeleteHook[] = [];
export function extend_guildDelete(hook: guildDeleteHook) {
    hooks.push(hook);
}

async function runHooks(guild: Guild) {
    for(const hook of hooks) {
        try {
            await hook(guild);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

/**
 * Executes when a server is deleted or teh bot is removed.
 * The bot will clear all rows about the guild
 */
const guildDelete: Event = {
    name: "guildDelete",
    async execute(guild: Guild) {
        await runHooks(guild);
        
        const tables = await DatabaseRepo.getTablesWithColumnValue({column: "guild", value: guild.id});

        for(const table of tables) {
            try {
                await DatabaseRepo.wipeGuildFromTable(table, guild.id);
            } catch(error) {
                await errorLogHandle(error);
            }
        }
    }
}

export default guildDelete;