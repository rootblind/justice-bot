import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";

const customReactCache = new SelfCache<string, string | null>(60 * 60_000);

class CustomReactRepository {
    /**
     * @param guildId Guild Snowflake 
     * @param keyword The keyword to fetch
     * @returns The reply to the keyword if there is one set
     */
    async getKeywordReply(guildId: Snowflake, keyword: string): Promise<string | null> {
        const key = `${guildId}:${keyword}`;
        const cache = customReactCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: reaction} = await database.query(
            `SELECT reply FROM customreact WHERE guild=$1 AND keyword=$2`,
            [guildId, keyword]
        );

        if(reaction.length) {
            customReactCache.set(key, reaction[0].reply);
            return reaction[0].reply;
        } else {
            customReactCache.set(key, null);
            return null;
        }
    }

    /**
     * Delete the specific custom reaction
     * @param guildId Guild Snowflake
     * @param keyword The custom react keyword
     */
    async deleteGuildReply(guildId: Snowflake, keyword: string): Promise<void> {
        const key = `${guildId}:${keyword}`;
        customReactCache.delete(key);

        await database.query(`DELETE FROM customreact WHERE guild=$1 AND keyword=$2`,
            [guildId, keyword]
        );
    }

    /**
     * Delete all guild specific custom reactions
     * @param guildId Guild Snowflake
     */
    async deleteGuildReactions(guildId: Snowflake) {
        customReactCache.deleteByValue((_, key) => key.startsWith(`${guildId}`));
        await database.query(`DELETE FROM customreact WHERE guild=$1`, [ guildId ]);
    }
}

const CustomReactRepo = new CustomReactRepository();
export default CustomReactRepo;