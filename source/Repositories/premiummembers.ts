import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { PremiumMembers, GuildMemberCustomRole } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

// this does not caches premiummembers objects, it keeps track of the boolean value
// of a member's status as a premium member
const membershipStatusCache = new SelfCache<string, boolean>(60 * 60_000);

class PremiumMembersRepository {
    /**
     * 
     * @param guildId Guild Snowflake
     * @param userId User Snowflake
     * @returns A boolean whether the user has premium status in the given Guild
     */
    async checkUserMembership(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
        const key = `${guildId}:${userId}`;
        const cache = membershipStatusCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: isPremium} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2)`,
            [guildId, userId]
        );

        membershipStatusCache.set(key, isPremium[0].exists);
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
        const key = `${guildId}:${memberId}:from_boosting`; // from boosting is a different matter
        const cache = membershipStatusCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: isBooster} = await database.query(
            `SELECT EXISTS(
                SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2 AND from_boosting=true
            )`,
            [guildId, memberId]
        );

        membershipStatusCache.set(key, isBooster[0].exists);
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
        membershipStatusCache.deleteByValue((_, key) => key.startsWith(`${guildId}:${memberId}`))
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

            if(from_boosting === true) {
                membershipStatusCache.set(`${guildId}:${memberId}:from_boosting`, true);
            }
        }

        parameters.push(memberId);
        parameters.push(guildId);

        query += ` WHERE member=$${++index} AND guild=$${++index}`;

        await database.query(query, parameters);

    }

    /**
     * Insert row
     * @param memberId Member Snowflake
     * @param guildId Guild Snowflake
     * @param code Encrypted code
     * @param customrole Custom role if it exists
     * @param from_boosting If the membership comes from boosting the guild
     */
    async newMember(
        memberId: Snowflake,
        guildId: Snowflake,
        code: string,
        customrole: Snowflake | null,
        from_boosting: boolean
    ): Promise<void> {
        const cacheKey = `${guildId}:${memberId}`;
        membershipStatusCache.set(cacheKey, true);
        if(from_boosting) membershipStatusCache.set(`${cacheKey}:from_boosting`, true);

        await database.query(
            `INSERT INTO premiummembers(member, guild, code, customrole, from_boosting)
                VALUES($1, $2, $3, $4, $5)`,
            [memberId, guildId, code, customrole, from_boosting]
        );
    }
 }

const PremiumMembersRepo = new PremiumMembersRepository();
export default PremiumMembersRepo;