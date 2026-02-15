import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CacheType,
    ChannelType,
    ChatInputCommandInteraction,
    ColorResolvable,
    ComponentType,
    EmbedBuilder,
    Guild,
    GuildMember,
    Message,
    MessageFlags,
    PermissionFlagsBits,
    Role
} from "discord.js";
import { confirm_button } from "../../utility_modules/button_builders.js";
import { message_collector, setLogChannel } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import TicketSystemRepo from "../../Repositories/ticketsystem.js";
import { open_ticket_collector } from "./ticket_manager.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";

export function embed_ticket_warning_setup(color: ColorResolvable = "Aqua"): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle("Ticket Support Setup")
        .setDescription(
            "By pressing the confirmation button, a new ticket support role " +
            "and channels will be created.\nPrevious configuration will be lost if any."
        )
}

export const openTicketButton = new ButtonBuilder()
    .setCustomId("open-ticket-button")
    .setLabel("Open Ticket")
    .setStyle(ButtonStyle.Success);

export function embeds_open_ticket(color: ColorResolvable = "Aqua"): EmbedBuilder[] {
    return [
        new EmbedBuilder()
            .setColor(color)
            .setTitle("Before you open a ticket")
            .setDescription(
                "The ticket system must be used strictly for moderation matters, server or bot-related issues, " +
                "or questions that are not already addressed in the informational channels.\n\n" +
                "Please do not open tickets without a valid reason.\n\nYou should open a ticket if:\n" +
                "- A member is breaking the rules or engaging in inappropriate behavior.\n" +
                "- A server feature or bot is not functioning properly.\n" +
                "- You have a question that is not already answered in the informational channels.\n" +
                "- You have a specific request that requires staff attention.\n\n" +
                "Do not open a ticket for:\n" +
                "- Testing the system.\n" +
                "- Casual conversation.\n" +
                "- Frequently asked questions that are already answered in informative channels.\n\n" +
                "How to submit a report:\n" +
                "- You do not need to wait for a staff member to claim the ticket. Begin by clearly describing the situation.\n" +
                "- Provide the username of the member involved and explain what occurred.\n" +
                "- Attach any evidence you have, such as screenshots or recordings.\n" +
                "- If you do not have evidence, you may still submit a report to inform the staff about the behavior."
            ),
        new EmbedBuilder()
            .setColor(color)
            .setTitle("Open a ticket")
            .setDescription("Click **Open Ticket** and select the subject of your ticket.")
    ]
}

/**
 * Wipe the current configuration, create the channels and roles and insert into the database.
 */
export async function build_and_register_system(
    guild: Guild,
    staffRole: Role
) {

    const category = await guild.channels.create({
        name: "Ticket Support",
        type: ChannelType.GuildCategory
    });

    // after closing a ticket, the bot will dump the logs here
    const ticketLogs = await category.children.create({
        name: "ticket-logs",
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AddReactions,
                    PermissionFlagsBits.ManageMessages
                ],
            },
            {
                id: staffRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
            }
        ]
    });

    // the channel where the interface will live
    const ticketManagerChannel = await category.children.create({
        name: "open-ticket",
        type: ChannelType.GuildText,
        permissionOverwrites: [
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
        ]
    });

    // TODO: AFTER EMBED BUILDER FRAMEWORK: LET ADMINS CUSTOMIZE THEIR open-ticket EMBED
    // the message holding the interface (collector)
    const openTicketMessage = await ticketManagerChannel.send({
        embeds: embeds_open_ticket(),
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(openTicketButton)]
    });

    // attach the collector
    await open_ticket_collector(guild.client, guild, openTicketMessage);

    // Ticket Support role used for notifying the staff members
    const ticketSupportRole = await guild.roles.create({
        name: "Ticket Support",
        position: staffRole.position - 1 // place it below the staff role
    });

    // wipe the current configuration
    await TicketSystemRepo.deleteGuildManager(guild.id);

    // register the new ticket system configuration
    await TicketSystemRepo.setGuildManager(
        {
            guild: guild.id,
            category: category.id,
            channel: ticketManagerChannel.id,
            message: openTicketMessage.id
        }
    );

    // register the ticket support role
    await ServerRolesRepo.put(guild.id, "ticket-support", ticketSupportRole.id);
    // register the logs channel
    await setLogChannel(guild.id, ticketLogs.id, "ticket-support");
}

/**
 * The collector handler used to launch the build and register method
 */
export async function ticket_setup_collector(
    message: Message,
    member: GuildMember,
    guild: Guild,
    staffRole: Role
) {
    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
            time: 120_000,
            filter: (i) => i.user.id === member.user.id
        },
        async (buttonInteraction) => {
            try {
                await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
                await build_and_register_system(guild, staffRole);
                await buttonInteraction.editReply({
                    embeds: [embed_message("Green", "Successfully built the ticket system.")]
                });
                collector.stop();
            } catch (error) {
                await errorLogHandle(error);
                await buttonInteraction.editReply({
                    embeds: [embed_error("Something went wrong while building the system...")]
                });
            }

        },
        async () => {
            try {
                if (message.deletable) {
                    await message.delete();
                }
            } catch { /* do nothing */ }

        }
    )
}

/**
 * The subcommand handler for /ticket-system setup, preparing everything in a modular way
 * 
 * Asking the administrator to confirm since the execution will remove the current ticketmanager row if it exists.
 */
export async function ticket_setup_builder(
    interaction: ChatInputCommandInteraction<CacheType>,
    guild: Guild,
    admin: GuildMember,
    staffRole: Role
) {
    const confirm = confirm_button("confirm-button");
    await interaction.reply({
        embeds: [embed_ticket_warning_setup()],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirm)]
    });

    const reply = await interaction.fetchReply();
    await ticket_setup_collector(reply, admin, guild, staffRole);
}