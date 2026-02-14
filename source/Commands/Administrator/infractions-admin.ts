import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    User
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_infraction, InfractionsListType, pageTypes } from "../../Systems/moderation/infractions.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";

const infractionsAdmin: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("infractions-admin")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Administrative commands for infractions.")
        .addSubcommand(subcommand =>
            subcommand.setName("lookup")
                .setDescription("Lookup details about an infraction by its ID.")
                .addNumberOption(option =>
                    option.setName("id")
                        .setDescription("The ID of the infraction.")
                        .setRequired(true)
                        .setMinValue(0)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("clear")
                .setDescription("Clear the selected page of infractions for a user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to clear the page for.")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("type")
                        .setDescription("The type of the infractions page.")
                        .setRequired(true)
                        .addChoices(
                            pageTypes.map(p => {
                                return {
                                    name: p.toUpperCase(),
                                    value: p
                                }
                            })
                        )
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 20,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "moderation",
        category: "Administrator"
    },
    async execute(interaction, client) {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case "lookup": {
                const id = options.getNumber("id", true);
                const log = await PunishLogsRepo.getLogByIdGuild(guild.id, id);
                if (log === null) {
                    await interaction.reply({
                        embeds: [embed_message("Red", "There is no infraction by that ID.")]
                    });
                    return;
                }

                let target: User | null = null;
                let moderator: User | null = null;
                try {
                    target = await client.users.fetch(log.target);
                    moderator = await client.users.fetch(log.moderator);
                } catch {
                    await interaction.reply({
                        embeds: [embed_error("Failed to fetch the target or moderator user.\nJSON data will be posted instead.")],
                        content: `The infraction log:\n${JSON.stringify(log)}`
                    });
                    return;
                }

                await interaction.reply({
                    embeds: [embed_infraction(target, moderator, log)],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId("delete-infraction-button")
                                    .setLabel("Delete")
                                    .setStyle(ButtonStyle.Danger)
                            )
                    ]
                });

                const reply = await interaction.fetchReply();
                const collector = await message_collector<ComponentType.Button>(reply,
                    {
                        componentType: ComponentType.Button,
                        filter: (i) => i.user.id === admin.id,
                        time: 600_000
                    },
                    async (buttonInteraction) => {
                        await PunishLogsRepo.deleteLogByIdGuild(guild.id, id);
                        await buttonInteraction.reply({
                            embeds: [embed_message("Green", "Deletion executed.")],
                            flags: MessageFlags.Ephemeral
                        });
                        collector.stop();
                    },
                    async () => {
                        try {
                            await reply.edit({ components: [] });
                        } catch { /* do nothing */ }
                    }
                )
                break;
            }
            case "clear": {
                const user = options.getUser("user", true);
                const type = options.getString("type", true) as InfractionsListType;
                const deletedLogsCount = await PunishLogsRepo.deleteInfractionPage(guild.id, user.id, type);

                if (deletedLogsCount === 0) {
                    await interaction.reply({
                        embeds: [embed_message("Red", "There is nothing to delete.")]
                    });
                } else {
                    await interaction.reply({
                        embeds: [
                            embed_message("Green",
                                `${user}'s ${type} page has been deleted.\n` +
                                `**${deletedLogsCount}** entries have been removed.`
                            )
                        ]
                    });
                }
                break;
            }
        }
    }
}

export default infractionsAdmin;