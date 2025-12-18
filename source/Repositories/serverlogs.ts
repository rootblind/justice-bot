import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { EventGuildLogsString } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const logsCache = new SelfCache<string, Snowflake | null>(60 * 60_000); // 1h

class ServerLogsRepository {
    /**
     * 
     * @param guildId Guild Snowflake
     * @param event EventGuildLogs type string, the event type log channel
     * @returns The specified channel snowflake or null if there is no row to match the guild and event
     */
    async getGuildEventChannel(guildId: Snowflake, event: EventGuildLogsString): Promise<Snowflake | null> {
        const key = `${guildId}:${event}`;
        const cache = logsCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: logsData} = await database.query(
            `SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [guildId, event]
        );

        if(logsData.length) {
            logsCache.set(key, logsData[0].channel);
            return logsData[0].channel;
        } else {
            logsCache.set(key, null);
            return null;
        }
    }

    /**
     * Delete the row associated with the event from the guild.
     * @param guildId Guild Snowflake
     * @param event The logs event
     */
    async deleteGuildEventChannel(guildId: Snowflake, event: EventGuildLogsString): Promise<void> {
        const key = `${guildId}:${event}`;
        logsCache.delete(key);
        await database.query(`DELETE FROM serverlogs WHERE guild=$1 AND eventtype=$2`,
            [guildId, event]
        );
    }
}

const ServerLogsRepo = new ServerLogsRepository();
export default ServerLogsRepo;