import { GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { embed_error, embed_message, embed_timeout, embed_timeout_dm, embed_timeout_removed } from "../../utility_modules/embed_builders";
import { fetchGuildMember, fetchLogsChannel } from "../../utility_modules/discord_helpers";
import { duration_to_seconds, seconds_to_duration, timestampNow } from "../../utility_modules/utility_methods";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import { PunishmentType } from "../../objects/enums.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const timeoutCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Manage the timeout of a member')
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Sets member on timeout')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to be timed out.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The duration of the timeout.')
                        .addChoices(
                            {
                                name: "5 minutes",
                                value: "5m"
                            },
                            {
                                name: "1 hour",
                                value: "1h"
                            },
                            {
                                name: "6 hours",
                                value: "6h"
                            },
                            {
                                name: "1 day",
                                value: "1d"
                            },
                            {
                                name: "2 days",
                                value: "2d"
                            }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason of the timeout')
                        .setMinLength(4)
                        .setMaxLength(512)
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('apply-warn')
                        .setDescription("Apply a warn on top of the timeout.")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Removes the current timeout of the member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove the timeout from')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason of the timeout being removed early.')
                        .setMinLength(4)
                        .setMaxLength(512)
                        .setRequired(true)
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.MuteMembers],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "moderation",
        category: "Staff"
    },
    async execute(interaction) {
        const moderator = interaction.member as GuildMember;
        const guild = moderator.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        const user = options.getUser("user", true);
        const reason = options.getString("reason", true);

        const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
        if (staffRoleId === null) {
            await interaction.reply({
                embeds: [embed_error("It seems like the staff role row is missing...", "Staff role is missing")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const target = await fetchGuildMember(guild, user.id);
        if (target === null) {
            await interaction.reply({
                embeds: [embed_error("Something went wrong while fetching the targeted member...")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (target.roles.cache.has(staffRoleId)) {
            await interaction.reply({
                embeds: [embed_message("Red", "You can't target a staff member!")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const modLogs = await fetchLogsChannel(guild, "moderation");
        await interaction.deferReply();

        switch (subcommand) {
            case "set": {
                const duration = duration_to_seconds(options.getString("duration", true))!; // choices are all valid strings

                // set the timeout
                try {
                    await target.timeout(duration * 1000, reason);
                } catch (error) {
                    await errorLogHandle(error);
                    await interaction.editReply({
                        embeds: [embed_error("Something went wrong while trying to mute the targeted member.")]
                    });
                    return;
                }

                const applyWarn = options.getBoolean("apply-warn") ?? true; // if not specified, defaults to true
                const embedLog = embed_timeout(
                    target,
                    moderator,
                    seconds_to_duration(duration)!,
                    timestampNow() + duration,
                    reason,
                    applyWarn

                )
                if (modLogs) {
                    await modLogs.send({
                        embeds: [
                            embedLog
                        ]
                    });
                }

                // register infraction
                await PunishLogsRepo.insertLog(
                    guild.id,
                    target.id,
                    moderator.id,
                    PunishmentType.TIMEOUT,
                    reason,
                    String(timestampNow())
                );

                try { // try to notify the user
                    await target.send({
                        embeds: [
                            embed_timeout_dm(
                                seconds_to_duration(duration)!,
                                guild,
                                moderator.user,
                                reason,
                                applyWarn
                            )
                        ]
                    });
                } catch {/* do nothing */ }

                await interaction.editReply({ embeds: [embedLog] });
                break;
            }
            case "remove": {
                if (target.communicationDisabledUntil === null) {
                    await interaction.editReply({
                        embeds: [embed_message("Red", "The member is not currently in timeout.")]
                    });
                }

                // set the timeout to null to remove it
                try {
                    await target.timeout(null, reason);
                } catch (error) {
                    await errorLogHandle(error);
                    await interaction.editReply({
                        embeds: [embed_error("Something went wrong while trying to unmute the targeted member.")]
                    });
                    return;
                }

                const embedLog = embed_timeout_removed(
                    target.user,
                    moderator.user,
                    reason,
                    "Aqua"
                );

                if (modLogs) {
                    await modLogs.send({ embeds: [embedLog] });
                }

                await interaction.editReply({ embeds: [embedLog] });
                break;
            }
        }


    }
}

export default timeoutCommand;