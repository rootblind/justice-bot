/*
    ticket-admin setup: creates a ticket support role that will be pinged and be given access to accept and manage tickets
        a category where the ticket menu will be located and where closed tickets will be logged
*/

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
     ComponentType, ChannelType, MessageFlags, TextInputBuilder, TextInputStyle, ModalBuilder, StringSelectMenuBuilder
    } = require("discord.js");
const { poolConnection } = require("../../utility_modules/kayle-db.js");
const { remove } = require("winston");
const { open_ticket_collector } = require("../../utility_modules/subcommands/ticket_handler.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ticket-admin")
        .setDescription("Administrative commands for support tickets.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("setup")
                .setDescription("Set everything up in order for the ticket system to operate.")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("add-subject")
                .setDescription("Add a new subject members can pick when opening a ticket")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove-subject")
                .setDescription("Select the subject(s) you desire to remove.")
        )
    ,
    async execute(interaction, client) {
        const cmd = interaction.options.getSubcommand();

        const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
            [interaction.guild.id]
        );

        if(staffRoleData.length == 0) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You need to set up a staff server role before doing this!"
            });
        }

        let staffRole = null;

        try {
            staffRole = await interaction.guild.roles.fetch(staffRoleData[0].role);
        } catch(err) {
            console.error(`${staffRoleData[0].role}\n${err}`);
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "Something went wrong with fetching the staff role, try setting it up again."
            });
        }

        switch(cmd) {
            case "setup":
                const confirmButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Success)
                    .setCustomId("confirm-button")
                    .setLabel("Confirm")

                const setupActionRow = new ActionRowBuilder()
                    .addComponents(confirmButton)

                const setupMessage = await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Green")
                            .setTitle("Ticket Support Setup")
                            .setDescription("By pressing the confirmation button, a new ticket support role and channels will be created.\nPrevious configuration will be lost if any.")
                    ],
                    components: [ setupActionRow ]
                });

                const setupCollector = setupMessage.createMessageComponentCollector({
                    filter: (i) => i.user.id === interaction.user.id,
                    time: 120_000,
                    ComponentType: ComponentType.Button 
                });

                setupCollector.on("collect", async (buttonInteraction) => {
                    if(!buttonInteraction.isButton()) return;

                    if(buttonInteraction.customId === "confirm-button") {
                        await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});
                        
                        // first thing, clear database tables
                        await poolConnection.query(`DELETE FROM ticketmanager WHERE guild=$1`, [buttonInteraction.guild.id]);
                        await poolConnection.query(`DELETE FROM serverroles WHERE guild=$1 AND roletype='ticket-support'`, [buttonInteraction.guild.id]);

                        const {rows: ticketlogsData} = await poolConnection.query(`SELECT channel FROM serverlogs
                            WHERE guild=$1 AND eventtype='ticket-support'`, [buttonInteraction.guild.id]);

                        if(ticketlogsData.length )
                        await poolConnection.query(`DELETE FROM serverlogs WHERE guild=$1 AND eventtype='ticket-support'`, [buttonInteraction.guild.id]);

                        // creating the ticket support role
                        const ticketSupportRole = await buttonInteraction.guild.roles.create({
                            name: "Ticket Support",
                            position: staffRole.position - 1

                        });

                        await poolConnection.query(`INSERT INTO serverroles(guild, roletype, role)
                            VALUES($1, $2, $3)`, [buttonInteraction.guild.id, "ticket-support", ticketSupportRole.id]);
                        

                        // creating channels
                        const category = await buttonInteraction.guild.channels.create({
                            name: "Ticket Support",
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: [
                                {
                                    id: buttonInteraction.guild.roles.everyone.id,
                                    deny: [
                                        PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions,
                                        PermissionFlagsBits.Connect
                                    ]
                                }
                            ]
                        });

                        const ticketLogs = await buttonInteraction.guild.channels.create({
                            name: "ticket-logs",
                            type: ChannelType.GuildText,
                            parent: category,
                            permissionOverwrites: [
                                {
                                    id: buttonInteraction.guild.roles.everyone.id,
                                    deny: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.ManageMessages
                                    ]
                                },
                                {
                                    id: staffRole.id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.AddReactions,
                                        PermissionFlagsBits.Connect
                                    ]
                                },
                                {
                                    id: ticketSupportRole.id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.AddReactions,
                                        PermissionFlagsBits.Connect
                                    ]
                                }
                            ]
                        });

                        // logs are handled differently
                        await poolConnection.query(`INSERT INTO serverlogs (guild, channel, eventtype)
                            VALUES($1, $2, $3)`,
                            [buttonInteraction.guild.id, ticketLogs.id, "ticket-support"]
                        );
                        
                        await poolConnection.query(`INSERT INTO serverlogsignore (guild, channel) VALUES($1, $2)`,
                            [buttonInteraction.guild.id, ticketLogs.id]
                        );

                        const ticketManager = await buttonInteraction.guild.channels.create({
                            name: "open-ticket",
                            type: ChannelType.GuildText,
                            parent: category
                        });

                        await ticketManager.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("Aqua")
                                    .setTitle("Before you open a ticket")
                                    .setDescription(
                                        `The ticket system must be used for strictly for moderation issues, server or bot related problems or for questions that are not already answered in the informational channels already.
                                        Please avoid opening tickets for no reason!
                                        
                                        **You may want to open a ticket for:**
                                        Someone breaking the rules or having inappropiate behavior
                                        One of the systems is not working properly
                                        You have a question about something that is not already explained on the informational channels
                                        You have a special request that needs the staff's attention.
                                        
                                        **You may want to refrain opening a ticket for:**
                                        Testing the system
                                        Casual chit-chat
                                        Commonly asked questions
                                        
                                        **How to report:**
                                        You don't have to wait for someone to claim the ticket, start by describing the situation you're reporting.
                                        Give details about whom you're reporting and what they did wrong.
                                        Post any proof you have, like screenshots or recordings.
                                        Even if you don't have proof, you can report a member just to notify the staff about their behavior.
                                        `
                                    )
                            ]
                        });

                        const openTicketButton = new ButtonBuilder()
                            .setLabel("Open Ticket")
                            .setStyle(ButtonStyle.Success)
                            .setCustomId("open-ticket")

                        const openTicketActionRow = new ActionRowBuilder()
                            .addComponents(openTicketButton)

                        const ticketSupportMessage = await ticketManager.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("Aqua")
                                    .setTitle("Open ticket")
                                    .setDescription("Clicking the button will require you to pick a subject before the ticket is created.")
                            ],
                            components: [ openTicketActionRow ]
                        });

                        await poolConnection.query(`INSERT INTO ticketmanager(guild, category, channel, message)
                            VALUES($1, $2, $3, $4)`,
                            [buttonInteraction.guild.id, category.id, ticketManager.id, ticketSupportMessage.id]
                        );
                        
                        await open_ticket_collector(ticketSupportMessage);
                        
                        await buttonInteraction.editReply({
                            content: "Ticket support system is now set up!"
                        });

                        setupCollector.stop();
                    }
                });

                setupCollector.on("end", async () => {
                    try {
                        await setupMessage.delete();
                    } catch(err) {};
                });
            break;
            case "add-subject":
                const subjectTextInput = new TextInputBuilder()
                    .setCustomId("subject")
                    .setLabel("Subject")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("A common reason for people to open tickets...")
                    .setMinLength(4)
                    .setMaxLength(100)
                    .setRequired(true)

                const descriptionTextInput = new TextInputBuilder()
                    .setCustomId("description")
                    .setLabel("Description")
                    .setPlaceholder("Guidelines to effectively report the issue...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(4)
                    .setMaxLength(2048)
                    .setRequired(true)

                const addSubjectActionRow = new ActionRowBuilder()
                    .addComponents(subjectTextInput)
                const addDescriptionActionRow = new ActionRowBuilder()
                    .addComponents(descriptionTextInput);

                const addSubjectModal = new ModalBuilder()
                    .setCustomId("add-subject-modal")
                    .setTitle("New Ticket Subject")
                    .addComponents(addSubjectActionRow, addDescriptionActionRow);

                await interaction.showModal(addSubjectModal);

                try{
                    const submit = await interaction.awaitModalSubmit({
                        filter: (i) => i.user.id === interaction.user.id,
                        time: 600_000
                    });
                    
                    const subject = submit.fields.getTextInputValue("subject");
                    const description = submit.fields.getTextInputValue("description");

                    await submit.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Purple")
                                .setTitle(`Subject: ${subject}`)
                                .setDescription(`**Description:**\n${description}`)
                        ]
                    });

                    await poolConnection.query(`INSERT INTO ticketsubject(guild, subject, description)
                        VALUES($1, $2, $3)`,
                        [interaction.guild.id, subject, description]
                    );
                } catch(err) {
                    await interaction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Timed out, try again."
                    });
                }
            break;
            case "remove-subject":
                const removeMessage = await interaction.deferReply({flags: MessageFlags.Ephemeral});
                const fetchedReply = await interaction.fetchReply();

                const {rows: subjectData} = await poolConnection.query(`SELECT * FROM ticketsubject WHERE guild=$1`, [interaction.guild.id]);

                if(subjectData.length == 0) {
                    return await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setTitle("No ticket subject")
                                .setDescription("The ticket subject list is empty, there is nothing to be removed.")
                        ]
                    });
                }

                const selectSubjectOptions = []

                subjectData.forEach((row) => {
                    selectSubjectOptions.push(
                        {
                            label: row.subject,
                            value: `${row.id}`,
                            description: "Ticket Subject"
                        }
                    )
                });

                const selectSubjectMenu = new StringSelectMenuBuilder()
                    .setCustomId("select-subject")
                    .setPlaceholder("The subject(s) to be removed...")
                    .setMinValues(1)
                    .setMaxValues(subjectData.length)
                    .addOptions(selectSubjectOptions)
                
                const selectSubjectActionRow = new ActionRowBuilder()
                    .addComponents(selectSubjectMenu);

                await removeMessage.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Aqua')
                            .setTitle("Select the subjects you want to be permanently removed")
                    ],
                    components: [ selectSubjectActionRow ]
                });

                const removeCollector = fetchedReply.createMessageComponentCollector({
                    time: 120_000,
                    filter: (i) => i.user.id === interaction.user.id,
                    ComponentType: ComponentType.StringSelect
                });

                removeCollector.on("collect", async (selectInteraction) => {
                    if(!selectInteraction.isStringSelectMenu) return;
                    await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});
                    if(selectInteraction.customId === "select-subject") {
                        for(const id of selectInteraction.values) {
                            await poolConnection.query(`DELETE FROM ticketsubject WHERE guild=$1 AND id=$2`,
                                [selectInteraction.guild.id, Number(id)]
                            );
                        }

                        await selectInteraction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("Green")
                                    .setDescription("Selected subjects have been removed")
                            ]
                        });
                    }
                });

                removeCollector.on("end", async () => {
                    try{
                        await removeMessage.delete();
                    } catch(err) {};
                });

            break;
        }
    }
}