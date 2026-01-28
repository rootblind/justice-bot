import type { Event } from "../../Interfaces/event.js";
import { ActionRowBuilder, ButtonBuilder, type GuildTextBasedChannel, type Message } from "discord.js";
import CustomReactRepo from "../../Repositories/customreact.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { dumpMessageFile, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { check_api_status } from "../../Systems/automoderation/automod_model_methods.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";
import { classifier } from "../../Systems/automoderation/classifier.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { ClassifierResponse } from "../../Interfaces/helper_types.js";
import { embed_flagged_message } from "../../utility_modules/embed_builders.js";
import { adjust_button, confirm_button, false_positive_button } from "../../utility_modules/button_builders.js";
import { attach_flagged_message_collector } from "../../Systems/automoderation/automoderation_system.js";

export type messageCreateHook = (message: Message) => Promise<void>;
const hooks: messageCreateHook[] = [];
export function extend_messageCreate(hook: messageCreateHook) {
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

const messageCreate: Event = {
    name: "messageCreate",
    async execute(message: Message) {
        if(!message.guild || !message.member || message.author.bot) return;
        const guild = message.guild;
        const channel = message.channel as GuildTextBasedChannel;
        
        const isChannelIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
        if(isChannelIgnored) return;

        await runHooks(message);

        // handling custom reactions
        const customKeyword = message.content.slice(0,20).toLocaleLowerCase();
        const customReaction = await CustomReactRepo.getKeywordReply(guild.id, customKeyword);
        if(customReaction) await channel.send(customReaction);
        
        // anything related to logs must go below
        const flaggedMessagesLogs = await fetchLogsChannel(guild, "flagged-messages");
        const mod_api = get_env_var("MOD_API_URL");
        const isModelOnline = await check_api_status(mod_api);
        // if the automod model is online and there is a flagged-messages logs channel
        if(isModelOnline && flaggedMessagesLogs) {
            let response: ClassifierResponse | false = false;
            try {
                response = await classifier(message.content, mod_api);
            } catch(error) {
                await errorLogHandle(error);
            }

            if(response) { // if the message was detected to be toxic
                // building the log embed
                const flaggedEmbed = embed_flagged_message(message, response);
                if(message.content.length <= 3000) {
                    flaggedEmbed.setDescription(`**Content**:\n${message.content}`);
                } else {
                    const dumpUrl = await dumpMessageFile(message, flaggedMessagesLogs, message.id);
                    flaggedEmbed.setDescription(`[[Content]](${dumpUrl})`);
                }

                // building the action raw
                const flaggedMessageActionRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(confirm_button(), adjust_button(), false_positive_button());

                // sending the embed
                const flaggedMessage = await flaggedMessagesLogs.send({
                    embeds: [ flaggedEmbed ],
                    components: [ flaggedMessageActionRow ]
                });

                // attach dataset related buttons for the owner server
                if(guild.id === get_env_var("HOME_SERVER_ID")) await attach_flagged_message_collector(flaggedMessage, response);
            }
        }
    }
}

export default messageCreate;