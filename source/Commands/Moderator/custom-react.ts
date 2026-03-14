import { APIEmbedField, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { getLocalizationRecord, t } from "../../Config/i18n.js";
import CustomReactRepo from "../../Repositories/customreact.js";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { chunkArray } from "../../utility_modules/utility_methods.js";

const customReact: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("custom-react")
        .setDescription("Set up the bot to reply to a specific key word or phrase.")
        .setDescriptionLocalizations(getLocalizationRecord("commands.moderator.custom_react.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand.setName("add")
                .setNameLocalizations(getLocalizationRecord("commands.moderator.custom_react.subcommands.add.name"))
                .setDescription("Add a new custom reaction.")
                .setDescriptionLocalizations(getLocalizationRecord("commands.moderator.custom_react.subcommands.add.description"))
                .addStringOption(option =>
                    option.setName("key")
                        .setDescription("The keyword or keyphrase.")
                        .setMinLength(3)
                        .setMaxLength(20)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("reply")
                        .setDescription("The reply of the bot.")
                        .setMaxLength(2048)
                        .setMinLength(3)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setNameLocalizations(getLocalizationRecord("commands.moderator.custom_react.subcommands.remove.name"))
                .setDescription("Remove a custom reaction")
                .setDescriptionLocalizations(getLocalizationRecord("commands.moderator.custom_react.subcommands.remove.description"))
                .addStringOption(option =>
                    option.setName("key")
                        .setDescription("The keyword or keyphrase to be removed")
                        .setMinLength(3)
                        .setMaxLength(20)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setNameLocalizations(getLocalizationRecord("commands.moderator.custom_react.subcommands.list.name"))
                .setDescription("List all custom reactions")
                .setDescriptionLocalizations(getLocalizationRecord("commands.moderator.custom_react.subcommands.list.description"))
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        group: "global",
        scope: "global",
        category: "Moderator",
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.SendMessages]
    },
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const locale = interaction.locale;
        switch (subcommand) {
            case "add": {
                const key = options.getString("key", true).toLowerCase();
                const reply = options.getString("reply", true);

                await CustomReactRepo.upsert(guild.id, key, reply);
                await interaction.reply({
                    embeds: [embed_message("Green",
                        `**${key}**: ${reply}`,
                        t(locale, "commands.moderator.custom_reaction.subcommands.add.success")
                    )]
                });
                break;
            }
            case "remove": {
                const key = options.getString("key", true).toLowerCase();
                const deletedRows: null | number = await CustomReactRepo.deleteGuildReply(guild.id, key);
                if (deletedRows === 0 || deletedRows === null) {
                    await interaction.reply({
                        embeds: [embed_message("Red", t(locale, "commands.moderator.custom_react.subcommands.remove.no_delete"))]
                    });
                    return;
                } else {
                    await interaction.reply({
                        embeds: [embed_message("Green", t(locale, "commands.moderator.custom_react.subcommands.remove.success", { string: key }))]
                    });
                }
                break;
            }
            case "list": {
                await interaction.deferReply();
                const reactList = await CustomReactRepo.getGuildList(guild.id);
                if (reactList.length === 0) {
                    await interaction.editReply({
                        embeds: [
                            embed_message("Aqua",
                                t(locale, "commands.moderator.custom_react.subcommands.list.empty_list.description"),
                                t(locale, "commands.moderator.custom_react.subcommands.list.empty_list.title")
                            )
                        ]
                    });
                    return;
                }

                const listEmbeds: EmbedBuilder[] = [];
                const reactFields: APIEmbedField[] = [];

                for (const row of reactList) {
                    reactFields.push({
                        name: row.keyword,
                        value: row.reply
                    });
                }

                const embedFieldsLimit = 25;
                const chunkFields = chunkArray(reactFields, embedFieldsLimit);
                const firstChunk = chunkFields[0]!;
                listEmbeds.push(
                    new EmbedBuilder()
                        .setColor("Aqua")
                        .setAuthor({
                            name: t(locale, "commands.moderator.custom_react.subcommands.list.author", { string: guild.name }),
                            iconURL: `${guild.iconURL({ extension: "png" })}`
                        })
                        .setFields(firstChunk)
                );

                if (chunkFields.length > 1) {
                    for (let index = 1; index < chunkFields.length; index++) {
                        listEmbeds.push(
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setFields(chunkFields[index]!)
                        );
                    }
                }

                const interactionEmbedsLimit = 10;
                await interaction.editReply({
                    embeds: listEmbeds.slice(0, interactionEmbedsLimit)
                });
                break;
            }
        }
    }
}

export default customReact;