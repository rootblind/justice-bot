import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { ServerRoles, type GuildRolePair, type GuildRoleTypeString } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const serverRolesCache = new SelfCache<string, Snowflake | null>(60 * 60_000);

class ServerRolesRepository {
    /**
     * Insert or update a row based on guild-roletype pair
     */
    async put(guildId: Snowflake, type: GuildRoleTypeString, roleId: Snowflake) {
        const key = `${guildId}:${type}`;
        serverRolesCache.set(key, roleId);

        await database.query(
            `INSERT INTO serverroles (guild, roletype, role) VALUES($1, $2, $3)
                ON CONFLICT (guild, roletype)
                    DO UPDATE SET
                        role = EXCLUDED.role`,
            [guildId, type, roleId]
        );
    }
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
     * Fetch all assigned server roles.
     */
    async getServerRoles(guildId: Snowflake): Promise<ServerRoles[]> {
        const {rows: data} = await database.query<ServerRoles>(
            `SELECT * FROM serverroles WHERE guild=$1`, [ guildId ]
        );

        for(const row of data) {
            serverRolesCache.set(`${guildId}:${row.roletype}`, row.role);
        }

        return data;
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

    async getGuildBotRole(guildId: Snowflake): Promise<Snowflake | null> {
        const key = `${guildId}:bot`;
        const cache = serverRolesCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: response} = await database.query(
            `SELECT role FROM serverroles WHERE guild=$1 AND roletype='bot'`,
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

    /**
     * Delete the registry of the specific role type from the guild
     * @param guildId Guild Snowflake
     * @param type Server role type
     */
    async deleteGuildRole(guildId: Snowflake, type: GuildRoleTypeString) {
        const key = `${guildId}:${type}`;
        serverRolesCache.delete(key);

        await database.query(`DELETE FROM serverroles WHERE guild=$1 AND roletype=$2`,
            [guildId, type]
        );
    }
}

const ServerRolesRepo = new ServerRolesRepository();
export default ServerRolesRepo;