import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { PremiumMembers, GuildMemberCustomRole } from "../Interfaces/database_types.js";

class PremiumMembersRepository {
    /**
     * 
     * @param guildId Guild Snowflake
     * @param userId User Snowflake
     * @returns A boolean whether the user has premium status in the given Guild
     */
    async checkUserMembership(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
        const {rows: isPremium} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2)`,
            [guildId, userId]
        );

        return isPremium[0].exists
    }

    /**
     * @param guildId Guild Snowflake
     * @param memberId Member/User Snowflake
     * @returns Boolean true if the member has premium membership from boosting the guild
     */
    async isPremiumFromBoosting(
        guildId: Snowflake,
        memberId: Snowflake
    ): Promise<boolean> {
        const {rows: isBooster} = await database.query(
            `SELECT EXISTS(
                SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2 AND from_boosting=true
            )`,
            [guildId, memberId]
        );

        return isBooster[0].exist;
    }

    /**
     * 
     * @returns Array of all premium members from all guilds that aquired premium through boosting
     */
    async getAllPremiumBoosters(): Promise<PremiumMembers[] | null> {
        const {rows: premiumBoosters} = await database.query(
            `SELECT * FROM premiummembers WHERE from_boosting=true`
        );

        if(premiumBoosters.length > 0) {
            return premiumBoosters;
        } else {
            return null;
        }
    }

    /**
     * Delete rows of a member's membership on the specified guild
     * @param guildId Guild Snowflake
     * @param memberId Member/User Snowflake
     */
    async deletePremiumGuildMember(guildId: Snowflake, memberId: Snowflake): Promise<void> {
        await database.query(
            `DELETE FROM premiummembers WHERE guild=$1 AND member=$2`,
            [guildId, memberId]
        );
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @param memberId Member/User Snowflake
     * @returns The snowflake of premium member's custom role if it exists
     */
    async getMemberCustomRole(guildId: Snowflake, memberId: Snowflake): Promise<Snowflake | null> {
        const {rows: customRole} = await database.query(
            `SELECT customrole FROM premiummembers WHERE guild=$1 AND member=$2`,
            [guildId, memberId]
        );

        if(customRole.length) {
            return String(customRole[0].customrole);
        } else {
            return null;
        }
    }

    /**
     * Fetch the guild, member id and custom role id from all the premiummembers rows with expired codes
     */
    async getExpiredGuildMemberCustomRole(): Promise<GuildMemberCustomRole[] | null> {
        const {rows: expiredMembers} = await database.query(
            `SELECT pm.guild, pm.member, customrole 
                FROM premiummembers pm
                    JOIN premiumkey pc ON pm.code = pc.code AND pm.guild = pc.guild
                        WHERE pc.expiresat <= $1 AND pc.expiresat > 0`,
            [Math.floor(Date.now() / 1000)]
        );

        if(expiredMembers.length) {
            return expiredMembers;
        } else {
            return null;
        }
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @param memberId Member Snowflake
     * @param code hex string
     * @param from_boosting Whether the membership is from boosting or not, can be omitted to remain unchanged
     */
    async updateMemberCode(
        guildId: Snowflake, 
        memberId: Snowflake, 
        code: string, 
        from_boosting: boolean | null = null
    ): Promise<void> {
        let index = 1;
        let query = `UPDATE premiummembers SET code=$${index}`;

        const parameters: unknown[] = [code];

        if(from_boosting !== null) {
             query += `, from_boosting=$${++index}`;
             parameters.push(from_boosting);
        }

        parameters.push(memberId);
        parameters.push(guildId);

        query += ` WHERE member=$${++index} AND guild=$${++index}`;

        await database.query(query, parameters);

    }
 }

const PremiumMembersRepo = new PremiumMembersRepository();
export default PremiumMembersRepo;