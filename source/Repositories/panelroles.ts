import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";

const panelRolesExistsCache = new SelfCache<string, boolean>(60 * 60_000);

class PanelRolesRepository {
    /**
     * Returns whether the message is part of the panel roles system
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @param messageId Message Snowflake
     * @returns boolean
     */
    async isPanelMessage(guildId: Snowflake, channelId: Snowflake, messageId: Snowflake): Promise<boolean> {
        const key = `${guildId}:${channelId}${messageId}`;
        const cache = panelRolesExistsCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: data} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM panelmessages
                    WHERE guild=$1
                        AND channel=$2
                        AND messageid=$3)`,
            [guildId, channelId, messageId]
        );

        panelRolesExistsCache.set(key, data[0].exists);
        return data[0].exists;
    }
}

const PanelRolesRepo = new PanelRolesRepository();
export default PanelRolesRepo;