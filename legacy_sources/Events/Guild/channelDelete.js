// handling the event of a channel being deleted
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require("@discordjs/builders");
const {AuditLogEvent} = require('discord.js');

async function clearDB(channel, table) {
    const checkPromise = new Promise((resolve, reject) => {
        poolConnection.query(`SELECT * FROM ${table} WHERE guild=$1 AND channel=$2`, [channel.guild.id, channel.id],
            (err, result) => {
                if(err) {
                    console.error(err);
                    reject(err);
                }
                if(result.rows.length > 0) {
                    poolConnection.query(`DELETE FROM ${table} WHERE guild=$1 AND channel=$2`, [channel.guild.id, channel.id]);
                }
                resolve(result);
            }
        );
    });
    await checkPromise;
}


module.exports = {
    name: 'channelDelete',

    async execute(channel) {
        if(!channel.guildId) return;
        if(!channel.id) return;

        // handling when a logging channel or ignored channel is deleted
        // so if a channel no longer exists, will update the database in order for the bot to avoid trying to access an unexisting channel
        await clearDB(channel, 'serverlogsignore');
        await clearDB(channel, 'serverlogs');
        await clearDB(channel,'panelmessages');
        await clearDB(channel,'reactionroles');
        await clearDB(channel,'welcomescheme');
        await clearDB(channel, 'serverlfgchannel');
        await clearDB(channel, "autovoiceroom");


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
            type: AuditLogEvent.ChannelDelete,
            limit: 1,
        });

        const fetchEntry = fetchAudit.entries.first();

        if(fetchEntry.executor.bot) return; // ignore bot actions

        const embed = new EmbedBuilder()
            .setTitle('Channel Deleted')
            .setAuthor({
                name: fetchEntry.executor.username,
                iconURL: fetchEntry.executor.displayAvatarURL({ format: 'jpg' })
            })
            .setColor(0xfb0505)
            .setDescription(`${fetchEntry.executor} deleted **#${channel.name}**.`)
            .setTimestamp()
            .setFooter({text:`ID: ${fetchEntry.executorId}`});
    
        await logChannel.send({embeds: [embed]});
    }
};