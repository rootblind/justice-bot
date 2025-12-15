import type { Snowflake } from "discord.js";
import database from "../Config/database.js";

class ServerLogsIgnoreRepository {
    /**
     * 
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @returns Whether the channel is ignored by the logging system or not.
     */
    async isChannelIgnored(guildId: Snowflake, channelId: Snowflake): Promise<boolean> {
        const {rows: check} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM serverlogsignore WHERE guild=$1 AND channel)`,
            [guildId, channelId]
        );

        return check[0].exists;
    }
}

const ServerLogsIgnoreRepo = new ServerLogsIgnoreRepository();
export default ServerLogsIgnoreRepo;