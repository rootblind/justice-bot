/*
    Administrators and above can give strikes to staff members that are doing something bad
    strikes are the warnings for staff members
    if a staff member gains too many strikes, they will be downgraded or even removed
 */

const {SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, StringSelectMenuBuilder} = require("discord.js");
const {poolConnection} = require("../../utility_modules/kayle-db.js");
const { duration_timestamp } = require("../../utility_modules/utility_methods.js");
const {strike_handler} = require("../../utility_modules/strike_handler.js");

const durationRegex = /^(\d+)([d,w,y])$/;

module.exports = {
    cooldown: 5,
    botPermissions: [PermissionFlagsBits.Administrator],
    data: new SlashCommandBuilder()
        .setName("strike")
        .setDescription("Strike one of your staff members.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("apply")
                .setDescription("Apply a strike to a staff member.")
                .addUserOption(option =>
                    option.setName("staff")
                        .setDescription("The staff member to apply the strike to.")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("duration")
                        .setDescription("The duration of the strike.")
                        .setRequired(true)
                        .setMaxLength(3)
                        .setMinLength(2)
                )
                .addStringOption(option =>
                    option.setName("reason")
                        .setDescription("The reason of the strike.")
                        .setRequired(true)
                        .setMinLength(4)
                        .setMaxLength(200)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setDescription("List the strikes of a staff member")
                .addUserOption(option =>
                    option.setName("staff")
                        .setDescription("The staff member")
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const cmd = interaction.options.getSubcommand();

        // checking if all requirements are met when running the command
        const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
            [interaction.guild.id]
        );

        if(staffRoleData.length == 0) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "No staff role found on this server, configure use using `/server-role`."
            });
        }

        let staffRole = null;
        try {
            staffRole = await interaction.guild.roles.fetch(staffRoleData[0].role);
        } catch(err) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "The staff role is not configured properly, set ip up again."
            });
        }

        // checking if target member is eligible for strike
        const staffUser = interaction.options.getUser("staff");
        let staffMember = null;

        try{
            staffMember = await interaction.guild.members.fetch(staffUser);
        } catch(err) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "Invalid user input!"
            });
        }

        if(!staffMember.roles.cache.has(staffRole.id)) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "This command can only target staff members."
            });
        }

        // fetching client member object for filter
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);

        //trying to fetch logs
        const {rows: logsData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype='moderation'`,
            [interaction.guild.id]
        );

        let logChannel = null;
        if(logsData.length) {
            try{
                logChannel = await interaction.guild.channels.fetch(logsData[0].channel);
            } catch(err) {/* in case the log channel no longer exists */};
        }

        const reply = await interaction.deferReply({});
        const fetchedReply = await interaction.fetchReply();

        switch(cmd) {
            case "apply":
                // checking if the user has permission to apply strike the target
                if(staffMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    // admins can not strike another one of the same position
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("Lack of permission")
                                .setDescription(`You lack the permission to strike ${staffMember}`)
                        ]
                    });
                }

                if(botMember.roles.highest.position <= staffMember.roles.highest.position) {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("Lack of permission")
                                .setDescription(`${staffMember} has roles above mine, therefore is immune to strikes!`)
                        ]
                    });
                }

                const duration = interaction.options.getString("duration");
                const reason = interaction.options.getString("reason");

                if(!durationRegex.test(duration)) {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setTitle('Invalid input!')
                                .setDescription('The duration format is invalid.\n Provide a duration that respects the format: <number: 1-99>< d | w | y >')
                        ]
                    });
                }

                const expiresTimestamp = duration_timestamp(duration);

                // register strike
                await poolConnection.query(`INSERT INTO staffstrike (guild, striked, striker, reason, expires)
                    VALUES($1, $2, $3, $4, $5)`,
                    [interaction.guild.id, staffMember.id, interaction.user.id, reason, expiresTimestamp]
                );

                await strike_handler(staffMember);

                const cancelButton = new ButtonBuilder()
                    .setCustomId("cancel-button")
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Cancel")

                const buttonActionRow = new ActionRowBuilder()
                    .addComponents(cancelButton)

                const strikeEmbed = new EmbedBuilder()
                            .setColor("Red")
                            .setAuthor({
                                name: `${staffMember.user.username} got a strike`,
                                iconURL: staffMember.displayAvatarURL({extension: "png"})
                            })
                            .addFields(
                                {
                                    name: "Striker",
                                    value: `${interaction.member}`
                                },
                                {
                                    name: "Striked",
                                    value: `${staffMember}`
                                },
                                {
                                    name: "Expires",
                                    value: `<t:${expiresTimestamp}:R>`
                                },
                                {
                                    name: "Reason",
                                    value: reason
                                }
                            )
                            .setTimestamp()
                            .setFooter({text: `ID: ${staffMember.id}`})

                await interaction.editReply({
                    embeds: [ strikeEmbed ],
                    components: [ buttonActionRow ]
                });

                if(logChannel) {
                    await logChannel.send({
                        embeds: [ strikeEmbed ]
                    });
                }

                const cancelStrikeCollector = reply.createMessageComponentCollector({
                    filter: (i) => i.user.id === interaction.user.id,
                    time: 300_000,
                    ComponentType: ComponentType.Button
                });

                cancelStrikeCollector.on("collect", async (buttonInteraction) => {
                    if(!buttonInteraction.isButton()) return;

                    await poolConnection.query(`DELETE FROM staffstrike
                        WHERE guild=$1 AND striked=$2 AND striker=$3 AND expires=$4`,
                        [interaction.guild.id, staffMember.id, buttonInteraction.user.id, expiresTimestamp]
                    );

                    const cancelStrikeEmbed = new EmbedBuilder()
                                .setColor("Green")
                                .setAuthor({
                                    name: `${buttonInteraction.user.username} cancelled a strike`,
                                    iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                                })
                                .addFields(
                                    {
                                        name: "Striker",
                                        value: `${buttonInteraction.member}`
                                    },
                                    {
                                        name: "Striked",
                                        value: `${staffMember}`
                                    },
                                    {
                                        name: "Expires",
                                        value: "Cancelled"
                                    }
                                )
                                .setTimestamp()
                                .setFooter({text: `Striker ID: ${buttonInteraction.user.id}`})

                    await buttonInteraction.reply({
                        embeds: [ cancelStrikeEmbed ]
                    });

                    if(logChannel) {
                        await logChannel.send({
                            embeds: [ cancelStrikeEmbed ]
                        });
                    }

                    cancelStrikeCollector.stop();
                });

                cancelStrikeCollector.on("end", async () => {
                    try{
                        cancelButton.setDisabled(true);
                        await reply.edit({
                            components: [buttonActionRow]
                        });
                    } catch(err) {};
                });
            break;
            case "list":
                // fetching data
                const {rows: staffStrikeData} = await poolConnection.query(`SELECT * FROM staffstrike
                    WHERE guild=$1 AND striked=$2 ORDER BY expires DESC`,
                    [interaction.guild.id, staffMember.id]
                );

                const embedList = new EmbedBuilder()
                    .setColor("Purple")
                    .setAuthor({
                        name: `${staffMember.user.username}'s strike list`,
                        iconURL: staffMember.displayAvatarURL({extension: "png"})
                    });

                if(staffStrikeData.length == 0) {
                    return await interaction.editReply({
                        embeds: [
                            embedList.setDescription(`This list is empty!\n${staffMember} is well behaved!`)
                        ]
                    });
                }

                const {rows: strikeRuleData} = await poolConnection.query(`SELECT * FROM strikerule 
                    WHERE guild=$1 AND strikecount > $2
                    ORDER BY strikecount ASC
                    LIMIT 1`,
                    [interaction.guild.id, staffStrikeData.length]);

                if(strikeRuleData.length) {
                    embedList.setDescription(`Next rule strikes: \`${staffStrikeData.length} / ${strikeRuleData[0].strikecount}\`
                        Punishment: ${strikeRuleData[0].punishment}`);
                }

                for(const row of staffStrikeData) {
                    const strikerMember = await interaction.guild.members.fetch(row.striker);
                    embedList.addFields(
                        {
                            name: `ID [${row.id}]`,
                            value: `**Expires**\n<t:${row.expires}:R>
                            **Striker**\n${strikerMember}
                            **Reason**\n${row.reason}`
                        }
                    )
                }

                const clearButton = new ButtonBuilder()
                    .setCustomId("clear-button")
                    .setLabel("Clear list")
                    .setStyle(ButtonStyle.Danger)

                const removeButton = new ButtonBuilder()
                    .setCustomId("remove-button")
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Remove Strike")

                const clearRemoveActionRow = new ActionRowBuilder()
                    .addComponents(clearButton, removeButton)

                await interaction.editReply({
                    embeds: [
                        embedList
                    ],
                    components: [ clearRemoveActionRow ]
                });

                const listCollector = reply.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    time: 300_000,
                    filter: (i) => i.member.roles.highest.position > botMember.roles.highest.position // only staff members above the bot can remove strikes
                });

                const selectCollector = fetchedReply.createMessageComponentCollector({
                    ComponentType: ComponentType.StringSelect,
                    time: 300_000,
                    filter: (i) => i.member.roles.highest.position > botMember.roles.highest.position
                });

                listCollector.on("collect", async (buttonInteraction) => {
                    if(!buttonInteraction.isButton()) return;
                    await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

                    if(buttonInteraction.customId === "clear-button") {
                        await poolConnection.query(`DELETE FROM staffstrike WHERE guild=$1 AND striked=$2`,
                            [buttonInteraction.guild.id, staffMember.id]
                        );

                        await reply.edit({
                            embeds: [
                                embedList.setDescription(`This list is empty!\n${staffMember} is well behaved!`)
                                    .setFields([])
                            ],
                            components: []
                        });

                        await buttonInteraction.editReply({
                            content: "The list was cleared."
                        });
                    } else if(buttonInteraction.customId === "remove-button") {
                        const {rows: strikeData} = await poolConnection.query(`SELECT id FROM staffstrike
                            WHERE guild=$1 AND striked=$2 ORDER BY expires DESC`,
                            [buttonInteraction.guild.id, staffMember.id]
                        );

                        const selectOptions = [];
                        for(const row of strikeData) {
                            selectOptions.push(
                                {
                                    label: `${row.id}`,
                                    description: `Remove the strike with the id ${row.id}`,
                                    value: `${row.id}`
                                }
                            )
                        }

                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId("select-remove")
                            .setPlaceholder("Select the strikes you want to remove")
                            .setMinValues(1)
                            .setMaxValues(strikeData.length)
                            .addOptions( selectOptions );

                        const selectActionRow = new ActionRowBuilder()
                            .addComponents(selectMenu);

                        await reply.edit({components: [selectActionRow]});
                        await buttonInteraction.editReply({content: "Select the strike id(s) you want removed."});
                    }
                });

                selectCollector.on("collect", async (selectInteraction) => {
                    if(!selectInteraction.isStringSelectMenu()) return;

                    await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});

                    if(selectInteraction.customId === "select-remove") {
                        for(const id of selectInteraction.values) {
                            await poolConnection.query(`DELETE FROM staffstrike WHERE guild=$1 AND id=$2`,
                                [selectInteraction.guild.id, Number(id)]
                            );
                        }

                        const {rows: strikeData} = await poolConnection.query(`SELECT * FROM staffstrike
                            WHERE guild=$1 AND striked=$2 ORDER BY expires DESC`,
                            [selectInteraction.guild.id, staffMember.id]
                        );

                        const {rows: ruleData} = await poolConnection.query(`SELECT * FROM strikerule 
                            WHERE guild=$1 AND strikecount > $2
                            ORDER BY strikecount ASC
                            LIMIT 1`,
                            [interaction.guild.id, strikeData.length]);

                        const embed = new EmbedBuilder()
                            .setColor("Purple")
                            .setAuthor({
                                name: `${staffMember.user.username}'s strike list`,
                                iconURL: staffMember.displayAvatarURL({extension: "png"})
                            });

                        const comp = [];

                        if(strikeData.length == 0) {
                            embed.setDescription(`This list is empty!\n${staffMember} is well behaved!`);
                        } else {
                            comp.push(clearRemoveActionRow);
                            embed.setDescription(`Next rule strikes: \`${strikeData.length} / ${ruleData[0].strikecount}\`
                                Punishment: ${ruleData[0].punishment}`);

                            for(const row of strikeData) {
                                const strikerMember = await interaction.guild.members.fetch(row.striker);
                                embed.addFields(
                                    {
                                        name: `ID [${row.id}]`,
                                        value: `**Expires**\n<t:${row.expires}:R>
                                        **Striker**\n${strikerMember}
                                        **Reason**\n${row.reason}`
                                    }
                                )
                            }
                        }

                        await reply.edit({
                            embeds: [embed],
                            components: comp
                        });

                        await selectInteraction.editReply({
                            content: `The following id(s) were removed: \`${selectInteraction.values.join(", ")}\``
                        });
                    }
                })

                listCollector.on("end", async () => {
                    try{
                        await reply.edit({components: []});
                        selectCollector.stop();
                    } catch(err) {};
                });
            break;
        }

        
    }
}