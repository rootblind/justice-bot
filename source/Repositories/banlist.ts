import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { BanList } from "../Interfaces/database_types.js";

class BanListRepository {
    async getUserBan(guildId: Snowflake, userId: Snowflake): Promise<BanList | null>  {
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
}

const BanListRepo = new BanListRepository();

export default BanListRepo;