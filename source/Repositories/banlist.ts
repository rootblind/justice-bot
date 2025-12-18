import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { BanList } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const banlistCache = new SelfCache<string, BanList | null>(60 * 60_000); // 1h

class BanListRepository {
    /**
     * The row about a specific user ban from a guild
     * @param guildId The guild snowflake
     * @param userId The user snowflake
     * @returns BanList object
     */
    async getGuildBan(guildId: Snowflake, userId: Snowflake): Promise<BanList | null> {
        const key = `${guildId}:${userId}`;
        const cache = banlistCache.get(key);
        if(cache !== undefined) return cache;

        const { rows: banData } = await database.query(
            `SELECT moderator, expires, reason 
            FROM banlist
            WHERE guild=$1
                AND target=$2`,
            [guildId, userId]
        );

        if (banData.length) {
            banlistCache.set(key, banData[0]);
            return banData[0];
        } else {
            banlistCache.set(key, null);
            return null;
        }

    }

    /**
     * @returns Array of rows of BanList data about expired tempbans or null if there is no expired tempban
     */
    async getExpiredTempBans(): Promise<BanList[] | null> {
        const { rows: banListData } = await database.query(
            `SELECT * FROM banlist WHERE expires > 0 AND expires <= $1`,
            [Math.floor(Date.now() / 1000)]
        );

        if (banListData.length) {
            return banListData;
        } else {
            return null;
        }
    }

    /**
     * Deletes all rows that have their expiration timestamp passed.
     * 
     * Rows with expires = 0 are avoided since those are marked permanent bans.
     */
    async deleteExpiredTempBans(): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        banlistCache.deleteByValue((value) => value !== null && value.expires > 0 && value.expires <= now);
        await database.query(
            `DELETE FROM banlist WHERE expires > 0 AND expires <= $1`,
            [now]
        );
    }

    /**
     * @param guildId Guild Snowflake
     * @param targetId User Snowflake
     * @returns A boolean of whether the user is permabanned or not
     */
    async isUserPermabanned(
        guildId: Snowflake,
        targetId: Snowflake
    ): Promise<boolean> {
        const key = `${guildId}${targetId}`;
        const cache = banlistCache.get(key);
        if(cache !== undefined) {
            // if the ban is cached, check the cache
            if(cache && cache.expires === 0) return true;
            return false; // if cached and cache === null or cache.expires !== 0 => not perma banned
        }

        const { rows: permabanBoolean } = await database.query(
            `SELECT EXISTS (
                SELECT 1 FROM banlist WHERE guild=$1 AND target=$2 AND expires=$3
            )`,
            [guildId, targetId, 0]
        );

        return permabanBoolean[0].exists;
    }

    /**
     * Delete the banned user entry
     * @param guildId Guild Snowflake
     * @param targetId User Snowflake
     */
    async deleteBan(
        guildId: Snowflake,
        targetId: Snowflake
    ): Promise<void> {
        const key = `${guildId}:${targetId}`;
        banlistCache.delete(key);

        await database.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`,
            [guildId, targetId]
        );
    }

    /**
     * Insert a new banlist row or update the existing one (guild, target pair)
     * @param guildId Guild Snowflake
     * @param targetId User Snowflake
     * @param moderatorId User Snowflake
     * @param expires Timestamp when the tempban expires or 0 if the ban is permanent
     * @param reason The reason for the ban
     */
    async push(
        guildId: Snowflake,
        targetId: Snowflake,
        moderatorId: Snowflake,
        expires: string | number,
        reason: string
    ) {
        const key = `${guildId}:${targetId}`;
        banlistCache.set(
            key,
            {
                id: 0,
                guild: BigInt(guildId),
                target: BigInt(targetId),
                moderator: BigInt(moderatorId),
                expires: Number(expires),
                reason: reason
            }
        );

        await database.query(
            `INSERT INTO banlist (guild, target, moderator, expires, reason)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (guild, target)
                DO UPDATE SET
                    moderator = EXCLUDED.moderator,
                    expires   = EXCLUDED.expires,
                    reason    = EXCLUDED.reason;`,
            [guildId, targetId, moderatorId, expires, reason]
        );
    }
}

const BanListRepo = new BanListRepository();

export default BanListRepo;