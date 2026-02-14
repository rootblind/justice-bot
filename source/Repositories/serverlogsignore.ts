import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { GuildChannelTable } from "../Interfaces/database_types.js";

const logsIgnoreCache = new SelfCache<string, boolean>(60 * 60_000); // 1h

class ServerLogsIgnoreRepository {

    /**
     * Fetch all ignored channels ids from the server logs ignore list
     */
    async getGuildIgnoreList(guildId: Snowflake): Promise<string[]> {
        // try to fetch from cache first
        const cache = logsIgnoreCache.fetchCache();
        const channels: string[] = [];
        const prefix = `${guildId}:`
        for(const [key, value] of cache) {
            if(!value) continue;
            if(!key.startsWith(prefix)) continue;

            const channelId = key.slice(prefix.length);
            channels.push(channelId);
        }

        if(channels.length) return channels;

        // database fallback
        const { rows: data } = await database.query<GuildChannelTable>(
            `SELECT channel FROM serverlogsignore WHERE guild=$1`,
            [ guildId ]
        );

        // populate cache
        for(const row of data) {
            logsIgnoreCache.set(`${guildId}:${row.channel}`, true);
        }

        return data.map(row => row.channel);
    }
    /**
     * Add channel to the guild ignore list
     */
    async put(guildId: Snowflake, channelId: Snowflake) {
        const key = `${guildId}:${channelId}`;
        logsIgnoreCache.set(key, true);
        await database.query(`INSERT INTO serverlogsignore (guild, channel) VALUES($1, $2)`, [ guildId, channelId ]);
    }

    /**
     * Add the list of channels to ignore list
     */
    async putBulk(guildId: Snowflake, channels: Snowflake[]) {
        const values: string[] = [];
        const params: string[] = [];
        let i = 1;

        for(const c of channels) {
            values.push(`($${i++}, $${i++})`);
            params.push(guildId, c);

            logsIgnoreCache.set(`${guildId}:${c}`, true);
        }

        await database.query(
            `INSERT INTO serverlogsignore(guild, channel) VALUES ${values.join(",")}`, params
        );
    }

    /**
     * Stop ignoring all channels in the list
     */
    async deleteBulk(guildId: Snowflake, channels: Snowflake[]) {
        const placeholders = channels.map((_, i) => `$${i + 2}`).join(",");

        await database.query(
            `DELETE FROM serverlogsignore 
            WHERE guild = $1 
            AND channel IN (${placeholders})`,
            [guildId, ...channels]
        );

        for (const c of channels) {
            logsIgnoreCache.delete(`${guildId}:${c}`);
        }
    }


    /**
     * 
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @returns Whether the channel is ignored by the logging system or not.
     */
    async isChannelIgnored(guildId: Snowflake, channelId: Snowflake): Promise<boolean> {
        const key = `${guildId}:${channelId}`;
        const cache = logsIgnoreCache.get(key);
        if(cache !== undefined) {
            return cache;
        }

        const {rows: check} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM serverlogsignore WHERE guild=$1 AND channel=$2)`,
            [guildId, channelId]
        );

        logsIgnoreCache.set(key, check[0].exists);
        return check[0].exists;
    }

    /**
     * Delete the channel from serverlogsignore registry
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     */
    async stopIgnoringChannel(guildId: Snowflake, channelId: Snowflake): Promise<void> {
        const key = `${guildId}:${channelId}`;
        logsIgnoreCache.set(key, false);

        await database.query(`DELETE FROM serverlogsignore WHERE guild=$1 AND channel=$2`,
            [guildId, channelId]
        );
    }

    /**
     * Delete all rows from the guild
     */
    async deleteGuildIgnore(guildId: Snowflake) {
        logsIgnoreCache.deleteByValue((_, key) => key.startsWith(guildId));
        await database.query(`DELETE FROM serverlogsignore WHERE guild=$1`, [ guildId ]);
    }
}

const ServerLogsIgnoreRepo = new ServerLogsIgnoreRepository();
export default ServerLogsIgnoreRepo;
