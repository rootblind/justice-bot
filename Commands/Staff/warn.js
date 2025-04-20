const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db');
const {warn_handler} = require('../../utility_modules/warn_handler.js');
/*
    Registering warnings
    Those warnings can be used by other systems to auto moderate or just for moderators to look up precedent offences
*/


module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member for breaking the rules.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to recieve a warn.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the warning.')
                .setMinLength(4)
                .setMaxLength(512)
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('send-dm')
                .setDescription('Announce the member of their warn.')
        )

    ,
    async execute(interaction, client) {
        let sendDM = interaction.options.getBoolean('send-dm');
        if(sendDM == null) sendDM = true;

        const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles
            WHERE guild=$1
                AND roletype=$2`, [interaction.guild.id, "staff"]);

        // checking if the server has a staff role configured
        if(staffRoleData.length == 0) {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Missing configuration')
                        .setDescription('An admin must use `/server-role` in order to set up a Staff role.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        let staffRole = await interaction.guild.roles.fetch(staffRoleData[0].role);
        if(!staffRole) {
            return await interaction.reply({flags: MessageFlags.Ephemeral, embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle("Error")
                    .setDescription("Something seems off about the staff role, try setting it up again.")
            ]});
        }

        // checking if user has the staff role
        if(!interaction.member.roles.cache.has(staffRole.id)) {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle("Missing staff role")
                        .setDescription(`You're missing the ${staffRole} role.`)
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        const user = interaction.options.getUser('member');
        let member = null;
        try { // throw an error if the user is not of this server
            member = await interaction.guild.members.fetch(user);
        } catch(err) {
            return await interaction.reply({flags: MessageFlags.Ephemeral, embeds: [
                new EmbedBuilder()
                    .setColor("Red")
                    .setTitle("Invalid member")
                    .setDescription("The member provided must be of this server!")
            ]});
        }

        if(member.roles.cache.has(staffRole.id)) {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle('Invalid member')
                        .setDescription('You cannot warn another staff member!')
                ],
                flags: MessageFlags.Ephemeral
            })
        }

        const reason = interaction.options.getString('reason');

        await interaction.deferReply();

        if(sendDM)
            try{
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setAuthor({name: `${interaction.user.username} gave you a warning`, iconURL: interaction.guild.iconURL({extension: 'png'})})
                            .setDescription(`You've been warned on **${interaction.guild.name}**!`)
                            .addFields(
                                {
                                    name: 'Moderator',
                                    value: interaction.user.username,
                                },
                                {
                                    name: 'Reason',
                                    value: reason
                                }
                            )
                            .setTimestamp()
                    ]
                });
            } catch(err) {}


        // there is a 5min window to remove the warn by any staff member, then only admins can do so by using another command
        const removeButton = new ButtonBuilder()
            .setCustomId('remove-button')
            .setLabel('Remove')
            .setStyle(ButtonStyle.Primary)

        const removeActionRow = new ActionRowBuilder().addComponents( removeButton );

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({name: `${user.username} has been warned`, iconURL: user.displayAvatarURL({extension: 'png'})})
            .addFields(
                {
                    name: 'Target',
                    value: `${member}`,
                    inline: true
                },
                {
                    name: 'Moderator',
                    value: `${interaction.member}`,
                    inline: true
                },
                {
                    name: 'Reason',
                    value: reason
                }
            )
            .setTimestamp()
            .setFooter({text: `ID: ${user.id}`});

        const warnMessage = await interaction.editReply({embeds: [embed], components: [removeActionRow]});

        const {rows: loggingData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`,
            [interaction.guild.id, "moderation"]
        );

        let logChannel = null;
        // logging the event
        if(loggingData.length > 0) {
            logChannel = await interaction.guild.channels.fetch(loggingData[0].channel);

            await logChannel.send({embeds: [embed]});
        }

        // inserting the warning into the database
        await warn_handler(interaction.guild, member, interaction.member, reason, logChannel);

        const warnTimestamp = parseInt(Date.now() / 1000); // in order to avoid removing the wrong warning, we will store the
        // approximative timestamp to compare upon using the remove button

        const collector = await warnMessage.createMessageComponentCollector({
            ComponentType: ComponentType.Button,
            time: 300_000,
            filter: (i) => i.member.roles.cache.has(staffRole.id)
        })

        collector.on('collect', async (buttonInteraction) => {
            await poolConnection.query(`DELETE FROM punishlogs
                WHERE guild=$1
                    AND target=$2
                    AND punishment_type=0
                    AND timestamp=(SELECT MAX(timestamp) FROM punishlogs WHERE guild=$1 AND target=$2 AND punishment_type=0 AND timestamp <= $3)`,
                    [buttonInteraction.guild.id, user.id, warnTimestamp]
                );
            removeButton.setDisabled(true)
            await warnMessage.edit({components: [removeActionRow]});
            const embedRemove = new EmbedBuilder()
                .setColor('Green')
                .setAuthor({name: `${user.username}'s warn was removed`, iconURL: user.displayAvatarURL({extension: 'png'})})
                .addFields(
                    {
                        name: 'Target',
                        value: user.username,
                        inline: true
                    },
                    {
                        name: 'Moderator',
                        value: buttonInteraction.user.username,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID ${buttonInteraction.user.id}`});
            await buttonInteraction.reply({embeds: [embedRemove]});

            if(logChannel) {
                await logChannel.send({embeds: [embedRemove]});
            }
        });

        collector.on('end', async () => {
            removeButton.setDisabled(true);
            try{
                await warnMessage.edit({components: [removeActionRow]});
            } catch(err) {};
        });
    }
}