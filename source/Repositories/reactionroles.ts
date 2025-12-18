import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";

const reactionRolesExistsCache = new SelfCache<string, boolean>(60 * 60_000);

class ReactionRolesRepository {
    /**
     * Returns whether the given message is used by the reaction roles system
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @param messageId Message Snowflake
     * @returns boolean
     */
    async isReactionRoleMessage(
        guildId: Snowflake,
        channelId: Snowflake,
        messageId: Snowflake
    ): Promise<boolean> {
        const key = `${guildId}:${channelId}:${messageId}`;
        const cache = reactionRolesExistsCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: data} = await database.query(
            `SELECT EXISTS 
                (SELECT 1 FROM reactionroles
                    WHERE guild=$1
                        AND channel=$2
                        AND messageid=$3)`,
            [guildId, channelId, messageId]
        );

        reactionRolesExistsCache.set(key, data[0].exists);
        return data[0].exists;
    }
}

const ReactionRolesRepo = new ReactionRolesRepository();
export default ReactionRolesRepo;