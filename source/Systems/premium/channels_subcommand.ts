import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CategoryChannel,
    ChannelType,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    InteractionReplyOptions,
    LabelBuilder,
    MessageEditOptions,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    VoiceChannel
} from "discord.js";
import { AnyDiscordInteraction, MembershipFull } from "../../Interfaces/helper_types.js";
import { PremiumTierEnum } from "../../Interfaces/database_types.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import {
    execute_modal,
    fetchGuildChannel,
    fetchMemberCustomRole,
    fetchStaffRole,
    message_collector,
    modal_builder,
    ModalBuilderMethodResponse
} from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { timestampNow } from "../../utility_modules/utility_methods.js";

type ChannelKind = "text" | "voice";
type ChannelsState = { text: TextChannel | null; voice: VoiceChannel | null };

//type ExecuteModalModal = Parameters<typeof execute_modal>[1];

const NAME_INPUT_ID = "channel-name-input";
const DELETE_SELECT_ID = "channel-delete-select";

/**
 * Builds the edit modal: optional new name + optional deletion select (defaults to "No").
 * Returned in the { id, built_modal } shape that execute_modal consumes from modal_builder.
 */
function channel_edit_modal(kind: ChannelKind, currentName: string): ModalBuilderMethodResponse {
    const id = `premium-channel-edit-modal`;

    const nameInput = new TextInputBuilder()
        .setCustomId(NAME_INPUT_ID)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(currentName.slice(0, 100))
        .setMaxLength(100)
        .setRequired(false);

    const deleteSelect = new StringSelectMenuBuilder()
        .setCustomId(DELETE_SELECT_ID)
        .setRequired(false)
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel("No").setValue("no").setDefault(true),
            new StringSelectMenuOptionBuilder().setLabel("Yes").setValue("yes")
        );

    const labels: LabelBuilder[] = [
        new LabelBuilder()
            .setLabel("New name (optional)")
            .setTextInputComponent(nameInput),
        new LabelBuilder()
            .setLabel("Delete this channel?")
            .setDescription("Leave on No to keep the channel.")
            .setStringSelectMenuComponent(deleteSelect)
    ]
    const built_modal = modal_builder(
        labels,
        `Edit ${kind} channel`,
        id
    );

    return built_modal;
}

function default_channel_name(member: GuildMember, kind: ChannelKind): string {
    if (kind === "voice") return `${member.displayName}'s voice`.slice(0, 100);
    const base = member.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
    return `${base || "premium"}-text`.slice(0, 100);
}

/**
 * Loads the member's premium channels. Rows pointing to channels that no longer
 * exist on Discord are cleaned up and treated as "no channel".
 */
async function load_channels_state(member: GuildMember): Promise<ChannelsState> {
    const guild = member.guild;
    const state: ChannelsState = { text: null, voice: null };
    const rows = await PremiumSystemRepo.fetchMemberChannels(guild.id, member.id);

    for (const row of rows) {
        const channel = await fetchGuildChannel(guild, row.channel);
        if (row.type === "text" && channel instanceof TextChannel) {
            state.text = channel;
        } else if (row.type === "voice" && channel instanceof VoiceChannel) {
            state.voice = channel;
        } else {
            await PremiumSystemRepo.deletePremiumChannelById(row.channel);
        }
    }
    return state;
}

