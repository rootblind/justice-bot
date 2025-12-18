import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";

const logsIgnoreCache = new SelfCache<string, boolean>(60 * 60_000); // 1h
// const ignoredChannelsCache = new SelfCache<string, string[]>(60 * 60_000)

class ServerLogsIgnoreRepository {
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
        logsIgnoreCache.delete(key);

        await database.query(`DELETE FROM serverlogsignore WHERE guild=$1 AND channel=$2`,
            [guildId, channelId]
        );
    }
}

const ServerLogsIgnoreRepo = new ServerLogsIgnoreRepository();
export default ServerLogsIgnoreRepo;