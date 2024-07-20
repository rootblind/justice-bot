// Handling the event of a message being edited
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require("@discordjs/builders");
const fs = require("fs");
const path = require("path");


module.exports = {
    name: 'messageUpdate', // message - when a message is being edited, the event will trigger

    async execute(oldMessage, newMessage) {
        
        //logging only valid messages (the bot doesn't cache messages older than his execution start time)
        if(oldMessage.member == null) return;
        // logging only guild messages
        if(!oldMessage.guildId) return;

        // ignore bots
        if(oldMessage.member.user.bot) return;

        let isChannelIgnored = false; // a switch variable for whether the channel is ignored or not

        const checkIgnoreList = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT 1 FROM serverlogsignore WHERE guild=$1 AND channel=$2 LIMIT 1`,
                [oldMessage.guildId, oldMessage.channelId],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) { // if the channel is ignored, there is a row in the database that
                                                    // contains the combination of the channel and guild ids
                        isChannelIgnored = true;
                    }
                    resolve(result);
                }
            );
        });
        await checkIgnoreList;

        if(isChannelIgnored == true) return; // if the channel is ignored, do not log events emmited from here

        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [oldMessage.guildId, 'messages'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = oldMessage.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return;

        let logMessageDescription = "**Old message**:\n";

        if(oldMessage.content.length <= 1500)
            logMessageDescription += `${oldMessage.content || "[no content]\n"}`; // the description message that will be constructed
            // the strategy is to build the old message section, the new message section and the bottom section in this order
            // composing the description if the old message has attachments
            // to avoid duplication, the new message will be where the attachements are sent directly to the channel
        else
            {
                // if the content is over 3000, to avoid embed characters limitation, anything above 3000 characters will be
                // parsed into a txt file and then uploaded along the log message
                const oldFilePath = path.join(__dirname, `../../temp/old-${oldMessage.id}.txt`);
                await fs.promises.writeFile(oldFilePath, oldMessage.content, (err) => {
                    console.error(err);
                });
                const sendOldFile = await logChannel.send({files:[oldFilePath]});
                logMessageDescription += `[[content]](${sendOldFile.url})\n`;
                await fs.promises.unlink(oldFilePath, (err) => {
                    if(err) throw err;
                });
            }
        if(oldMessage.attachments.size) {
            logMessageDescription += `\n[file(s)]\n`
            await oldMessage.attachments.forEach(a => {
                logMessageDescription += `[${a.name}](${a.url})\n`
            });
        }

        // composing the description for new message

        logMessageDescription += `\n\n**New message**:\n`
        
        if(newMessage.content.length <= 1500)
            logMessageDescription += `${newMessage.content || "[no content]\n"}`
        else {
            const newFilePath = path.join(__dirname, `../../temp/new-${newMessage.id}.txt`);
            await fs.promises.writeFile(newFilePath, newMessage.content, (err) => {
                console.error(err);
            });
            const sendNewFile = await logChannel.send({files:[newFilePath]});
            logMessageDescription += `[[content]](${sendNewFile.url})\n`;
            await fs.promises.unlink(newFilePath, (err) => {
                    if(err) throw err;
                });
        }

        if(newMessage.attachments.size) {
            logMessageDescription += `\n[file(s)]\n`
            await newMessage.attachments.forEach(a => {
                logMessageDescription += `[${a.name}](${a.url})\n`
                logChannel.send({files: [a.url]})
            });
        }

        logMessageDescription += `\n\n**Message Author**: ${oldMessage.author}\n**Channel**: ${oldMessage.channel}\n\n**[Jump to context](${newMessage.url})**`

        const messageUpdateEmbed = new EmbedBuilder()
            .setAuthor({
                name: oldMessage.author.username,
                iconURL: oldMessage.member.displayAvatarURL({ format: 'jpg' })
            })
            .setColor(0x2596be)
            .setTitle(`📝 Message Edited`)
            .setDescription(logMessageDescription)
            .setTimestamp()
            .setFooter({text:`ID: ${oldMessage.member.id}`});
        
        await logChannel.send({embeds: [messageUpdateEmbed]});
    }
};