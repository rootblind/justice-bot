import {
    ActionRow,
    ActionRowBuilder,
    APIEmbedField,
    ButtonBuilder,
    ButtonStyle,
    CacheType,
    CategoryChannel,
    ChannelType,
    ChatInputCommandInteraction,
    ComponentType,
    Guild,
    GuildMember,
    Message,
    MessageFlags,
    PermissionFlagsBits,
    RestOrArray,
    TextChannel,
    VoiceChannel
} from "discord.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { AUTOVOICE_BUTTONS, embed_autovoice_manager } from "./autovoice_components.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { local_config } from "../../objects/local_config.js";
import AutoVoiceSystemRepo from "../../Repositories/autovoicesystem.js";
import GuildPlanRepo from "../../Repositories/guildplan.js";
import { attach_autovoice_manager_collector } from "./autovoice_system.js";

/**
 * @returns Whether the guild exceeds current plan's autovoice limits
 */
export async function guild_exceeds_autovoice_limits(guild: Guild) {
    const guildPlan = await GuildPlanRepo.getGuildPlan(guild.id);
    const autoVoiceGuildRule = local_config.rules.guild_plans;
    const maxSystems = autoVoiceGuildRule[guildPlan.plan].autoVoiceSystem.maxSlots;
    const autoVoiceSystemCount = await AutoVoiceSystemRepo.guildSystemsCount(guild.id);

    return maxSystems <= autoVoiceSystemCount;
}

export async function autovoice_manager_builder_collector(
    interaction: ChatInputCommandInteraction<CacheType>, // !!! interaction defered
    message: Message,
    channels?: {
        category?: CategoryChannel | null,
        autovoice?: VoiceChannel | null,
        managerchannel?: TextChannel | null
    }
) {
    const guild = interaction.guild as Guild;
    const member = interaction.member as GuildMember;

    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
            time: 300_000,
            filter: (i) => i.user.id === member.id
        },
        async (buttonInteraction) => {
            if (buttonInteraction.customId === "send-interface-button") {
                await buttonInteraction.deferReply();
                // check if the guild exceeds the limit
                const guildExceedsLimits = await guild_exceeds_autovoice_limits(guild);
                if (guildExceedsLimits) {
                    await buttonInteraction.editReply({
                        embeds: [
                            embed_error("You already have the maximum number of autovoice systems for your current plan!\nMake room to add a new one.")
                        ]
                    });

                    return;
                }
                // handling the logic of setting everything up once the buttons are selected/unselected
                const enabledButtons: ButtonBuilder[] = [];
                const fields: RestOrArray<APIEmbedField> = [];
                buttonInteraction.message.components
                    .filter((row) => row instanceof ActionRow)
                    .forEach((row) => {
                        for (const component of row.components) {
                            // making sure to filter out anything that is not a button or is not enabled
                            if (component.type !== ComponentType.Button) continue;
                            if (component.customId === "send-interface-button") continue;
                            if (component.style === ButtonStyle.Danger) continue;
                            enabledButtons.push(ButtonBuilder.from(component));

                            // fields
                            const buttonField = AUTOVOICE_BUTTONS(guild.preferredLocale).find((button) => button.id === component.customId);
                            if (buttonField) {
                                fields.push(
                                    {
                                        name: `${buttonField.emoji} ${buttonField.name}`,
                                        value: `${buttonField.value}`
                                    }
                                );
                            }
                        }
                    });

                enabledButtons.push(
                    new ButtonBuilder()
                        .setCustomId("autovoice-status-button")
                        .setLabel("Status")
                        .setStyle(ButtonStyle.Primary)
                ); // add the status button at the end

                const enabledFeatures: ActionRowBuilder<ButtonBuilder>[] = [];
                for (let i = 0; i < enabledButtons.length; i += 5) { // fill rows in density
                    const row = new ActionRowBuilder<ButtonBuilder>();
                    row.addComponents(enabledButtons.slice(i, i + 5));
                    enabledFeatures.push(row);
                }

                // if channels were provided, register them, create channels otherwise
                let category: CategoryChannel | null = null;
                let autovoice: VoiceChannel | null = null;
                let managerchannel: TextChannel | null = null;

                if (channels?.category) {
                    category = channels.category;
                } else {
                    category = await guild.channels.create({
                        name: "Voice Rooms",
                        type: ChannelType.GuildCategory
                    });
                }
                if (channels?.autovoice) {
                    autovoice = channels.autovoice;
                    if (autovoice.parentId !== category.id) {
                        await autovoice.edit({ parent: category });
                    }
                } else {
                    autovoice = await category.children.create({
                        name: "➕ Auto Voice",
                        type: ChannelType.GuildVoice,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [
                                    PermissionFlagsBits.Speak,
                                    PermissionFlagsBits.Stream,
                                    PermissionFlagsBits.SendMessages
                                ]
                            }
                        ]
                    });
                }
                if (channels?.managerchannel) {
                    managerchannel = channels.managerchannel;
                    if (managerchannel.parentId !== category.id) {
                        await managerchannel.edit({ parent: category });
                    }
                } else {
                    managerchannel = await category.children.create({
                        name: "voice-manager",
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.AddReactions,
                                    PermissionFlagsBits.CreatePublicThreads,
                                    PermissionFlagsBits.CreatePrivateThreads,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            }
                        ]
                    });
                }

                // send the interface in managerchannel
                const manager = await managerchannel.send({
                    embeds: [embed_autovoice_manager(fields, guild.preferredLocale)],
                    components: enabledFeatures
                });

                // register in database
                await AutoVoiceSystemRepo.put(guild.id, category.id, managerchannel.id, autovoice.id, manager.id);
                // activate collector
                await attach_autovoice_manager_collector(manager);
                // respond
                await buttonInteraction.editReply({
                    embeds: [embed_message("Green", `Autovoice system setup successfully using the interface with ID ${manager.id}`)]
                });
                collector.stop();
            } else {
                // buttons clicked must toggle their style (green/red or success/danger)
                // and must be kept track of to be used only the enabled buttons when pressing send interface
                const buttonComponents = buttonInteraction.message.components
                    .filter((row) => row instanceof ActionRow)
                    .map(row => {
                        const newRow = new ActionRowBuilder<ButtonBuilder>();
                        for (const component of row.components) {
                            if (component.type !== ComponentType.Button) continue;
                            const button = ButtonBuilder.from(component);
                            if (component.customId === buttonInteraction.customId) {
                                // toggle the style of the button pressed
                                button.setStyle(
                                    component.style === ButtonStyle.Success
                                        ? ButtonStyle.Danger
                                        : ButtonStyle.Success
                                );
                            }

                            newRow.addComponents(button);
                        }

                        return newRow;
                    });

                await message.edit({ components: buttonComponents }); // update the components to show button toggle
                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [embed_message("Green", "Component updated")]
                });
            }
        },
        async () => {
            try {
                await message.delete();
            } catch (error) {
                await errorLogHandle(error);
            }
        }
    )
}