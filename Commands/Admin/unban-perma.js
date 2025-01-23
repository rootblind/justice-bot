const {EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle,
    ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban-perma')
        .setDescription('Unban permanently banned users.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to be unbanned.')
                .setRequired(true)
        )

    ,
    async execute(interaction, client) {
        const target = interaction.options.getUser('target');
        const {rows: banlist} = await poolConnection.query(`SELECT * FROM banlist WHERE guild=$1 AND target=$2`,
            [interaction.guild.id, target.id]);

        const punishmentDict = {
            0: 'Warn',
            1: 'Timeout',
            2: 'Tempban',
            3: 'Indefinite ban',
            4: 'Permaban'
        }

        if(banlist.length > 0) {
            if(banlist[0].expires != 0) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('Wrong unban method!')
                            .setDescription('You are trying to unban someone that is NOT permanently banned!\nYou need to use `/unban` in order to do so.')
                    ],
                    ephemeral: true
                });
            }
        }
        
        const {rows: punishlogsData} = await poolConnection.query(`SELECT target FROM punishlogs WHERE guild=$1 AND target=$2`,
            [interaction.guild.id, target.id]
        );
        const {rows: punishlogs} = await poolConnection.query(`SELECT * FROM punishlogs WHERE guild=$1 AND target=$2
            ORDER BY timestamp DESC LIMIT 8`,
            [interaction.guild.id, target.id]
        );

        const unbanButton = new ButtonBuilder()
            .setCustomId('unban-button')
            .setStyle(ButtonStyle.Danger)
            .setLabel('Unban')

        const modal = new ModalBuilder()
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
        modal.addComponents(reasonActionRow);

        const unbanActionRow = new ActionRowBuilder().addComponents( unbanButton );

        const embed = new EmbedBuilder()
            .setColor('Aqua')
            .setAuthor({name: `${target.username}'s punishment logs`, iconURL: target.displayAvatarURL({extension: 'png'})})
            .setDescription(`Punishments displayed: \`${punishlogs.length} / ${punishlogsData.length}\``);

        let counter = 1;
        for(let row of punishlogs) {
            embed.addFields(
                {
                    name: `[${counter++}] - Punishment Type`,
                    value: `${punishmentDict[row.punishment_type]}`,
                },
                {
                    name: 'Timestamp',
                    value: `<t:${row.timestamp}:R>`,
                },
                {
                    name: 'Reason',
                    value: `${row.reason}`,
                },
            )
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

        const message = await interaction.reply({embeds: [embed], components: [unbanActionRow]});

        const messageCollector = message.createMessageComponentCollector({
            ComponentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 300_000
        });

        messageCollector.on('collect', async (buttonInteraction) => {
            buttonInteraction.showModal(modal)
            try {
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
                /*
                    TODO: Probation member logic
                */

                unbanButton.setDisabled(true);
                await message.edit({components: [unbanActionRow]});
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
            }catch (err) {
                await buttonInteraction.followUp({ephemeral: true, content: 'No reason was given in time, try again.'});
            }
        });

        messageCollector.on('end', async () => {
            await message.delete();
        });


        
    }
}