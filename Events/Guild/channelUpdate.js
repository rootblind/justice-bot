// handling the event of a channel being edited
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require("@discordjs/builders");
const {AuditLogEvent} = require('discord.js');

module.exports = {
    name: 'channelUpdate',

    async execute(oldChannel, newChannel) {
        if(!oldChannel.guildId) return;
        if(!oldChannel.id) return;
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [oldChannel.guildId, 'server-activity'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = oldChannel.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        const fetchAudit = await oldChannel.guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelUpdate,
            limit: 1,
        });

        const fetchEntry = fetchAudit.entries.first();

        let description = "";
        const embed = new EmbedBuilder()
        .setTitle('Channel Updated')
        .setAuthor({
            name: fetchEntry.executor.username,
            iconURL: fetchEntry.executor.displayAvatarURL({ format: 'jpg' })
        })
        .setColor(0x05f5fb)
        .setTimestamp()
        .setFooter({text:`ID: ${fetchEntry.executorId}`});

        if(oldChannel.name != newChannel.name)
            description += `**Name change**: ${oldChannel.name} -> ${newChannel.name}`;
        else return;

        embed.setDescription(description);

        logChannel.send({embeds: [embed]});
        

    }
};