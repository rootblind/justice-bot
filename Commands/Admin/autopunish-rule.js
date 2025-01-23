const {SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle,
    ComponentType, ActionRowBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {convert_seconds_to_units} = require('../../utility_modules/utility_methods.js');
const durationRegex = /^(\d+)([m,h,d,w,y])$/;

function duration_to_seconds(durationString) {
    const match = durationString.match(durationRegex);
    if(match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const Unit = {
            "m": 60,
            "h": 3600,
            "d": 86400,
            "w": 604800,
            "y": 31556926
        }
        return value * Unit[unit];
    } else {
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autopunish-rule')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('Manage auto punishment rules.')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a new rule. Rules are unique based on warn count and duration pair.')
                .addNumberOption(option => 
                    option.setName('warncount')
                        .setDescription('The number of warnings within the duration to trigger the rule')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The duration of the warns counted to the rule.')
                        .setMinLength(2)
                        .setMaxLength(3)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('punishment-type')
                        .setDescription('The type of punishment to be applied if the rule is triggered.')
                        .addChoices(
                            {
                                name: "Time out",
                                value: "timeout"
                            },
                            {
                                name: "Ban",
                                value: "ban"
                            }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('punishment-duration')
                        .setDescription('The duration of the punishment. Bans can be set to 0 for indefinite ban.')
                        .setMaxLength(3)
                        .setMinLength(1)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all active auto punish rules.')
        )

    ,async execute(interaction, client) {
        const punishmentDict = {
            1: "timeout",
            2: "tempban",
            3: "indefinite ban"
        }
        await interaction.deferReply();
        const cmd = interaction.options.getSubcommand();

        let logChannel = null;

        const {rows: logchannelData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE eventtype=$1 AND guild=$2`,
            ["moderation", interaction.guild.id]
        );

        if(logchannelData.length > 0)
            logChannel = await interaction.guild.channels.fetch(logchannelData[0].channel);

        switch(cmd) {
            case 'add':
                const {rows: [{countrules}]} = await poolConnection.query(
                    `SELECT COUNT (*) AS countrules FROM autopunishrule
                        WHERE guild=$1`,
                        [interaction.guild.id]
                );
                if(countrules >= 5) {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Exceeded maximum rules count!')
                                .setDescription('This server has reached the maximum number of auto punish rules, you need to remove some before adding more.')
                        ]
                    })
                }

                const warnCount = interaction.options.getNumber('warncount');

                const durationString = interaction.options.getString('duration').toLowerCase();

                if(!durationRegex.test(durationString))
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Invalid duration')
                                .setDescription('Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y >')
                        ]
                    })
                
                const duration = duration_to_seconds(durationString);

                if(parseInt(Date.now() / 1000) - duration <= 0) {
                    // in case the input is larger than actual current unix time, throw it as an error
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Invalid input')
                                .setDescription('Duration can not exceed JAN 01 1970 (Unix time).')
                        ]
                    });
                }

                const punishmentType = interaction.options.getString('punishment-type');

                const punishmentDurationString = interaction.options.getString('punishment-duration').toLowerCase();

                if(!durationRegex.test(punishmentDurationString) && 
                    punishmentDurationString != "0") {
                        return await interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('Invalid punishment duration')
                                    .setDescription('Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y > or 0 for indefinite ban.')
                            ]
                        });
                }

                if(punishmentDurationString == "0" && punishmentType == "timeout") {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Invalid timeout duration')
                                .setDescription('You can not set timeout duration to 0, that option is available for ban.')
                        ]
                    });
                }
                
                let punishmentDuration = null;

                if(punishmentDurationString == "0")
                    punishmentDuration = 0;
                else
                    punishmentDuration = duration_to_seconds(punishmentDurationString);

                // index 1 is for timeout, index 2 is for temp ban and index 3 is for indefinite ban (ban type 0 duration)
                let punishmentIndex = null;
                if(punishmentType == "timeout")
                    punishmentIndex = 1;
                else if(punishmentType == "ban" && punishmentDuration == 0)
                    punishmentIndex = 3;
                else if(punishmentType == "ban" && punishmentDuration > 0)
                    punishmentIndex = 2;

                if(punishmentType == "timeout" && punishmentDuration > duration_to_seconds("2d"))
                {
                    // can not set a timeout longer than 2 days
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle("Invalid timeout duration")
                                .setDescription("Timeout can not exceed the duration of 2 days.")
                        ]
                    });
                }
                
                if(punishmentType == "ban" && punishmentDuration < duration_to_seconds("3d") && punishmentDuration > 0) {
                    // can not set a timeout shorter than 3 days
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle("Invalid tempban duration")
                                .setDescription("Tempban can not be shorter than 3 days.")
                        ]
                    });
                }
                

                const {rows: [{countrule}]} = await poolConnection.query(`SELECT COUNT(*) AS countrule FROM autopunishrule
                    WHERE guild=$1
                        AND warncount=$2
                        AND duration=$3`, 
                        [interaction.guild.id, warnCount, duration]
                    );
                
                if(countrule > 0)
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Rule duplicate')
                                .setDescription('Rules are unique by their warn count and duration trigger.')
                        ]
                    });

                // after all the input validation, the rule can be registered

                await poolConnection.query(`INSERT INTO autopunishrule(guild, warncount, duration, punishment_type, punishment_duration)
                    VALUES($1, $2, $3, $4, $5)`,
                    [interaction.guild.id, warnCount, duration, punishmentIndex, punishmentDuration]
                );

                let ruleMessage = `\`${punishmentDict[punishmentIndex]}\` `;
                if(punishmentIndex < 3)
                    ruleMessage += `for \`${punishmentDurationString}\` `
                ruleMessage += `when someone has \`${warnCount} warns\` or more in the last \`${durationString}\``;
                if(logChannel)
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Purple")
                                .setAuthor({name: `${interaction.user.username} added a new auto punish rule`,
                                    iconURL: interaction.member.displayAvatarURL({extension: 'png'})})
                                .setFields(
                                    {
                                        name: "Rule",
                                        value: ruleMessage
                                    }
                                )
                                .setTimestamp()
                                .setFooter({text: `Admin ID: ${interaction.user.id}`})
                        ]
                    });

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Purple')
                            .setTitle('Rule added successfully')
                            .setDescription(`**Condition**: ${ruleMessage}`)
                    ]
                });

            break;
            case "list":
                let {rows: rulesData} = await poolConnection.query(`SELECT * FROM autopunishrule
                    WHERE guild=$1
                    ORDER BY warncount DESC, duration ASC`, [interaction.guild.id]);

                const embedList = new EmbedBuilder()
                    .setColor('Purple')

                if(rulesData.length == 0) {
                    return await interaction.editReply({
                        embeds: [
                            embedList.setTitle("The list is empty")
                                .setDescription("No rules were added, use `/autopunish-rule add` to add a new rule.")
                        ]
                    });
                }

                embedList.setTitle("Auto Punish Rules")
                    .setDescription("**Remove rules** to remove one or more rules.\n**Clear** to clear all rules.");

                for(const rule of rulesData) {
                    let ruleMessage = `\`${punishmentDict[rule.punishment_type]}\` `;
                    if(rule.punishment_type < 3)
                        ruleMessage += `for \`${convert_seconds_to_units(rule.punishment_duration)}\` `;
                    ruleMessage += `when someone has \`${rule.warncount} warns\` or more in the last \`${convert_seconds_to_units(rule.duration)}\``
                    embedList.addFields(
                        {
                            name: `Rule ID [${rule.id}]`,
                            value: ruleMessage
                        }
                    )
                }
                
                const removeRulesButton = new ButtonBuilder()
                    .setCustomId('remove-rules')
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Remove rules")
                const removeAllRulesButton = new ButtonBuilder()
                    .setCustomId('remove-all-rules')
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Clear")

                const removeButtonsActionRow = new ActionRowBuilder()
                    .addComponents(removeRulesButton, removeAllRulesButton);

                const listMessage = await interaction.editReply({
                    embeds: [
                        embedList
                    ],
                    components: [ removeButtonsActionRow ]
                });
                
                const collector = listMessage.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.user.id === interaction.user.id,
                });

                collector.on("collect", async (buttonInteraction) => {
                    switch(buttonInteraction.customId) {
                        case "remove-rules":
                            // a select menu will be created in order to choose the rules to be removed
                            const selectMenuOptions = []
                            rulesData.forEach(rule => {
                                selectMenuOptions.push(
                                    {
                                        label: `Rule ID [${rule.id}]`,
                                        value: `${rule.id}`,
                                        description: `Remove rule with the ID of ${rule.id}`
                                    }
                                )
                            });

                            const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId('select-rules')
                                .setPlaceholder("Select the rules you want removed.")
                                .setMinValues(1)
                                .setMaxValues(rulesData.length)
                                .addOptions(selectMenuOptions)

                            const selectMenuActionRow = new ActionRowBuilder()
                                .setComponents( selectMenu );

                            const selectMenuMessage = await buttonInteraction.reply({
                                components: [ selectMenuActionRow ]
                            });

                            const selectMenuMessageReply = await buttonInteraction.fetchReply();

                            const selectCollector = selectMenuMessageReply.createMessageComponentCollector({
                                ComponentType: ComponentType.StringSelect,
                                filter: (i) => i.user.id === buttonInteraction.user.id,
                                time: 300_000
                            });

                            selectCollector.on("collect", async (selectInteraction) => {
                                selectInteraction.values.forEach(async (ruleId) => {
                                    await poolConnection.query(`DELETE FROM autopunishrule WHERE guild=$1 AND id=$2`,
                                        [selectInteraction.guild.id, ruleId]
                                    );
                                });
                                
                                // updating the content of the variable with the changed rows
                                ({rows: rulesData} = await poolConnection.query(`SELECT * FROM autopunishrule WHERE guild=$1
                                    ORDER BY warncount DESC, duration ASC`,
                                    [buttonInteraction.guild.id]));

                                if(rulesData.length == 0) {
                                    await listMessage.edit({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor('Purple')
                                                .setTitle("The list is empty")
                                                .setDescription("No rules were added, use `/autopunish-rule add` to add a new rule.")
                                        ],
                                        components: []
                                    });
                                } else {
                                    const updatedEmbed = new EmbedBuilder()
                                        .setColor('Purple')
                                        .setTitle("Auto Punish Rules")
                                        .setDescription("**Remove rules** to remove one or more rules.\n**Clear** to clear all rules.");
                                    for(const rule of rulesData) {
                                        let ruleMessage = `\`${punishmentDict[rule.punishment_type]}\` `;
                                        if(rule.punishment_type < 3)
                                            ruleMessage += `for \`${convert_seconds_to_units(rule.punishment_duration)}\` `;
                                        ruleMessage += `when someone has \`${rule.warncount} warns\` or more in the last \`${convert_seconds_to_units(rule.duration)}\``
                                        updatedEmbed.addFields(
                                            {
                                                name: `Rule ID [${rule.id}]`,
                                                value: ruleMessage
                                            }
                                        )
                                    }
                                    await listMessage.edit({
                                        embeds: [updatedEmbed]
                                    });
                                }

                                await selectInteraction.reply({
                                    content: `The following rules were deleted: ${selectInteraction.values.join(", ")}`,
                                    ephemeral: true
                                })

                                selectCollector.stop();
                            });

                            selectCollector.on("end", async () => {
                                try{
                                    await selectMenuMessage.delete();
                                } catch(err) {};
                            });
                            
                        break;
                        case "remove-all-rules":
                            await poolConnection.query(`DELETE FROM autopunishrule WHERE guild=$1`, [buttonInteraction.guild.id]);
                            await listMessage.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Purple')
                                        .setTitle("The list is empty")
                                        .setDescription("No rules were added, use `/autopunish-rule add` to add a new rule.")
                                ],
                                components: []
                            });
                            await buttonInteraction.reply({
                                content: "All rules were cleared.",
                                ephemeral: true
                            });
                        break;
                    }
                })
            break;
        }
    }
}