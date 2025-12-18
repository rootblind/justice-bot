import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { GuildRolePair, GuildRoleTypeString } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const serverRolesCache = new SelfCache<string, Snowflake | null>(60 * 60_000);

class ServerRolesRepository {
    /**
     * Fetch all rows of all guilds that have set up the specific roletype
     * @param roletype 
     * @returns Array of {guild, role} objects (Snowflake)
     */
    async getAllGuildRolePairs(roletype: GuildRoleTypeString): Promise<GuildRolePair[] | null> {
        const {rows: guildRolePairs} = await database.query(
            `SELECT guild, role FROM serverroles WHERE roletype=$1`,
            [roletype]
        );

        if(guildRolePairs.length) {
            return guildRolePairs;
        } else {
            return null;
        }
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @returns The snowflake of the premium role if it exists in the database
     */
    async getGuildPremiumRole(guildId: Snowflake): Promise<Snowflake | null> {
        const key = `${guildId}:premium`;
        const cache = serverRolesCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: premiumRole} = await database.query(
            `SELECT role FROM serverroles WHERE guild=$1 AND roletype='premium'`,
            [guildId]
        );

        if(premiumRole.length) {
            serverRolesCache.set(key, String(premiumRole[0].role));
            return String(premiumRole[0].role);
        } else {
            serverRolesCache.set(key, null);
            return null;
        }
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @returns The snowflake of the staff role if it exists in the database
     */
    async getGuildStaffRole(guildId: Snowflake): Promise<Snowflake | null> {
        const key = `${guildId}:staff`;
        const cache = serverRolesCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: response} = await database.query(
            `SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
            [guildId]
        );

        if(response.length) {
            serverRolesCache.set(key, String(response[0].role));
            return String(response[0].role);
        } else {
            serverRolesCache.set(key, null);
            return null;
        }
    }
}

const ServerRolesRepo = new ServerRolesRepository();
export default ServerRolesRepo;