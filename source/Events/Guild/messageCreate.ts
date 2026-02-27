import type { Event } from "../../Interfaces/event.js";
import { ActionRowBuilder, ButtonBuilder, GuildMember, TextChannel, type GuildTextBasedChannel, type Message } from "discord.js";
import CustomReactRepo from "../../Repositories/customreact.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { dumpMessageFile, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { check_api_status } from "../../Systems/automoderation/automod_model_methods.js";
import { csv_append, get_env_var } from "../../utility_modules/utility_methods.js";
import { classifier } from "../../Systems/automoderation/classifier.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { ClassifierResponse, LabelsClassification } from "../../Interfaces/helper_types.js";
import { embed_flagged_message, embed_message } from "../../utility_modules/embed_builders.js";
import { adjust_button, confirm_button, false_positive_button } from "../../utility_modules/button_builders.js";
import { attach_flagged_message_collector } from "../../Systems/automoderation/automoderation_system.js";
import { LocalConfigSources, local_config } from "../../objects/local_config.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";
import { LfgParsedMessage, parsedPostBuilder, parseLFG, wrong_lfg_format } from "../../lolro_pack/lfg_chat_parser.js";
import { lfgParserConfig } from "../../lolro_pack/objects/lfg_objects.js";
import { LfgGamemodeTable } from "../../Interfaces/lfg_system.js";
import { t } from "../../Config/i18n.js";

const local_config_sources: LocalConfigSources = local_config.sources;


export type messageCreateHook = (message: Message) => Promise<void>;
const hooks: messageCreateHook[] = [];
export function extend_messageCreate(hook: messageCreateHook) {
    hooks.push(hook);
}

async function runHooks(message: Message) {
    for (const hook of hooks) {
        try {
            await hook(message);
        } catch (error) {
            await errorLogHandle(error);
        }
    }
}

const messageCreate: Event = {
    name: "messageCreate",
    async execute(message: Message) {
        if (!message.guild || !message.member || message.author.bot) return;
        const guild = message.guild;
        const channel = message.channel as GuildTextBasedChannel;
        const member = message.member as GuildMember;
        await runHooks(message);

        // lfg parser
        if (channel instanceof TextChannel) {
            const deleteMessageTimeout = 60_000; // 1 min
            const lfgChannel = await LfgSystemRepo.getLfgChannelBySnowflake(channel.id);
            if (lfgChannel) {
                const lfgConfig = await LfgSystemRepo.getSystemConfigForGuild(guild.id);

                if (
                    (lfgConfig.force_voice === true && member.voice.channelId !== null)
                    || lfgConfig.force_voice === false
                ) {
                    // if force voice is true, the member must be in a voice channel
                    const gameId: number = lfgChannel.game_id;
                    const userCooldown = LfgSystemRepo.getCooldown(guild.id, member.id, gameId);
                    if (!userCooldown) { // if no cooldown
                        // if the message is sent in a lfg channel, try to parse the message
                        const parsedLfg: LfgParsedMessage = parseLFG(message.content, lfgParserConfig);
                        if (parsedLfg.slots === null || parsedLfg.gamemode === null) {
                            try {
                                const wrongLfgMessage = await channel.send({
                                    content: `${member.toString()}`,
                                    embeds: [wrong_lfg_format(guild.preferredLocale)]
                                });
                                setTimeout(async () => {
                                    await wrongLfgMessage.delete();
                                }, deleteMessageTimeout); // remove the message after 10s
                            } catch (error) {
                                await errorLogHandle(error);
                            }

                        } else {
                            const gamemodeTable: LfgGamemodeTable | null =
                                await LfgSystemRepo.getGamemodeByName(
                                    gameId,
                                    parsedLfg.gamemode
                                );

                            if (gamemodeTable) {
                                await parsedPostBuilder(
                                    lfgChannel,
                                    gamemodeTable,
                                    gameId,
                                    guild,
                                    parsedLfg,
                                    member,
                                    channel
                                );
                            } else {
                                await errorLogHandle(new Error("The gamemode was parsed, but failed to fetch from database."));
                            }
                        }
                    } else {
                        try {
                            const memberOnCooldownMessage = await channel.send({
                                content: `${member.toString()}`,
                                embeds: [embed_message("Red", t(guild.preferredLocale, "common.action_on_cooldown", { cooldown: userCooldown }))]
                            });
                            setTimeout(async () => {
                                await memberOnCooldownMessage.delete();
                            }, deleteMessageTimeout); // remove the message after 10s
                        } catch (error) {
                            await errorLogHandle(error);
                        }
                    }
                } else {
                    try {
                        const forceVoiceMessage = await channel.send({
                            content: `${member.toString()}`,
                            embeds: [embed_message("Red", t(guild.preferredLocale, "common.not_in_voice"))]
                        });

                        setTimeout(async () => {
                            await forceVoiceMessage.delete();
                        }, deleteMessageTimeout); // remove the message after 10s
                    } catch (error) {
                        await errorLogHandle(error);
                    }
                }

                try {
                    await message.delete(); // clean the user's message
                } catch (error) {
                    await errorLogHandle(error);
                }
            }
        }

        // handling custom reactions
        const customKeyword = message.content.slice(0, 20).toLowerCase();
        const customReaction = await CustomReactRepo.getKeywordReply(guild.id, customKeyword);
        if (customReaction) await channel.send(customReaction);

        const isChannelIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
        if (isChannelIgnored) return;

        // anything related to logs must go below
        const flaggedMessagesLogs = await fetchLogsChannel(guild, "flagged-messages");
        const mod_api = get_env_var("MOD_API_URL");
        const isModelOnline = await check_api_status(mod_api);
        // if the automod model is online and there is a flagged-messages logs channel
        if (isModelOnline) {
            let response: ClassifierResponse | false = false;
            try {
                response = await classifier(message.content, mod_api);
            } catch (error) {
                await errorLogHandle(error);
            }

            if (response && !response.labels.includes("OK")) { // if the message was detected to be toxic
                // building the log embed

                if (flaggedMessagesLogs) {
                    const flaggedEmbed = embed_flagged_message(message, response);
                    if (message.content.length <= 3000) {
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
                        embeds: [flaggedEmbed],
                        components: [flaggedMessageActionRow]
                    });

                    // attach dataset related buttons for the owner server
                    if (guild.id === get_env_var("HOME_SERVER_ID")) await attach_flagged_message_collector(flaggedMessage, response);
                }
                // self label
                // the object will be used to keep track of the labels to be assigned
                const flagTags: LabelsClassification = {
                    "OK": 0,
                    "Aggro": 0,
                    "Violence": 0,
                    "Sexual": 0,
                    "Hateful": 0
                }
                for (const label of response.labels) {
                    if (label === "OK") {
                        flagTags["OK"] = 1;
                        break;
                    }
                    flagTags[label] = 1;
                }

                if (local_config_sources.self_flag_data) {
                    csv_append(response.text, flagTags, local_config_sources.self_flag_data);
                }
            }
        }
    }
}

export default messageCreate;