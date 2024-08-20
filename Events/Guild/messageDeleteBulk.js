const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require("@discordjs/builders");
const fs = require('graceful-fs');
const path = require('path');
const botUtils = require('../../utility_modules/utility_methods.js');

module.exports = {
    name: 'messageDeleteBulk',
    async execute(messages, channel) {
        if(!channel.guildId) return;
        if(!channel.id) return;
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [channel.guildId, 'messages'],
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

        let isChannelIgnored = false;

        const fetchIgnoreList = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogsignore WHERE guild=$1 AND channel=$2`, [channel.guildId, channel.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        isChannelIgnored = true
                    }
                    resolve(result);
                }
            );
        });
        await fetchIgnoreList;

        if(isChannelIgnored) return; // if the channel is ignored from this type of logging, ignore the event

        const embed = new EmbedBuilder()
            .setTitle('🧹🧹Messages bulk deletion')
            .setColor(0xfb0003)
            .setTimestamp();
        
        const filePath = path.join(__dirname, `../../temp/bulkDeleteOn-${channel.id}.txt`); // setting path of the temporary file

        let messagesFormatted = `In channel #${channel.name} (${channel.id})\n\n`

        messages.forEach((message) => { // trying to log each message from the bulk deletion into the temp file
            /*
                message attachments can be added if needed
            */
           
            // do note that like any other command that depends on cache, there is no information that the bot
            // can retrieve through this event if it wasn't active at the time of the message being created in order to add it to the
            // cache
            const date = new Date(message.createdTimestamp);
            const username = message.author ? message.author.username : "Not fetched";
            const id = message.author ? message.author.id : "Not fetched"
            messagesFormatted +=`[${username}] [${id}] At ${botUtils.formatDate(date)} | ${botUtils.formatTime(date)} - Message:\n${message.content || "no content fetched"}\n`
        });
        // writing the string of all messages to the temp file
        fs.writeFile(filePath, messagesFormatted);
        // sending the temp file to the logging channel
        const sendFile = await logChannel.send({files:[filePath]});
        // we no longer need the temp file so it can be deleted now
        fs.unlink(filePath, (err) => {
            if(err) throw err;
        });

        embed.setDescription(`The log file: [click](${sendFile.url})`);

        await logChannel.send({embeds: [embed]});
    }
};