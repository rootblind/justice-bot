import { Snowflake } from "discord.js";
import database from "../Config/database.js";
//import type { PremiumMembers } from "../Interfaces/database_types.js";

class PremiumMembersRepository {
    async checkUserMembership(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
        const {rows: isPremium} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2)`,
            [guildId, userId]
        );

        return isPremium[0].exists
    }
}

const PremiumMembersRepo = new PremiumMembersRepository();
export default PremiumMembersRepo;