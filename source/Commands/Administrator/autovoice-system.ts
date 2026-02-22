import { CategoryChannel, ChannelType, Guild, PermissionFlagsBits, SlashCommandBuilder, TextChannel, VoiceChannel } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { autovoice_actionrow_button_builder, embed_autovoice_manager_builder } from "../../Systems/autovoice/autovoice_components.js";
import { autovoice_manager_builder_collector, guild_exceeds_autovoice_limits } from "../../Systems/autovoice/autovoice_manager_builder.js";
import AutoVoiceSystemRepo from "../../Repositories/autovoicesystem.js";
import { fetchGuildChannel, resolveAndDeleteChannels } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { isSnowflake } from "../../utility_modules/utility_methods.js";

const autovoice_system: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("autovoice-system")
        .setDescription("Autovoice system administrative commands.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("setup")
                .setDescription("Set up the autovoice system and channels.")
                .addChannelOption(option =>
                    option.setName("category")
                        .setDescription("The category to host the autovoice system. Omitting will create it's own category.")
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Set existing channels as part of the system. The interface will still be built by the bot.")
                .addChannelOption(option =>
                    option.setName("category")
                        .setDescription("The category to host the autovoice system.")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("autovoice")
                        .setDescription("The autovoice to join to create a new room.")
                        .addChannelTypes(ChannelType.GuildVoice)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("managerchannel")
                        .setDescription("The text channel where the interface will be built.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("delete")
                .setDescription("Delete the autovoice system that sent that interface.")
                .addStringOption(option =>
                    option.setName("messageid")
                        .setDescription("The message id of the interface to have its system deleted.")
                        .setRequired(true)
                        .setMinLength(17)
                        .setMaxLength(19)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("wipe")
                .setDescription("Forget all setups. This command does not delete channels or the interface.")
        )
        .toJSON(),
    async execute(interaction) {
        const guild = interaction.guild as Guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        await interaction.deferReply();

        const autovoiceCountExceeded = await guild_exceeds_autovoice_limits(guild);
        if (autovoiceCountExceeded === true && (subcommand === "setup" || subcommand === "set")) {
            await interaction.editReply({
                embeds: [
                    embed_error(
                        `You already have the maximum number of autovoice systems for your current plan!\nMake room to add a new one.`
                    )
                ]
            });

            return;
        }

        switch (subcommand) {
            case "setup": {
                const category: CategoryChannel | null = options.getChannel("category", false); // if not provided, the bot will create one

                // to finalize the setup, autovoice manager builder is called
                const buttonRows = autovoice_actionrow_button_builder();
                const managerBuilderEmbed = embed_autovoice_manager_builder(guild.preferredLocale);

                await interaction.editReply({
                    embeds: [managerBuilderEmbed],
                    components: buttonRows
                });

                const reply = await interaction.fetchReply();
                await autovoice_manager_builder_collector(interaction, reply, { category }); // attach the builder collector
                break;
            }
            case "set": {
                const category: CategoryChannel = options.getChannel("category", true);
                const autovoice: VoiceChannel = options.getChannel("autovoice", true);
                const managerchannel: TextChannel = options.getChannel("managerchannel", true);

                const buttonRows = autovoice_actionrow_button_builder();
                const managerBuilderEmbed = embed_autovoice_manager_builder(guild.preferredLocale);

                await interaction.editReply({
                    embeds: [managerBuilderEmbed],
                    components: buttonRows
                });

                const reply = await interaction.fetchReply();
                await autovoice_manager_builder_collector(interaction, reply, { category, autovoice, managerchannel });
                break;
            }
            case "delete": {
                const messageId: string = options.getString("messageid", true);
                if (!isSnowflake(messageId)) {
                    await interaction.editReply({
                        embeds: [embed_error("The ID provided is not a valid Snowflake.")]
                    });
                    return;
                }
                const autovoiceSystem = await AutoVoiceSystemRepo.getInterfaceSystem(guild.id, messageId);
                if (autovoiceSystem === null) {
                    await interaction.editReply({
                        embeds: [embed_error("The message provided is not a valid message Snowflake or is not the ID of a registered interface!")],
                    });
                    return;
                }

                const managerchannel = await fetchGuildChannel(guild, autovoiceSystem.managerchannel);
                const autovoice = await fetchGuildChannel(guild, autovoiceSystem.autovoice);
                const category = await fetchGuildChannel(guild, autovoiceSystem.category);

                if (
                    !(managerchannel instanceof TextChannel) ||
                    !(autovoice instanceof VoiceChannel) ||
                    !(category instanceof CategoryChannel)
                ) {

                    await interaction.editReply({
                        embeds: [
                            embed_message(
                                "Yellow",
                                "The system was deleted from database but guild-side removal must be done manual.",
                                "Some channels couldn't be fetched"
                            )
                        ]
                    });
                } else {
                    try {
                        await managerchannel.delete();
                        await autovoice.delete();
                        await category.delete();
                        await interaction.editReply({
                            embeds: [embed_message("Green", `Autovoice system identified by interface ID ${messageId} was completely removed.`)]
                        })
                    } catch (error) {
                        await errorLogHandle(error);
                        await interaction.editReply({
                            embeds: [embed_message("Yellow", "The autovoice system was removed from the database, but an error occured while trying to clean the channels. Some might need manual clean up.")]
                        });
                    }
                }
                await AutoVoiceSystemRepo.deleteSystem(guild.id, messageId);
                break;
            }
            case "wipe": {
                const guildAutovoiceSystems = await AutoVoiceSystemRepo.getGuildSystems(guild.id);
                const managerArray = [
                    ...new Set(
                        guildAutovoiceSystems.map((row) => row.managerchannel)
                    )
                ];
                const autovoiceArray = [
                    ...new Set(
                        guildAutovoiceSystems.map((row) => row.autovoice)
                    )
                ];
                const categoryArray = [
                    ...new Set(
                        guildAutovoiceSystems.map((row) => row.category)
                    )
                ];

                if (categoryArray.length === 0) {
                    await interaction.editReply({
                        embeds: [embed_message("Aqua", "This guild has no autovoice system in place to be wiped.", "Nothing was deleted.")]
                    });
                    return;
                }

                const channels = [...managerArray, ...autovoiceArray, ...categoryArray];
                await resolveAndDeleteChannels(guild, channels);
                await AutoVoiceSystemRepo.wipeGuildSystems(guild.id);
                await interaction.editReply({
                    embeds: [embed_message(
                        "Green",
                        "This guild no longer has registered autovoice systems.\nThere may be residual channels that need to be removed manually."
                    )
                    ]
                });
            }

        }

    },
    metadata: {
        botPermissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers
        ],
        userPermissions: [PermissionFlagsBits.Administrator],
        cooldown: 10,
        scope: "guild",
        category: "Administrator",
        group: "autovoice"
    }
}

export default autovoice_system;