import {
    ChatInputCommandInteraction,
    CacheType,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    Guild,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    Message,
    RoleSelectMenuBuilder,
    OverwriteResolvable,
    PermissionFlagsBits,
    ChannelType,
    CategoryChannel,
    Collection
} from "discord.js";
import { LfgChannel, LfgGamemode, LfgGameTable, LfgRole } from "../../Interfaces/lfg_system.js";
import { select_game_builder, select_roles_builder } from "./lfg_select_builders.js";
import { embed_error, embed_interaction_expired, embed_message } from "../../utility_modules/embed_builders.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { getChannelNameModal, getGamemodeModal } from "./lfg_modals.js";
import { embed_interface_manager, interface_manager_buttons, interface_manager_collector } from "./lfg_interface_manager.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { has_cooldown } from "../../utility_modules/utility_methods.js";
import { lfg_post_buttons } from "./lfg_post.js";

const addChannelButton = new ButtonBuilder()
    .setCustomId("add-channel-button")
    .setLabel("Add Channel")
    .setEmoji("➕")
    .setStyle(ButtonStyle.Primary)
const addGamemodeButton = new ButtonBuilder()
    .setCustomId("add-gamemode-button")
    .setLabel("Add Gamemode")
    .setEmoji("➕")
    .setStyle(ButtonStyle.Primary)
const setRolesButton = new ButtonBuilder()
    .setCustomId("set-roles-button")
    .setLabel("Set Roles")
    .setEmoji("✒️")
    .setStyle(ButtonStyle.Primary)
const setRanksButton = new ButtonBuilder()
    .setCustomId("set-ranks-button")
    .setLabel("Set Ranks")
    .setEmoji("✒️")
    .setStyle(ButtonStyle.Primary)
const builderButton = new ButtonBuilder()
    .setCustomId("builder-button")
    .setLabel("BUILD")
    .setEmoji("🔨")
    .setStyle(ButtonStyle.Success)


/**
 * The embed for the initial builder message.
 */
export function game_builder_embed(gameName: string, guild: Guild): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle(`LFG ${gameName}`)
        .setAuthor({
            name: `${guild.name} LFG System builder`,
            iconURL: String(guild.iconURL({ extension: "png" }))
        })
        .setColor("Purple")
        .setDescription(`Use the buttons to configurate the contents of ${gameName} LFG.\nUse **BUILD** when you are done with adding the necessaries.`)
        .addFields({
            name: "Buttons",
            value: `**Add Channel**: Add the name of the channels to be created
            **Add Gamemode**: Register gamemodes for the game
            **Set Roles** (optional): Assign Discord roles as in-game roles if any
            **Set Ranks** (optional): Assign Discord roles as in-game ranks if any`
        });
}

/**
 * The embed displaying the current configuration of the builder
 */
export function game_builder_current_config(
    gameName: string,
    channels: string[],
    gamemodes: string[]
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor("Purple")
        .setTitle("Current configuration")
        .setFields(
            {
                name: "Game",
                value: gameName
            },
            {
                name: "Channels",
                value: channels.length > 0 ? channels.join(", ") : "None"
            },
            {
                name: "Gamemodes",
                value: gamemodes.length > 0 ? gamemodes.join(", ") : "None"
            }
        )
}

export function update_embed_while_building(
    guild: Guild,
    gameName: string,
    channels: string[],
    gamemodes: string[]
): EmbedBuilder[] {
    return [
        game_builder_embed(gameName, guild),
        game_builder_current_config(gameName, channels, gamemodes)
    ]
}

/**
 * Handle the building of a LFG system after the BUILD button is pressed.
 * 
 * Creating the necessary channels and registering the data in database
 * 
 * @returns The category channel created
 */
