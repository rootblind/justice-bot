/**
 * System-wide tools for antialt_guard
 */

import { ButtonBuilder, ButtonStyle, OverwriteResolvable, OverwriteType, PermissionFlagsBits } from "discord.js";
import { ChatCommandExecuteWrapper } from "../../Interfaces/command.js";
import TicketSystemRepo from "../../Repositories/ticketsystem.js";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";

/**
 * The wrapper makes sure that antialt guard commands are ran only if all dependencies are met.
 * 
 * - Currently only the home server is supported
 * 
 * - Requires the web server to be enabled
 * 
 * - Depends on the ticket system
 */
export const antiAltExecuteWrapper: ChatCommandExecuteWrapper =
    (execute) => async (interaction) => {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        if (guild.id !== get_env_var("HOME_SERVER_ID")) {
            await interaction.reply({
                embeds: [
                    embed_message("Red", "This server is not allowed to use this command.", "Forbidden")
                ]
            });
            return;
        }

        if (Number(get_env_var("ENABLE_SERVER")) == 0) {
            await interaction.reply({
                embeds: [
                    embed_message(
                        "Red",
                        "Using this command requires the API server to be enabled.",
                        "The API backend of the bot is disable"
                    )
                ]
            });
            return;
        }

        const ticketManagerRow = await TicketSystemRepo.getManager(guild.id);
        if (!ticketManagerRow) {
            await interaction.reply({
                embeds: [
                    embed_message(
                        "Red",
                        "Antialt guard commands require a ticket system configured on this server.",
                        "Dependency required"
                    )
                ]
            });
            return;
        }


        await execute(interaction);
    }


/**
 * Allow everyone to see and use the channel. Verified users lose access to the verification channel.
 * 
 * 
 * @param everyoneId The id to the guild's everyone role
 * @param verificationRoleId The id to the designated verification role
 */
export function verification_channel_perms(everyoneId: string, verificationRoleId: string): OverwriteResolvable[] {
    return [
        {
            id: everyoneId,
            type: OverwriteType.Role,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory
            ],
            deny: [
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AddReactions,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.ManageMessages
            ]
        },
        {
            id: verificationRoleId,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel]
        }
    ];
}


/**
 * Restrict the channel to staff only.
 * 
 * 
 * @param everyoneId The id to the guild's everyone role
 * @param staffRoleId The id to the designated staff role
 */
export function assessment_channel_perms(everyoneId: string, staffRoleId: string): OverwriteResolvable[] {
    return [
        {
            id: everyoneId,
            type: OverwriteType.Role,
            deny: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AddReactions,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.ManageMessages
            ]
        },
        {
            id: staffRoleId,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel]
        }
    ]
}


/**
 * The generic configuration of the category is that only unverified members can see the category channels
 */
export function category_channel_perms(everyoneId: string, verificationRoleId: string): OverwriteResolvable[] {
    return [
        {
            id: everyoneId,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        },
        {
            id: verificationRoleId,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel]
        }
    ];
}

export function verification_message_buttons(): ButtonBuilder[] {
    const verification_url = `${get_env_var("WEB_HOST")}:${get_env_var("WEB_FRONT_PORT")}/`
    return [
        new ButtonBuilder()
            .setLabel("Verify")
            .setStyle(ButtonStyle.Link)
            .setURL(verification_url),
        new ButtonBuilder()
            .setLabel("Status")
            .setStyle(ButtonStyle.Primary)
            .setCustomId("status-button")
    ]
}