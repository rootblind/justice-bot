import {
    ActionRowBuilder,
    APISelectMenuOption,
    ButtonBuilder,
    CategoryChannel,
    ChannelType,
    Client,
    Collection,
    ColorResolvable,
    ComponentType,
    EmbedBuilder,
    Guild,
    GuildMember,
    LabelBuilder,
    Message,
    MessageFlags,
    ModalBuilder,
    OverwriteResolvable,
    PermissionFlagsBits,
    RestOrArray,
    Role,
    StringSelectMenuBuilder,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    User
} from "discord.js";
import { fetchGuildChannel, fetchStaffRole, fetchTicketSupportRole, message_collector } from "../../utility_modules/discord_helpers.js";
import { has_cooldown, timestampNow } from "../../utility_modules/utility_methods.js";
import { embed_error, embed_interaction_expired, embed_message } from "../../utility_modules/embed_builders.js";
import TicketSystemRepo from "../../Repositories/ticketsystem.js";
import { TicketSubject } from "../../Interfaces/database_types.js";
import { TicketSubjectContext } from "../../Interfaces/helper_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { add_member_button, claim_button, remove_member_button, resolve_button } from "../../utility_modules/button_builders.js";
import { ticket_collector } from "./ticket_collector.js";

export function ticket_channel_member_permissions(
    memberId: string,
    access: "allow" | "deny"
): OverwriteResolvable {
    const perms: bigint[] = [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles
    ]

    if (access === "allow") return { id: memberId, allow: perms }
    return { id: memberId, deny: perms }
}

export function ticket_channel_default_permissions(
    everyoneId: string,
    memberId: string,
    staffRoleId: string
): OverwriteResolvable[] {
    return [
        {
            id: everyoneId,
            deny: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages
            ],
        },
        {
            id: staffRoleId,
            allow: [
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ViewChannel
            ]
        },
        ticket_channel_member_permissions(memberId, "allow")
    ]
}

/**
 * Formatting the context of the ticket into an embed
 */
