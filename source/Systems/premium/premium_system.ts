import type { Client, Guild, GuildMember, GuildTextBasedChannel, Role, Snowflake } from "discord.js";
import { fetchGuildMember, fetchMemberCustomRole, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";
import { generate_unique_code } from "../../utility_modules/utility_methods.js";
import PremiumKeyRepo from "../../Repositories/premiumkey.js";
import { embed_new_premium_membership, embed_premium_member_notification } from "../../utility_modules/embed_builders.js";

/**
 * Remove the membership of the member and handle the follow up actions.
 * 
 * Works on non members
 * @param client 
 * @param memberId 
 * @param guild 
 */
export async function remove_premium_from_member(
    client: Client,
    memberId: Snowflake,
    guild: Guild
) {
    const premiumRole = await fetchPremiumRole(client, guild);
    if (!premiumRole) {
        throw new Error(
            `remove_premium_membership was called, but failed to fetch ${guild.name}[${guild.id}] premium role.
            Method called incorrectly or there are residual rows in the database for this guild.`
        );
    }
    const member = await fetchGuildMember(guild, memberId);
    const customRole = await fetchMemberCustomRole(client, guild, memberId);
    // handling the case where the booster is still a guild member but no longer boosting
    if (member) {
        await member.roles.remove(premiumRole); // remove premium server role from the member
    }

    if (customRole) {
        // Custom roles of members that no longer have premium must be deleted
        try {
            await customRole.delete();
        } catch (error) {
            errorLogHandle(error);
        }
    }

    // cleaning the database
    await PremiumMembersRepo.deletePremiumGuildMember(guild.id, memberId);
}

/**
 * Assign premiumRole to member, generate an encrypted code, register the new key and premium membership
 * in database, log the event if logChannel is provided and notify the member.
 * @param premiumRole The premium role of the guild
 * @param member The premium member
 * @param generatorMember The entity GuildMember that generated the code
 * @param expiresAt Code expiration as timestamp. 0 means permanent
 * @param usesnumber How many uses does the code have. Defaults to 1 which results in 0 after being assigned to member
 * @param dedicatedMember Whether the assigned code uses member as dedicatedmember
 * @param from_boosting If the membership results from boosting the guild
 * @param logChannel The premium logs channel 
 */
export async function assign_premium_to_member(
    premiumRole: Role,
    member: GuildMember,
    generatorMember: GuildMember,
    expiresAt: string | number,
    usesnumber: number = 1,
    dedicatedMember: boolean = false,
    from_boosting: boolean = false,
    logChannel: GuildTextBasedChannel | null = null
) {
    try { // add the premium role to the member
        await member.roles.add(premiumRole);
    } catch (error) {
        await errorLogHandle(error);
    }

    const guild: Guild = member.guild;
    const code = await generate_unique_code(guild.id); // generate the premium key code

    try { // register the new key
        await PremiumKeyRepo.newKey(
            code,
            guild.id,
            generatorMember.id,
            expiresAt,
            usesnumber - 1,
            dedicatedMember ? member.id : null
        );
        // register the new membership
        await PremiumMembersRepo.newMember(member.id, guild.id, code, null, from_boosting);
    } catch (error) {
        await errorLogHandle(error, "There was a problem while trying to insert a new premium key");
    }

    if (logChannel) { // log the event
        try {
            await logChannel.send({
                embeds: [
                    embed_new_premium_membership(member, code, expiresAt, usesnumber - 1, from_boosting)
                ]
            });
        } catch (error) {
            await errorLogHandle(error);
        }
    }

    try { // send the member a notification if possible
        await member.send({
            embeds: [
                embed_premium_member_notification(guild, member, code, expiresAt, from_boosting)
            ]
        });
    } catch {/* do nothing */ }
}