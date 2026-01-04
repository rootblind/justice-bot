import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { BlockSystem } from "../Interfaces/database_types.js";

const blockListCache = new SelfCache<string, string[]>(60 * 60_000);

class BlockSystemRepository {
    async getAll(): Promise<BlockSystem[]> {
        const{rows: data} = await database.query<BlockSystem>(
            `SELECT * FROM blocksystem`
        );

        return data;
    }

    /**
     * Fetch how many people the member has blocked
     */
    async blockedByMemberCount(guildId: Snowflake, memberId: Snowflake): Promise<number> {
        const {rows: [{ count }]} = await database.query(
            `SELECT COUNT(*) AS count FROM blocksystem WHERE guild=$1 AND blocker=$2`,
            [ guildId, memberId ]
        );

        return Number(count);
    }

    /**
     * Array of all users blocked by this member
     */
    async getMemberBlockList(guildId: Snowflake, memberId: Snowflake): Promise<string[]> {
        const {rows: data} = await database.query<BlockSystem>(
            `SELECT blocked FROM blocksystem WHERE guild=$1 AND blocker=$2`,
            [guildId, memberId]
        );

        const ids = data.map(row => row.blocked);
        return ids;
    }

    /**
     * String array of all members that are blocking or being blocked by the memberId provided
     * 
     * Mutual restricted represents all the ids of members that can not interact with memberId through 
     * 
     * some features of the bot such as autovoice.
     */
    async getMutualRestrictedList(guildId: Snowflake, memberId: Snowflake): Promise<string[]> {
        const key = `${guildId}:${memberId};`
        const cache = blockListCache.get(key);
        if(cache !== undefined) return cache;
        const {rows: data} = await database.query(
            `SELECT DISTINCT
                CASE
                    WHEN blocker=$2 THEN blocked
                    ELSE blocker
                END AS user_id
            FROM blocksystem
            WHERE guild=$1 AND (blocker=$2 OR blocked=$2);`,
            [guildId, memberId]
        );

        const blockedIds = data.map(d => d.user_id);
        blockListCache.set(key, blockedIds);
        return blockedIds;
    }

    /**
     * Blocker member blocks Blocked member
     */
    async addBlock(guildId: Snowflake, blocker: Snowflake, blocked: Snowflake) {
        await database.query(
            `INSERT INTO blocksystem(guild, blocker, blocked)
                VALUES($1, $2, $3)
                ON CONFLICT (guild, blocker, blocked)
                DO NOTHING;`,
            [guildId, blocker, blocked]
        );

        // add mutual restrictions in cache
        const blockerCache = blockListCache.get(`${guildId}:${blocker}`);
        if(blockerCache) {
            // avoid duplicates
            if(!blockerCache.includes(blocked)) blockerCache.push(blocked);
        } else {
            blockListCache.set(`${guildId}:${blocker}`, [ blocked ]);
        }

        const blockedCache = blockListCache.get(`${guildId}:${blocked}`);
        if(blockedCache) {
            // avoid duplicates
            if(!blockedCache.includes(blocker)) blockedCache.push(blocker);
        } else {
            blockListCache.set(`${guildId}:${blocked}`, [ blocker ]);
        }
    }

    /**
     * Remove the block a blocker has given to a blocked
     */
    async removeBlock(guildId: Snowflake, blocker: Snowflake, blocked: Snowflake) {
        await database.query(`DELETE FROM blocksystem WHERE guild=$1 AND blocker=$2 AND blocked=$3`,
            [guildId, blocker, blocked]
        );

        // remove the mutual restrictions from cache
        const blockerCache = blockListCache.get(`${guildId}:${blocker}`);
        if(blockerCache) blockListCache.set(`${guildId}:${blocker}`, blockerCache.filter(v => v !== blocked));
        const blockedCache = blockListCache.get(`${guildId}:${blocked}`);
        if(blockedCache) blockListCache.set(`${guildId}:${blocked}`, blockedCache.filter(v => v !== blocker));
    }
}

const BlockSystemRepo = new BlockSystemRepository();
export default BlockSystemRepo;