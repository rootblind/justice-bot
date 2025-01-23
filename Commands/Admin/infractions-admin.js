/*
    this command requires admin perms, it is used to list infractions from punishlogs and to remove data from database
    delete DELETES a row based on ID from the interaction guild 
    clear-list deletes all rows associated with the target and punishment_type specified

    Do note: while warnings are entirely stored in punishlogs table, infractions like bans are also stored in their own table
    therefore the bot is coded in a way that registries will be cleared, but not the actual bans since this is not really an unban tool
*/

const {SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    ComponentType,
} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db');

const punishType = {
    0: "Warn",
    1: "Timeout",
    2: "Tempban",
    3: "Indefinite Ban",
    4: "Permaban"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infractions-admin')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('Administrative commands for infractions')
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List infractions.')
                .addStringOption(option => 
                    option.setName('list-type')
                        .setDescription('The type of infractions to be listed.')
                        .addChoices(
                            {
                                name: 'Full',
                                value: 'full'
                            },
                            {
                                name: 'Warn',
                                value: 'warn'
                            },
                            {
                                name: 'Timeout',
                                value: 'timeout'
                            },
                            {
                                name: 'Ban',
                                value: 'ban'
                            }
                        )
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to list infractions for.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('lookup')
                .setDescription('Look up a specific infraction ID for details.')
                .addNumberOption(option =>
                    option.setName('id')
                        .setDescription('The infraction ID to look up.')
                        .setRequired(true)
                )

        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-list')
                .setDescription('Clear the list of a member')
                .addStringOption(option => 
                    option.setName('list-type')
                        .setDescription('The type of infraction list to be cleared.')
                        .addChoices(
                            {
                                name: 'Full',
                                value: 'full'
                            },
                            {
                                name: 'Warn',
                                value: 'warn'
                            },
                            {
                                name: 'Timeout',
                                value: 'timeout'
                            },
                            {
                                name: 'Ban',
                                value: 'ban'
                            }
                        )
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to delete the list from.')
                        .setRequired(true)
                )
        )

    ,
    async execute(interaction, client) {
        
        // on lookup there is a delete function
        const deleteButton = new ButtonBuilder() // used to delete the row
            .setCustomId('delete-button')
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)

        const confirmButton = new ButtonBuilder() // confirms the deletion of the list
            .setCustomId('confirm-button')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger)

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel-button')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Success)

        const buttonsActionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
        const deleteActionRow = new ActionRowBuilder().addComponents(deleteButton);

        await interaction.deferReply();

        const cmd = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const listType = interaction.options.getString('list-type');
        const ID = interaction.options.getNumber('id');

        // fetching logs channel for deletion or clear-list
        const {rows: logsData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`,
            [interaction.guild.id, "moderation"]
        )

        let logChannel = null;
        if(logsData.length > 0) {
            logChannel = await interaction.guild.channels.fetch(logsData[0].channel);
        }

        switch(cmd) {
            case 'list':
                const embedEmpty = new EmbedBuilder()
                    .setColor('Aqua')
                    .setAuthor({name: `${user.username}'s ${listType} list`, iconURL: user.displayAvatarURL({extension: 'png'})})
                    .setDescription('No results found, the list is empty.')

                switch(listType) {
                    case 'full':
                        const {rows: fullUserData} = await poolConnection.query(`SELECT * FROM punishlogs WHERE guild=$1 AND target=$2
                            ORDER BY timestamp DESC`,
                            [interaction.guild.id, user.id]
                        );

                        if(fullUserData.length == 0)
                        {
                            return await interaction.editReply({embeds: [embedEmpty]});
                        }

                        let embedFullList = new EmbedBuilder()
                            .setColor('Aqua')
                            .setAuthor({name: `${user.username}'s ${listType} list`, iconURL: user.displayAvatarURL({extension: 'png'})})

                        let fullInfractionsList = [];

                        fullUserData.forEach((row) => {
                            fullInfractionsList.push(
                                {
                                    id: row.id,
                                    punishment_type: punishType[row.punishment_type],
                                    reason: row.reason == "no_reason" ? "No Reason" : row.reason,
                                    timestamp: row.timestamp
                                }
                            )
                        });

                        let fullListCount = 0;
                        for(let i of fullInfractionsList) {
                            ++fullListCount;
                            embedFullList.addFields(
                                {
                                    name: `ID: ${i.id}`,
                                    value: `**Type**: ${i.punishment_type}\n**Reason**: ${i.reason}\n**Time**: <t:${i.timestamp}:R>`
                                }
                            );

                            if(fullListCount % 25 == 0 || fullListCount == fullUserData.length) {
                                await interaction.followUp({embeds: [embedFullList]});
                                embedFullList = new EmbedBuilder().setColor('Aqua');
                            }
                        }
                    break;
                    case 'warn':
                        const {rows: warnUserData} = await poolConnection.query(`SELECT * FROM punishlogs
                            WHERE guild=$1
                                AND target=$2
                                AND punishment_type=0
                                ORDER BY timestamp DESC`,[interaction.guild.id, user.id]);

                        if(warnUserData.length == 0) {
                            return await interaction.editReply({embeds: [embedEmpty]});
                        }

                        let embedWarnList = new EmbedBuilder()
                            .setColor('Aqua')
                            .setAuthor({name: `${user.username}'s ${listType} list`, iconURL: user.displayAvatarURL({extension: 'png'})})

                        let warnInfractionsList = [];

                        warnUserData.forEach((row) => {
                                warnInfractionsList.push(
                                {
                                    id: row.id,
                                    punishment_type: punishType[row.punishment_type],
                                    reason: row.reason == "no_reason" ? "No Reason" : row.reason,
                                    timestamp: row.timestamp
                                }
                            )
                        });

                        let warnListCount = 0;
                        for(let i of warnInfractionsList) {
                            ++warnListCount;
                            embedWarnList.addFields(
                                {
                                    name: `ID: ${i.id}`,
                                    value: `**Reason**: ${i.reason}\n**Time**: <t:${i.timestamp}:R>`
                                }
                            );
                            if(warnListCount % 25 == 0 || warnListCount == warnUserData.length) {
                                await interaction.followUp({embeds: [embedWarnList]});
                                embedWarnList = new EmbedBuilder().setColor('Aqua');
                            }
                        }
                    break;
                    case 'timeout':
                        const {rows: timeoutUserData} = await poolConnection.query(`SELECT * FROM punishlogs
                            WHERE guild=$1
                                AND target=$2
                                AND punishment_type=1
                                ORDER BY timestamp DESC`,[interaction.guild.id, user.id]);

                        if(timeoutUserData.length == 0) {
                            return await interaction.editReply({embeds: [embedEmpty]});
                        }

                        let embedTimeoutList = new EmbedBuilder()
                            .setColor('Aqua')
                            .setAuthor({name: `${user.username}'s ${listType} list`, iconURL: user.displayAvatarURL({extension: 'png'})})

                        let timeoutInfractionsList = [];

                        timeoutUserData.forEach((row) => {
                            timeoutInfractionsList.push(
                                {
                                    id: row.id,
                                    punishment_type: punishType[row.punishment_type],
                                    reason: row.reason == "no_reason" ? "No Reason" : row.reason,
                                    timestamp: row.timestamp
                                }
                            )
                        });

                        let timeoutListCount = 0;
                        for(let i of timeoutInfractionsList) {
                            ++timeoutListCount;
                            embedTimeoutList.addFields(
                                {
                                    name: `ID: ${i.id}`,
                                    value: `**Reason**: ${i.reason}\n**Time**: <t:${i.timestamp}:R>`
                                }
                            );
                            if(timeoutListCount % 25 == 0 || timeoutListCount == timeoutUserData.length) {
                                await interaction.followUp({embeds: [embedTimeoutList]});
                                embedTimeoutList = new EmbedBuilder().setColor('Aqua');
                            }
                        }
                    break;
                    case 'ban':
                        const {rows: banUserData} = await poolConnection.query(`SELECT * FROM punishlogs
                            WHERE guild=$1
                                AND target=$2
                                AND punishment_type>=2
                                ORDER BY timestamp DESC`,[interaction.guild.id, user.id]);

                        if(banUserData.length == 0) {
                            return await interaction.editReply({embeds: [embedEmpty]});
                        }

                        let embedBanList = new EmbedBuilder()
                            .setColor('Aqua')
                            .setAuthor({name: `${user.username}'s ${listType} list`, iconURL: user.displayAvatarURL({extension: 'png'})})

                        let banInfractionsList = [];

                        banUserData.forEach((row) => {
                            banInfractionsList.push(
                                {
                                    id: row.id,
                                    punishment_type: punishType[row.punishment_type],
                                    reason: row.reason == "no_reason" ? "No Reason" : row.reason,
                                    timestamp: row.timestamp
                                }
                            )
                        });

                        let banListCount = 0;
                        for(let i of banInfractionsList) {
                            ++banListCount;
                            embedBanList.addFields(
                                {
                                    name: `ID: ${i.id}`,
                                    value: `**Type**: ${i.punishment_type}\n**Reason**: ${i.reason}\n**Time**: <t:${i.timestamp}:R>`
                                }
                            );
                            if(banListCount % 25 == 0 || banListCount == banUserData.length) {
                                await interaction.followUp({embeds: [embedBanList]});
                                embedBanList = new EmbedBuilder().setColor('Aqua');
                            }
                        }
                    break;
                }

                break;
                case 'lookup':
                    
                    // even thought the ID is unique, without the AND guild condition, any admin can delete any punishlogs row from any server
                    // since rows.length is used for validation
                    const {rows: IdData} = await poolConnection.query(`SELECT * FROM punishlogs WHERE id=$1 AND guild=$2`, 
                        [ID, interaction.guild.id]
                    );

                    if(IdData.length == 0) {
                        return await interaction.editReply({embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Invalid ID')
                                .setDescription(`${ID} is not a valid id!`)
                        ]});
                    }

                    const fetchTarget = await client.users.fetch(IdData[0].target);
                    const fetchModerator = await client.users.fetch(IdData[0].moderator)
                    const IdMessage = await interaction.editReply({components: [deleteActionRow],
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setAuthor({name: `${fetchTarget.username} - infraction [${ID}]`, iconURL: fetchTarget.displayAvatarURL({extension: 'png'})})
                                .setDescription('The delete button will remove this infraction.')
                                .addFields(
                                    {
                                        name: 'Type',
                                        value: punishType[IdData[0].punishment_type]
                                    },
                                    {
                                        name: 'Applied by',
                                        value: fetchModerator.username
                                    },
                                    {
                                        name: 'Reason',
                                        value: IdData[0].reason == "no_reason" ? "No Reason" : IdData[0].reason
                                    },
                                    {
                                        name: 'Date',
                                        value: `<t:${IdData[0].timestamp}:R>`
                                    }
                                )
                        ]
                    });

                    const IdMessageCollector = IdMessage.createMessageComponentCollector({
                        ComponentType: ComponentType.Button,
                        filter: (i) => i.member.permissions.has(PermissionFlagsBits.Administrator),
                        time: 600_000
                    });
                    IdMessageCollector.on('collect', async (buttonInteraction) => {
                        if(buttonInteraction.customId != 'delete-button') return;

                        // here it's save to use only the id since the ID was validated before, enforcing it to be from the interaction guild only
                        await poolConnection.query(`DELETE FROM punishlogs WHERE id=$1`, [ID]);
                        deleteButton.setDisabled(true);
                        await IdMessage.edit({components: [deleteActionRow],
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Red')
                                    .setAuthor({name: `${fetchTarget.username} - infraction [${ID}]`, iconURL: fetchTarget.displayAvatarURL({extension: 'png'})})
                                    .setDescription(`${buttonInteraction.member} removed this infraction.`)
                            ]
                        });
                        await buttonInteraction.reply({ephemeral: true, content: `Infraction ${ID} was deleted.`});

                        //logging if possible
                        if(logChannel) {
                            await logChannel.send({
                                embeds: [
                                    new EmbedBuilder()
                                    .setColor('Red')
                                    .setAuthor({name: `${buttonInteraction.user.username} deleted infraction [${ID}]`,
                                        iconURL: buttonInteraction.user.displayAvatarURL({extension: 'png'})})
                                    .setDescription('Details about the deleted infraction')
                                    .addFields(
                                        {
                                            name: 'Type',
                                            value: punishType[IdData[0].punishment_type]
                                        },
                                        {
                                            name: 'Target',
                                            value: `${fetchTarget.username}`
                                        },
                                        {
                                            name: 'Applied by',
                                            value: fetchModerator.username
                                        },
                                        {
                                            name: 'Reason',
                                            value: IdData[0].reason == "no_reason" ? "No Reason" : IdData[0].reason
                                        },
                                        {
                                            name: 'Date',
                                            value: `<t:${IdData[0].timestamp}:R>`
                                        }
                                    )
                                    .setTimestamp()
                                    .setFooter({text: `Target ID: ${fetchTarget.id}`})
                                ]
                            })
                        }

                    });
                break;
                case 'clear-list':
                    const emptyEmbedList = new EmbedBuilder()
                        .setColor('Aqua')
                        .setAuthor({name: `${user.username}'s ${listType} list is empty`, iconURL: user.displayAvatarURL({extension: 'png'})})
                        .setDescription('There is nothing to be removed.');
                    const embedCountList = new EmbedBuilder()
                        .setColor('Aqua')
                        .setAuthor({name: `${user.username}'s ${listType} list`, iconURL: user.displayAvatarURL({extension: 'png'})})
                        
                    const stringToType = {
                        "warn": 0,
                        "timeout": 1,
                        "ban": 2
                    }
                    let clearedRows = 0;
                    // because i am unable to generalize full, warn + timeout and bans, i will divide the approach into three ifs
                    // since full needs to select all types [ listType == "full"]
                    // warn and timeout are single types [stringToType[listType] < 2]
                    // and ban represents all 3 types of bans [stringToType[listType] >= 2]

                    deleteQuery = `DELETE FROM punishlogs WHERE guild=${interaction.guild.id} AND target=${user.id}`;
                    if(listType == 'full') {
                        const {rows: [{countfull}]} = await poolConnection.query(`SELECT COUNT(*) AS countfull FROM punishlogs
                            WHERE guild=$1 AND target=$2`, [interaction.guild.id, user.id]);
                        
                        if(countfull == 0)
                            return await interaction.editReply({embeds: [emptyEmbedList]});
                        clearedRows = countfull;
                        embedCountList.setDescription(`Are you sure that you want to remove **${countfull}** from the ${listType} list?`);
                    } else if(stringToType[listType] < 2) {
                        const {rows: [{counttype1}]} = await poolConnection.query(`SELECT COUNT(*) AS counttype1
                            FROM punishlogs
                            WHERE guild=$1
                                AND target=$2
                                AND punishment_type=$3`,
                                [interaction.guild.id, user.id, stringToType[listType]]
                            );
                        if(counttype1 == 0)
                            return await interaction.editReply({embeds: [emptyEmbedList]});
                        clearedRows = counttype1;
                        deleteQuery += ` AND punishment_type=${stringToType[listType]}`;

                        embedCountList.setDescription(`Are you sure that you want to remove **${counttype1}** from the ${listType} list?`);
                    } else if(stringToType[listType] >= 2) {
                        const {rows: [{counttype2}]} = await poolConnection.query(`SELECT COUNT(*) AS counttype2
                            FROM punishlogs
                            WHERE guild=$1
                                AND target=$2
                                AND punishment_type >= $3`)

                        if(counttype2 == 0)
                            return await interaction.editReply({embeds: [emptyEmbedList]});
                        clearedRows = counttype2;
                        embedCountList.setDescription(`Are you sure that you want to remove **${counttype2}** from the ${listType} list?`);
                        deleteQuery += ` AND punishment_type >= ${stringToType[listType]}`;
                    }

                    const clearListMessage = await interaction.editReply({embeds: [embedCountList], components: [buttonsActionRow]});

                    const clearListCollector = await clearListMessage.createMessageComponentCollector({
                        ComponentType: ComponentType.Button,
                        filter: (i) => i.member.permissions.has(PermissionFlagsBits.Administrator),
                        time: 300_000 
                    })

                    clearListCollector.on('collect', async (buttonInteraction) => {
                        if(buttonInteraction.customId == 'confirm-button') {
                            await poolConnection.query(deleteQuery);
                            clearListMessage.edit(
                                {
                                    embeds:[embedCountList.setDescription(`**${user.username}**'s ${listType} list was cleared and is empty now.`)],
                                    components: []
                                }
                            )
                            await buttonInteraction.reply({ephemeral: true, content: 'List cleared.'});

                            if(logChannel)
                                await logChannel.send({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor('Red')
                                            .setAuthor({name: `${user.username}'s ${listType} list got cleared`, iconURL: user.displayAvatarURL({extension: 'png'})})
                                            .addFields(
                                                {
                                                    name: 'Target',
                                                    value: `${user}`,
                                                    inline: true
                                                },
                                                {
                                                    name: 'Cleared by',
                                                    value: `${buttonInteraction.member}`,
                                                    inline: true
                                                },
                                                {
                                                    name: 'Cleared',
                                                    value: `${clearedRows} infractions`,
                                                }
                                            )
                                            .setTimestamp()
                                            .setFooter({text: `Target ID: ${user.id}`})
                                    ]
                                });
                        } else if(buttonInteraction.customId == 'cancel-button') {
                            await clearListCollector.stop()
                        }
                    });

                    clearListCollector.on('end', async () => {
                        try{
                            await clearListMessage.delete();
                        } catch(e) {};
                    })

                break;
        }
    }
}