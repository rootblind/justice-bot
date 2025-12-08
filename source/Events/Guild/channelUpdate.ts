import { AuditLogEvent, EmbedBuilder, User, type Guild, type GuildChannel } from "discord.js";
import type { Event } from "../../Interfaces/event.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_channel_event } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const channelUpdate: Event = {
    name: "channelUpdate",
    async execute(oldChannel: GuildChannel, newChannel: GuildChannel) {
        const guild: Guild = newChannel.guild;

        const logChannel = await fetchLogsChannel(guild, "server-activity");
        if(!logChannel) return;

        const channelUpdateAudit = await guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelUpdate,
            limit: 1
        });

        const entry = channelUpdateAudit.entries.first();
        if(!entry || !entry.executor || entry.executor.bot) return;
        if(entry.target.id !== newChannel.id) return; // ignore if the audit log doesn't target the channel

        const embed: EmbedBuilder = embed_channel_event(newChannel, entry.executor as User, "updated", "Aqua");

        if(oldChannel.name !== newChannel.name) {
            embed.setDescription(`**Name change**: ${oldChannel.name} ➡️ ${newChannel.name}`);
        }

        try {
            await logChannel.send({ embeds: [ embed ] });
        } catch(error) {
            await errorLogHandle(error, `Failed to log channelUpdate event from ${guild.name}[${guild.id}]`);
        }
    }
}

export default channelUpdate;