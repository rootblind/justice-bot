import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { PunishLogs } from "../Interfaces/database_types.js";

class PunishLogsRepository {
    async getUserLogsOrder(order: string, guildId: Snowflake, userId: Snowflake): Promise<PunishLogs[]> {
        const {rows: punishLogsData} = await database.query(
            `SELECT timestamp FROM punishlogs
                WHERE guild=$1
                    AND target=$2
                ORDER BY timestamp ${order.toUpperCase() == "DESC" ? "DESC" : "ASC"}
                LIMIT 1`,
            [guildId, userId]
        ); // default to  ASC if the programmer messes up

        return punishLogsData;
    }
}

const PunishLogsRepo = new PunishLogsRepository();
export default PunishLogsRepo;