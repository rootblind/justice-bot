import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { BanList } from "../Interfaces/database_types.js";

class BanListRepository {
    /**
     * The row about a specific user ban from a guild
     * @param guildId The guild snowflake
     * @param userId The user snowflake
     * @returns BanList object
     */
    async getGuildBan(guildId: Snowflake, userId: Snowflake): Promise<BanList | null>  {
        const {rows: banData} = await database.query(
            `SELECT moderator, expires, reason 
            FROM banlist
            WHERE guild=$1
                AND target=$2`,
            [guildId, userId]
        );

        if(banData.length) {
            return banData[0];
        } else {
            return null;
        }
        
    }

    /**
     * @returns Array of rows of BanList data about expired tempbans or null if there is no expired tempban
     */
    async getExpiredTempBans() {
        const {rows: banListData} = await database.query(
            `SELECT * FROM banlist WHERE expires > 0 AND expires <= $1`,
            [Math.floor(Date.now() / 1000)]
        );

        if(banListData.length) {
            return banListData;
        } else {
            return null;
        }
    }

    async deleteExpiredTempBans() {
        await database.query(
            `DELETE FROM banlist WHERE expires > 0 AND expires <= $1`,
            [Math.floor(Date.now() / 1000)]
        );
    }
}

const BanListRepo = new BanListRepository();

export default BanListRepo;