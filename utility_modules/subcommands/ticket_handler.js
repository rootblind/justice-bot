const {EmbedBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, ModalBuilder,
    ComponentType,
    Collection,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("graceful-fs")
const { hasCooldown } = require("../utility_methods");
const { poolConnection } = require("../kayle-db");
const path = require("path");

async function fetch_ticket(channel) {
    let messages = [];
    let batch = 0;
    let lastID = channel.lastMessageId;

    while(true) {
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            ...(lastID && {before: lastID})
        });

        if(fetchedMessages.size === 0 || batch >= 50_000) {
            messages = messages.reverse();
            messages = messages.filter(msg => !msg.author.bot);
            return messages
        }

        batch += fetchedMessages.size;
        messages = messages.concat(Array.from(fetchedMessages.values()));
        lastID = fetchedMessages.lastKey();
    }
}

async function create_ticket(context, category, logs) {
    const conclusionTextInput = new TextInputBuilder()
        .setCustomId("conclusion-input")
        .setLabel("The conclusion of the ticket")
        .setPlaceholder("The reason for closing the ticket")
        .setMinLength(4)
        .setMaxLength(512)
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)

    const conclusionActionRow = new ActionRowBuilder()
        .addComponents(conclusionTextInput)

    const conclusionModal = new ModalBuilder()
        .setCustomId("conclusion-modal")
        .setTitle("Close ticket")
        .addComponents(conclusionActionRow);

    const ticket = await context.guild.channels.create({
        name: `ticket-${context.member.user.username}`,
        parent: category,
        permissionOverwrites: [
            {
                id: context.member.id,
                allow: [
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ViewChannel
                ]
            },
            {
                id: context.staffRole.id,
                allow: [
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ViewChannel
                ]
            },
            {
                id: context.guild.roles.everyone.id,
                deny: [
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ViewChannel
                ]
            }
        ]
    });

    const claimButton = new ButtonBuilder()
        .setCustomId("claim-button")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)

    const closeTicketButton = new ButtonBuilder()
        .setCustomId("close-button")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)

    const ticketActionRow = new ActionRowBuilder()
        .addComponents(claimButton, closeTicketButton);

    await ticket.send({
        content: `${context.pingRole} ${context.member}`,
        embeds: [
            new EmbedBuilder()
                .setColor("Aqua")
                .setAuthor({
                    name: `${context.member.user.username} ticket`,
                    iconURL: context.member.displayAvatarURL({extension: "png"})
                })
                .setTitle(context.subject)
                .setDescription(`**Notice:**\n${context.description}`)
        ]
    });

    const ticketMessage = await ticket.send({
        embeds: [
            new EmbedBuilder()
                .setColor("Aqua")
                .setTitle("Staff members have been notified of your ticket.")
        ],
        components: [ ticketActionRow ]
    });

    await logs.send({
        embeds: [
            new EmbedBuilder()
                .setColor("Aqua")
                .setAuthor({
                    name: `${context.member.user.username} opened a ticket`,
                    iconURL: context.member.displayAvatarURL({extension: "png"})
                })
                .setFields(
                    {
                        name: "Subject",
                        value: context.subject
                    },
                    {
                        name: "Member",
                        value: `${context.member}`
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${context.member.id}`})
        ]
    });

    const ticketCollector = ticketMessage.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: (i) => i.member.roles.cache.has(context.staffRole.id)
    });

    ticketCollector.on("collect", async (buttonInteraction) => {
        if(!buttonInteraction.isButton()) return;
        
        switch(buttonInteraction.customId) {
            case "claim-button":
                await ticket.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Aqua")
                            .setTitle("Ticket claimed")
                            .setDescription(`${buttonInteraction.member} claimed your ticket and will help you with your issues.`)
                    ],
                    content: `${context.member}`
                });

                claimButton.setDisabled(true);

                await ticketMessage.edit({
                    components: [ ticketActionRow ]
                });

                await logs.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Green")
                            .setAuthor({
                                name: `${buttonInteraction.user.username} claimed a ticket`,
                                iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                            })
                            .setTitle("Ticket Claimed")
                            .setFields(
                                {
                                    name: "Moderator",
                                    value: `${buttonInteraction.member}`
                                },
                                {
                                    name: "Member",
                                    value: `${context.member}`
                                },
                                {
                                    name: "Subject",
                                    value: `${context.subject}`
                                }
                            )
                            .setTimestamp()
                            .setFooter({text: `Moderator: ${buttonInteraction.user.id}`})
                    ]
                });

                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "Ticket claimed."
                });
            break;
            case "close-button":
                await buttonInteraction.showModal(conclusionModal);
                try{
                    const submit = await buttonInteraction.awaitModalSubmit({
                        time: 120_000,
                        filter: (i) => i.user.id === buttonInteraction.user.id
                    });
                    
                    await submit.deferReply({flags: MessageFlags.Ephemeral});

                    const reason = submit.fields.getTextInputValue("conclusion-input");

                    let stringlogs = "";
                    let files = [];
                    const ticketMessages = await fetch_ticket(ticket);
                    for(const msg of ticketMessages) {
                        stringlogs +=
                            `\n${msg.author.username} [${msg.createdAt}] : ${msg.content}`;
                        
                        if(msg.attachments.size > 0) {
                            await msg.attachments.forEach(a => {
                                stringlogs += `\n[${a.name}]`
                            });
                        }
                    }

                    const tempFile = path.join(__dirname, `../../temp/${ticket.id}.txt`);
                    if(stringlogs.length) {
                        fs.writeFile(tempFile, stringlogs, (err) => {
                            if(err)
                                console.error(err)
                        });
                        files.push(tempFile);
                    }
                    
                    await logs.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setAuthor({
                                    name: `${buttonInteraction.user.username} closed a ticket`,
                                    iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                                })
                                .setTitle("Ticket Closed")
                                .setFields(
                                    {
                                        name: "Moderator",
                                        value: `${buttonInteraction.member}`
                                    },
                                    {
                                        name: "Member",
                                        value: `${context.member}`
                                    },
                                    {
                                        name: "Subject",
                                        value: context.subject
                                    },
                                    {
                                        name: "Conclusion",
                                        value: reason
                                    }
                                )
                                .setTimestamp()
                                .setFooter({text: `Moderator: ${buttonInteraction.user.id}`})
                        ],
                        files: files
                    });

                    if(files.length) {
                        fs.unlink(tempFile, (err) => {
                            if(err) throw err;
                        });
                    }
                    

                    await ticket.delete();


                } catch(err) {
                    console.error(err);
                    await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Timed out, try again."
                    });
                }
            break;
        }
    })
}

async function open_ticket_collector(message) {
    const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
        [message.guild.id]
    );
    
    let staffRole = null;
    try{
        staffRole = await message.guild.roles.fetch(staffRoleData[0].role);
    } catch(err) {
        console.error(err);
    }

    const {rows: ticketRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='ticket-support'`,
        [message.guild.id]
    );

    let ticketSupportRole = null;
    try{
        ticketSupportRole = await message.guild.roles.fetch(ticketRoleData[0].role);
    } catch(err) {
        console.error(err);
    }

    const {rows: ticketCategoryData} = await poolConnection.query(`SELECT category FROM ticketmanager WHERE guild=$1`,
        [message.guild.id]
    );

    let category = null;
    try {
        category = await message.guild.channels.fetch(ticketCategoryData[0].category);
    } catch(err) {
        console.error(err);
    }

    const {rows: ticketLogsData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype='ticket-support'`,
        [message.guild.id]
    );

    let ticketLogs = null;
    try{
        ticketLogs = await message.guild.channels.fetch(ticketLogsData[0].channel);
    } catch(err) {
        console.error(err);
    }

    let subject = null;
    let description = null;
    const subjectInput = new TextInputBuilder()
        .setCustomId("subject-input")
        .setLabel("Ticket Subject")
        .setPlaceholder("Your issue/question")
        .setMaxLength(100)
        .setMinLength(4)
        .setRequired(true)
        .setStyle(TextInputStyle.Short)

    const subjectActionRow = new ActionRowBuilder().addComponents(subjectInput)

    const subjectModal = new ModalBuilder()
        .setCustomId("subject-modal")
        .setTitle("Ticket Subject")
        .addComponents(subjectActionRow)

    const collector = message.createMessageComponentCollector({
        ComponentType: ComponentType.Button
    });

    const ticketCooldowns = new Collection();
    const cooldown = 600_000;

    collector.on("collect", async (buttonInteraction) => {
        if(!buttonInteraction.isButton()) return;

        const userCooldown = hasCooldown(buttonInteraction.user.id, ticketCooldowns, cooldown);

        if(userCooldown) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `Opening a ticket is on cooldown: <t:${parseInt(userCooldown / 1000)}:R>`
            });
        }

        ticketCooldowns.set(buttonInteraction.user.id, Date.now());
        setTimeout(() => ticketCooldowns.delete(buttonInteraction.user.id), cooldown);

        if(buttonInteraction.customId === "open-ticket") {
            // when opening a ticket, a subject must be provided
            // the member can select some preset subjects or type his own

            const reply = await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});
            const fetchedReply = await buttonInteraction.fetchReply();

            const selectSubjectOptions = [];

            const {rows: subjectData} = await poolConnection.query(`SELECT * FROM ticketsubject WHERE guild=$1`,
                [buttonInteraction.guild.id]
            );
            
            if(subjectData.length) {
                subjectData.forEach((row) => {
                    selectSubjectOptions.push(
                        {
                            label: row.subject,
                            value: `${row.id}`,
                            description: "Ticket Support Subject"
                        }
                    )
                });
            }

            selectSubjectOptions.push(
                {
                    label: "Other",
                    value: "other",
                    description: "Specify your ticket subject"
                }
            );

            const selectSubject = new StringSelectMenuBuilder()
                .setCustomId("select-subject")
                .setPlaceholder("What do you need help with?")
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(selectSubjectOptions)

            const selectSubjectActionRow = new ActionRowBuilder()
                .addComponents(selectSubject);

            await reply.edit({
                components: [ selectSubjectActionRow ]
            });

            const selectCollector = fetchedReply.createMessageComponentCollector({
                time: 600_000,
                ComponentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === buttonInteraction.user.id
            });

            selectCollector.on("collect", async (selectInteraction) => {
                if(!selectInteraction.isStringSelectMenu()) return;

                if(selectInteraction.customId === "select-subject") {
                    const value = selectInteraction.values[0];
                    if(value == "other") {
                        await selectInteraction.showModal(subjectModal);
                        try{
                            const submitSubject = await selectInteraction.awaitModalSubmit({
                                time: 600_000,
                                filter: (i) => i.user.id === selectInteraction.user.id
                            });

                            subject = submitSubject.fields.getTextInputValue("subject-input");
                            description = `Your ticket will be addressed shortly. In the meantime, please share relevant details about your issue.`
                            await submitSubject.reply({
                                flags: MessageFlags.Ephemeral,
                                content: `Ticket subject set to ${subject}`
                            });
                        } catch (err) {
                            console.error(err);
                            await selectInteraction.followUp({
                                flags: MessageFlags.Ephemeral,
                                content: "Timed out, try again!"
                            });
                        }
                    } else {
                        const id = Number(value);
                        const {rows: selectSubjectData} = await poolConnection.query(`SELECT * FROM ticketsubject WHERE id=$1`, [id]);
                        subject = selectSubjectData[0].subject;
                        description = selectSubjectData[0].description;
                    }

                    if(subject)
                        try{
                            await reply.delete();
                        } catch(err) {};
                        await create_ticket(
                            {
                                subject: subject,
                                description: description,
                                member: selectInteraction.member,
                                guild: selectInteraction.guild,
                                pingRole: ticketSupportRole,
                                staffRole: staffRole
                            },
                            category,
                            ticketLogs

                        );
                }
            });
        }
    })
}

module.exports = {
    open_ticket_collector
}