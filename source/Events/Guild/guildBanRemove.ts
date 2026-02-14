import type { Event } from "../../Interfaces/event.js";
import { AuditLogEvent, User, type Guild, type GuildBan } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";
import BanListRepo from "../../Repositories/banlist.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { ban_handler, unban_log } from "../../Systems/moderation/ban_system.js";

export type guildBanRemoveHook = (ban: GuildBan) => Promise<void>;
const hooks: guildBanRemoveHook[] = [];
export function extend_guildBanRemove(hook: guildBanRemoveHook) {
    hooks.push(hook);
}

async function runHooks(ban: GuildBan) {
    for (const hook of hooks) {
        try {
            await hook(ban);
        } catch (error) {
            await errorLogHandle(error);
        }
    }
}

const guildBanRemove: Event = {
    name: "guildBanRemove",
    async execute(ban: GuildBan) {
        const guild: Guild = ban.guild;
        await runHooks(ban);

        const unbanAudit = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 1
        });

        const entry = unbanAudit.entries.first();

        if (!entry || !entry.target || !entry.executor) return;
        if (entry.executor.id === get_env_var("CLIENT_ID")) return;
        if (entry.target.id !== ban.user.id) return; // ignore if the entry's target is not the unban user

        const logChannel = await fetchLogsChannel(guild, "moderation");

        // check if the user is permabanned; Permabanned users must be unbanned by an admin through command
        // a violation of this rule will result in keeping the user banned
        const isPermabanned = await BanListRepo.isUserPermabanned(guild.id, ban.user.id);

        if (isPermabanned) {
            const reason = `${entry.executor.username} attempted to remove the permaban through an illegal method.`;
            const punishmentType = 4;
            const deleteMessages = false;
            const no_punishlog = true;
            const no_update = true;
            const send_dm = false;
            await ban_handler(
                guild,
                ban.user,
                guild.client.user,
                punishmentType,
                reason,
                deleteMessages,
                undefined,
                logChannel,
                no_punishlog,
                send_dm,
                no_update
            );

            return;
        }

        // passing the if above means the unban is legitimate
        await unban_log(
            guild,
            ban.user,
            entry.executor as User,
            logChannel,
            ban.reason ?? "No reason specified"
        );
    }
}

export default guildBanRemove;