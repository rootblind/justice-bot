import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { PremiumCustomRole, PremiumKey, PremiumMember } from "../Interfaces/database_types.js";
import { encryptor, timestampNow } from "../utility_modules/utility_methods.js";
import { SelfCache } from "../Config/SelfCache.js";

interface GuildMemberRole { guild: Snowflake, member: Snowflake, role: Snowflake | null };
interface MembershipTierKeyIdRole { premiumkey_id: number, tier: number, member: Snowflake, role: Snowflake | null }
interface MembershipFull {
    membership_id: number;
    member: Snowflake;
    guild: Snowflake;
    premiumkey_id: number;
    key_id: number;
    code: Buffer;
    tier: number;
    generatedby: Snowflake;
    createdat: number;
    expiresat: number;
    usesnumber: number;
    dedicateduser: Snowflake | null;
    role: Snowflake | null;
}

// invite cooldowns
const inviteCooldowns = new SelfCache<string, number>();
// the keyformat is INVITER_MEMBER_ID:INVITED_MEMBER_ID
const key_format = (inviter: string, invited: string) => `${inviter}:${invited}`;
export const INVITE_ROLE_COOLDOWN = 120; // 120 seconds | 2 minutes
export const DENY_INVITE_ROLE_COOLDOWN = 600 // 600 seconds | 10 minutes

class PremiumSystemRepository {
    /*
    * Managing the invite cooldowns cache
    */
    /**
     * 
     * @param inviter Inviter member snowflake
     * @param invited Invited member snowflake
     * @returns the expiration timestamp
     */
    getInviteCooldown(inviter: string, invited: string): number | null {
        return inviteCooldowns.get(key_format(inviter, invited)) ?? null;
    }
    /**
     * 
     * @param inviter Inviter member snowflake
     * @param invited Invited member snowflake
     * @param cooldown The cooldown to be set in seconds
     * @returns the expiration timestamp
     */
    setInviteCooldown(inviter: string, invited: string, cooldown: number): number {
        const expirationTimestamp = timestampNow() + cooldown;
        inviteCooldowns.set(key_format(inviter, invited), expirationTimestamp);
        return expirationTimestamp;
    }
    removeInviteCooldown(inviter: string, invited: string) {
        inviteCooldowns.delete(key_format(inviter, invited));
    }


    /**
     * Fetch the membership of the given user within the specified guild
     */
    async getGuildMembership(guildId: Snowflake, memberId: Snowflake): Promise<PremiumMember & { id: number } | null> {
        const { rows: data } = await database.query<PremiumMember & { id: number }>(
            `
            SELECT * FROM premiummember WHERE guild=$1 AND member=$2
            `,
            [guildId, memberId]
        );

        return data[0] ?? null;
    }
    /**
     * @param guildId Guild Snowflake
     * @param userId User Snowflake
     * @returns The tier of the membership or null if the user is not registered as a premium user.
     */
    async getMembershipTier(guildId: Snowflake, userId: Snowflake): Promise<number | null> {
        const { rows: data } = await database.query<{ tier: number }>(
            `
            SELECT pk.tier
            FROM premiummember pm
            JOIN premiumkey pk
                ON pm.premiumkey_id = pk.id
            WHERE pm.member = $2 AND pm.guild = $1
            `,
            [guildId, userId]
        );

        return data[0]?.tier ?? null;

    }

    /**
     * @param tier The tier of the memberships to look for
     * @returns Array of all premium members from all guilds that have the tier given
     */
    async getAllMembershipsWithTier(tier: number): Promise<PremiumMember[]> {
        const { rows: memberships } = await database.query<PremiumMember>(
            `
            SELECT pm.*
            FROM premiummember pm
            JOIN premiumkey pk
                ON pm.premiumkey_id = pk.id
            WHERE pk.tier = $1
            `,
            [tier]
        );

        return memberships;
    }

    /**
     * Remove the targeted member's premium status from the given guild id
     * @param guildId Guild Snowflake
     * @param memberId Member/User Snowflake
     */
    async removeGuildMembership(guildId: Snowflake, memberId: Snowflake): Promise<void> {
        await database.query(
            `DELETE FROM premiummember WHERE guild=$1 AND member=$2`,
            [guildId, memberId]
        );
    }

    /**
     * Fetch the custom role discord snowflake by member id.
     * 
     * @param guildId Guild Snowflake
     * @param memberId Member/User Snowflake
     * @returns The snowflake of premium member's custom role if it exists or null otherwise
     */
    async getMemberCustomRole(guildId: Snowflake, memberId: Snowflake): Promise<Snowflake | null> {
        const { rows: data } = await database.query<{ role: Snowflake }>(
            `
            SELECT pcr.role
            FROM premium_custom_role pcr
            JOIN premiummember pm
                ON pm.id = pcr.premiummember_id
            WHERE pm.guild = $1 AND pm.member = $2
            `,
            [guildId, memberId]
        );

        return data[0]?.role ?? null;
    }


