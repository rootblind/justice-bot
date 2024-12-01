/*
    Banning server members using 3 different methods:
        - indefinite is the default ban, no duration specified, nothing different from a normal ban
        - temporary ban is a ban to be removed after a specified expiration duration
        - permanent ban is a special level of ban since unbanning it requires admin permissions, alerts the admin before unbanning and enforces the ban over other methods of bypassing it
            someone permanently banned will be registered as in Probation when unbanned.
    Also some info related subcommands.
*/

const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {duration_timestamp, formatDate, formatTime} = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
config();

const durationRegex = /^(\d+)([m,h,d,w,y])$/;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member of this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(subcommand => 
            subcommand.setName('indefinite')
                .setDescription('Indefinitely ban a member.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to be banned.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason to be banned.')
                        .setMaxLength(512)
                        .setMinLength(4)
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('delete-messages')
                        .setDescription('True to delete messages. False is the default.')
                )
        )
        .addSubcommand(subcommand => 
            subcommand.setName('temporary')
                .setDescription('Temporary ban a member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to be banned.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The ban duration.')
                        .setMaxLength(3)
                        .setMinLength(2)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the ban.')
                        .setMaxLength(512)
                        .setMinLength(4)
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('delete-messages')
                        .setDescription('True to delete messages. False is the default.')
                )

        )
        .addSubcommand(subcommand =>
            subcommand.setName('permanent')
                .setDescription('Perform a permanent ban that requires administrator perms.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to be banned.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the ban.')
                        .setRequired(true)
                        .setMaxLength(512)
                        .setMinLength(4)
                )
                .addBooleanOption(option =>
                    option.setName('delete-messages')
                        .setDescription('True to delete messages. False is the default.')
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('counter')
                .setDescription('The number of all time bans on this server.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('check')
                .setDescription('Details about a specific ban.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('Check the ban of the target.')
                        .setRequired(true)
                )
        )

    ,
    async execute(interaction, client) {
        const target = interaction.options.getUser('target') || null;
        const reason = interaction.options.getString('reason');
        const duration = interaction.options.getString('duration') || null;
        const deleteMessages = interaction.options.getBoolean('delete-messages') || false; // if deleteMessages is set to true, the messages of the last 7 days will be deleted
        const deletionTime = deleteMessages ? 604800 : 0;
        // validating input
        let targetMember = null; 
        try{
            if(target)
                targetMember = await interaction.guild.members.fetch(target?.id)
        } catch(err) {
            targetMember = null;
        }
        
        if(targetMember)
        {
            if(targetMember?.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder().setTitle('Invalid target')
                            .setDescription('Cannot ban a member with a higher role position than yours.')
                            .setColor('Red')
                    ],
                    ephemeral: true
                });
            }

            const botMember = await interaction.guild.members.fetch(process.env.CLIENT_ID);
            if(targetMember?.roles.highest.position >= botMember.roles.highest.position) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder().setTitle('Invalid target')
                            .setDescription('Cannot ban a member whose role is above mine!')
                            .setColor('Red')
                    ],
                    ephemeral: true
                });
            }
        }
        if(duration != null && !durationRegex.test(duration))
        {
            const editEmbedError = EmbedBuilder().setTitle('Invalid input!')
                .setDescription('The duration format is invalid.\n Provide a duration that respects the format: <number: 1-99>< d | w | y >')
            return await interaction.reply({embeds: [editEmbedError], ephemeral: true});
        }
        else if(durationRegex.test(duration) && duration_timestamp(duration) < parseInt(Date.now() / 1000) + 86400)
        {
            // temp ban duration must be at least one day long
            return await interaction.reply({embeds: [
                new EmbedBuilder().setTitle('The duration is too short!')
                    .setDescription('The duration of a temporary ban must be at least one day (1d) long!')
                    .setColor("Red")
            ], ephemeral: true});
        }
        let logChannel = null;

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [interaction.guild.id, 'moderation'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = interaction.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        const unbanModal = new ModalBuilder()
            .setCustomId(`unban-modal-${interaction.user.id}`)
            .setTitle('Unban')

        const reasonInput = new TextInputBuilder()
            .setCustomId('unban-reason-input')
            .setLabel('Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(4)
            .setMaxLength(512)
            .setPlaceholder('Enter the reason....')
            .setRequired(true)
        
        const reasonActionRow = new ActionRowBuilder().addComponents( reasonInput );
        unbanModal.addComponents(reasonActionRow);

        const cmd = interaction.options.getSubcommand();

        let banlistData = null;
        if(target) {
            const result = await poolConnection.query(`SELECT target FROM banlist WHERE guild=$1 AND target=$2`, 
                [interaction.guild.id, target.id]);
            banlistData = result.rows;
        }
        switch(cmd) {
            case "indefinite":
                try{
                    await interaction.guild.bans.create(target.id, {reason: `${interaction.member.displayName} | ${reason}`, deleteMessageSeconds: deletionTime});
                } catch(error) {
                    console.error(error);
                }
                const embed = new EmbedBuilder()
                        .setAuthor({
                            name: `[BAN] ${target.username}`,
                            iconURL: target.displayAvatarURL({ format: 'jpg' })
                        })
                        .setColor(0xff0000)
                        .setTimestamp()
                        .setFooter({text:`ID: ${target.id}`})
                        .addFields(
                            {
                                name: 'User',
                                value: `${target}`,
                                inline: true
                            },
                            {
                                name: 'Moderator',
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: 'Expires',
                                value: 'Indefinite',
                                inline: true
                            },
                            {
                                name: 'Reason',
                                value: `${reason}`,
                                inline: false
                            }
                        )
                if(logChannel) { // logging the ban
                    
                    await logChannel.send({embeds: [embed]});
                }
                // logging the audit
                // 0- warn; 1- timeout; 2- tempban; 3- indefinite ban; 4- permanent ban
                await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                    VALUES($1, $2, $3, $4, $5, $6)
                    `, [interaction.guild.id, target.id, interaction.user.id, 3, reason, parseInt(Date.now() / 1000)]);
                
                const unbanButton = new ButtonBuilder()
                    .setCustomId('unban-button')
                    .setLabel('Unban')
                    .setStyle(ButtonStyle.Danger)

                const unbanActionRow = new ActionRowBuilder().addComponents( unbanButton );

                const indefiniteBanResponse = await interaction.reply({
                    embeds: [embed],
                    components: [unbanActionRow]
                });

                const indefiniteResponseCollector = indefiniteBanResponse.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.member.permissions.has(PermissionFlagsBits.BanMembers),
                    time: 300_000,
                });

                indefiniteResponseCollector.on('collect', async (buttonInteraction) => {
                    buttonInteraction.showModal(unbanModal);
                    try{
                        const submitReason = await buttonInteraction.awaitModalSubmit({
                            filter: (i) => i.customId === `unban-modal-${interaction.user.id}`,
                            time: 300_000
                        });

                        await submitReason.deferReply();

                        const reason = submitReason.fields.getTextInputValue('unban-reason-input');

                        try {
                            await buttonInteraction.guild.bans.remove(target.id, reason);
                        } catch(err) {}
                        unbanButton.setDisabled(true);
                        await indefiniteBanResponse.edit({components: [unbanActionRow]});
                        const embed = new EmbedBuilder()
                                .setAuthor({
                                    name: `[UNBAN] ${target.username}`,
                                    iconURL: target.displayAvatarURL({ format: 'jpg' })
                                })
                                .setColor(0x00ff01)
                                .setTimestamp()
                                .setFooter({text:`ID: ${target.id}`})
                                .addFields(
                                    {
                                        name: 'User',
                                        value: `${target}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Moderator',
                                        value: `${buttonInteraction.member}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason,
                                        inline: false
                                    }
                                )
                        if(logChannel) {
                            await logChannel.send({embeds: [embed]});
                        }
                        

                        await submitReason.editReply({embeds: [embed]});
                    } catch(err) {
                        await buttonInteraction.followUp({ephemeral: true, content: 'No reason was given in time, try again.'});
                    }

                    
                });

                indefiniteResponseCollector.on('end', async () => {
                    await indefiniteBanResponse.delete();
                })
                
            break;
            case "temporary":
                // basically the same as indefinite, but with cron task added for automatic unban upon expiration
                const expirationTimestamp = duration_timestamp(duration);
                try{
                    await interaction.guild.bans.create(target.id, {reason: `${interaction.member.displayName} | ${reason}`, deleteMessageSeconds: deletionTime});
                } catch(error) {
                    console.error(error);
                }

                if(banlistData && banlistData?.length > 0) {
                    await poolConnection.query(`UPDATE banlist SET moderator=$1, expires=$2, reason=$3 WHERE guild=$4 AND target=$5`,
                        [interaction.user.id, expirationTimestamp, reason, interaction.guild.id, target.id]
                    );
                } else if(banlistData && banlistData?.length == 0) {
                    await poolConnection.query(`INSERT INTO banlist(guild, target, moderator, expires, reason)
                            VALUES($1, $2, $3, $4, $5)
                        `, [interaction.guild.id, target.id, interaction.user.id, expirationTimestamp, reason]);
                }

                
                const responseEmbed = new EmbedBuilder()
                        .setAuthor({
                            name: `[BAN] ${target.username}`,
                            iconURL: target.displayAvatarURL({ format: 'jpg' })
                        })
                        .setColor(0xff0000)
                        .setTimestamp()
                        .setFooter({text:`ID: ${target.id}`})
                        .addFields(
                            {
                                name: 'User',
                                value: `${target}`,
                                inline: true
                            },
                            {
                                name: 'Moderator',
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: 'Expires',
                                value: `<t:${expirationTimestamp}:R>`,
                                inline: true
                            },
                            {
                                name: 'Reason',
                                value: `${reason}`,
                                inline: false
                            }
                        )
                if(logChannel) { // logging the ban
                    
                    await logChannel.send({embeds: [responseEmbed]});
                }
                // 0- warn; 1- timeout; 2- tempban; 3- indefinite ban; 4- permanent ban
                await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                    VALUES($1, $2, $3, $4, $5, $6)
                    `, [interaction.guild.id, target.id, interaction.user.id, 2, reason, parseInt(Date.now() / 1000)]);
                
                const unbanTempButton = new ButtonBuilder()
                    .setCustomId('unban-button')
                    .setLabel('Unban')
                    .setStyle(ButtonStyle.Danger)

                const unbanTempActionRow = new ActionRowBuilder().addComponents( unbanTempButton );

                const tempBanResponse = await interaction.reply({
                    embeds: [responseEmbed],
                    components: [unbanTempActionRow]
                });

                const tempBanMessageCollector = tempBanResponse.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.member.permissions.has(PermissionFlagsBits.BanMembers),
                    time: 300_000,
                });

                tempBanMessageCollector.on('collect', async (buttonInteraction) => {
                    buttonInteraction.showModal(unbanModal);
                    try{
                        const submitReason = await buttonInteraction.awaitModalSubmit({
                            filter: (i) => i.customId === `unban-modal-${interaction.user.id}`,
                            time: 300_000
                        });

                        await submitReason.deferReply();

                        const reason = submitReason.fields.getTextInputValue('unban-reason-input');

                        try {
                            await buttonInteraction.guild.bans.remove(target.id, reason);
                        } catch(err) {}
                        await poolConnection.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`, [buttonInteraction.guild.id, target.id]);
                        unbanTempButton.setDisabled(true);
                        await tempBanResponse.edit({components: [unbanTempActionRow]});
                        const embed = new EmbedBuilder()
                                .setAuthor({
                                    name: `[UNBAN] ${target.username}`,
                                    iconURL: target.displayAvatarURL({ format: 'jpg' })
                                })
                                .setColor(0x00ff01)
                                .setTimestamp()
                                .setFooter({text:`ID: ${target.id}`})
                                .addFields(
                                    {
                                        name: 'User',
                                        value: `${target}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Moderator',
                                        value: `${buttonInteraction.member}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason,
                                        inline: false
                                    }
                                )
                        if(logChannel) {
                            await logChannel.send({embeds: [embed]});
                        }
    
                        await submitReason.editReply({embeds: [embed]});
                    } catch(err) {
                        await buttonInteraction.followUp({ephemeral: true, content: 'No reason was given before the time ended.'});
                    }
                });

                tempBanMessageCollector.on('end', async () => {
                    await tempBanResponse.delete();
                })
            break;
            case "permanent":
                // only admins
                if(!interaction.member.permissions.has(PermissionFlagsBits.Administrator)){
                    return await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle("Insufficient permissions!")
                                .setDescription('Permanently banning users requires administrator permissions.')
                        ],
                        ephemeral: true
                    });
                }
                try{
                    await interaction.guild.bans.create(target.id, {reason: `${interaction.member.displayName} | ${reason}`, deleteMessageSeconds: deletionTime});
                } catch(error) {
                    console.error(error);
                }
                
                const permaEmbed = new EmbedBuilder()
                        .setAuthor({
                            name: `[BAN] ${target.username}`,
                            iconURL: target.displayAvatarURL({ format: 'jpg' })
                        })
                        .setColor(0xff0000)
                        .setTimestamp()
                        .setFooter({text:`ID: ${target.id}`})
                        .addFields(
                            {
                                name: 'User',
                                value: `${target}`,
                                inline: true
                            },
                            {
                                name: 'Moderator',
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: 'Expires',
                                value: 'Restricted',
                                inline: true
                            },
                            {
                                name: 'Reason',
                                value: `${reason}`,
                                inline: false
                            }
                        )
                if(logChannel) { // logging the ban
                    
                    await logChannel.send({embeds: [permaEmbed]});
                }
                // 0- warn; 1- timeout; 2- tempban; 3- indefinite ban; 4- permanent ban
                await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                    VALUES($1, $2, $3, $4, $5, $6)
                    `, [interaction.guild.id, target.id, interaction.user.id, 4, reason, parseInt(Date.now() / 1000)]);

                if(banlistData && banlistData?.length > 0) {
                    await poolConnection.query(`UPDATE banlist SET moderator=$1, expires=$2, reason=$3 WHERE guild=$4 AND target=$5`,
                        [interaction.user.id, 0, reason, interaction.guild.id, target.id]
                    );
                } else if(banlistData && banlistData?.length == 0) {
                    await poolConnection.query(`INSERT INTO banlist(guild, target, moderator, expires, reason)
                            VALUES($1, $2, $3, $4, $5)
                        `, [interaction.guild.id, target.id, interaction.user.id, 0, reason]);
                }

                const unbanPermaButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId('perma-unban')
                    .setLabel('Unban')

                const unbanPermaActionRow = new ActionRowBuilder()
                    .addComponents( unbanPermaButton );

                const permaBanResponse = await interaction.reply({
                    embeds: [permaEmbed],
                    components: [unbanPermaActionRow]
                });

                const permaBanResponseCollector = permaBanResponse.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.member.permissions.has(PermissionFlagsBits.Administrator),
                    time: 300_000
                });

                permaBanResponseCollector.on('collect', async (buttonInteraction) => {
                    buttonInteraction.showModal(unbanModal);
                    try{
                        const submitReason = await buttonInteraction.awaitModalSubmit({
                            filter: (i) => i.customId === `unban-modal-${interaction.user.id}`,
                            time: 300_000
                        });

                        await submitReason.deferReply();

                        const reason = submitReason.fields.getTextInputValue('unban-reason-input');
                        try {
                            await buttonInteraction.guild.bans.remove(target.id, reason);
                        } catch(err) {}
                        unbanPermaButton.setDisabled(true);
                        await permaBanResponse.edit({components: [unbanPermaActionRow]});
                        const embed = new EmbedBuilder()
                                .setAuthor({
                                    name: `[UNBAN] ${target.username}`,
                                    iconURL: target.displayAvatarURL({ format: 'jpg' })
                                })
                                .setColor(0x00ff01)
                                .setTimestamp()
                                .setFooter({text:`ID: ${target.id}`})
                                .addFields(
                                    {
                                        name: 'User',
                                        value: `${target}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Moderator',
                                        value: `${buttonInteraction.member}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason,
                                        inline: false
                                    }
                                )
                        if(logChannel) {
                            await logChannel.send({embeds: [embed]});
                        }
                        
                        await poolConnection.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`, [buttonInteraction.guild.id, target.id]);
                        await submitReason.editReply({embeds: [embed]})
                    } catch(err) {
                        await buttonInteraction.followUp({ephemeral: true, content: 'No reason was given before the time ended.'});
                    }
                    
                });

                permaBanResponseCollector.on('end', async () => {
                    await permaBanResponse.delete();
                });

            break;
            case "counter":
                await interaction.deferReply({ephemeral: false});
                const fetchAllBans = async (guild) => {
                    let allBans = new Map();
                    let lastBanId = null;
                    try {
                        while(true) {
                            const banBatch = await guild.bans.fetch({limit: 1000, after: lastBanId});
                            banBatch.forEach((ban, id) => allBans.set(id, ban));
                            if(banBatch.size < 1) break;
                            lastBanId = banBatch.lastKey();
                        }
                        return allBans.size;
                    } catch(error) {
                        console.error(error);
                    }
                }
                let resultData = await poolConnection.query(`SELECT expires FROM banlist WHERE guild=$1 AND expires=$2`,
                    [interaction.guild.id, 0]
                );
                const permaBanCount = resultData.rows.length;
                resultData = await poolConnection.query(`SELECT expires FROM banlist WHERE guild=$1 AND expires > $2`,
                    [interaction.guild.id, 0]
                )
                const tempBanCount = resultData.rows.length;

                await interaction.editReply({
                    ephemeral: false,
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({name: `${interaction.guild.name}'s ban counter`, iconURL: interaction.guild.iconURL({extension: 'png'})})
                            .setColor('Purple')
                            .addFields(
                                {
                                    name: 'Total',
                                    value: `${await fetchAllBans(interaction.guild)}`
                                },
                                {
                                    name: 'Temporary',
                                    value: `${tempBanCount}`
                                },
                                {
                                    name: 'Permanent',
                                    value: `${permaBanCount}`
                                }
                            )
                    ]
                });
            break;
            case "check":
                const checkBanMessage = await interaction.deferReply();
                let fetchBan = null;
                const checkEmbed = new EmbedBuilder();
                try{
                    fetchBan = await interaction.guild.bans.fetch(target.id);
                } catch(err) {
                    fetchBan = null;
                }

                if(!fetchBan) {
                    return await interaction.editReply({
                        embeds: [
                            checkEmbed.setColor('Red')
                                .setTitle('Invalid ban')
                                .setDescription(`${target} is not currently banned!`)
                        ]
                    });
                }

                checkEmbed.setColor('Aqua')
                    .setAuthor({name: `${target.username}'s ban details`, iconURL: target.displayAvatarURL({extension: 'png'})})
                    .addFields(
                        {
                            name: 'User',
                            value: `${target}`
                        }
                    );
                
                const {rows: banlist} = await poolConnection.query(`SELECT * FROM banlist WHERE guild=$1 AND target=$2`,
                    [interaction.guild.id, target.id]
                );
                const {rows: punishlogs} = await poolConnection.query(`SELECT * FROM punishlogs WHERE guild=$1 AND target=$2 AND punishment_type >= 2
                    ORDER BY timestamp DESC LIMIT 1`, [interaction.guild.id, target.id]);

                if(banlist.length > 0) {
                    checkEmbed.addFields(
                        {
                            name: 'Expires',
                            value: banlist[0].expires > 0 ? `<t:${banlist[0].expires}:R>` : "Restricted"
                        }
                    );
                }
                else {
                    checkEmbed.addFields(
                        {
                            name: 'Expires',
                            value: 'Indefinite'
                        }
                    );
                }

                if(punishlogs.length > 0) {
                    banType = {
                        2: "Temporary",
                        3: "Indefinite",
                        4: "Permanent"
                    }
                    checkEmbed.addFields(
                        {
                            name: 'Reason',
                            value: punishlogs[0].reason
                        },
                        {
                            name: 'Moderator',
                            value: `<@${punishlogs[0].moderator}>`
                        },
                        {
                            name: 'Ban Type',
                            value: banType[punishlogs[0].punishment_type]
                        },
                        {
                            name: "Date",
                            value: `<t:${punishlogs[0].timestamp}:R>`
                        }
                    )
                }
                else {
                    checkEmbed.addFields(
                        {
                            name: 'Reason',
                            value: fetchBan.reason
                        }
                    )
                }

                if(banlist[0]?.expires == 0) {
                    return await interaction.editReply({embeds: [checkEmbed]});
                }
                const checkUnban = new ButtonBuilder()
                    .setStyle(ButtonStyle.Danger)
                    .setLabel('Unban')
                    .setCustomId('unban-button')
                
                const checkUnbanActionRow = new ActionRowBuilder()
                    .addComponents( checkUnban );
                
                const checkBanCollector = checkBanMessage.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.member.permissions.has(PermissionFlagsBits.BanMembers)
                });

                await checkBanMessage.edit({
                    embeds: [checkEmbed],
                    components: [checkUnbanActionRow]
                });

                checkBanCollector.on('collect', async (buttonInteraction) => {
                    buttonInteraction.showModal(unbanModal);
                    try{
                        const submitReason = await buttonInteraction.awaitModalSubmit({
                            filter: (i) => i.customId === `unban-modal-${interaction.user.id}`,
                            time: 300_000
                        });

                        await submitReason.deferReply();

                        const reason = submitReason.fields.getTextInputValue('unban-reason-input');

                        try {
                            await buttonInteraction.guild.bans.remove(target.id, reason);
                        } catch(err) {}
                        checkUnban.setDisabled(true);
                        await checkBanMessage.edit({components: [checkUnbanActionRow]});
                        const embed = new EmbedBuilder()
                                .setAuthor({
                                    name: `[UNBAN] ${target.username}`,
                                    iconURL: target.displayAvatarURL({ format: 'jpg' })
                                })
                                .setColor(0x00ff01)
                                .setTimestamp()
                                .setFooter({text:`ID: ${target.id}`})
                                .addFields(
                                    {
                                        name: 'User',
                                        value: `${target}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Moderator',
                                        value: `${buttonInteraction.member}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason,
                                        inline: false
                                    }
                                )
                        if(logChannel) {
                            await logChannel.send({embeds: [embed]});
                        }
                        
                        await poolConnection.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`, [buttonInteraction.guild.id, target.id]);
                        await submitReason.editReply({embeds: [embed]})
                    } catch(err) {
                        await buttonInteraction.followUp({ephemeral: true, content: 'No reason was given before the time ended.'});
                    }
                    
                });

            break;
        }

    }
}