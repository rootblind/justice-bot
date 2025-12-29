import { Guild, GuildMember, Message } from "discord.js";
import type { Event } from "../../Interfaces/event.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { dumpMessageFile, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import ServerLogsRepo from "../../Repositories/serverlogs.js";
import { embed_message_update } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

export type messageUpdateHook = (oldMessage: Message, newMessage: Message) => Promise<void>;
const hooks: messageUpdateHook[] = [];
export function extend_messageUpdate(hook: messageUpdateHook) {
    hooks.push(hook);
}

async function runHooks(oldMessage: Message, newMessage: Message) {
    for(const hook of hooks) {
        try {
            await hook(oldMessage, newMessage);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const messageUpdate: Event = {
    name: "messageUpdate",
    async execute(oldMessage: Message, newMessage: Message) {
        const guild: Guild | null = newMessage.guild;
        const member: GuildMember | null = newMessage.member;
        if(!guild || !member || newMessage.author.bot) return;

        await runHooks(oldMessage, newMessage);

        const channel = newMessage.channel;
        const sendableFiles: string[] = [];

        const isChannelIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
        if(!isChannelIgnored) return;

        const messagesLogs = await fetchLogsChannel(guild, "messages");
        if(!messagesLogs) {
            await ServerLogsRepo.deleteGuildEventChannel(guild.id, "messages");
            return;
        }

        let description = "**Old message**:\n";
        if(oldMessage.content.length <= 1500) {
            description += `${oldMessage.content || "[no content]"}\n`;
        } else {
            const oldFile = await dumpMessageFile(oldMessage.content, messagesLogs, `old-${oldMessage.id}`);
            description += `[[content]](${oldFile})\n`;
        }
        if(oldMessage.attachments.size) {
            description += "\n[file(s)]\n";
            for(const attachment of oldMessage.attachments.values()) {
                description += `[${attachment.name}](${attachment.url})\n`;
            }
        }

        description += "**New message**:\n";
        if(newMessage.content.length <= 1500) {
            description += `${newMessage.content || "[no content]"}\n`;
        } else {
            const newFile = await dumpMessageFile(newMessage.content, messagesLogs, `new-${newMessage.id}`);
            description += `[[content]](${newFile})\n`;
        }
        if(newMessage.attachments.size) {
            description += "\n[file(s)]\n";
            for(const attachment of newMessage.attachments.values()) {
                description += `[${attachment.name}](${attachment.url})\n`;
                sendableFiles.push(attachment.url);
            }
        }

        await messagesLogs.send({
            embeds: [ embed_message_update(member.user, description) ],
            files: sendableFiles
        });
    }
}

export default messageUpdate;