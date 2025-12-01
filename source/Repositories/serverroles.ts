import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { GuildRolePair, GuildRoleTypeString } from "../Interfaces/database_types.js";

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
        const {rows: premiumRole} = await database.query(
            `SELECT role FROM serverroles WHERE guild=$1 AND roletype='premium'`,
            [guildId]
        );

        if(premiumRole.length) {
            return String(premiumRole[0].role);
        } else {
            return null;
        }
    }
}

const ServerRolesRepo = new ServerRolesRepository();
export default ServerRolesRepo;