import {
    ActionRowBuilder,
    APISelectMenuOption,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    RestOrArray,
    SlashCommandBuilder,
    StringSelectMenuBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import { embedInfractionsCompleteList, embedInfractionsShortList, InfractionsListType, pageTypes, punishDictFilter } from "../../Systems/moderation/infractions.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { PunishLogs } from "../../Interfaces/database_types.js";
import { chunkArray } from "../../utility_modules/utility_methods.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_message } from "../../utility_modules/embed_builders.js";

const infractionsCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("infractions")
        .setDescription("Lookup someone's infractions on this server.")
        .addSubcommand(subcommand =>
            subcommand.setName("short")
                .setDescription("Lookup the short list.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to check infractions for.")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("complete")
                .setDescription("Lookup the complete list.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to check infractions for.")
                )
                .addStringOption(option =>
                    option.setName("page")
                        .setDescription("The page to be completely displayed.")
                        .addChoices(pageTypes.map(p => {
                            return {
                                name: p.toUpperCase(),
                                value: p
                            }
                        }))
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 20,
        botPermissions: [PermissionFlagsBits.Administrator],
        userPermissions: [],
        scope: "guild",
        group: "moderation",
        category: "Info"
    },
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const user = options.getUser("user") ?? member.user; // if no user is given, the command is self-targeted

        if (user.bot) {
            await interaction.reply({
                embeds: [embed_message("Red", "You can't target bots with that action.")]
            });
            return;
        }

        const punishLogs = await PunishLogsRepo.getUserLogsOrder("DESC", guild.id, user.id);
        switch (subcommand) {
            case "short": {
                const overview = embedInfractionsShortList(user, "full", punishLogs);

                const selectPageOptions: RestOrArray<APISelectMenuOption> = pageTypes
                    .map(p => {
                        return {
                            // full is displayed as "overview" while the others are displayed at plural
                            label: `${p === "full" ? "OVERVIEW" : p.toUpperCase()} page`,
                            description: `Lookup ${p === "full" ? "overview" : p + "s"}`,
                            value: p
                        }
                    });
                const selectPage = new StringSelectMenuBuilder()
                    .setCustomId("select-page-menu")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(selectPageOptions);

                await interaction.reply({
                    embeds: [overview],
                    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectPage)]
                });
                const reply = await interaction.fetchReply();
                await message_collector<ComponentType.StringSelect>(reply,
                    {
                        componentType: ComponentType.StringSelect,
                        filter: (i) => i.user.id === member.id,
                        time: 600_000
                    },
                    async (selectInteraction) => {
                        const page = selectInteraction.values[0] as InfractionsListType;
                        const pageInfractions: PunishLogs[] = punishLogs.filter(punishDictFilter[page]);
                        await interaction.editReply({
                            embeds: [
                                embedInfractionsShortList(user, page, pageInfractions)
                            ]
                        });
                        await selectInteraction.reply({
                            embeds: [embed_message("Green", `${page} page selected.`)],
                            flags: MessageFlags.Ephemeral
                        });
                    },
                    async () => {
                        try {
                            await reply.edit({ components: [] })
                        } catch { /* do nothing */ }
                    }
                )
                break;
            }
            case "complete": {
                await interaction.deferReply();
                const page = (options.getString("page") ?? "full") as InfractionsListType; // the choices are built from the array
                const pageInfractions = punishLogs.filter(punishDictFilter[page]);
                const completeInfractonsList = embedInfractionsCompleteList(user, page, pageInfractions);
                const interactionReplyEmbedLimit = 10;
                const embedChunks = chunkArray<EmbedBuilder>(completeInfractonsList, interactionReplyEmbedLimit);

                await interaction.editReply({ embeds: embedChunks[0]! });
                if (embedChunks.length > 1) {
                    for (const chunk of embedChunks.slice(1, embedChunks.length)) {
                        try {
                            await interaction.followUp({ embeds: chunk })
                        } catch (error) {
                            await errorLogHandle(error);
                        }
                    }
                }
                break;
            }
        }
    }
}

export default infractionsCommand;