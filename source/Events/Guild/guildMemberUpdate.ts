import type { Event } from "../../Interfaces/event.js";
import type { Guild, GuildMember } from "discord.js";
import { fetchLogsChannel, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import { embed_member_update_name } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";
import { assign_premium_to_member, remove_premium_from_member } from "../../Systems/premium/premium_system.js";

const guildMemberUpdate: Event = {
    name: "guildMemberUpdate",
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        const guild: Guild = newMember.guild;
        const clientMember = await guild.members.fetchMe();
        if (newMember.user.bot) return; // ignore bots

        // log name changes
        const userActivityLogs = await fetchLogsChannel(guild, "user-activity");
        if (userActivityLogs) {
            let nameType: string = "";

            if (oldMember.displayName !== newMember.displayName) {
                nameType = "displayname";
            } else if (oldMember.user.username !== newMember.user.username) {
                nameType = "username";
            }

            // if nameType remains empty string, then the member update was not a name update
            if (nameType === "displayname" || nameType === "username") {
                try {
                    await userActivityLogs.send({
                        embeds: [
                            embed_member_update_name(oldMember, newMember, nameType)
                        ]
                    })
                } catch (error) {
                    await errorLogHandle(error);
                }
            }
        }

        // boosting premium events
        // premium membership must be removed from boosters that are no longer boosting
        // checking if 
        //      1- member has premium membership and from boosting 
        //      2- checking if member still has nitro booster role
        const premiumRole = await fetchPremiumRole(guild.client, guild);
        if (premiumRole) {
            const premiumLogs = await fetchLogsChannel(guild, "premium-activity");
            const hasPremium = await PremiumMembersRepo.checkUserMembership(guild.id, newMember.id);
            if (!oldMember.premiumSince && newMember.premiumSince && !hasPremium) {
                // if the member was not boosting before, but is boosting now and does not currently have premium
                const expiresAt = 0; // 0 = permanent for boosters
                const from_boosting = true;
                const usesnumber = 1;
                const dedicatedmember = true;
                await assign_premium_to_member(
                    premiumRole,
                    newMember,
                    clientMember,
                    expiresAt,
                    usesnumber,
                    dedicatedmember,
                    from_boosting,
                    premiumLogs
                );
            } else if(hasPremium && newMember.premiumSince) {
                // when a member stops boosting, premiumSince is null
                await remove_premium_from_member(
                    guild.client,
                    newMember.id,
                    guild
                );
            }
        }
    }
}

export default guildMemberUpdate;