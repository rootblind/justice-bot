const {EmbedBuilder, AuditLogEvent, Events} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');

module.exports = {
    name: Events.GuildAuditLogEntryCreate,

    async execute(auditLogEntry, guild) {
        if(!auditLogEntry) return;
        if(!auditLogEntry.target) return;

        let logChannel = null;
        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [guild.id, 'moderation'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        if(auditLogEntry.action == AuditLogEvent.MessageDelete) {
            if(auditLogEntry.target.bot) return;
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `${auditLogEntry.executor.username} deleted a message.`,
                    iconURL: auditLogEntry.executor.displayAvatarURL({extension: 'jpg'})
                })
                .setDescription('For details, look up the messages logging channel or the context message.')
                .setColor(0xff0005)
                .setTimestamp()
                .setFooter({text:`Target ID: ${auditLogEntry.target.id}`})
                .addFields(
                    {
                        name: 'Moderator',
                        value: `${auditLogEntry.executor}`,
                        inline: true
                    },
                    {
                        name: 'Target',
                        value: `${auditLogEntry.target}`,
                        inline: true
                    },
                    {
                        name: "In channel",
                        value: `${auditLogEntry.extra.channel}`,
                        inline: true
                    }
                );
            await logChannel.send({embeds:[embed]});

        } else if(auditLogEntry.action == AuditLogEvent.MemberUpdate){

            const targetMember = await guild.members.fetch(auditLogEntry.targetId);

            if(auditLogEntry.changes[0]['key'] == 'communication_disabled_until' &&
                auditLogEntry.changes[0]['new']

            ){

                const targetMember = await guild.members.fetch(auditLogEntry.targetId);
                const embed = new EmbedBuilder()
                    .setTitle('Member timed out')
                    .setAuthor({
                        name: `${auditLogEntry.target.username}`,
                        iconURL: targetMember.displayAvatarURL({extension: 'jpg'})
                    })
                    .addFields(
                        {
                            name: 'Moderator',
                            value: `${auditLogEntry.executor}`,
                            inline: true
                        },
                        {
                            name: 'Target',
                            value: `${targetMember}`,
                            inline: true
                        },
                        {
                            name: 'Expiration',
                            value:`${botUtils.formatDate(targetMember.communicationDisabledUntil)} - ${botUtils.formatTime(targetMember.communicationDisabledUntil)}`
                        }
                    )
                    .setTimestamp()
                    .setColor(0xff0005)
                    .setFooter({text: `Target ID: ${auditLogEntry.targetId}`});

                await logChannel.send({embeds: [embed]});

            } else if(auditLogEntry.changes[0]['key'] == 'communication_disabled_until' &&
                !auditLogEntry.changes[0]['new']) {
                        const embed = new EmbedBuilder()
                        .setTitle('Member unmuted')
                        .setAuthor({
                            name: `${auditLogEntry.target.username}`,
                            iconURL: targetMember.displayAvatarURL({extension: 'jpg'})
                        })
                        .addFields(
                            {
                                name: 'Moderator',
                                value: `${auditLogEntry.executor}`,
                                inline: true
                            },
                            {
                                name: 'Target',
                                value: `${targetMember}`,
                                inline: true
                            }
                        )
                        .setTimestamp()
                        .setColor(0x2596be)
                        .setFooter({text: `Target ID: ${auditLogEntry.targetId}`});

                    await logChannel.send({embeds: [embed]});
                }

            
        }

        return;

    }
};