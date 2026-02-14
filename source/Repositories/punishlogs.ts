import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { PunishLogs } from "../Interfaces/database_types.js";
import { PunishmentType } from "../objects/enums.js";
import { InfractionsListType } from "../Systems/moderation/infractions.js";


class PunishLogsRepository {
    key(guildId: string, userId: string): string {
        return `${guildId}:${userId}`;
    }

    /**
     * Fetches a single punishment log entry (oldest or most recent) for a user in a guild.
     *
     * The result is ordered chronologically based on the provided order parameter.
     * If an invalid order is provided, it defaults to ascending ("ASC").
     *
     * @param order Either "ASC" or "DESC" to determine chronological order.
     * @param guildId Snowflake identifier of the guild.
     * @param userId Snowflake identifier of the user.
     * @param limit Optionally limit the getter to a specific amount
     * @returns Promise resolving to an array containing at most one punishment log entry (possibly empty).
     */
    async getUserLogsOrder(
        order: "ASC" | "DESC",
        guildId: Snowflake,
        userId: Snowflake,
        limit?: number
    ): Promise<PunishLogs[]> {
        const { rows: punishLogsData } = await database.query<PunishLogs>(
            `SELECT * FROM punishlogs
                WHERE guild=$1
                    AND target=$2
                ORDER BY timestamp ${order.toUpperCase() == "DESC" ? "DESC" : "ASC"}
                ${limit !== undefined ? `LIMIT ${limit}` : ""}`,
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
     * 
     * @returns The inserted row
     */
    async insertLog(
        guildId: Snowflake,
        targetId: Snowflake,
        moderatorId: Snowflake,
        punishment_type: 0 | 1 | 2 | 3 | 4,
        reason: string,
        timestamp: string
    ): Promise<PunishLogs & { id: number }> {
        const { rows: data } = await database.query<PunishLogs & { id: number }>(
            `INSERT INTO punishlogs (guild, target, moderator, punishment_type, reason, timestamp)
                VALUES($1, $2, $3, $4, $5, $6)
                RETURNING *;`,
            [guildId, targetId, moderatorId, punishment_type, reason, timestamp]
        );

        return data[0]!;
    }

    async deleteLogById(id: number) {
        // removing row
        await database.query(`DELETE FROM punishlogs WHERE id=$1`, [id]);
    }

    /**
     * Fetch the punishlogs of a member by punishment type
     * 
     * @param type Fetch the logs based on punishment type
     * @param order How the logs should be ordered by timestamp. Defaults to DESC
     * @param limit Optionally limit the results
     */
    async fetchLogsByType(
        guildId: Snowflake,
        userId: Snowflake,
        type: PunishmentType,
        order: "ASC" | "DESC" = "DESC",
        limit?: number
    ): Promise<PunishLogs[]> {
        const { rows: data } = await database.query<PunishLogs>(
            `SELECT * 
            FROM punishlogs 
            WHERE guild=$1 
                AND target=$2 
                AND punishment_type=$3
            ORDER BY timestamp ${order}
            ${limit !== undefined ? `LIMIT ${limit}` : ""}`,
            [guildId, userId, type]
        );
        return data;
    }

    /**
     * Fetch the last log about the target's ban (tempban, indefinite ban, perma ban)
     */
    async fetchLastBan(guildId: string, targetId: string): Promise<PunishLogs | null> {
        const { rows: data } = await database.query<PunishLogs>(
            `SELECT * FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type >= $3
            ORDER BY timestamp DESC
            LIMIT 1`,
            [guildId, targetId, PunishmentType.TEMPBAN]
        )

        if (data && data[0]) {
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Fetch the target's bans (tempban, indefinite ban, perma ban)
     */
    async fetchBans(guildId: string, targetId: string): Promise<PunishLogs[]> {
        const { rows: data } = await database.query<PunishLogs>(
            `SELECT * FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type >= $3
            ORDER BY timestamp DESC`,
            [guildId, targetId, PunishmentType.TEMPBAN]
        )

        return data
    }

    /**
     * In order to block access cross-server, guild is used in the query
     */
    async getLogByIdGuild(guildId: string, id: number): Promise<PunishLogs | null> {
        const { rows: data } = await database.query<PunishLogs>(
            `SELECT * FROM punishlogs WHERE guild=$1 AND id=$2`,
            [guildId, id]
        );

        if (data && data[0]) return data[0];
        return null;
    }

    /**
     * The safer version to avoid cross-server actions
     */
    async deleteLogByIdGuild(guildId: Snowflake, id: number) {
        await database.query(`DELETE FROM punishlogs WHERE guild=$1 AND id=$2`, [guildId, id]);
    }

    /**
     * Delete target's rows in bulk based on type.
     * 
     * "full" removes all logs about the target in that guild
     * 
     * "ban" removes all logs about the target in a guild regarding tempban, indefinite ban and permaban
     */
    async deleteInfractionPage(
        guildId: string,
        userId: string,
        type: InfractionsListType
    ): Promise<number> {
        let query = "DELETE FROM punishlogs WHERE guild=$1 AND target=$2";

        switch (type) {
            case "full": {
                query += ";";
                break;
            }
            case "warn": {
                query += " AND punishment_type = 0;";
                break;
            }
            case "timeout": {
                query += " AND punishment_type = 1;";
                break;
            }
            case "ban": {
                query += " AND punishment_type >= 2;"
                break;
            }
        }

        const result = await database.query(query, [guildId, userId]);

        return result.rowCount ?? 0;
    }
}

const PunishLogsRepo = new PunishLogsRepository();
export default PunishLogsRepo;