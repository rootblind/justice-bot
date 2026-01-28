import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { EventGuildLogsString, GuildChannelTable } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const logsCache = new SelfCache<string, Snowflake | null>(60 * 60_000); // 1h

class ServerLogsRepository {

    /**
     * Whether the channel provided is a server logs channel in the guild
     */
    async isLogsChannel(guildId: Snowflake, channelId: Snowflake): Promise<boolean> {
        const cache = logsCache.getByValue((value, key) =>
            key.startsWith(guildId) && value === channelId
        );

        if(cache !== undefined && cache.length) return true;

        const { rows: data } = await database.query(
            `SELECT * FROM serverlogs WHERE guild=$1 AND channel=$2`,
            [ guildId, channelId ]
        );

        if(data && data[0]) {
            logsCache.set(`${guildId}:${data[0].eventtype}`, data[0].channel);
            return true;
        } else {
            // if no row is found, there is no access to the eventtype that is lacking
            return false;
        }
    }

    /**
     * Fetch all server logs from the guild and populate the cache
     */
    async getGuildLogs(guildId: Snowflake): Promise<(GuildChannelTable & { eventtype: string })[]> {
        const { rows: data } = await database.query<(GuildChannelTable & { eventtype: string })>(
            `SELECT * FROM serverlogs WHERE guild=$1`,
            [ guildId ]
        );

        for(const row of data) {
            logsCache.set(`${guildId}:${row.eventtype}`, row.channel);
        }

        return data;
    }

    /**
     * Fetch all channel ids
     */
    async getAllGuildChannels(guildId: Snowflake): Promise<string[]> {
        const cache = logsCache.getByValue((value, key) => key.startsWith(guildId) && value !== null);
        if(cache !== undefined) return cache.filter((c) => c !== null);

        const {rows: data} = await database.query<{guild: string, channel: string, eventtype: EventGuildLogsString}>(
            `SELECT * FROM serverlogs WHERE guild=$1`, [ guildId ]
        );

        for(const row of data) {
            logsCache.set(`${guildId}:${row.eventtype}`, row.channel);
        }
        const channelIds = data.map(row => row.channel);
        return channelIds;
    }
    /**
     * Insert or update the logs channel for an event type
     */
    async put(guildId: Snowflake, channelId: Snowflake, event: EventGuildLogsString) {
        const key = `${guildId}:${event}`;
        logsCache.set(key, channelId);

        await database.query(
            `INSERT INTO serverlogs(guild, channel, eventtype) VALUES($1, $2, $3)
                ON CONFLICT (guild, eventtype)
                    DO UPDATE SET
                        channel = EXCLUDED.channel`,
            [guildId, channelId, event]
        )
    }

    /**
     * Insert an array of channels as rows
     */
    async putBulk(guildId: Snowflake, channels: { id: Snowflake, event: EventGuildLogsString }[]) {
        const values: string[] = [];
        const params: string[] = [];
        let i = 1;

        for(const c of channels) {
            values.push(`($${i++}, $${i++}, $${i++})`);
            params.push(guildId, c.id, c.event);

            logsCache.set(`${guildId}:${c.event}`, c.id);
        }

        await database.query(
            `INSERT INTO serverlogs(guild, channel, eventtype)
                VALUES ${values.join(",")}
                ON CONFLICT (guild, eventtype)
                DO UPDATE SET channel = EXCLUDED.channel`,
            params
        );

    }
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

    /**
     * Delete all rows from a guild
     */
    async deleteAllEvents(guildId: Snowflake) {
        logsCache.deleteByValue((_, key) => key.startsWith(guildId));

        await database.query(`DELETE FROM serverlogs WHERE guild=$1`, [ guildId ]);
    }
}

const ServerLogsRepo = new ServerLogsRepository();
export default ServerLogsRepo;