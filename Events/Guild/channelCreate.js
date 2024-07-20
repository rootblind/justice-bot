// handling the event of a channel being created
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require("@discordjs/builders");
const {AuditLogEvent, ChannelType} = require('discord.js');

module.exports = {
    name: 'channelCreate',

    async execute(channel) {
        if(!channel.guildId) return;
        if(!channel.id) return;
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [channel.guildId, 'server-activity'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = channel.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        const fetchAudit = await channel.guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelCreate,
            limit: 1,
        });

        const fetchEntry = fetchAudit.entries.first();

        if(fetchEntry.executor.bot) return; // ignore bot actions

        let channelType = "";
        // adding the information of what kind of channel was created
        switch(channel.type) {
            case ChannelType.GuildAnnouncement:
                channelType = "announcement";
                break;
            case ChannelType.GuildCategory:
                channelType = "category";
                break;
            case ChannelType.GuildText:
                channelType = "text";
                break;
            case ChannelType.GuildVoice:
                channelType = "voice";
                break;
            case ChannelType.GuildForum:
                channelType = "forum";
                break;
            case ChannelType.GuildStageVoice:
                channelType = "stage";
                break;
        }
        
        // also add to the description the type of channel that was created
        const embed = new EmbedBuilder()
            .setTitle('Channel Created')
            .setAuthor({
                name: fetchEntry.executor.username,
                iconURL: fetchEntry.executor.displayAvatarURL({ format: 'jpg' })
            })
            .setColor(0x05fb29)
            .setDescription(`${fetchEntry.executor} created **${channel} ${channelType}** channel.`)
            .setTimestamp()
            .setFooter({text:`ID: ${fetchEntry.executorId}`});
        
        await logChannel.send({embeds: [embed]});
    }
};