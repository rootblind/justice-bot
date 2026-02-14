import {
    ActionRowBuilder,
    ButtonBuilder,
    ComponentType,
    GuildMember,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import BanListRepo from "../../Repositories/banlist.js";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { embedInfractionsShortList } from "../../Systems/moderation/infractions.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import { reasonInputLabel, unban_button, unban_handler } from "../../Systems/moderation/ban_system.js";
import { fetchLogsChannel, message_collector } from "../../utility_modules/discord_helpers.js";

const unbanPerma: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('unban-perma')
        .setDescription('Unban permanently banned users.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to be unbanned.')
                .setRequired(true)
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "moderation",
        category: "Administrator"
    },
    async execute(interaction) {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const options = interaction.options;

        const target = options.getUser("target", true);
        const isPermabanned = await BanListRepo.isUserPermabanned(guild.id, target.id);
        if (!isPermabanned) {
            await interaction.reply({
                embeds: [
                    embed_message("Red",
                        "This command can be used only to remove permanent bans.\nUse `/unban` instead.",
                        "Wrong method"
                    )
                ]
            });
            return;
        }

        const overviewLimit = 5;
        const logs = await PunishLogsRepo.getUserLogsOrder("DESC", guild.id, target.id, overviewLimit);
        const previewInfractions = embedInfractionsShortList(
            target,
            "full", // showing the overview
            logs
        );

        await interaction.reply({
            embeds: [
                previewInfractions,
                embed_message("Purple", "Review target's infractions before making a decision.")
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(unban_button())
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
                // ask for a reason
                const modal = new ModalBuilder()
                    .setCustomId("ask-for-reason")
                    .setTitle("Unban reason")
                    .setLabelComponents(reasonInputLabel())

                await buttonInteraction.showModal(modal);
                try {
                    const submit = await buttonInteraction.awaitModalSubmit({
                        time: 600_000,
                        filter: (i) => i.user.id === admin.id
                    });

                    const reason = submit.fields.getTextInputValue("reason-input");
                    const modLogs = await fetchLogsChannel(guild, "moderation");
                    await unban_handler(guild, target, admin.user, modLogs, reason);

                    await submit.reply({
                        embeds: [embed_message("Green", "Permanent ban lifted.")]
                    });
                    collector.stop();
                } catch (error) {
                    console.error(error); // remove after dev
                }
            },
            async () => {
                try {
                    await reply.edit({
                        components: [
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(unban_button().setDisabled(true))
                        ]
                    });
                } catch { /* do nothing */ }
            }
        )

    }
}

export default unbanPerma;