export async function register_and_build_lfg(
    guild: Guild,
    game: LfgGameTable,
    channels: string[],
    gamemodes: string[],
    roles: string[],
    ranks: string[]
): Promise<CategoryChannel> {
    // perms
    const channelPerms: OverwriteResolvable[] = [
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
    ];

    // build the game category
    const category = await guild.channels.create({
        name: game.game_name,
        type: ChannelType.GuildCategory
    });

    // building the manager channel
    const managerChannel = await category.children.create({
        name: "lfg-interface",
        permissionOverwrites: channelPerms,
        type: ChannelType.GuildText
    });

    // sending the interface manager message and attaching the collector
    const interfaceMessage = await managerChannel.send({
        embeds: [embed_interface_manager(game.game_name)],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(...interface_manager_buttons()),
            new ActionRowBuilder<ButtonBuilder>().addComponents(...lfg_post_buttons())
        ]
    });
    await interface_manager_collector(interfaceMessage);

    // update the game with the IDs created
    game.category_channel_id = category.id;
    game.manager_channel_id = managerChannel.id;
    game.manager_message_id = interfaceMessage.id;
    await LfgSystemRepo.setGameSnowflakes(game);

    // create and register channels
    for (const name of channels) {
        const channel = await category.children.create({
            name: name,
            type: ChannelType.GuildText,
            permissionOverwrites: channelPerms
        });

        const lfgChannel: LfgChannel = {
            game_id: game.id,
            name: channel.name,
            discord_channel_id: channel.id
        };

        await LfgSystemRepo.registerChannel(lfgChannel);
    }

    // register gamemodes
    for (const name of gamemodes) {
        const gamemode: LfgGamemode = {
            game_id: game.id,
            name: name
        };

        await LfgSystemRepo.registerGamemode(gamemode);
    }

    // register the roles assigned to act as in-game roles and in-game ranks
    for (const id of roles) {
        const lfgRole: LfgRole = {
            guild_id: guild.id,
            game_id: game.id,
            role_id: id,
            type: "role"
        }

        await LfgSystemRepo.registerRole(lfgRole);
    }

    for (const id of ranks) {
        const lfgRank: LfgRole = {
            game_id: game.id,
            guild_id: guild.id,
            role_id: id,
            type: "rank"
        };

        await LfgSystemRepo.registerRole(lfgRank);
    }

    return category;
}

/**
 * Handle the interaction of each button from the lfg builder menu.
 */
