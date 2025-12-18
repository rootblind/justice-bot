import type { Event } from "../../Interfaces/event.js";
import { AuditLogEvent, type User, type Guild, type GuildBan } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";
import { log_ban } from "../../Systems/ban/ban_system.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";
import { remove_premium_from_member } from "../../Systems/premium/premium_system.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type guildBanAddHook = (ban: GuildBan) => Promise<void>;
const hooks: guildBanAddHook[] = [];
export function extend_guildBanAdd(hook: guildBanAddHook) {
    hooks.push(hook);
}

async function runHooks(ban: GuildBan) {
    for(const hook of hooks) {
        try {
            await hook(ban);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const guildBanAdd: Event = {
    name: "guildBanAdd",
    async execute(ban: GuildBan) {
        const guild: Guild = ban.guild;
        await runHooks(ban);
        // remove premium membership if the banned user has one
        const hasPremium = await PremiumMembersRepo.checkUserMembership(guild.id, ban.user.id);
        if(hasPremium) await remove_premium_from_member(guild.client, ban.user.id, guild);

        const logChannel = await fetchLogsChannel(guild, "moderation");
        if(!logChannel) return; // do nothing if there is not channel to log this event

        const banAudit = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanAdd,
            limit: 1
        });

        const entry = banAudit.entries.first();
        if(!entry || !entry.executor || !entry.target) return;
        if(entry.executor.id === get_env_var("CLIENT_ID")) return; // ignore bans applied by this bot
        if(entry.target.id !== ban.user.id) return; // ignore if the entry's target is not the banned user

        const reason = entry.reason ?? "No reason specified";
        const punishmentType = 3;

        await log_ban(
            guild,
            ban.user,
            entry.executor as User,
            punishmentType,
            reason,
            logChannel
        );
    }
}

export default guildBanAdd;