import type { Event } from "../../Interfaces/event.js";
import {
    AuditLogEvent,
    type User,
    type Guild,
    type GuildTextBasedChannel,
    type Message
} from "discord.js";
import { dumpMessageFile, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { embed_message_action_context, embed_message_delete } from "../../utility_modules/embed_builders.js";
import DatabaseRepo from "../../Repositories/database_repository.js";
import { ColumnValuePair } from "../../Interfaces/database_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type messageDeleteHook = (message: Message) => Promise<void>;
const hooks: messageDeleteHook[] = [];
export function extend_messageDelete(hook: messageDeleteHook) {
    hooks.push(hook);
}

async function runHooks(message: Message) {
    for(const hook of hooks) {
        try {
            await hook(message);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}


const messageDelete: Event = {
    name: "messageDelete",
    async execute(message: Message) {
        if (!message.guild || !message.member) return;
        const guild: Guild = message.guild;
        const channel = message.channel as GuildTextBasedChannel;

        await runHooks(message);

        const messagesLogs = await fetchLogsChannel(guild, "messages");
        const isChannelIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);

        // logs related
        if (messagesLogs && !isChannelIgnored && !message.author.bot) {
            const embed = embed_message_delete(message.author);
            if (message.content.length <= 3000) {
                embed.setDescription(`**Content**:\n${message.content}`);
            } else {
                const dumpUrl = dumpMessageFile(message, messagesLogs);
                embed.setDescription(`[[Content]](${dumpUrl})`);
            }

            const files: { name: string, url: string }[] = [];
            if (message.attachments.size) { // logging attachments
                let filesFieldValue: string = "";
                message.attachments.forEach(attachment => {
                    files.push({
                        name: attachment.name,
                        url: attachment.url
                    });
                    filesFieldValue += `[${attachment.name}](${attachment.url})\n`;
                });
                embed.setFields({ name: "Attachments", value: filesFieldValue });
            }

            const messageLog = await messagesLogs.send({
                files: files.map(f => f.url),
                embeds: [embed]
            });

            const moderationLogs = await fetchLogsChannel(guild, "moderation");
            if (moderationLogs) {
                // sending a moderation log in case the message was deleted by a moderator and it created an audit log
                const messageAuditLog = await guild.fetchAuditLogs({
                    type: AuditLogEvent.MessageDelete,
                    limit: 1
                });

                const entry = messageAuditLog.entries.first();
                if (
                    entry?.extra.channel.id === message.channel.id &&
                    entry.executor &&
                    entry.target &&
                    entry.targetId === message.author.id &&
                    entry.createdTimestamp > (Date.now() - 2000) &&
                    !entry.target.bot
                ) {
                    // if the entry matches the deleted message, then log it as moderation event as well
                    await moderationLogs.send({
                        embeds: [
                            embed_message_action_context(
                                entry.executor as User,
                                message.url,
                                messageLog.url,
                                messageLog.id
                            )
                        ]
                    });
                }
            }
        }

        // clean up for database tables
        if(message.author.id === guild.client.user.id) {
            // if the deleted message is sent by justice bot
            // perform database clean up
            const property: ColumnValuePair = { column: "messageid", value: message.id};
            const tablesWithMessageIdColumn = await DatabaseRepo.getTablesWithColumnValue(property);
            for(const table of tablesWithMessageIdColumn) {
                await DatabaseRepo.wipeGuildRowsWithProperty(guild.id, table, property);
            }
            property.column = "message"; // there are tables that use "message" instead
            const tablesWithMessageColumn = await DatabaseRepo.getTablesWithColumnValue(property);
            for(const table of tablesWithMessageColumn) {
                await DatabaseRepo.wipeGuildRowsWithProperty(guild.id, table, property);
            }
        }
    }
}

export default messageDelete;