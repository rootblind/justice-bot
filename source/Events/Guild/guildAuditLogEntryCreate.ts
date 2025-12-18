import type { Event } from "../../Interfaces/event.js";
import { type GuildAuditLogsEntry, type Guild, AuditLogEvent, User, GuildChannel } from "discord.js";
import { fetchGuildMember, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_member_timeout, embed_message_moderated, embed_timeout_removed } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";

export type guildAuditLogEntryCreateHook = (auditLogEntry: GuildAuditLogsEntry, guild: Guild) => Promise<void>;
const hooks: guildAuditLogEntryCreateHook[] = [];
export function extend_guildAuditLogEntryCreate(hook: guildAuditLogEntryCreateHook) {
    hooks.push(hook);
}

async function runHooks(auditLogEntry: GuildAuditLogsEntry, guild: Guild) {
    for(const hook of hooks) {
        try {
            await hook(auditLogEntry, guild);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const guildAuditLogEntryCreate: Event = {
    name: "guildAuditLogEntryCreate",
    async execute(auditLogEntry: GuildAuditLogsEntry, guild: Guild) {

        await runHooks(auditLogEntry, guild);

        const moderationLogsChannel = await fetchLogsChannel(guild, "moderation");
        if(!moderationLogsChannel) return; // this line must be changed if other types of logs are handled by this event
        

        if(auditLogEntry.target instanceof User) { // events targeting a user
            // ignore actions targeting bots or that lack an executor object
            if(auditLogEntry.target.bot || !auditLogEntry.executor) return;

            const reason = auditLogEntry.reason ?? "No reason specified";

            if(auditLogEntry.action === AuditLogEvent.MessageDelete) { // messages deleted by a moderator
                try {
                    if(auditLogEntry.extra && "channel" in auditLogEntry.extra) {
                        await moderationLogsChannel.send({
                            embeds: [
                                embed_message_moderated(
                                    auditLogEntry.executor as User,
                                    auditLogEntry.target,
                                    auditLogEntry.extra.channel as GuildChannel
                                )
                            ]
                        });
                    }
                } catch(error) {
                    await errorLogHandle(error, `Failed to log message moderated event from ${guild.name}[${guild.id}]`);
                }
            } else if(
                auditLogEntry.action === AuditLogEvent.MemberUpdate &&
                auditLogEntry.changes[0] &&
                auditLogEntry.changes[0]["key"] === "communication_disabled_until" &&
                auditLogEntry.changes[0]["new"]
            ) {
                // logging timeouts
                const targetMember = await fetchGuildMember(guild, auditLogEntry.target.id);
                if(targetMember) {
                    try {
                        await moderationLogsChannel.send({
                            embeds: [
                                embed_member_timeout(
                                    auditLogEntry.executor as User,
                                    targetMember,
                                    reason
                                )
                            ]
                        });

                        // register in punishlogs
                        const punishmentType = 1; // timeout = 1
                        const currentTimestamp = String(Math.floor(Date.now() / 1000));
                        await PunishLogsRepo.insertLog(
                            guild.id,
                            targetMember.id,
                            auditLogEntry.executor.id,
                            punishmentType,
                            reason,
                            currentTimestamp
                        );
                    } catch(error) {
                        await errorLogHandle(error, `Failed to log member timeout event from ${guild.name}[${guild.id}]`);
                    }
                }
            } else if(
                auditLogEntry.action === AuditLogEvent.MemberUpdate &&
                auditLogEntry.changes[0] &&
                auditLogEntry.changes[0]["key"] === "communication_disabled_until" &&
                !auditLogEntry.changes[0]["new"]
            ) {
                // logging then a timed out member has its time out removed by a moderator

                try{
                    await moderationLogsChannel.send({
                        embeds: [
                            embed_timeout_removed(
                                auditLogEntry.target as User,
                                auditLogEntry.executor as User,
                                reason
                            )
                        ]
                    })
                } catch(error) {
                    await errorLogHandle(error, `Failed to log timeout removed event from ${guild.name}[${guild.id}]`);
                }
            }
        }
    }
}

export default guildAuditLogEntryCreate;