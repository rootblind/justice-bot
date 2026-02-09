import {
    ActionRowBuilder,
    APISelectMenuOption,
    CategoryChannel,
    ChannelType,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    RestOrArray,
    Role,
    RoleSelectMenuBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextChannel
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { LfgChannel, LfgGamemode, LfgGameTable, LfgRole, LfgRoleType } from "../../Interfaces/lfg_system.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";
import { embed_error, embed_interaction_expired, embed_message } from "../../utility_modules/embed_builders.js";
import { lfg_game_builder } from "../../Systems/lfg/lfg_builder.js";
import {
    getChannelInputLabel,
    getGamemodeInputLabel,
    select_game_id_builder,
    select_game_label,
    select_gamemode_id_label,
    select_lfg_channel_label,
    select_lfg_roles_label,
} from "../../Systems/lfg/lfg_modals.js";
import { 
    fetchGuildChannel, 
    fetchMessage, 
    message_collector, 
    resolveAndDeleteChannels, 
    resolveSnowflakesToRoles 
} from "../../utility_modules/discord_helpers.js";

const lfgSystem: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("lfg-system")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Configure and manage the LFG systems for different games on your server.")
        .addSubcommand(subcommand =>
            subcommand.setName("instructions")
                .setDescription("Get a short guide on how to set this up.")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("about")
                .setDescription("Open a menu and select the game you want to see details about.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("config")
                .setDescription("System-wide configuration for this guild")
                .addSubcommand(subcommand =>
                    subcommand.setName("force-voice")
                        .setDescription("Toggle whether or not the bot will require members to be present in a voice channel.")
                        .addBooleanOption(option => 
                            option.setName("toggle-voice")
                                .setDescription("Toggle true to force members on voice or false otherwise.")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("lfg-cooldown")
                        .setDescription("Set the cooldown between LFG posts and BUMPS.")
                        .addNumberOption(option =>
                            option.setName("cooldown")
                                .setDescription("The cooldown in seconds.")
                                .setRequired(true)
                                .setMinValue(60)
                                .setMaxValue(86_400) // 1 day
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("info")
                        .setDescription("Get the current configuration of the lfg system on this guild.")
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("new")
                .setDescription("Create new games and channels, gamemodes and roles for those games.")
                .addSubcommand(subcommand =>
                    subcommand.setName("game")
                        .setDescription("Define a new game by its name")
                        .addStringOption(option =>
                            option.setName("game-name")
                                .setDescription("The name of the game to be added to the lfg system.")
                                .setRequired(true)
                                .setMinLength(1)
                                .setMaxLength(25)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("channel")
                        .setDescription("Create a new channel for the selected game.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("gamemode")
                        .setDescription("Create a new gamemode for the selected game.")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("builder")
                .setDescription("Select a game and build the corresponding lfg configuration.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("assign")
                .setDescription("Set assigned features")
                .addSubcommand(subcommand =>
                    subcommand.setName("lfg-gamemodes")
                        .setDescription("Open a menu to select channels and gamemodes to attach to each other.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("lfg-roles")
                        .setDescription("Set the in-game roles for a game.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("lfg-ranks")
                        .setDescription("Set the rank roles for a game.")
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("delete")
                .setDescription("Delete games, channels, gamemodes or roles from the system.")
                .addSubcommand(subcommand =>
                    subcommand.setName("games")
                        .setDescription("Open a menu to select the games to be deleted.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("channels")
                        .setDescription("Select the channels to be deleted from a game.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("gamemodes")
                        .setDescription("Open a menu to select the gamemodes to be deleted.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("roles")
                        .setDescription("Open a menu to select the roles to be forgotten.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("ranks")
                        .setDescription("Open a menu to select the rank roles to be forgotten.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("channel-gamemodes")
                        .setDescription("Open a menu to select what gamemodes to de-attach from the channel.")
                )
        )
        .toJSON(),

    metadata: {
        cooldown: 10,
        botPermissions: [
            PermissionFlagsBits.ViewAuditLog,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.SendMessages
        ],
        userPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        category: "Administrator",
        group: "lfg"
    },

    async execute(interaction) {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const subcommandGroup = options.getSubcommandGroup();

        const guildGames: LfgGameTable[] = await LfgSystemRepo.getGuildGames(guild.id);
        const builtGames: LfgGameTable[] = guildGames.filter((row) =>
            row.category_channel_id !== null
            && row.manager_channel_id !== null
            && row.manager_message_id !== null
        );

        if (
            (subcommandGroup !== "new" || subcommand !== "game")
            && subcommand !== "instructions" 
            && subcommandGroup !== "config"
        ) {
            // if the command is not "/lfg-system new game" or "/lfg-system instructions"
            // there must be at least one game registered in this guild
            if (guildGames.length === 0) {
                await interaction.reply({
                    embeds: [
                        embed_message("Red", "You must register a game first before doing that!\nRun `/lfg-system instructions` to get some help.", "No game registered")
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        // subcommands with no groups
        switch (subcommand) {
            case "instructions": {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Instructions")
                            .setAuthor({name: "Setup LFG System"})
                            .setDescription("This is a short guide to walk you through the steps to be taken in creating an LFG system for your desired game.")
                            .addFields(
                                {
                                    name: "Steps",
                                    value: `[1]: Use \`/lfg-system new game <game-name>\` - in order to register a game in the system. You can register multiple games, but the name must be unique.
                                    [2]: Use \`/lfg-system builder\` - if you have more than one game registered and not already built, you will be asked to select the game you desire to build. The builder will open directly for your game if you have only one not built.
                                    [3]: Use the interactive buttons to set the desired configuration for your game's lfg contents. Do note that you must add at least one channel and one gamemode. Roles and ranks are optional
                                    [4]: When you are done adding and setting up the necessary components of your LFG, hit the BUILD button and wait for the bot to build the category and registered channels at the previous step.`
                                },
                                {
                                    name: "Details",
                                    value: `After following the steps above, your LFG system will be represented by the manager/interface channel where the menu is posted with the buttons attached.
                                    The game is represented by the category and the interface.
                                    Channels are represented by the channels created under the game's category.
                                    Gamemodes have no discord representation and live only in the database.
                                    Roles and ranks are discord Roles used based on their assigned type 'role' or 'rank'. A role can not be of both types at the same time.
                                    Deleting channels, messages or roles related to the system can result in it being disfunctional.`
                                }
                            )
                    ]
                });
                break;
            }
            case "builder": {
                // buildable games are games that do not have yet an lfg configuration
                const unBuiltGames = guildGames.filter((row) => row.manager_message_id === null);
                if (unBuiltGames.length === 0) {
                    await interaction.reply({
                        embeds: [
                            embed_message("Red", "There is no game to run the builder for. Try adding a new one.")
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await lfg_game_builder(interaction, unBuiltGames);
                break;
            }
            case "about": {
                await interaction.reply({
                    embeds: [embed_message("Purple", "Select the games to be deleted.\nIf the game is built, the discord channels won't be deleted.")],
                    flags: MessageFlags.Ephemeral,
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(select_game_id_builder(guildGames, 1))
                    ]
                });
                const reply = await interaction.fetchReply();

                const collector = await message_collector<ComponentType.StringSelect>(reply,
                    {
                        componentType: ComponentType.StringSelect,
                        filter: (i) => i.user.id == interaction.user.id,
                        lifetime: 120_000
                    },
                    async (selectInteraction) => {
                        await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});
                        const gameId = Number(selectInteraction.values[0]);
                        const gameSelected = guildGames.find(g => g.id === gameId)!;
                        const embed = new EmbedBuilder().setColor("Purple").setTitle(`LFG ${gameSelected.game_name}`);
                        if(
                            gameSelected.category_channel_id === null 
                            || gameSelected.manager_channel_id === null 
                            || gameSelected.manager_message_id === null
                        ) {
                            await selectInteraction.editReply({
                                embeds: [embed.setDescription(`${gameSelected.game_name} is registered but not built.`)]
                            });
                            return;
                        }

                        const category = await fetchGuildChannel(guild, gameSelected.category_channel_id);
                        const interfaceChannel = await fetchGuildChannel(guild, gameSelected.manager_channel_id);
                        if(!(category instanceof CategoryChannel) || !(interfaceChannel instanceof TextChannel)) {
                            await selectInteraction.editReply({
                                embeds: [embed_error("Something went wrong while fetching the game-related channels...")]
                            });
                            await LfgSystemRepo.deleteGame(gameId); // clean up the faulty row
                            return;
                        }

                        const interfaceMessage = await fetchMessage(interfaceChannel, gameSelected.manager_message_id);
                        if(interfaceMessage === null) {
                            await selectInteraction.editReply({
                                embeds: [embed_error("Something went wrong while fetching the interface message...")]
                            });
                            await LfgSystemRepo.deleteGame(gameId); // clean up the faulty row
                            return;
                        }

                        const lfgChannels = await LfgSystemRepo.getLfgChannelsByGame(gameId);
                        const lfgGamemodes = await LfgSystemRepo.getGamemodesOfGameId(gameId);
                        const lfgRoles = await LfgSystemRepo.getGameRoles(gameId);
                        const lfgRanks = await LfgSystemRepo.getGameRanks(gameId);
                        const postsCounter = await LfgSystemRepo.postGameCounter(gameId);
                        
                        embed.setDescription(`Game Category: ${category}\nInterface channel: ${interfaceChannel}\nInterface Message: ${interfaceMessage.url}`)
                            .addFields(
                                {
                                    name: "Active posts",
                                    value: `📝 ${postsCounter} LFGs`
                                },
                                {
                                    name: "Gamemodes",
                                    value: lfgGamemodes.length > 0 ?
                                        ( lfgGamemodes.length > 10 ? 
                                            lfgGamemodes.map(gm => gm.name)
                                                .slice(0, 10)
                                                .join(" ") + `... and ${lfgGamemodes.length - 10} more`
                                            : lfgGamemodes.map(gm => gm.name).join(" ")
                                        )
                                        : "None"
                                },
                                {
                                    // if the game has no channels, print None, if the game has more than 10 channels, print 10 and
                                    // the indication that there are more, if the game has [0,10] channels, just print the channels
                                    name: "Channels",
                                    value: lfgChannels.length > 0 ?
                                        ( lfgChannels.length > 10 ? 
                                            lfgChannels.map(c => `<#${c.discord_channel_id}>`)
                                                .slice(0, 10)
                                                .join(" ") + `... and ${lfgChannels.length - 10} more`
                                            : lfgChannels.map(c => `<#${c.discord_channel_id}>`).join(" ")
                                        )
                                        : "None"
                                },
                                {
                                    name: "Roles",
                                    value: lfgRoles.length > 0 ?
                                        lfgRoles.map(r => `<@&${r.role_id}>`).join(" ")
                                        : "None"
                                },
                                {
                                    name: "Ranks",
                                    value: lfgRanks.length > 0 ?
                                        lfgRanks.map(r => `<@&${r.role_id}>`).join(" ")
                                        : "None"
                                }
                            )

                        await selectInteraction.editReply({embeds: [embed]});
                        collector.stop();
                    },
                    async () => {
                        try {
                            await reply.edit({embeds: [embed_interaction_expired()], components: []});
                        } catch { /* do nothing */}
                    }
                )
                break;
            }
        }

        // groups and their subcommands
        switch (subcommandGroup) {
            case "new": {
                const channelLimit = 40; // maximum number of channels under the same category is 50, setting it to 40 to leave some space
                const gamemodeLimit = 40; // arbitrary limit
                const gameLimit = 40;
                switch (subcommand) {
                    case "game": {
                        if(guildGames.length >= gameLimit) {
                            await interaction.reply({
                                embeds: [embed_error("The maximum number of LFG games has been reached", "Limit")],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        const gameName = options.getString("game-name", true);
                        const nameInUse = guildGames.find((row) => row.game_name === gameName);
                        if (nameInUse) {
                            await interaction.reply({
                                embeds: [
                                    embed_message("Red", `The game **${gameName}** already has an LFG system on this guild, use a different name.`, "Name in use")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        await LfgSystemRepo.registerNewGame(guild.id, gameName);
                        await interaction.reply({
                            embeds: [
                                embed_message("Green", `**${gameName}** has been registered as a game in the lfg system.`)
                            ]
                        });
                        break;
                    }
                    case "channel": {
                        const newChannelModal = new ModalBuilder()
                            .setCustomId("new-channel-modal")
                            .setTitle("New Channel")
                            .addLabelComponents(select_game_label(builtGames), getChannelInputLabel());

                        await interaction.showModal(newChannelModal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                filter: (i) => i.user.id === interaction.user.id,
                                time: 120_000
                            });

                            const gameId = Number(submit.fields.getStringSelectValues("select-game-menu")[0]!); // the select menu is required and guarantees one selection
                            // fetch the game row
                            const selectedGame = builtGames.find(g => g.id === gameId)!; // guaranteed by the fact that the select menu options is made up of this array
                            // builtGames array ensures that category, channel and message ids are non null
                            const gameCategory = await fetchGuildChannel(guild, selectedGame.category_channel_id!);
                            if (!(gameCategory instanceof CategoryChannel)) {
                                await submit.reply({
                                    embeds: [embed_error("Fetching the game category failed", "Faulty row")],
                                    flags: MessageFlags.Ephemeral
                                });

                                // cleaning up the faulty row
                                await LfgSystemRepo.deleteGame(gameId);
                                return;
                            }
                            // fetch the channels of the game to ensure unique name
                            const lfgChannels = await LfgSystemRepo.getLfgChannelsByGame(gameId);

                            if(lfgChannels.length >= channelLimit) {
                                await submit.reply({
                                    embeds: [embed_error("The maximum number of LFG channels has been reached for this game", "Limit")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            const channelName = submit.fields.getTextInputValue("channel-name-input")
                                .toLowerCase()
                                .trim()
                                .replace(/\s+/g, "-")
                                .replace(/[^a-z0-9-]/g, "x")
                                .replace(/-+/g, "-");

                            if (lfgChannels.map(c => c.name).includes(channelName)) {
                                // channel name must be unique within the same game
                                await submit.reply({
                                    embeds: [embed_message("Red", `**${channelName}** is already in use by another channel of this game.`)],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            // create and register the new channel
                            const newChannel = await gameCategory.children.create({
                                name: channelName,
                                type: ChannelType.GuildText,
                                permissionOverwrites: [{
                                    id: guild.roles.everyone.id,
                                    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                                }]
                            });
                            const newLfgChannel: LfgChannel = {
                                game_id: gameId,
                                name: channelName,
                                discord_channel_id: newChannel.id
                            }
                            await LfgSystemRepo.registerChannel(newLfgChannel);

                            await submit.reply({
                                embeds: [embed_message("Green", `${newChannel} has been created and registered as an LFG channel.`)],
                                flags: MessageFlags.Ephemeral
                            });

                        } catch (error) {
                            console.error(error); // remove after dev
                            await interaction.followUp({
                                embeds: [embed_interaction_expired()],
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        break;
                    }
                    case "gamemode": {
                        const newGamemodeModal = new ModalBuilder()
                            .setCustomId("new-gamemode-modal")
                            .setTitle("New Gamemode")
                            .addLabelComponents(
                                select_game_label(builtGames),
                                getGamemodeInputLabel()
                            );
                        await interaction.showModal(newGamemodeModal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                filter: (i) => i.user.id === interaction.user.id,
                                time: 120_000
                            });

                            const gameId = Number(submit.fields.getStringSelectValues("select-game-menu")[0]!);
                            const gamemodeName = submit.fields.getTextInputValue("gamemode-input").toUpperCase();

                            const gamemodes = await LfgSystemRepo.getGamemodesOfGameId(gameId);
                            if(gamemodes.length >= gamemodeLimit) {
                                await submit.reply({
                                    embeds: [embed_error("The maximum number of gamemodes has been reached for this game", "Limit")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            if (gamemodes.map(g => g.name).includes(gamemodeName)) {
                                await submit.reply({
                                    embeds: [embed_message("Red", `**${gamemodeName}** is already in use for this game!`)],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            // the gamemode name was validated, it can be registered now
                            const gamemodeTable: LfgGamemode = {
                                game_id: gameId,
                                name: gamemodeName
                            }
                            await LfgSystemRepo.registerGamemode(gamemodeTable);

                            await submit.reply({
                                embeds: [embed_message("Green", `**${gamemodeName}** was added as a gamemode.`)],
                                flags: MessageFlags.Ephemeral
                            });

                        } catch (error) {
                            console.error(error); // remove after dev
                            await interaction.followUp({ embeds: [embed_interaction_expired()], flags: MessageFlags.Ephemeral });
                        }
                        break;
                    }
                }
                break;
            }
            case "assign": {
                switch (subcommand) {
                    case "lfg-gamemodes": {
                        // open a select menu to pick the game and then open a modal to pick the gamemodes and channels to
                        // get attached
                        await interaction.reply({
                            embeds: [
                                embed_message("Purple", "Select the game of the channels you want to attach gamemodes to.")
                            ],
                            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select_game_id_builder(builtGames))],
                            flags: MessageFlags.Ephemeral
                        });

                        const reply = await interaction.fetchReply();

                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                lifetime: 120_000,
                                filter: (i) => i.user.id === interaction.user.id
                            },
                            async (selectInteraction) => {
                                const gameId: number = Number(selectInteraction.values[0]!);
                                const channels = await LfgSystemRepo.getLfgChannelsByGame(gameId);
                                const gamemodes = await LfgSystemRepo.getGamemodesOfGameId(gameId);
                                const attachGamemodeModal = new ModalBuilder()
                                    .setCustomId("attach-gamemode-modal")
                                    .setTitle("Attach gamemodes to channels")
                                    .setLabelComponents(
                                        select_lfg_channel_label(channels, true, channels.length),
                                        select_gamemode_id_label(gamemodes, true, gamemodes.length)
                                    );

                                await selectInteraction.showModal(attachGamemodeModal);
                                try {
                                    const submit = await selectInteraction.awaitModalSubmit({
                                        filter: (i) => i.user.id === selectInteraction.user.id,
                                        time: 120_000
                                    });

                                    const channelIds = submit
                                        .fields
                                        .getStringSelectValues("select-channel-menu")
                                        .map(id => Number(id));

                                    const gamemodeIds = submit
                                        .fields
                                        .getStringSelectValues("select-gamemode-menu")
                                        .map(id => Number(id));

                                    await LfgSystemRepo.attachGamemodesToChannelsArray(channelIds, gamemodeIds);

                                    await submit.reply({
                                        embeds: [embed_message("Green", "Gamemodes and channels got attached.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                } catch (error) {
                                    console.error(error); // remove after dev
                                    await selectInteraction.followUp({
                                        embeds: [embed_interaction_expired()],
                                        flags: MessageFlags.Ephemeral
                                    });
                                }

                                // stop the collector after selection
                                collector.stop();
                            },
                            async () => {
                                try {
                                    await reply.edit({ embeds: [embed_interaction_expired()], components: [] });
                                } catch {/* do nothing */ }
                            }
                        )

                        break;
                    }
                    case "lfg-ranks":
                    case "lfg-roles": {
                        const discordRoleLimit = 25; // select menus accept a maximum of 25 options
                        const roleType: LfgRoleType = subcommand === "lfg-ranks" ? "rank" : "role";
                        const selectRolesMenu = new RoleSelectMenuBuilder()
                            .setCustomId("select-roles-menu")
                            .setRequired(true)
                            .setMinValues(1)
                            .setMaxValues(25)
                            .setPlaceholder("Roles...")
                        const selectRolesLabel = new LabelBuilder()
                            .setLabel("Select " + roleType.toUpperCase())
                            .setRoleSelectMenuComponent(selectRolesMenu);
                        const selectRolesToGameModal = new ModalBuilder()
                            .setCustomId("select-roles-game-modal")
                            .setTitle(`${roleType.toUpperCase()} select`)
                            .addLabelComponents(select_game_label(builtGames), selectRolesLabel);

                        await interaction.showModal(selectRolesToGameModal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                filter: (i) => i.user.id === interaction.user.id,
                                time: 120_000
                            });

                            const gameId: number = Number(submit.fields.getStringSelectValues("select-game-menu")[0]!);

                            const selectedRoles: LfgRole[] = Array.from(
                                submit
                                    .fields
                                    .getSelectedRoles("select-roles-menu", true)
                                    .values()
                                    .filter(r => r instanceof Role)
                            ).map(role => {
                                return {
                                    guild_id: guild.id,
                                    game_id: gameId,
                                    role_id: role.id,
                                    type: roleType
                                }
                            });

                            if(selectedRoles.length >= discordRoleLimit) {
                                await submit.reply({
                                    embeds: [embed_error(`The selection of roles is limited to ${discordRoleLimit}`, "Limit")],
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }
                            await LfgSystemRepo.deleteGameRolesByType(gameId, roleType);
                            await LfgSystemRepo.registerRolesBulk(selectedRoles);

                            await submit.reply({
                                embeds: [embed_message("Green", `The ${roleType}s have been updated for this game.`)],
                                flags: MessageFlags.Ephemeral
                            });

                        } catch (error) {
                            console.error(error); // remove after dev
                            await interaction.followUp({ embeds: [embed_interaction_expired()], flags: MessageFlags.Ephemeral });
                        }
                        break;
                    }
                }
                break;
            }
            case "delete": {
                await interaction.reply({
                    embeds: [embed_message("Purple", "Select the games to be deleted.\nIf the game is built, the discord channels won't be deleted.")],
                    flags: MessageFlags.Ephemeral,
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(select_game_id_builder(guildGames,
                                subcommand === "games" ? guildGames.length : 1
                            )) // only delete games subcommands can select multiple games
                    ]
                });
                const reply = await interaction.fetchReply();
                switch (subcommand) {
                    case "games": {
                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                filter: (i) => i.user.id === interaction.user.id,
                                lifetime: 120_000
                            },
                            async (selectInteraction) => {
                                const ids = selectInteraction.values.map(v => Number(v)).filter(id => !Number.isNaN(id));
                                const selectedBuiltGames = guildGames.filter(
                                    g => ids.includes(g.id) && g.manager_channel_id !== null
                                );
                                for (const row of selectedBuiltGames) { // attempt to delete the interface channel of built games
                                    const interfaceChannel = await fetchGuildChannel(guild, row.manager_channel_id!);
                                    if (interfaceChannel) {
                                        try {
                                            await interfaceChannel.delete();
                                        } catch { /* do nothing */ }
                                    }
                                }
                                await LfgSystemRepo.deleteGamesBulk(ids);
                                try { // game deletion might be executed inside the manager channel of the game to be deleted
                                    await selectInteraction.reply({
                                        embeds: [embed_message("Green", "Deletion executed successfully.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                } catch { /* do nothing */}
                                collector.stop();
                            },
                            async () => {
                                try {
                                    await reply.edit({ embeds: [embed_interaction_expired()], components: [] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                    case "channels": {
                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                lifetime: 120_000,
                                filter: (i) => i.user.id === interaction.user.id
                            },
                            async (selectInteraction) => {
                                const gameId = Number(selectInteraction.values[0]);
                                const channels = await LfgSystemRepo.getLfgChannelsByGame(gameId);
                                if (channels.length === 0) {
                                    await selectInteraction.reply({
                                        embeds: [embed_message("Red", "The game selected has no channel.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }

                                const deleteChannelsModal = new ModalBuilder()
                                    .setCustomId("delete-channel-modal")
                                    .setTitle("Delete LFG Channels")
                                    .addLabelComponents(select_lfg_channel_label(channels, true, channels.length));

                                await selectInteraction.showModal(deleteChannelsModal);
                                try {
                                    const submit = await selectInteraction.awaitModalSubmit({
                                        filter: (i) => i.user.id === selectInteraction.user.id,
                                        time: 120_000
                                    });
                                    await submit.deferReply({ flags: MessageFlags.Ephemeral })
                                    // fetch the selections made, convert them to int from string and from channels array fetch the selected ones
                                    const selectedChannels = channels.filter((c) =>
                                        submit
                                            .fields
                                            .getStringSelectValues("select-channel-menu")
                                            .map(v => Number(v))
                                            .includes(c.id)
                                    );

                                    // attempt to delete the channels by their snowflake
                                    await resolveAndDeleteChannels(guild, selectedChannels.map(c => c.discord_channel_id!));

                                    // delete the database rows
                                    await LfgSystemRepo.deleteChannelsBulk(selectedChannels.map(c => c.id));

                                    await submit.editReply({
                                        embeds: [embed_message("Green", "Lfg channel deletion executed.")]
                                    });
                                    collector.stop();

                                } catch (error) {
                                    console.error(error); // remove after dev
                                    await selectInteraction.followUp({ embeds: [embed_interaction_expired()], flags: MessageFlags.Ephemeral });
                                }
                                
                            },
                            async () => {
                                try {
                                    await reply.edit({ embeds: [embed_interaction_expired()], components: [] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                    case "gamemodes": {
                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                filter: (i) => i.user.id === interaction.user.id,
                                lifetime: 120_000
                            },
                            async (selectInteraction) => {
                                const gameId = Number(selectInteraction.values[0]);
                                const gamemodes = await LfgSystemRepo.getGamemodesOfGameId(gameId);
                                if (gamemodes.length === 0) {
                                    await selectInteraction.reply({
                                        embeds: [embed_message("Red", "The game selected doesn't have gamemodes.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }

                                const deleteGamemodesModal = new ModalBuilder()
                                    .setCustomId("delete-gamemodes-modal")
                                    .setTitle("Delete Gamemodes")
                                    .addLabelComponents(select_gamemode_id_label(gamemodes, true, gamemodes.length));

                                await selectInteraction.showModal(deleteGamemodesModal);
                                try {
                                    const submit = await selectInteraction.awaitModalSubmit({
                                        filter: (i) => i.user.id === selectInteraction.user.id,
                                        time: 120_000
                                    });

                                    // get the gamemode ids that were selected
                                    const selectedGamemodes = submit
                                        .fields
                                        .getStringSelectValues("select-gamemode-menu")
                                        .map(v => Number(v));

                                    await LfgSystemRepo.deleteGamemodesBulk(selectedGamemodes);
                                    await submit.reply({
                                        embeds: [embed_message("Green", "Gamemode deletion executed.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    collector.stop();
                                } catch (error) {
                                    console.error(error); // remove after dev
                                    await selectInteraction.followUp({ embeds: [embed_interaction_expired()], flags: MessageFlags.Ephemeral })
                                }

                                
                            },
                            async () => {
                                try {
                                    await reply.edit({ embeds: [embed_interaction_expired()], components: [] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                    case "ranks":
                    case "roles": {
                        const roleType: LfgRoleType = subcommand === "ranks" ? "rank" : "role";
                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                lifetime: 300_000,
                                filter: (i) => i.user.id === interaction.user.id
                            },
                            async (selectInteraction) => {
                                const gameId = Number(selectInteraction.values[0]);
                                const lfgRoles = await LfgSystemRepo.getGameLfgRolesByType(gameId, roleType);
                                if(lfgRoles.length === 0) {
                                    await selectInteraction.reply({
                                        embeds: [embed_message("Red", "This game has no lfg roles of that type.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }
                                const roles: Role[] = await resolveSnowflakesToRoles(guild, lfgRoles.map(r => r.role_id))
                                const deleteRolesModal = new ModalBuilder()
                                    .setCustomId("delete-roles-modal")
                                    .setTitle(`Delete ${roleType}s`)
                                    .setLabelComponents(select_lfg_roles_label(roles, true, roles.length));
                                await selectInteraction.showModal(deleteRolesModal);
                                try {
                                    const submit = await selectInteraction.awaitModalSubmit({
                                        filter: (i) => i.user.id === selectInteraction.user.id,
                                        time: 300_000
                                    });

                                    const selectedRoleSnowflakes = [...submit.fields.getStringSelectValues("select-lfg-role-menu")];

                                    await LfgSystemRepo.deleteLfgRolesBySnowflake(selectedRoleSnowflakes);
                                    await submit.reply({
                                        embeds: [embed_message("Green", "Lfg Role deletion executed.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    collector.stop();
                                } catch(error) {
                                    console.error(error); // remove after dev
                                    await selectInteraction.followUp({embeds: [embed_interaction_expired()], flags: MessageFlags.Ephemeral})
                                }

                                
                            },
                            async () => {
                                try {
                                    await reply.edit({ embeds: [embed_interaction_expired()], components: [] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                    case "channel-gamemodes": {
                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                lifetime: 120_000,
                                filter: (i) => i.user.id === interaction.user.id
                            },
                            async (selectInteraction) => {
                                const gameId = Number(selectInteraction.values[0]);
                                const channels = await LfgSystemRepo.getLfgChannelsByGame(gameId);
                                if(channels.length === 0) {
                                    await selectInteraction.reply({
                                        embeds: [embed_message("Red", "This game has no channels.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }
                                const gamemodes = await LfgSystemRepo.getGamemodesOfGameId(gameId);
                                if(gamemodes.length === 0) {
                                    await selectInteraction.reply({
                                        embeds: [embed_message("Red", "This game has no gamemodes.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }

                                const channelOptions: RestOrArray<APISelectMenuOption> =
                                    channels.map((c) => {
                                        return {
                                            label: `#${c.name}`,
                                            value: `${c.id}`
                                        }
                                    });
                                const channelSelectMenu = new StringSelectMenuBuilder()
                                    .setCustomId("select-channels")
                                    .setRequired(true)
                                    .setMinValues(1)
                                    .setMaxValues(channels.length)
                                    .setPlaceholder("Channels...")
                                    .setOptions(...channelOptions)
                                const channelSelectLabel = new LabelBuilder()
                                    .setLabel("Channels")
                                    .setDescription("The channels to have gamemodes removed.")
                                    .setStringSelectMenuComponent(channelSelectMenu);
                                
                                const gamemodeOptions: RestOrArray<APISelectMenuOption> =
                                    gamemodes.map((gm) => {
                                        return {
                                            label: gm.name,
                                            value: `${gm.id}`
                                        }
                                    });
                                const gamemodeSelectMenu = new StringSelectMenuBuilder()
                                    .setCustomId("select-gamemodes")
                                    .setRequired(true)
                                    .setMinValues(1)
                                    .setMaxValues(gamemodes.length)
                                    .setPlaceholder("Gamemodes...")
                                    .setOptions(gamemodeOptions)
                                const gamemodeSelectLabel = new LabelBuilder()
                                    .setLabel("Gamemodes")
                                    .setDescription("Select the gamemodes to be removed from the selected channels.")
                                    .setStringSelectMenuComponent(gamemodeSelectMenu);

                                const deleteChannelGamemodesModal = new ModalBuilder()
                                    .setCustomId("delete-channel-gamemodes-modal")
                                    .setTitle("De-assign gamemodes from channels")
                                    .setLabelComponents(channelSelectLabel, gamemodeSelectLabel);

                                await selectInteraction.showModal(deleteChannelGamemodesModal);
                                try {
                                    const submit = await selectInteraction.awaitModalSubmit({
                                        filter: (i) => i.user.id === interaction.user.id,
                                        time: 120_000
                                    });

                                    const channelIds = [...submit.fields.getStringSelectValues("select-channels")].map(v => Number(v));
                                    const gamemodeIds = [...submit.fields.getStringSelectValues("select-gamemodes")].map(v => Number(v));

                                    await LfgSystemRepo.deattachGamemodesAndChannels(channelIds, gamemodeIds);

                                    await submit.reply({
                                        embeds: [embed_message("Green", "De-attachment of gamemodes from channels executed.")],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    collector.stop();
                                } catch(error) {
                                    console.error(error); // remove after dev
                                }
                                
                                
                            },
                            async () => {
                                try {
                                    await reply.edit({ embeds: [embed_interaction_expired()], components: [] });
                                } catch {/* do nothing */ }
                            }
                        )
                        break;
                    }
                }
                break;
            }
            case "config": {
                switch(subcommand) {
                    case "force-voice": {
                        const toggle = options.getBoolean("toggle-voice", true);
                        await LfgSystemRepo.toggleSystemForceVoice(guild.id, toggle);
                        await interaction.reply({
                            embeds: [embed_message("Green", `Force voice was set to **${toggle}**.`)],
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }
                    case "lfg-cooldown": {
                        const cooldown = options.getNumber("cooldown", true);
                        await LfgSystemRepo.updateSystemCooldown(guild.id, cooldown);
                        await interaction.reply({
                            embeds: [embed_message("Green", `LFG cooldown was set to \`${cooldown} seconds\`.`)],
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }
                    case "info": {
                        const config = await LfgSystemRepo.getSystemConfigForGuild(guild.id);
                        await interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setAuthor({name: `${guild.name} LFG Configuration`, iconURL: `${guild.iconURL({extension: "png"})}`})
                                    .setColor("Purple")
                                    .addFields(
                                        {
                                            name: "Force Voice",
                                            value: `${config.force_voice}`.toUpperCase(),
                                            inline: true
                                        },
                                        {
                                            name: "LFG Cooldown",
                                            value: `${config.post_cooldown} seconds`,
                                            inline: true
                                        }
                                    )
                            ]
                        });
                        break;
                    }
                }
                break;
            }
        }
    }
}

export default lfgSystem;