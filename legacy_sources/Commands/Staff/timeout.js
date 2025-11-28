const {SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits} = require('discord.js');

const {poolConnection} = require('../../utility_modules/kayle-db.js')
const {warn_handler} = require('../../utility_modules/warn_handler.js');
const warn = require('./warn.js');

const duration_conversion = {
    "5m": 300_000,
    "1h": 3_600_000,
    "6h": 21_600_000,
    "1d": 86_400_000,
    "2d": 172_800_000
}
module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Set a member with a timeout or remove the current timeout.')
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Sets a timeout for a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to be timed out.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The duration of the timeout.')
                        .addChoices(
                            {
                                name: "5 minutes",
                                value: "5m"
                            },
                            {
                                name: "1 hour",
                                value: "1h"
                            },
                            {
                                name: "6 hours",
                                value: "6h"
                            },
                            {
                                name: "1 day",
                                value: "1d"
                            },
                            {
                                name: "2 days",
                                value: "2d"
                            }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason of the timeout')
                        .setMinLength(4)
                        .setMaxLength(512)
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('apply-warn')
                        .setDescription("Apply a warn on top of the timeout.")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Removes the current timeout of the member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove the timeout from')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason of the timeout being removed early.')
                        .setMinLength(4)
                        .setMaxLength(512)
                        .setRequired(true)
                )
        ),
        cooldown: 5,
        botPermissions: [
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks
        ],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype=$2`,
            [interaction.guild.id, "staff"]
        );

        if(staffRoleData.length == 0) {
            return await interaction.reply({
                embeds: [
                        new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('No staff role on this server')
                        .setDescription('A staff role must be set up in order for this command to work.')
                ],
                flags: MessageFlags.Ephemeral

            });
        }

        const staffRole = await interaction.guild.roles.fetch(staffRoleData[0].role);

        if(!staffRole) {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Invalid staff role')
                        .setDescription('The current staff role is invalid, set a new one.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        if(!interaction.member.roles.cache.get(staffRole.id))
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Missing Permission')
                        .setDescription('You lack the staff role of this server.')
                ],
                flags: MessageFlags.Ephemeral
            });

        let member = null;
        try{
            member = await interaction.guild.members.fetch(user.id);
        }catch(err) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Invalid target')
                        .setDescription('The user provided is not valid or not a member of this server.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        const {rows: modlogsData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`,
            [interaction.guild.id, 'moderation']
        );

        let logChannel = null;
        if(modlogsData.length > 0) {
            try{
                logChannel = await interaction.guild.channels.fetch(modlogsData[0].channel);
            } catch(err) {};
        }

        const cmd = interaction.options.getSubcommand();
        const embed = new EmbedBuilder()
        switch(cmd) {
            case 'set':
                if(member.roles.cache.get(staffRole.id) || member.id == interaction.client.user.id){
                    return await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Invalid target')
                                .setDescription('You can not time out another staff member or myself!')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }
                await interaction.deferReply();

                const duration = duration_conversion[interaction.options.getString('duration')];
                await member.timeout(duration, reason);

                let applyWarn = interaction.options.getBoolean('apply-warn');
                if(applyWarn == null) applyWarn = true; // enabled by default

                embed.setColor('Red')
                    .setAuthor({
                        name: `${user.username} got timed out for ${interaction.options.getString('duration')}`,
                        iconURL: user.displayAvatarURL({extension: 'png'})
                    })
                    .setTimestamp()
                    .setFooter({text: `Target ID: ${user.id}`})
                
                if(logChannel) {
                    embed.setFields(
                        {
                            name: "Target",
                            value: `${member}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.member}`,
                            inline: true
                        },
                        {
                            name: "Expires",
                            value: `<t:${parseInt((Date.now() + duration) / 1000)}:R>`,
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )

                    if(applyWarn)
                        embed.addFields(
                            {
                                name: "Warned",
                                value: "True"
                            }
                        );
                    await logChannel.send({
                        embeds: [
                            embed
                        ]
                    });
                }
                await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                        VALUES($1, $2, $3, $4, $5, $6)`,
                        [interaction.guild.id, user.id, interaction.user.id, 1, reason, parseInt(Date.now() / 1000)]
                );

                embed.setFields(
                    {
                        name: "Moderator",
                        value: `${interaction.member}`,
                        inline: true
                    },
                    {
                        name: "Expires",
                        value: `<t:${parseInt((Date.now() + duration) / 1000)}:R>`,
                        inline: true
                    },
                    {
                        name: "Reason",
                        value: reason
                    }
                )
                
                if(applyWarn)
                    embed.addFields(
                        {
                            name: "Warned",
                            value: "True"
                        }
                    )
                await interaction.editReply({
                    embeds: [
                        embed
                    ]
                });

                if(applyWarn) await warn_handler(interaction.guild, member, interaction.member, reason, logChannel);
            
            break;
            case 'remove':
                if(member.communicationDisabledUntil == null) {
                    return await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('Invalid target')
                                .setDescription('The member is not currently timed out.')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }
                await interaction.deferReply();
                await member.timeout(null, reason);
                const embedRemoved = new EmbedBuilder()
                    .setColor(0x2596be)
                    .setTitle("Member unmuted")
                    .setAuthor({name: user.username, iconURL: user.displayAvatarURL({extension: 'png'})})
                    .setFields(
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Target",
                            value: `${user}`,
                            inline: true
                        },
                        {
                            name: 'Reason',
                            value: reason
                        }
                    )
                    .setTimestamp()
                    .setFooter({text: `Target ID: ${user.id}`});
                if(logChannel) {
                    logChannel.send({embeds: [embedRemoved]});
                }
                await interaction.editReply({embeds: [embedRemoved]});
            break;
        }
        

        


    }
}