    /**
     * Fetch the guild, member id and custom role id from all the premiummembers rows with expired codes
     */
    async getExpiredGuildMemberCustomRole(): Promise<GuildMemberRole[]> {
        const { rows: expiredMembers } = await database.query<GuildMemberRole>(
            `
            SELECT pm.guild, pm.member, pcr.role 
            FROM premiummember pm
            JOIN premiumkey pk
                ON pm.premiumkey_id = pk.id
            LEFT JOIN premium_custom_role pcr
                ON pcr.premiummember_id = pm.id
            WHERE pk.expiresat <= $1 AND pk.expiresat > 0`,
            [timestampNow()]
        );

        return expiredMembers;
    }

    /**
     * Fetches a member's premium membership information for a specific guild.
     *
     * The returned data includes the premium key ID assigned to the member,
     * the premium tier granted by that key, and the member's custom role
     * snowflake if one exists.
     *
     * @param guild Guild Snowflake.
     * @param memberId Member/User Snowflake.
     * @returns The member's premium membership information, or `null` if the
     * member does not have a premium membership in the specified guild.
     */
    async getGuildMembershipFeatures(guild: Snowflake, memberId: Snowflake): Promise<MembershipTierKeyIdRole | null> {
        const { rows: data } = await database.query<MembershipTierKeyIdRole>(
            `
            SELECT
                pm.premiumkey_id,
                pk.tier,
                pm.member,
                pcr.role
            FROM premiummember pm
            JOIN premiumkey pk
                ON pm.premiumkey_id = pk.id
            LEFT JOIN premium_custom_role pcr
                ON pcr.premiummember_id=pm.id
            WHERE pm.guild=$1
                AND pm.member=$2
            `,
            [guild, memberId]
        );

        return data[0] ?? null;
    }

    /**
     * 
     * @param guildId Guild Snowflake
     * @param memberId Member Snowflake
     * @param premiumKeyId The ID of the premiumkey.
     */
    async updateMemberCode(
        guildId: Snowflake,
        memberId: Snowflake,
        premiumKeyId: number
    ): Promise<PremiumMember> {
        const { rows: data } = await database.query<PremiumMember>(
            `
            UPDATE premiummember SET premiumkey_id=$3
            WHERE guild=$1 AND member=$2
            RETURNING *;
            `,
            [guildId, memberId, premiumKeyId]
        );

        return data[0]!;
    }

    /**
     * Insert row
     * @param memberId Member Snowflake
     * @param guildId Guild Snowflake
     * @param premiumKeyId The premiumkey ID that enables this membership
     */
    async newMembership(
        memberId: Snowflake,
        guildId: Snowflake,
        premiumKeyId: number
    ): Promise<PremiumMember> {
        const { rows: data } = await database.query<PremiumMember>(
            `
            INSERT INTO premiummember(member, guild, premiumkey_id)
            VALUES($1, $2, $3)
            RETURNING *;
            `,
            [memberId, guildId, premiumKeyId]
        );

        return data[0]!;
    }

    /**
     * 
     * @param membershipId The ID of the membership this role is assigned to
     * @param roleId The Snowflake of the role to be assigned as custom role
     */
    async assignCustomRole(
        membershipId: number,
        roleId: Snowflake
    ): Promise<PremiumCustomRole> {
        const { rows: data } = await database.query<PremiumCustomRole>(
            `
            INSERT INTO premium_custom_role (premiummember_id, role)
            VALUES ($1, $2)
            ON CONFLICT (premiummember_id)
            DO UPDATE
            SET role = EXCLUDED.role

            RETURNING *;
            `,
            [membershipId, roleId]
        );

        return data[0]!;
    }

    /**
     * Fetch the database row of a custom role by its role snowflake
     */
    async getCustomRoleBySnowflake(roleId: Snowflake): Promise<PremiumCustomRole | null> {
        const { rows: data } = await database.query<PremiumCustomRole>(
            `SELECT * FROM premium_custom_role WHERE role=$1`, [roleId]
        );

        return data[0] ?? null;
    }

    /**
     * Based on role snowflake, remove a custom role
     * @param roleId Role Snowflake
     */
    async removeCustomRole(roleId: Snowflake) {
        await database.query(
            `DELETE FROM premium_custom_role WHERE role=$1`,
            [roleId]
        );
    }

    /**
     * @param guildId Guild snowflake
     * @returns Array of all codes as hex strings from the specified guild (codes are stored encrypted)
     */
    async getAllGuildCodes(guildId: Snowflake): Promise<string[]> {
        const { rows: codes } = await database.query<{ code: Buffer }>(
            `SELECT code FROM premiumkey WHERE guild=$1`,
            [guildId]
        );

        return codes.map(row => row.code.toString("hex"));
    }

    /**
     * 
     * @returns Array of all codes in the database as strings
     */
    async getAllCodes(): Promise<string[]> {
        const { rows: codes } = await database.query<{ code: Buffer }>(
            `SELECT code FROM premiumkey;`
        );

        return codes.map(row => row.code.toString("hex"));
    }

