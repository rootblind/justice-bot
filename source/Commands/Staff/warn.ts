import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";

import { ChatCommand } from "../../Interfaces/command.js";
import { fetchGuildMember, fetchLogsChannel, fetchStaffRole, message_collector } from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { embed_unwarn, embed_warn, embed_warn_dm, warn_handler } from "../../Systems/moderation/warning.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";

const warnCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member for breaking the rules.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The member to be warned.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("The reason for the warning")
                .setMinLength(4)
                .setMaxLength(1024)
                .setRequired(true)
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "moderation",
        category: "Staff"
    },
    async execute(interaction, client) {
        const interactionMember = interaction.member as GuildMember;
        const guild = interactionMember.guild;
        const options = interaction.options;

        const user = options.getUser("user", true)
        const reason = options.getString("reason", true);
        const member = await fetchGuildMember(guild, user.id);
        if (!member) {
            await interaction.reply({
                embeds: [embed_error("Failed to fetch the member provided...")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const staffRole = await fetchStaffRole(client, guild);
        if (!staffRole) {
            // the row is validated inside interactionCreate
            // faulty row
            await interaction.reply({
                embeds: [embed_error("Failed to fetch the staff role of this server...", "Faulty row")],
                flags: MessageFlags.Ephemeral
            });
            await ServerRolesRepo.deleteGuildRole(guild.id, "staff"); // clear the row
            return;
        }

        // staff members are immune to warnings
        if (member.roles.cache.has(staffRole.id)) {
            await interaction.reply({
                embeds: [embed_message("Red", "You can not take that action against another staff member!")],
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        if (member.user.bot) {
            await interaction.reply({
                embeds: [embed_message("Red", "You can not target bots with this action!")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (
            member.permissions.has(PermissionFlagsBits.BanMembers)
            || member.permissions.has(PermissionFlagsBits.MuteMembers)
        ) {
            await interaction.reply({
                embeds: [embed_message("Red", "This member has moderation permissions!")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply();
        const modLogs = await fetchLogsChannel(guild, "moderation");

        // call the handler to register the warning and for autopunish logs to take effect
        const warnId = await warn_handler(guild, member.user, interactionMember.user, reason, modLogs);

        const removeButton = new ButtonBuilder()
            .setCustomId("remove-button")
            .setLabel("Remove")
            .setStyle(ButtonStyle.Danger)

        await interaction.editReply({
            embeds: [embed_warn(member, interactionMember, reason)],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(removeButton)]
        });

        try { // notify the targeted user if possible
            await member.send({ embeds: [embed_warn_dm(interactionMember.user.username, guild, reason)] })
        } catch { /* do nothing */ }

        if (modLogs) { // log the event
            await modLogs.send({ embeds: [embed_warn(member, interactionMember, reason)] })
        }

        // if the warning was a mistake, the moderator has 5 minutes to remove the warning by themselves
        // warnings can be removed by admins only otherwise
        const reply = await interaction.fetchReply();
        await message_collector<ComponentType.Button>(reply,
            {
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === interaction.user.id,
                time: 300_000
            },
            async (buttonInteraction) => {
                await PunishLogsRepo.deleteLogById(warnId); // remove the row
                try {
                    await reply.edit({
                        embeds: [embed_message("Green", "Warn removed.")],
                        components: []
                    });
                } catch {/* do nothing */ }

                // log the removal if possible
                if (modLogs) {
                    await modLogs.send({ embeds: [embed_unwarn(member.user.username, interactionMember)] });
                }

                await buttonInteraction.reply({
                    embeds: [embed_message("Green", "Warn removed.")],
                    flags: MessageFlags.Ephemeral
                });
            },
            async () => {
                try {
                    if (reply.deletable) await reply.delete();
                } catch { /* do nothing */ }
            }
        )
    }
}

export default warnCommand;