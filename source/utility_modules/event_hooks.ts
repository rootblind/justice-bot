import { extend_messageCreate, messageCreateHook } from "../Events/Guild/messageCreate.js";
import { OnReadyTaskBuilder } from "../Interfaces/helper_types.js";
import { fetchLogsChannel } from "./discord_helpers.js";
import ServerRolesRepo from "../Repositories/serverroles.js";
import AutoBanChannelRepo from "../Repositories/autobanchannel.js";
import { ban_handler } from "../Systems/moderation/ban_system.js";
import { PunishmentType } from "../objects/enums.js";
import { errorLogHandle } from "./error_logger.js";
import { duration_to_seconds } from "./utility_methods.js";

export const autobanChannelOnMessageSent: OnReadyTaskBuilder = {
    name: "Autoban channel on message sent",
    task: async () => {
        const hook: messageCreateHook =
            async (message) => {
                const author = message.member;
                if (!author || author.user.bot) return;
                const guild = author.guild;
                const autobanChannelId = await AutoBanChannelRepo.get(guild.id);
                // ignore if it's not the autoban channel
                if (!autobanChannelId || message.channel.id !== autobanChannelId) return;
                const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
                if (!staffRoleId) return;
                if (author.roles.cache.has(staffRoleId)) return; // ignore staff members
                const botMember = await guild.members.fetchMe();
                if (botMember.roles.highest.position <= author.roles.highest.position) return; // ignore members of higher position
                // valid member for ban
                try {
                    const deleteMessages = true;
                    const duration_seconds = String(duration_to_seconds("1h")!);
                    const no_punishlog = true;
                    const sendDM = false;
                    const moderationLogs = await fetchLogsChannel(guild, "moderation");
                    const reason = "Autoban channel triggered.";
                    await ban_handler(
                        guild,
                        author.user,
                        botMember.user,
                        PunishmentType.TEMPBAN,
                        reason,
                        deleteMessages,
                        duration_seconds,
                        moderationLogs,
                        no_punishlog,
                        sendDM
                    );
                } catch (error) {
                    await errorLogHandle(error);
                }

            }

        extend_messageCreate(hook);
    },
    runCondition: async () => true
}