export async function lfg_builder_collector(
    interaction: ChatInputCommandInteraction<CacheType>,
    message: Message,
    game: LfgGameTable
) {
    const channels: string[] = [];
    const channelLimit = 40; // maximum number of channels under the same category is 50, setting it to 40 to leave some space
    const gamemodes: string[] = [];
    const gamemodeLimit = 40; // arbitrary limit
    const roles: string[] = [];
    const ranks: string[] = [];
    const discordRoleLimit = 25; // select menus accept a maximum of 25 options

    // there is no reset, if the user wishes to correct their mistakes, they need to start another builder instance

    // inner button cooldowns
    const cooldowns = new Collection<string, number>();
    const cooldown = 5;

    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
            time: 60 * 60_000,
            filter: (i) => i.user.id === interaction.user.id
        },
        async (buttonInteraction) => {
            const userCooldown = has_cooldown(buttonInteraction.user.id, cooldowns, cooldown);
            if (userCooldown) {
                await buttonInteraction.reply({
                    embeds: [embed_message("Red", `You are pressing buttons too fast! <t:${userCooldown}:R>`)],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            cooldowns.set(buttonInteraction.user.id, Math.floor(Date.now() / 1000));
            setTimeout(() => cooldowns.delete(buttonInteraction.user.id), cooldown * 1000);

            switch (buttonInteraction.customId) {
                case "add-channel-button": {
                    // open a modal and validate the input
                    // since channel names must be unique within the same game
                    if (channels.length === channelLimit) {
                        await buttonInteraction.reply({
                            embeds: [embed_message("Red", `You can not exceed ${channelLimit} per game!`)],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const channelNameModal = getChannelNameModal();
                    await buttonInteraction.showModal(channelNameModal);
                    try {
                        const submit = await buttonInteraction.awaitModalSubmit({
                            time: 120_000,
                            filter: (i) => i.user.id === buttonInteraction.user.id
                        });

                        const channelName = submit.fields.getTextInputValue("channel-name-input")
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9-]/g, "x")
                            .replace(/-+/g, "-");

                        if (channels.includes(channelName)) {
                            await submit.reply({
                                embeds: [embed_message("Red", "Channel names must be unique within the same game!")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        channels.push(channelName);

                        await submit.reply({
                            embeds: [embed_message("Green", `Added **${channelName}** to the list.`)],
                            flags: MessageFlags.Ephemeral
                        });

                        await message.edit({
                            embeds: update_embed_while_building(
                                buttonInteraction.guild as Guild,
                                game.game_name,
                                channels,
                                gamemodes
                            )
                        });
                    } catch (error) {
                        console.error(error); // remove this after testing
                        await buttonInteraction.followUp({
                            embeds: [embed_interaction_expired()],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    break;
                }
                case "add-gamemode-button": {
                    if (gamemodes.length === gamemodeLimit) {
                        await buttonInteraction.reply({
                            embeds: [embed_message("Red", `You can not exceed ${gamemodeLimit} gamemodes per game.`)]
                        });
                        return;
                    }

                    const gamemodeModal = getGamemodeModal();
                    await buttonInteraction.showModal(gamemodeModal);

                    try {
                        const submit = await buttonInteraction.awaitModalSubmit({
                            time: 120_000,
                            filter: (i) => i.user.id === buttonInteraction.user.id
                        });

                        const gamemode = submit.fields.getTextInputValue("gamemode-input").toUpperCase();

                        if (gamemodes.includes(gamemode)) {
                            await submit.reply({
                                embeds: [embed_message("Red", "Gamemodes must be unique within the same game!")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        gamemodes.push(gamemode);

                        await submit.reply({
                            embeds: [embed_message("Green", `Added **${gamemode}** to the list.`)],
                            flags: MessageFlags.Ephemeral
                        });

                        await message.edit({
                            embeds: update_embed_while_building(
                                buttonInteraction.guild as Guild,
                                game.game_name,
                                channels,
                                gamemodes
                            )
                        });
                    } catch (error) {
                        console.error(error); // remove this after testing
                        await buttonInteraction.followUp({
                            embeds: [embed_interaction_expired()],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    break;
                }
                case "set-roles-button": {
                    const ranks2Set = new Set(ranks); // one role can not be assigned as a role and as a rank
                    // in the lfg system
                    await buttonInteraction.reply({
                        embeds: [
                            embed_message("Aqua", "Select the roles to be set as the in-game roles for this LFG system.")
                        ],
                        components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select_roles_builder(discordRoleLimit))]
                    });

                    const response = await buttonInteraction.fetchReply();

                    const selectCollector = await message_collector<ComponentType.RoleSelect>(response,
                        {
                            componentType: ComponentType.RoleSelect,
                            time: 120_000,
                            filter: (i) => i.user.id === buttonInteraction.user.id
                        },
                        async (selectInteraction) => {
                            const anyMatch = selectInteraction.values.some(id => ranks2Set.has(id));
                            if (anyMatch) {
                                await selectInteraction.reply({
                                    embeds: [embed_message("Red", "Same roles can not be set for both in-game roles and ranks.")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            roles.splice(0, roles.length, ...selectInteraction.values); // replace the previous roles with the currently selected ones

                            await selectInteraction.reply({
                                embeds: [embed_message("Green", "Roles are now set.")],
                                flags: MessageFlags.Ephemeral
                            });
                            selectCollector.stop();
                        },
                        async () => {
                            try {
                                if (response.deletable) await response.delete();
                            } catch { /* do nothing */ }
                        }
                    )
                    break;
                }
                case "set-ranks-button": {
                    // one role can not be assigned as a role and as a rank
                    // in the lfg system
                    const roles2Set = new Set(roles);

                    await buttonInteraction.reply({
                        embeds: [
                            embed_message("Aqua", "Select the roles to be set as the in-game ranks for this LFG system.")
                        ],
                        components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select_roles_builder(discordRoleLimit))]
                    });

                    const response = await buttonInteraction.fetchReply();

                    const selectCollector = await message_collector<ComponentType.RoleSelect>(response,
                        {
                            componentType: ComponentType.RoleSelect,
                            time: 120_000,
                            filter: (i) => i.user.id === buttonInteraction.user.id
                        },
                        async (selectInteraction) => {
                            const anyMatch = selectInteraction.values.some(id => roles2Set.has(id));
                            if (anyMatch) {
                                await selectInteraction.reply({
                                    embeds: [embed_message("Red", "Same roles can not be set for both in-game roles and ranks.")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            ranks.splice(0, ranks.length, ...selectInteraction.values); // replace the previous ranks with the currently selected ones

                            await selectInteraction.reply({
                                embeds: [embed_message("Green", "Ranks are now set.")],
                                flags: MessageFlags.Ephemeral
                            });

                            selectCollector.stop();
                        },
                        async () => {
                            try {
                                if (response.deletable) await response.delete();
                            } catch {/* do nothing */ }
                        }
                    )

                    break;
                }
                case "builder-button": {
                    if (channels.length === 0 || gamemodes.length === 0) {
                        await buttonInteraction.reply({
                            embeds: [embed_message("Red",
                                "You must add at least one channel and one gamemode.",
                                "Invalid configuration"
                            )],
                            flags: MessageFlags.Ephemeral
                        });

                        return;
                    }

                    const checkGame = await LfgSystemRepo.getGame(buttonInteraction.guild!.id, game.game_name);
                    if (checkGame && checkGame.manager_message_id !== null) { // safe guarding against building the same game more than once
                        await buttonInteraction.reply({
                            embeds: [embed_error(
                                "It seems like another builder instance already built this game before the button was pressed.\n" +
                                `Channel Id: ${checkGame.manager_channel_id}`
                            )]
                        });
                        collector.stop();
                        return;
                    }

                    await buttonInteraction.deferReply();

                    try {
                        const category = await register_and_build_lfg(
                            buttonInteraction.guild as Guild,
                            game,
                            channels,
                            gamemodes,
                            roles,
                            ranks
                        );

                        await buttonInteraction.editReply({
                            embeds: [
                                embed_message("Green", `The LFG system for **${game.game_name}** has been created under the ${category} category.`)
                            ]
                        });
                    } catch (error) {
                        await errorLogHandle(error);
                        await buttonInteraction.editReply({
                            embeds: [embed_error("Something went wrong while building the LFG channels...")]
                        });
                    }

                    collector.stop();
                    break;
                }
            }

        },
        async () => {
            try {
                if (message.deletable) await message.delete();
            } catch { /* do nothing */ }
        }
    )

    return collector;
}

export async function lfg_game_builder(
    interaction: ChatInputCommandInteraction<CacheType>,
    games: LfgGameTable[]
) {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const guild = reply.guild as Guild;

    // assemble buttons
    const builderButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        addChannelButton, addGamemodeButton, setRolesButton, setRanksButton, builderButton
    );

    let gameName: string = "";
    // if there is only one game provided
    // autoselect it
    // skip the select menu
    // open a select menu for more than 2 buildable games
    if (games.length === 1 && games[0]) {
        gameName = games[0].game_name;

        await interaction.editReply({
            embeds: [
                game_builder_embed(gameName, guild),
                game_builder_current_config(gameName, [], []) // empty arrays since when the builder is started, nothing is selected
            ],
            components: [builderButtonsRow]
        });
        await lfg_builder_collector(interaction, reply, games[0]);
    } else {
        const selectGameMenu = select_game_builder(games);
        await interaction.editReply({
            embeds: [embed_message("Aqua", "Select the game to start the builder for.", "LFG Builder")],
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectGameMenu)]
        });

        const collector = await message_collector<ComponentType.StringSelect>(reply,
            {
                componentType: ComponentType.StringSelect,
                time: 120_000,
                filter: (i) => i.user.id === interaction.user.id
            },
            async (selectInteraction) => {
                gameName = selectInteraction.values[0]!;
                await interaction.editReply({
                    embeds: [
                        game_builder_embed(gameName, guild),
                        game_builder_current_config(gameName, [], []) // empty arrays since when the builder is started, nothing is selected
                    ],
                    components: [builderButtonsRow]
                });
                await selectInteraction.reply({
                    embeds: [embed_message("Aqua", `Building LFG ${gameName}`)],
                    flags: MessageFlags.Ephemeral
                });

                const pickedGame = games.find((entry) => entry.game_name === gameName)!;
                await lfg_builder_collector(interaction, reply, pickedGame);
                collector.stop();
            },
            async () => {
                if (reply.deletable) {
                    try {
                        await reply.delete();
                    } catch { /* do nothing */ }
                }
            }
        )
    }
}