import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { PunishLogs } from "../Interfaces/database_types.js";

class PunishLogsRepository {
    /**
     * Fetch the logs of an user from a specific guild in the desired chronological order
     * @param order Order the array ascending or descending based on the chronological factor
     * @param guildId Snowflake of the guild
     * @param userId Snowflake of the user
     * @returns Array (possibly empty) of all punishlogs of an user
     */
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