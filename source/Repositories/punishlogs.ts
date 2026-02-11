import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { PunishLogs } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const punishLogsCache = new SelfCache<string, PunishLogs[]>();

class PunishLogsRepository {
    /**
     * Fetch the logs of a user from a specific guild in the desired chronological order
     * @param order Order the array ascending or descending based on the chronological factor
     * @param guildId Snowflake of the guild
     * @param userId Snowflake of the user
     * @returns Array (possibly empty) of all punishlogs of a user
     */
    async getUserLogsOrder(order: string, guildId: Snowflake, userId: Snowflake): Promise<PunishLogs[]> {
        const key = `${guildId}:${userId}`;
        const cache = punishLogsCache.get(key);
        if(cache !== undefined) {
            if(order.toUpperCase() === "DESC") {
                return cache.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
            } else {
                return cache.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
            }
        }

        const {rows: punishLogsData} = await database.query(
            `SELECT timestamp FROM punishlogs
                WHERE guild=$1
                    AND target=$2
                ORDER BY timestamp ${order.toUpperCase() == "DESC" ? "DESC" : "ASC"}
                LIMIT 1`,
            [guildId, userId]
        ); // default to  ASC if the programmer messes up

        punishLogsCache.set(key, punishLogsData);
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
        punishment_type: number,
        reason: string,
        timestamp: string
    ): Promise<PunishLogs & {id: number}> {
        const key = `${guildId}:${targetId}`;
        const log: PunishLogs = {
            id: 0,
            guild: guildId,
            target: targetId,
            moderator: moderatorId,
            punishment_type: punishment_type,
            reason: reason,
            timestamp: timestamp
        }

        const cache = punishLogsCache.get(key);
        if(cache !== undefined) {
            punishLogsCache.set(key, cache);
        } else {
            punishLogsCache.set(key, [ log ]);
        }

        const {rows: data} = await database.query<PunishLogs & {id: number}>(
            `INSERT INTO punishlogs (guild, target, moderator, punishment_type, reason, timestamp)
                VALUES($1, $2, $3, $4, $5, $6)
                RETURNING *;`,
            [guildId, targetId, moderatorId, punishment_type, reason, timestamp]
        );

        return data[0]!;
    }

    async deleteLogById(id: number) {
        // updating cache
        const cache = punishLogsCache.getByValue((value) => {
            if(value.find((v) => v.id === id)) return true;
            return false;
        });

        if(cache && cache[0] && cache[0].length) {
            const updatedCache = cache[0].filter(p => p.id !== id);
            const log = cache[0][0]!; // since cache[0].length > 0 there is an index 0 element
            punishLogsCache.set(`${log.guild}:${log.target}`, updatedCache);
        }

        // removing row
        await database.query(`DELETE FROM punishlogs WHERE id=$1`, [id]);
    }
}

const PunishLogsRepo = new PunishLogsRepository();
export default PunishLogsRepo;