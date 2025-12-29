import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { ReactionRoles } from "../Interfaces/database_types.js";

const reactionRolesCache = new SelfCache<string, ReactionRoles | null>(60 * 60_000);
const reactionRoleMessageCache = new SelfCache<string, Snowflake | null>(60 * 60_000);

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
        const key = `${guildId}:${channelId}`;
        const cache = reactionRoleMessageCache.get(key);
        if(cache) return true;
        if(cache === null) return false;

        const {rows: data} = await database.query(
            `SELECT EXISTS 
                (SELECT 1 FROM reactionroles
                    WHERE guild=$1
                        AND channel=$2
                        AND messageid=$3)`,
            [guildId, channelId, messageId]
        );

        if(!data[0].exists) {
            reactionRoleMessageCache.set(key, null);
        } else {
            reactionRoleMessageCache.set(key, messageId);
        }

        return data[0].exists;
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @param messageId Message Snowflake
     * @param emoji The name of the emoji
     * @returns ReactionRoles object
     */
    async getReaction(
        guildId: Snowflake,
        channelId: Snowflake,
        messageId: Snowflake,
        emoji: string
    ): Promise<ReactionRoles | null> {
        const key = `${guildId}:${messageId}:${emoji}`;
        const cache = reactionRolesCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: data} = await database.query(
            `SELECT * FROM reactionroles
                WHERE guild=$1
                    AND channel=$2
                    AND messageid=$3
                    AND emoji=$4`,
            [guildId, channelId, messageId, emoji]
        );

        if(data.length) {
            reactionRolesCache.set(key, data[0]);
            return data[0];
        } else {
            reactionRolesCache.set(key, null);
            return null;
        }

    }

    /**
     * Delete the reaction
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @param messageId Message Snowflake
     * @param emoji Emoji name
     */
    async deleteReaction(
        guildId: Snowflake,
        channelId: Snowflake,
        messageId: Snowflake,
        emoji: string
    ) {
        const key = `${guildId}:${messageId}:${emoji}`;
        reactionRolesCache.delete(key);

        await database.query(
            `DELETE FROM reactionroles
                WHERE guild=$1
                    AND channel=$2
                    AND messageid=$3
                    AND emoji=$4`,
            [guildId, channelId, messageId, emoji]
        );
    }
}

const ReactionRolesRepo = new ReactionRolesRepository();
export default ReactionRolesRepo;