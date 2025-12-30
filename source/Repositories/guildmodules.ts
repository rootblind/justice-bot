import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { GuildModules } from "../Interfaces/database_types";

const guildModulesCache = new SelfCache<string, string[]>(60 * 60_000);

class GuildModulesRepository {
    /**
     * Set a guild's disabled modules to default (everything is enabled)
     * @param guildId Guild Snowflake
     */
    async default(guildId: Snowflake) {
        guildModulesCache.set(guildId, []);

        await database.query(
            `INSERT INTO guildmodules (guild, disabled_groups) 
            VALUES ($1, '{}') 
            ON CONFLICT (guild) 
            DO UPDATE SET disabled_groups = '{}'`,
            [guildId]
        );
    }

    /**
     * Enabling/disabling works on a negative logic, everything in the array is disabled 
     * so disable adds the groups to the array
     * @param guildId Guild Snowflake
     * @param groups The single group or the array of groups to be disabled
     */
    async disable(guildId: Snowflake, groups: string | string[]) {
        const groupsArray = Array.isArray(groups) ? groups : [groups];
        const current = guildModulesCache.get(guildId) || [];
        const updated = [...new Set([...current, ...groupsArray])];
        guildModulesCache.set(guildId, updated);

        // using UNNEST and ARRAY_AGG to merge arrays and remove duplicates
        await database.query(
            `INSERT INTO guildmodules (guild, disabled_groups) 
                VALUES($1, $2)
                ON CONFLICT (guild) DO UPDATE SET 
                disabled_groups = (
                    SELECT ARRAY_AGG(DISTINCT x) 
                    FROM UNNEST(guildmodules.disabled_groups || $2) t(x)
         )`,
            [guildId, groupsArray]
        );
    }

    /**
     * Enabling/disabling works on a negative logic, everything in the array is disabled 
     * so enable removes the groups from the array
     * @param guildId Guild Snowflake
     * @param groups The single group or the array of groups to be enabled
     */
    async enable(guildId: Snowflake, groups: string | string[]) {
        const groupsArray = Array.isArray(groups) ? groups : [groups];
        const current = guildModulesCache.get(guildId) || [];
        const updated = current.filter(g => !groupsArray.includes(g));
        guildModulesCache.set(guildId, updated);

        await database.query(
            `UPDATE guildmodules 
            SET disabled_groups = (
                SELECT COALESCE(ARRAY_AGG(x), '{}') 
                FROM UNNEST(disabled_groups) t(x)
                WHERE x <> ALL($2)
            )
            WHERE guild = $1`,
            [guildId, groupsArray]
        );
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @returns Array of groups disabled on this guild
     */
    async getGuildDisabled(guildId: Snowflake): Promise<string[]> {
        const cache = guildModulesCache.get(guildId);
        if (cache !== undefined) {
            return cache;
        }
        const { rows: data } = await database.query(
            `SELECT disabled_groups FROM guildmodules WHERE guild = $1`,
            [guildId]
        );
        const disabledGroups = data.length > 0
            ? data[0].disabled_groups
            : [];

        guildModulesCache.set(guildId, disabledGroups);
        return disabledGroups;
    }

    /**
     * Fetch the entire table
     * @returns GuildModules
     */
    async getAll(): Promise<GuildModules[]> {
        const { rows: data } = await database.query<GuildModules>(
            `SELECT * FROM guildmodules`
        );

        for(const row of data) {
            guildModulesCache.set(row.guild, row.disabled_groups);
        }
        return data;
    }
}

const GuildModulesRepo = new GuildModulesRepository();
export default GuildModulesRepo;