    /**
     * Register a new key to the database.
     * 
     * @param premiumKey PremiumKey object to be inserted. 
     * 
     * @returns The new key
     */
    async newKey(premiumKey: PremiumKey): Promise<PremiumKey> {
        const { rows: data } = await database.query<PremiumKey>(
            `
            INSERT INTO premiumkey(code, tier, guild, generatedby, createdat, expiresat, usesnumber, dedicateduser)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
            `,
            [
                premiumKey.code,
                premiumKey.tier,
                premiumKey.guild,
                premiumKey.generatedby,
                premiumKey.createdat,
                premiumKey.expiresat,
                premiumKey.usesnumber,
                premiumKey.dedicateduser
            ]
        );

        return data[0]!;
    }

    /**
     * Based on its id, update key details.
     * 
     * @param newKey PremiumKey
     * @returns 
     */
    async updateKey(newKey: PremiumKey & { id: number }): Promise<PremiumKey & { id: number }> {
        const { rows: data } = await database.query<PremiumKey & { id: number }>(
            `UPDATE premiumkey SET tier=$2, expiresat=$3, usesnumber=$4, dedicateduser=$5
            WHERE id=$1
            RETURNING *;`,
            [
                newKey.id,
                newKey.tier,
                newKey.expiresat,
                newKey.usesnumber,
                newKey.dedicateduser
            ]
        );

        return data[0]!;
    }

    /**
     * Deletes all entries of expired keys
     */
    async clearExpiredKeys() {
        const now = timestampNow();
        await database.query(
            `DELETE FROM premiumkey WHERE expiresat <= $1 AND expiresat > 0`,
            [now]
        );
    }

    /**
     * Delete a premium key by its code from a guild.
     * 
     * @param guild The guild Snowflake
     * @param code The code in plain text
     */
    async deleteGuildKeyCode(guild: Snowflake, code: string) {
        const encryptedCode = encryptor(code);
        await database.query(`DELETE FROM premiumkey WHERE guild=$1 AND code=$2`, [guild, encryptedCode]);
    }

    /**
     * Fetches a premium key by its code from a guild.
     * 
     * @param guild The guild Snowflake
     * @param code The code in plain text
     */
    async getGuildKeyByCode(guild: Snowflake, code: string): Promise<PremiumKey & { id: number } | null> {
        const encryptedCode = Buffer.from(encryptor(code), "hex");
        const { rows: data } = await database.query<PremiumKey & { id: number }>(
            `SELECT * FROM premiumkey WHERE guild=$1 AND code=$2`,
            [guild, encryptedCode]
        );

        return data[0] ?? null;
    }

    /**
     * Fetch the PremiumKey object by its database ID
     */
    async getKeyById(id: number): Promise<PremiumKey & { id: number } | null> {
        const { rows: data } = await database.query<PremiumKey & { id: number }>(
            `SELECT * FROM premiumkey WHERE id=$1`, [id]
        );

        return data[0] ?? null;
    }

    /**
     * Fetch the PremiumKey object by its database ID but restrict it to the guild
     */
    async getGuildKeyById(id: number, guildId: string): Promise<PremiumKey & { id: number } | null> {
        const { rows: data } = await database.query<PremiumKey & { id: number }>(
            `SELECT * FROM premiumkey WHERE id=$1 AND guild=$2`, [id, guildId]
        );

        return data[0] ?? null;
    }

    async getGuildFullMembership(guildId: Snowflake, memberId: Snowflake): Promise<MembershipFull | null> {
        const { rows: data } = await database.query<MembershipFull>(
            `
            SELECT
                pm.id AS membership_id,
                pm.member,
                pm.guild,
                pm.premiumkey_id,

                pk.id AS key_id,
                pk.code,
                pk.tier,
                pk.generatedby,
                pk.createdat,
                pk.expiresat,
                pk.usesnumber,
                pk.dedicateduser,

                pcr.role
            FROM premiummember pm
            JOIN premiumkey pk
                ON pm.premiumkey_id = pk.id
            LEFT JOIN premium_custom_role pcr
                ON pcr.premiummember_id = pm.id
            WHERE pm.member = $1 AND pm.guild=$2;
            `,
            [memberId, guildId]
        );

        return data[0] ?? null;
    }

    /**
     * Fetches the snowflakes of all members of the guild that have premium status through the given key id
     */
    async getMembersOfKeyId(guildId: Snowflake, keyId: number): Promise<string[]> {
        const { rows: data } = await database.query<PremiumMember>(
            `SELECT member
            FROM premiummember
            WHERE guild=$1 AND premiumkey_id=$2
            `,
            [guildId, keyId]
        );

        return data.map(pm => pm.member);
    }

    /**
     * Returns an array of all premium custom role ids from the guild that are not owned by the given member 
     */
    async getGuildRolesNotOwnedByMember(guildId: Snowflake, memberId: Snowflake): Promise<string[]> {
        const { rows: data } = await database.query<PremiumCustomRole>(
            `
            SELECT pcr.role
            FROM premium_custom_role pcr
            JOIN premiummember pm
                ON pm.id = pcr.premiummember_id
            WHERE pm.guild=$1 AND pm.member != $2
            `,
            [guildId, memberId]
        );

        return data.map(r => r.role);
    }
}

const PremiumSystemRepo = new PremiumSystemRepository();
export default PremiumSystemRepo;