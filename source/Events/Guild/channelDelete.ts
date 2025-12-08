import { AuditLogEvent, type GuildChannel, type User, type Guild } from "discord.js";
import type { Event } from "../../Interfaces/event.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_channel_event } from "../../utility_modules/embed_builders.js";
import DatabaseRepo from "../../Repositories/database_repository.js";
import type { ColumnValuePair } from "../../Interfaces/database_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const channelDelete: Event = {
    name: "channelDelete",
    async execute(channel: GuildChannel) {
        const guild: Guild = channel.guild;
        /**
         * Deleting a channel used or registered by one or more database tables must be curated
         */

        const property: ColumnValuePair = {column: "channel", value: channel.id}
        const tablesToBeCleaned = await DatabaseRepo.getTablesWithColumnValue(property);
        for(const table of tablesToBeCleaned) {
            await DatabaseRepo.wipeGuildRowsWithProperty(guild.id, table, property);
        }

        // logging
        const logChannel = await fetchLogsChannel(guild, "server-activity");
        if(!logChannel) return;

        const channelDeleteAudit = await guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelDelete,
            limit: 1
        });

        const entry = channelDeleteAudit.entries.first();

        if(!entry || !entry.executor || entry.executor.bot) return;
        if(entry.target.id !== channel.id) return; // ignore if the audit log doesn't target the channel

        try{
            await logChannel.send({
                embeds: [
                    embed_channel_event(channel, entry.executor as User, "deleted", "Red")
                ]
            });
        } catch(error) {
            await errorLogHandle(error, `Failed to channelDelete event from ${guild.name}[${guild.id}]`);
        }
    }
}

export default channelDelete;