export async function channels_subcommand(
    interaction: AnyDiscordInteraction,
    member: GuildMember,
    membership: MembershipFull
): Promise<void> {
    if (interaction.replied || interaction.deferred) {
        throw new Error("channels_subcommand called on a replied interaction.");
    }

    if (membership.tier < PremiumTierEnum.TIER_1) {
        await interaction.reply({
            embeds: [
                embed_message("Red", "This command requires at least premium Tier 1", "Lacking permission")
            ]
        });
        return;
    }
    const guild = member.guild;
    const client = interaction.client;

    const embedHeader = new EmbedBuilder()
        .setColor("Purple")
        .setAuthor({
            name: `${member.user.username} channels page`,
            iconURL: member.displayAvatarURL({ extension: "png" })
        });

    const channelsPage = (state: ChannelsState): InteractionReplyOptions => {
        const embed = EmbedBuilder.from(embedHeader);

        if (!state.text && !state.voice) {
            embed.setTitle("You don't own any channels")
                .setDescription("Use the buttons below to create your text and/or voice channel.");
        } else {
            embed.addFields(
                { name: "✍️ Text channel", value: state.text ? state.text.toString() : "None" },
                { name: "🔊 Voice channel", value: state.voice ? state.voice.toString() : "None" }
            );
        }

        const textButton = new ButtonBuilder()
            .setCustomId(state.text ? "text-edit" : "text-create")
            .setLabel(state.text ? "Edit Text" : "Create Text")
            .setStyle(state.text ? ButtonStyle.Primary : ButtonStyle.Success);
        const voiceButton = new ButtonBuilder()
            .setCustomId(state.voice ? "voice-edit" : "voice-create")
            .setLabel(state.voice ? "Edit Voice" : "Create Voice")
            .setStyle(state.voice ? ButtonStyle.Primary : ButtonStyle.Success);

        return {
            embeds: [embed],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(textButton, voiceButton)]
        };
    };

    let state = await load_channels_state(member);
    await interaction.reply({ ...channelsPage(state) });
    const reply = await interaction.fetchReply();

    const refreshPage = async () => {
        state = await load_channels_state(member);
        try {
            await reply.edit(channelsPage(state) as MessageEditOptions);
        } catch {/* message might be gone */ }
    };

    let cooldownExpires = 0;
    const collector = message_collector<ComponentType.Button>(
        reply,
        {
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === member.id,
            time: 600_000
        },
        async (buttonInteraction) => {
            const innerCooldown = 5; // seconds
            const now = timestampNow();
            if (now < cooldownExpires) {
                await buttonInteraction.reply({
                    content: `You are pressing the buttons too fast! <t:${cooldownExpires}:R>`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            cooldownExpires = now + innerCooldown;

            const [kindRaw, action] = buttonInteraction.customId.split("-");
            const kind = kindRaw as ChannelKind;

            // never trust data fetched before: multiple menus could be open at the same time
            const membershipRefetch = await PremiumSystemRepo.getGuildFullMembership(guild.id, member.id);
            if (!membershipRefetch) {
                await buttonInteraction.reply({
                    embeds: [embed_error("Your premium membership expired during this session.")],
                    flags: MessageFlags.Ephemeral
                });
                (await collector).stop();
                return;
            }
            if (membershipRefetch.tier < PremiumTierEnum.TIER_1) {
                await buttonInteraction.reply({
                    embeds: [embed_error("Your membership tier is too low to manage premium channels.")],
                    flags: MessageFlags.Ephemeral
                });
                (await collector).stop();
                return;
            }

            const currentState = await load_channels_state(member);
            const existing = currentState[kind];

            switch (action) {
                case "create": {
                    if (existing) {
                        await buttonInteraction.reply({
                            embeds: [embed_error(`During this session a ${kind} channel has been created.`)],
                            flags: MessageFlags.Ephemeral
                        });
                        await refreshPage();
                        return;
                    }

                    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                    const customRole = await fetchMemberCustomRole(client, guild, member);
                    if (!customRole) {
                        await buttonInteraction.editReply({
                            embeds: [embed_message(
                                "Red",
                                "You need a custom role to own a channel.\nUse `/premium role panel` and create one first."
                            )]
                        });
                        return;
                    }

                    const staffRole = await fetchStaffRole(client, guild);
                    if (!staffRole) {
                        await buttonInteraction.editReply({
                            embeds: [embed_message("Red", "Server role for staff is missing on this guild.")]
                        });
                        return;
                    }

                    const categoryRow = await PremiumSystemRepo.getCategory(guild.id);
                    if (!categoryRow) {
                        await buttonInteraction.editReply({
                            embeds: [embed_message("Red", "Premium channels are not set up on this server. Contact an administrator.")]
                        });
                        return;
                    }
                    const category = await fetchGuildChannel(guild, categoryRow.category);
                    if (!(category instanceof CategoryChannel)) {
                        await buttonInteraction.editReply({
                            embeds: [embed_error("Failed to fetch the premium category. Contact an administrator.")]
                        });
                        return;
                    }

                    try {
                        const newChannel = await category.children.create({
                            name: default_channel_name(member, kind),
                            type: kind === "text" ? ChannelType.GuildText : ChannelType.GuildVoice,
                            permissionOverwrites: [
                                { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
                                { id: customRole.id, allow: ["ViewChannel"] },
                                { id: staffRole.id, allow: ["ViewChannel"] }
                            ]
                        });

                        try {
                            await newChannel.send(`${member} your channel has been created.`);
                        } catch (error) {
                            await errorLogHandle(error);
                        }

                        await PremiumSystemRepo.upsertPremiumChannel(
                            membershipRefetch.membership_id,
                            newChannel.id,
                            kind
                        );

                        await buttonInteraction.editReply({
                            embeds: [embed_message(
                                "Green",
                                `${newChannel} has been created. Use the Edit button to rename it.`
                            )]
                        });
                        await refreshPage();
                    } catch (error) {
                        await errorLogHandle(error);
                        await buttonInteraction.editReply({
                            embeds: [embed_error("Something went wrong while creating the channel...")]
                        });
                    }
                    break;
                }
                case "edit": {
                    if (!existing) {
                        await buttonInteraction.reply({
                            embeds: [embed_error(`Your ${kind} channel was removed or couldn't be fetched during this session.`)],
                            flags: MessageFlags.Ephemeral
                        });
                        await refreshPage();
                        return;
                    }

                    const modal = channel_edit_modal(kind, existing.name);
                    await execute_modal(
                        buttonInteraction,
                        modal,
                        { time: 300_000, filter: (i) => i.user.id === member.id },
                        async (submit) => {
                            const newName = submit.fields.getTextInputValue(NAME_INPUT_ID).trim();
                            const deleteChoice = submit.fields.getStringSelectValues(DELETE_SELECT_ID)[0] ?? "no";

                            // re-fetch: the channel could have been removed while the modal was open
                            const freshState = await load_channels_state(member);
                            const channel = freshState[kind];
                            if (!channel) {
                                await submit.reply({
                                    embeds: [embed_error("The channel no longer exists.")],
                                    flags: MessageFlags.Ephemeral
                                });
                                await refreshPage();
                                return;
                            }

                            if (deleteChoice === "yes") {
                                await submit.deferReply({ flags: MessageFlags.Ephemeral });
                                try {
                                    await channel.delete(`${member.user.username} requested their premium channel to be deleted.`);
                                    await PremiumSystemRepo.deletePremiumChannelById(channel.id);
                                    await submit.editReply({
                                        embeds: [embed_message("Green", "Your channel has been deleted.")]
                                    });
                                } catch (error) {
                                    await errorLogHandle(error);
                                    await submit.editReply({
                                        embeds: [embed_error("Something went wrong while deleting the channel...")]
                                    });
                                }
                                await refreshPage();
                                return;
                            }

                            if (!newName) {
                                await submit.reply({
                                    embeds: [embed_message("Yellow", "Nothing was changed.")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            await submit.deferReply({ flags: MessageFlags.Ephemeral });
                            try {
                                await channel.setName(newName, `${member.user.username} renamed their premium channel.`);
                                await submit.editReply({
                                    embeds: [embed_message("Green", `Your channel has been renamed to ${channel}.`)]
                                });
                            } catch (error) {
                                await errorLogHandle(error);
                                await submit.editReply({
                                    embeds: [embed_error("Something went wrong while renaming the channel...")]
                                });
                            }
                            await refreshPage();
                        }
                    );
                    break;
                }
            }
        },
        async () => {
            try {
                await reply.edit({ components: [] });
            } catch {/* do nothing */ }
        }
    );
}
