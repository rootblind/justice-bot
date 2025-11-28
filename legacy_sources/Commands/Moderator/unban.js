const {EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, MessageFlags} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban the targeted user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to be unbanned.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason to be unbanned.')
                .setRequired(true)
                .setMinLength(4)
                .setMaxLength(512)
        ),
        cooldown: 5,
        botPermissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.BanMembers
        ]

    ,
    async execute(interaction, client) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');
        const {rows: banlist} = await poolConnection.query(`SELECT expires FROM banlist WHERE guild=$1 AND target=$2`,
            [interaction.guild.id, target.id]);

        if(banlist.length > 0) {
            if(banlist[0].expires == 0) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('Wrong unban method!')
                            .setDescription('You are trying to unban someone that is permanently banned!\nYou need administrative permissions and to use `/unban-perma` in order to do so.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        try {
            const bannedMember = await interaction.guild.bans.fetch(target.id);
        } catch(err) {
            // can not unban someone that is not banned
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Invalid target!')
                        .setDescription('You are trying to unban someone that is not currently banned!')
                ]
            });
        }

        try{
            await interaction.guild.bans.remove(target.id, reason);
        } catch(err) {
            console.error(err);
        }

        await poolConnection.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`, [interaction.guild.id, target.id]);

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
                    value: `${interaction.member}`,
                    inline: true
                },
                {
                    name: 'Reason',
                    value: reason,
                    inline: false
                }
            )
        if(logChannel) {
            await logChannel.send({
                embeds: [
                    embed
                ]
            });
        }

        await interaction.reply({embeds: [embed]});
        
    }
}