import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { BanList } from "../Interfaces/database_types.js";

class BanListRepository {
    /**
     * The row about a specific user ban from a guild
     * @param guildId The guild snowflake
     * @param userId The user snowflake
     * @returns BanList object
     */
    async getGuildBan(guildId: Snowflake, userId: Snowflake): Promise<BanList | null> {
        const { rows: banData } = await database.query(
            `SELECT moderator, expires, reason 
            FROM banlist
            WHERE guild=$1
                AND target=$2`,
            [guildId, userId]
        );

        if (banData.length) {
            return banData[0];
        } else {
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
        await database.query(
            `DELETE FROM banlist WHERE expires > 0 AND expires <= $1`,
            [Math.floor(Date.now() / 1000)]
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