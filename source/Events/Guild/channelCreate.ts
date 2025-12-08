import type { Event } from "../../Interfaces/event.js";
import { AuditLogEvent, type User, type Guild, type GuildChannel } from "discord.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_channel_event } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const channelCreate: Event = {
    name: "channelCreate",
    async execute(channel: GuildChannel) {
        const guild: Guild = channel.guild;
        const logChannel = await fetchLogsChannel(guild, "server-activity");

        if(!logChannel) return; // everything below is about logging the event

        const channelCreateAudit = await guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelCreate,
            limit: 1
        });

        const entry = channelCreateAudit.entries.first(); // get details from the audit

        if(!entry || !entry.executor || entry.executor.bot) return; // ignore invalid entries and actions taken by a bot
        if(entry.target.id !== channel.id) return; // ignore if the audit log doesn't target the channel

        try {
            await logChannel.send({
                embeds: [ 
                    embed_channel_event(channel, entry.executor as User, "created", "Aqua") ]
            });
        } catch(error) {
            await errorLogHandle(error, `Failed to log channelCreate event from ${guild.name}[${guild.id}]`);
        }
    }
}

export default channelCreate;