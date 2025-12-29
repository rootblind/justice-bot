import { Collection, Guild, GuildTextBasedChannel, Message, Snowflake } from "discord.js";
import type { Event } from "../../Interfaces/event.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { dumpMessageFile, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { formatDate, formatTime } from "../../utility_modules/utility_methods.js";
import { embed_message_delete_bulk } from "../../utility_modules/embed_builders.js";

export type messageDeleteBulkHook = 
    (messages: Collection<Snowflake, Message>, channel: GuildTextBasedChannel) => Promise<void>;
const hooks: messageDeleteBulkHook[] = [];
export function extend_messageDeleteBulk(hook: messageDeleteBulkHook) {
    hooks.push(hook);
}

async function runHooks(messages: Collection<Snowflake, Message>, channel: GuildTextBasedChannel) {
    for(const hook of hooks) {
        try {
            await hook(messages, channel);
        } catch(error) {
            await errorLogHandle(error);
        }
    }
}

const messageDeleteBulk: Event = {
    name: "messageDeleteBulk",
    async execute(messages: Collection<Snowflake, Message>, channel: GuildTextBasedChannel) {
        await runHooks(messages, channel);

        const guild: Guild = channel.guild;

        const isChannelIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
        if(!isChannelIgnored) return; // if the channel is ignored

        const messagesLogs = await fetchLogsChannel(guild, "messages");
        if(!messagesLogs) return;

        let messagesFormatted = "";
        for(const msg of messages.values()) {
            const timestamp = new Date(msg.createdTimestamp);
            const username = msg.author ? msg.author.username : "Not fetched";
            const id = msg.author? msg.author.id : "Not fetched";
            messagesFormatted += `[${username}] [${id}] At ${formatDate(timestamp)} | ${formatTime(timestamp)} - Message:\n${msg.content || "no content fetched"}\n`
        }

        const file = await dumpMessageFile(messagesFormatted, messagesLogs, channel.id);
        await messagesLogs.send({
            embeds: [
                embed_message_delete_bulk(channel, file)
            ]
        });

    }
}

export default messageDeleteBulk;