import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { PunishLogs } from "../Interfaces/database_types.js";

class PunishLogsRepository {
    /**
     * Fetch the logs of a user from a specific guild in the desired chronological order
     * @param order Order the array ascending or descending based on the chronological factor
     * @param guildId Snowflake of the guild
     * @param userId Snowflake of the user
     * @returns Array (possibly empty) of all punishlogs of a user
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

    /**
     * 
     * @param guildId Guild Snowflake
     * @param targetId Target Snowflake
     * @param moderatorId Executor Snowflake
     * @param punishment_type Punishment index: 0- warn; 1- timeout; 2- tempban; 3- indefinite ban; 4- permanent ban
     * @param reason The reason for the punishment
     * @param timestamp The timestamp of the punishment
     */
    async insertLog(
        guildId: Snowflake,
        targetId: Snowflake,
        moderatorId: Snowflake,
        punishment_type: number,
        reason: string,
        timestamp: string
    ): Promise<void> {
        await database.query(
            `INSERT INTO punishlogs (guild, target, moderator, punishment_type, reason, timestamp)
                VALUES($1, $2, $3, $4, $5, $6)`,
            [guildId, targetId, moderatorId, punishment_type, reason, timestamp]
        );
    }
}

const PunishLogsRepo = new PunishLogsRepository();
export default PunishLogsRepo;