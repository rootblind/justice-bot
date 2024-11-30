const {EmbedBuilder, AuditLogEvent} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {config} = require('dotenv');
config();
module.exports = {
    name: 'guildBanRemove',
    async execute(ban) {
        if(!ban) return;

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
        
        // removing perma bans must be done through the bot
        const {rows: banData} = await poolConnection.query(`SELECT * FROM banlist WHERE guild=$1 AND target=$2 AND expires=$3`,
            [ban.guild.id, ban.user.id, 0]
        );

        if(banData.length > 0) {
            try{
                await ban.guild.bans.create(ban.user.id, {reason: 'The member is permanently banned and the ban was revoked through an illegal way.'})
            } catch (error) {
                console.error(error);
            }
            if(logChannel != null) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
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
                                    value: `<@${process.env.CLIENT_ID}>`,
                                    inline: true
                                },
                                {
                                    name: 'Reason',
                                    value: `Illegal removal of the ban.`,
                                    inline: false
                                }
                            )
                    ]
                })
            }
            return;
        }
        // removing the ban from database if it exists
        await poolConnection.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`, [ban.guild.id, ban.user.id]);

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        const fetchAudit = await ban.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 1,
        });

        const fetchEntry = fetchAudit.entries.first();
        if(fetchEntry.executor.id == process.env.CLIENT_ID) return;
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `[UNBAN] ${ban.user.username}`,
                iconURL: ban.user.displayAvatarURL({ format: 'jpg' })
            })
            .setColor(0x00ff01)
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