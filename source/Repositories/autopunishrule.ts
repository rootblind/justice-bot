import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { AutoPunishRule, AutoPunishRuleWithWarnCounter } from "../Interfaces/database_types.js";
import { seconds_to_duration, timestampNow } from "../utility_modules/utility_methods.js";

class AutopunishRuleRepository {
    /**
     * 
     * @param rule Autorule
     * @returns The rule as human-readable text
     */
    stringifyRule(rule: AutoPunishRule): string {
        const punishmentDict = {
            1: "timeout",
            2: "tempban",
            3: "indefinite ban"
        }

        let ruleMessage = `\`${punishmentDict[rule.punishment_type]}\` `;
        if (rule.punishment_type < 3) {
            ruleMessage += `for \`${seconds_to_duration(Number(rule.punishment_duration))}\` `;
        }
        ruleMessage += `when someone has \`${rule.warncount} warns\` or more in the last \`${seconds_to_duration(Number(rule.duration))}\``;
        return ruleMessage;
    }
    /**
     * The rules are ordered from the highest warncount to the lowest and rules with shorter duration have priority 
     * over rules with a longer.
     * 
     * @returns autopunishrules and "activewarns" as a counter for the number of punishlog warns that fit the autorule duration 
     */
    async getActiveRulesForTarget(guildId: string, targetId: string) {
        const { rows: data } = await database.query<AutoPunishRuleWithWarnCounter>(
            `SELECT ar.*, COUNT (pl.id) AS activewarns
            FROM autopunishrule ar
            LEFT JOIN punishlogs pl
            ON ar.guild = pl.guild
                AND pl.punishment_type = 0
                AND pl.timestamp >= $1 - ar.duration
                AND pl.target=$3
            WHERE ar.guild=$2
            GROUP BY ar.id
            ORDER BY ar.warncount DESC, ar.duration ASC`,
            [timestampNow(), guildId, targetId]
        );

        return data;
    }

    /**
     * The number of rules in a guild
     */
    async count(guildId: Snowflake): Promise<number> {
        const { rows: [{ count }] } = await database.query(
            `SELECT COUNT (*) AS count FROM autopunishrule WHERE guild=$1`, [guildId]
        );

        return count;
    }

    /**
     * @returns If the guild-warncount-duration combination is valid (unique) 
     */
    async isRuleValid(guildId: Snowflake, warncount: number, duration: number): Promise<boolean> {
        const { rows: valid } = await database.query(
            `SELECT EXISTS
            (SELECT 1 FROM autopunishrule WHERE guild=$1 AND warncount=$2 AND duration=$3)`,
            [guildId, warncount, duration]
        );

        return !valid[0].exists; // if it exists, then it's not valid
    }

    /**
     * Insert or update an autorule based on guild-warncount-duration
     * @returns The row inserted or updated
     */
    async insert(
        guildId: Snowflake,
        warnCount: number,
        duration: number,
        punishment_type: number,
        punishment_duration: number
    ): Promise<AutoPunishRule & { id: number }> {
        const { rows: data } = await database.query<AutoPunishRule & { id: number }>(
            `INSERT INTO autopunishrule(guild, warncount, duration, punishment_type, punishment_duration)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (guild, warncount, duration)
                DO UPDATE SET
                    punishment_type = EXCLUDED.punishment_type,
                    punishment_duration = EXCLUDED.punishment_duration
                RETURNING *;`,
            [guildId, warnCount, duration, punishment_type, punishment_duration]
        );

        return data[0]!;
    }

    /**
     * Fetch all autorules from the guild
     */
    async getRules(guildId: Snowflake): Promise<(AutoPunishRule & { id: number })[]> {
        const { rows: data } = await database.query<AutoPunishRule & { id: number }>(
            `SELECT * FROM autopunishrule WHERE guild=$1
                ORDER BY warncount DESC, duration ASC`,
            [guildId]
        );

        return data;
    }

    /**
     * Delete rules in bulk using an array of database ids
     */
    async deleteRulesByIdArray(guildId: Snowflake, ids: number[] | string[]) {
        await database.query(
            `DELETE FROM autopunishrule WHERE guild=$1 AND id=ANY($2::int[])`,
            [guildId, ids]
        );
    }

    async cleanGuildRules(guildId: Snowflake) {
        await database.query(`DELETE FROM autopunishrule WHERE guild=$1`, [guildId]);
    }
}

const AutopunishRuleRepo = new AutopunishRuleRepository();
export default AutopunishRuleRepo;