export function embed_ticket_subject_message(
    user: User,
    subject: string,
    description: string,
    color: ColorResolvable = "Aqua"
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${user.username} ticket`, iconURL: user.displayAvatarURL({ extension: "jpg" }) })
        .setTitle(subject)
        .setDescription(`**Notice**:\n${description}`)
        .setTimestamp()
        .setFooter({ text: `Member ID: ${user.id}` })
}

/**
 * Creates the text channel under the category, post the message based on the context given 
 * and register the new ticket
 */
export async function create_ticket(
    category: CategoryChannel,
    context: TicketSubjectContext
): Promise<TextChannel> {
    // create channel
    const ticketChannel = await category.children.create({
        name: `${context.member.user.username}-ticket`,
        permissionOverwrites: ticket_channel_default_permissions(
            context.guild.roles.everyone.id,
            context.member.id,
            context.staffRole.id
        ),
        type: ChannelType.GuildText
    });

    const ticketMessage = await ticketChannel.send({
        content: `${context.ticketSupportRole} ${context.member}`,
        embeds: [
            embed_ticket_subject_message(context.member.user, context.subject, context.description, "Aqua"),
            embed_message("Aqua", "The ticket support staff has been notified of your ticket.")
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(claim_button(), resolve_button(), add_member_button(), remove_member_button())
        ]
    });

    // register the ticket
    await TicketSystemRepo.registerTicket({
        guild: context.guild.id,
        channel: ticketChannel.id,
        message: ticketMessage.id,
        member: context.member.id,
        subject: context.subject,
        timestamp: String(timestampNow())
    });

    // attach collector
    await ticket_collector(ticketMessage, context.staffRole.id, context.subject);

    return ticketChannel;
}

export function ticket_subject_select(
    subjects: (TicketSubject & { id: number })[],
    selectLimit: number = 1,
    includeOther: boolean = true
): StringSelectMenuBuilder {
    const subjectOptions: RestOrArray<APISelectMenuOption> =
        subjects.map(s => {
            return {
                label: s.subject,
                value: `${s.id}`
            }
        });

    if (includeOther) subjectOptions.push({ label: "Other", value: "other" });

    const selectSubjectMenu = new StringSelectMenuBuilder()
        .setCustomId("select-subject-menu")
        .setMinValues(1)
        .setMaxValues(selectLimit)
        .addOptions(subjectOptions);

    return selectSubjectMenu;
}

export function other_modal_input(): ModalBuilder {
    const subject = new TextInputBuilder()
        .setCustomId("subject-input")
        .setMinLength(4)
        .setMaxLength(100)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("The reason for opening this ticket...");
    const subjectLabel = new LabelBuilder()
        .setLabel("Your reason")
        .setTextInputComponent(subject);
    const modal = new ModalBuilder()
        .setCustomId("other-subject-modal")
        .setTitle("Ticket subject")
        .addLabelComponents(subjectLabel);

    return modal;
}

/**
 * The select menu handles member's selection and then calls the ticket creation method.
 * 
 * If the member selects the "other" option, a modal will be promped asking for the ticket's subject
 */
export async function select_ticket_subject_collector(
    category: CategoryChannel,
    message: Message,
    subjects: (TicketSubject & { id: number })[],
    ticketSupportRole: Role,
    staffRole: Role
) {
    const collector = await message_collector<ComponentType.StringSelect>(message,
        {
            componentType: ComponentType.StringSelect
        },
        async (selectInteraction) => {
            const subjectId = selectInteraction.values[0]!;
            if (subjectId === "other") {
                await selectInteraction.showModal(other_modal_input());
                try {
                    const submit = await selectInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === selectInteraction.user.id,
                        time: 120_000
                    });

                    const subject = submit.fields.getTextInputValue("subject-input");
                    const description = "Your ticket will be addressed shortly. In the meantime, please share relevant details about your issue.";
                    await submit.deferReply({ flags: MessageFlags.Ephemeral });
                    try { // create the ticket
                        const ticketChannel = await create_ticket(
                            category,
                            {
                                subject: subject,
                                description: description,
                                member: selectInteraction.member as GuildMember,
                                guild: selectInteraction.guild as Guild,
                                ticketSupportRole: ticketSupportRole,
                                staffRole: staffRole
                            }
                        );
                        submit.editReply({
                            embeds: [embed_message("Green", `Your ticket is at ${ticketChannel}.`)]
                        });
                    } catch (error) {
                        await errorLogHandle(error);
                        await submit.editReply({
                            embeds: [embed_error("A problem occured while creating your ticket...")]
                        });
                    }

                } catch (error) {
                    console.error(error); // remove after dev
                    await selectInteraction.followUp({
                        embeds: [embed_interaction_expired()],
                        flags: MessageFlags.Ephemeral
                    });
                }
            } else {
                const selectedSubject = subjects
                    .find(s => s.id === Number(subjectId))! // it's guaranteed since the options were build from this array
                await selectInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                try {
                    const ticketChannel = await create_ticket(
                        category,
                        {
                            subject: selectedSubject.subject,
                            description: selectedSubject.description,
                            member: selectInteraction.member as GuildMember,
                            guild: selectInteraction.guild as Guild,
                            ticketSupportRole: ticketSupportRole,
                            staffRole: staffRole
                        }
                    );
                    await selectInteraction.editReply({
                        embeds: [embed_message("Green", `Your ticket is at ${ticketChannel}.`)]
                    });
                } catch (error) {
                    await errorLogHandle(error);
                    await selectInteraction.editReply({
                        embeds: [embed_error("A problem occured while creating your ticket...")]
                    });
                }
                collector.stop();
            }
        },
        async () => {
            try {
                await message.edit({ embeds: [embed_interaction_expired()] })
            } catch {/* do nothing */ }
        }
    )
}

/**
 * The interaction handler for when a member presses the "Open Ticket" button.
 * 
 * The collector of the ticket system manager interface.
 */
export async function open_ticket_collector(client: Client, guild: Guild, message: Message) {
    const cooldowns = new Collection<string, number>();
    const ticketCooldown = 120_000; // 2min

    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button
        },
        async (buttonInteraction) => {
            const userCooldown = has_cooldown(buttonInteraction.user.id, cooldowns, ticketCooldown);
            if (userCooldown) {
                await buttonInteraction.reply({
                    embeds: [
                        embed_message("Red", `You can open your next ticket <t:${userCooldown}:R>`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            cooldowns.set(buttonInteraction.user.id, timestampNow());
            setTimeout(() => cooldowns.delete(buttonInteraction.user.id));

            await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
            const ticketManager = await TicketSystemRepo.getManager(guild.id);
            if (ticketManager === null) {
                await buttonInteraction.editReply({
                    embeds: [embed_error("It seems like the ticket system configuration is missing...")]
                });
                collector.stop();
                return;
            }

            const category = await fetchGuildChannel(guild, ticketManager.category);
            if (!(category instanceof CategoryChannel)) {
                await buttonInteraction.editReply({
                    embeds: [embed_error("Failed to fetch the category of the ticket system...")]
                });
                collector.stop();
                return;
            }

            const ticketSupportRole = await fetchTicketSupportRole(client, guild);
            if (ticketSupportRole === null) {
                await buttonInteraction.editReply({
                    embeds: [embed_error("Failed to fetch the ticket support role...")]
                });
                collector.stop();
                return;
            }

            const staffRole = await fetchStaffRole(client, guild);
            if (staffRole === null) {
                await buttonInteraction.editReply({
                    embeds: [embed_error("Failed to fetch the staff role...")]
                });
                collector.stop();
                return;
            }

            // last check: if the user already has a ticket
            const memberOpenTicket = await TicketSystemRepo.getMemberTicket(guild.id, buttonInteraction.user.id);
            if (memberOpenTicket !== null) {
                await buttonInteraction.editReply({
                    embeds: [embed_message("Red", "You can not open more than one ticket at a time!")]
                });

                return;
            }

            const subjects = await TicketSystemRepo.getGuildSubjects(guild.id);
            await buttonInteraction.editReply({
                embeds: [embed_message("Aqua", "Select the subject of your ticket.")],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(ticket_subject_select(subjects))
                ]
            });

            const selectMenuReply = await buttonInteraction.fetchReply();
            await select_ticket_subject_collector(
                category,
                selectMenuReply,
                subjects,
                ticketSupportRole,
                staffRole
            );
        },
        async () => {
            console.log(`${guild.name} [${guild.id}] | Message ID [${message.id}] | Open Ticket Collector collector stopped`);
        }
    )
}