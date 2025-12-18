import type { Event } from "../../Interfaces/event.js";
import type { Guild, GuildMember } from "discord.js";
import BanListRepo from "../../Repositories/banlist.js";
import { welcome_handler } from "../../Systems/welcome/welcome_system.js";
import { ban_handler } from "../../Systems/ban/ban_system.js";
import { fetchLogsChannel, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_member_joined } from "../../utility_modules/embed_builders.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";

export type guildMemberAddHook = (member: GuildMember) => Promise<void>;
const hooks: guildMemberAddHook[] = [];
export function extend_guildMemberAdd(hook: guildMemberAddHook) {
    hooks.push(hook);
}

async function runHooks(member: GuildMember) {
    for(const hook of hooks) {
        try {
            await hook(member);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const guildMemberAdd: Event = {
    name: "guildMemberAdd",
    async execute(member: GuildMember) {
        const guild: Guild = member.guild;
        if(member.user.bot) return;
        
        await runHooks(member);

        // enforcing perma bans
        const isPermabanned = await BanListRepo.isUserPermabanned(guild.id, member.id);
        if (isPermabanned) { // if the user is permabanned in banlist, but somehow unbanned on discord and able to join
            // reassign the ban on discord's side
            const moderationLogs = await fetchLogsChannel(guild, "moderation");
            const punishmentType = 4;
            const reason = "The user is permanently banned. The ban was removed by illegal means";
            const deleteMessages = true;
            const no_punishlog = true;
            const send_dm = false;
            const no_update = true;
            await ban_handler(
                guild,
                member.user,
                guild.client.user,
                punishmentType,
                reason,
                deleteMessages,
                undefined,
                moderationLogs,
                no_punishlog,
                send_dm,
                no_update
            );

            return;
        }


        // welcome system
        await welcome_handler(member);

        // log as user-activity
        const userActivityLogs = await fetchLogsChannel(guild, "user-activity");
        if(userActivityLogs) {
            try {
                userActivityLogs.send({
                    embeds: [
                        embed_member_joined(member)
                    ]
                });
            } catch(error) {
                await errorLogHandle(error);
            }
        }

        // check if the member has active premium membership
        const premiumRole = await fetchPremiumRole(guild.client, guild);
        if(premiumRole) {
            const hasPremium = await PremiumMembersRepo.checkUserMembership(guild.id, member.id);
            if(hasPremium) {
                try {
                    await member.roles.add(premiumRole);
                } catch(error) {
                    await errorLogHandle(error);
                }
            }
        }
    }
}

export default guildMemberAdd;