import {
    ActionRowBuilder,
    ComponentType,
    GuildMember,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { ticket_setup_builder } from "../../Systems/ticket_support/ticket_setup.js";
import { fetchStaffRole, handleModalCatch, message_collector } from "../../utility_modules/discord_helpers.js";
import TicketSystemRepo from "../../Repositories/ticketsystem.js";
import { ticket_subject_select } from "../../Systems/ticket_support/ticket_manager.js";

const subjectInput = new TextInputBuilder()
    .setCustomId("subject-input")
    .setMinLength(4)
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Common ticket subject...");
const subjectLabel = new LabelBuilder()
    .setLabel("Ticket Subject")
    .setTextInputComponent(subjectInput);

const descriptionInput = new TextInputBuilder()
    .setCustomId("description-input")
    .setMinLength(4)
    .setMaxLength(2048)
    .setPlaceholder("Guidelines to report the subject of the issue...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
const descriptionLabel = new LabelBuilder()
    .setLabel("Description")
    .setTextInputComponent(descriptionInput);

const ticketSystem: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("ticket-system")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Administrative commands for the ticket system.")
        .addSubcommand(subcommand =>
            subcommand.setName("setup")
                .setDescription("Set everything up in order for the ticket system to operate.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("subject")
                .setDescription("Manage ticket subjects.")

                .addSubcommand(subcommand =>
                    subcommand.setName("add")
                        .setDescription("Add a new subject members can pick when opening a ticket")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("remove")
                        .setDescription("Select the subject(s) you desire to remove.")
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "ticket",
        category: "Administrator"
    },
    async execute(interaction, client) {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const subcommandGroup = options.getSubcommandGroup();
        // interactionCreate doesn't guarantee the staff role for ticket commands
        const staffRole = await fetchStaffRole(client, guild);
        if (!staffRole) {
            await interaction.reply({
                embeds: [
                    embed_message("Red", "This action requires the STAFF role to be set as a server role.")
                ],
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        // the user is admin, no need to check for the staff role

        if (subcommandGroup === null && subcommand === "setup") {
            // setup the system by creating the necessary discord components
            await ticket_setup_builder(interaction, guild, admin, staffRole);
        }

        switch (subcommandGroup) {
            case "subject": {
                switch (subcommand) {
                    case "add": {
                        const modal = new ModalBuilder()
                            .setCustomId("new-subject-modal")
                            .setTitle("New Ticket Subject")
                            .addLabelComponents(subjectLabel, descriptionLabel);
                        await interaction.showModal(modal);
                        try {
                            const submit = await interaction.awaitModalSubmit({
                                filter: (i) => i.user.id === interaction.user.id,
                                time: 600_000
                            });

                            const subject = submit.fields.getTextInputValue("subject-input");
                            const description = submit.fields.getTextInputValue("description-input");

                            // register the new subject
                            await TicketSystemRepo.registerSubject({
                                guild: guild.id,
                                subject: subject,
                                description: description
                            });

                            await submit.reply({
                                embeds: [
                                    embed_message("Aqua", `**Description**:\n${description}`, `Subject created: ${subject}`)
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                        } catch (error) {
                            await handleModalCatch(error, interaction);
                        }
                        break;
                    }
                    case "remove": {
                        const ticketSubjectTable = await TicketSystemRepo.getGuildSubjects(guild.id);
                        await interaction.reply({
                            embeds: [
                                embed_message("Aqua", "Select the subjects to be deleted.")
                            ],
                            components: [
                                new ActionRowBuilder<StringSelectMenuBuilder>()
                                    .addComponents(
                                        ticket_subject_select(
                                            ticketSubjectTable,
                                            ticketSubjectTable.length,
                                            false
                                        )
                                    )
                            ]
                        });

                        const reply = await interaction.fetchReply();
                        const collector = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                time: 120_000,
                                filter: (i) => i.user.id === admin.id
                            },
                            async (selectInteraction) => {
                                const ids = [...selectInteraction.values];
                                await TicketSystemRepo.deleteSubjectsBulk(guild.id, ids);

                                await selectInteraction.reply({
                                    embeds: [embed_message("Green", "Deletion executed.")],
                                    flags: MessageFlags.Ephemeral
                                });

                                collector.stop();
                            },
                            async () => {
                                if (reply.deletable) {
                                    try {
                                        await reply.delete();
                                    } catch {/* do nothing */ }
                                }
                            }
                        )

                        break;
                    }
                }
                break;
            }
        }



    }
}

export default ticketSystem;