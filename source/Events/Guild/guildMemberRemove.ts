import { Event } from "../../Interfaces/event.js";
import type { GuildMember } from "discord.js";
import { fetchLogsChannel, remove_premium_from_member } from "../../utility_modules/discord_helpers.js";
import { embed_member_left } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";

const guildMemberRemove: Event = {
    name: "guildMemberRemove",
    async execute(member: GuildMember) {
        const guild = member.guild;
        const userActivityLogs = await fetchLogsChannel(guild, "user-activity");
        if(userActivityLogs) {
            try {
                userActivityLogs.send({
                    embeds: [
                        embed_member_left(member)
                    ]
                });
            } catch(error) {
                await errorLogHandle(error);
            }
        }

        const isBooster = await PremiumMembersRepo.isPremiumFromBoosting(guild.id, member.id);
        if(isBooster) {
            // if the member has premium membership from boosting, as it left the guild, they must lose the status
            await remove_premium_from_member(guild.client, member.id, guild);
        }
    }
}

export default guildMemberRemove;