import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { CustomReact } from "../Interfaces/database_types.js";

const customReactCache = new SelfCache<string, string | null>(24 * 60 * 60_000);

class CustomReactRepository {
    async upsert(guildId: Snowflake, keyword: string, reply: string): Promise<string> {
        const keywordNormalized = keyword.toLowerCase();
        await database.query(
            `INSERT INTO customreact (guild, keyword, reply)
            VALUES ($1, $2, $3)
            ON CONFLICT (guild, keyword)
            DO UPDATE SET
                reply = EXCLUDED.reply
            RETURNING reply;`,
            [guildId, keywordNormalized, reply]
        );

        customReactCache.set(`${guildId}:${keywordNormalized}`, reply);
        return reply;
    }
    /**
     * @param guildId Guild Snowflake 
     * @param keyword The keyword to fetch
     * @returns The reply to the keyword if there is one set
     */
    async getKeywordReply(guildId: Snowflake, keyword: string): Promise<string | null> {
        const keywordNormalized = keyword.toLowerCase();
        const key = `${guildId}:${keywordNormalized}`;
        const cache = customReactCache.get(key);
        if (cache !== undefined) return cache;

        const { rows: reaction } = await database.query(
            `SELECT reply FROM customreact WHERE guild=$1 AND keyword=$2`,
            [guildId, keywordNormalized]
        );

        if (reaction.length) {
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
    async deleteGuildReply(guildId: Snowflake, keyword: string): Promise<number | null> {
        const keywordNormalized = keyword.toLowerCase();
        const key = `${guildId}:${keywordNormalized}`;
        customReactCache.delete(key);

        const result = await database.query(`DELETE FROM customreact WHERE guild=$1 AND keyword=$2`,
            [guildId, keywordNormalized]
        );

        return result.rowCount;
    }

    /**
     * Delete all guild specific custom reactions
     * @param guildId Guild Snowflake
     */
    async deleteGuildReactions(guildId: Snowflake) {
        customReactCache.deleteByValue((_, key) => key.startsWith(`${guildId}`));
        await database.query(`DELETE FROM customreact WHERE guild=$1`, [guildId]);
    }

    async getGuildList(guildId: Snowflake): Promise<CustomReact[]> {
        const { rows: data } = await database.query<CustomReact>(
            `SELECT * FROM customreact WHERE guild=$1`, [guildId]
        );

        for (const row of data) { // populate cache
            customReactCache.set(`${guildId}:${row.keyword}`, row.reply);
        }

        return data;
    }
}

const CustomReactRepo = new CustomReactRepository();
export default CustomReactRepo;