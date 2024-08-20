const {EmbedBuilder, AuditLogEvent} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');

module.exports = {
    name: 'guildBanAdd',
    async execute(ban) {
        if(!ban.guild.id) return;
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [ban.guild.id, 'moderation'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = ban.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        const fetchAudit = await ban.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanAdd,
            limit: 1,
        });

        const fetchEntry = fetchAudit.entries.first();
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `[BAN] ${ban.user.username}`,
                iconURL: ban.user.displayAvatarURL({ format: 'jpg' })
            })
            .setColor(0xff0000)
            .setTimestamp()
            .setFooter({text:`ID: ${ban.user.id}`})
            .addFields(
                {
                    name: 'User',
                    value: `${ban.user}`,
                    inline: true
                },
                {
                    name: 'Moderator',
                    value: `${fetchEntry.executor}`,
                    inline: true
                },
                {
                    name: 'Reason',
                    value: `${fetchEntry.reason || 'No reason specified'}`,
                    inline: false
                }
            )
        await logChannel.send({embeds: [embed]});
    }

};