const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');

const {poolConnection} = require('../../utility_modules/kayle-db.js')

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
                ephemeral: true

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
                ephemeral: true
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
                ephemeral: true
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
                ephemeral: true
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
                        ephemeral: true
                    });
                }
                await interaction.deferReply();
                const duration = duration_conversion[interaction.options.getString('duration')];
                await member.timeout(duration, reason);
                embed.setColor('Red')
                    .setAuthor({
                        name: `${user.username} got timed out for ${interaction.options.getString('duration')}`,
                        iconURL: user.displayAvatarURL({extension: 'png'})
                    })
                    .setTimestamp()
                    .setFooter({text: `Target ID: ${user.id}`})
                
                if(logChannel) {
                    await logChannel.send({
                        embeds: [
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
                        ]
                    });
                }
                await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                        VALUES($1, $2, $3, $4, $5, $6)`,
                        [interaction.guild.id, user.id, interaction.user.id, 1, reason, parseInt(Date.now() / 1000)]
                );
                await interaction.editReply({
                    embeds: [
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
                    ]
                });
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
                        ephemeral: true
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