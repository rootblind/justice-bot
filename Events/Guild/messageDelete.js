// Handling the event of a message being deleted

// logs and managing reaction roles messages being deleted.

const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {config} = require('dotenv');
const {EmbedBuilder} = require("@discordjs/builders");
const {AuditLogEvent} = require('discord.js')
const fs = require('fs');
const path = require('path');
config();

module.exports = {
    name: 'messageDelete', // message - when a message is deleted, this event is triggered
    async execute(message) {
        if(!message.guildId) return;
        if(message.member == null) return;
        if(message.member.user.bot) return;
        // checking if the channel where the message was deleted is on ignore list, otherwise, log the event in the specified channel
        const messageLogs = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT 1 FROM serverlogsignore WHERE guild=$1 AND channel=$2 LIMIT 1`, [message.guildId, message.channelId],
                (err, results) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(results.rows.length == 0) {
                        poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [message.guildId, 'messages'],
                            async (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                else if(result.rows.length > 0) {
                                    const messageLogEmbed = new EmbedBuilder();
                                    const logChannel = await message.guild.channels.cache.get(result.rows[0].channel);
                                    let logMessageDescription = ""; // forming the description message
                                    if(message.attachments.size) { // if attachments exist, they will be posted and added to the description
                                        await message.attachments.forEach(a => {
                                            logChannel.send({files:[a.url]});
                                            logMessageDescription += `[${a.name}](${a.url})\n`
                                        });

                                    }
                                    
                                    // logging the content and the author of the message

                                    if(message.content.length <= 3000)
                                        logMessageDescription += `${message.content}\n`;
                                    else
                                        {
                                            // if the content is over 3000, to avoid embed characters limitation, anything above 3000 characters will be
                                            // parsed into a txt file and then uploaded along the log message
                                            const filePath = path.join(__dirname, `../../temp/${message.id}.txt`);
                                            fs.writeFile(filePath, message.content, (err) => {
                                                console.error(err);
                                            });
                                            const sendFile = await logChannel.send({files:[filePath]});
                                            logMessageDescription += `[[content]](${sendFile.url})\n`;
                                            fs.unlink(filePath, (err) => {
                                                if(err) throw err;
                                            });
                                            
                                        }
                                    logMessageDescription += `\n**Message author**: ${message.member}\n`;
                                

                                    // sending a moderation log in case the message deletion generated a recent audit log about it
                                    const entry = await message.guild.fetchAuditLogs({
                                        type: AuditLogEvent.MessageDelete
                                    }).then(audit => audit.entries.first());

                                    
                                    
                                   
                                    //logging the channel where the message was created
                                    logMessageDescription += `**Channel**: ${message.channel}
                                            \n**[Jump to context](${message.url})**`
                                    
                                    // defining the embed
                                    messageLogEmbed
                                        .setAuthor(
                                            {
                                                name: `${message.author.username}`,
                                                iconURL: message.member.displayAvatarURL({ format: 'jpg' })
                                            }
                                        )   
                                        .setColor(0xfb0003)
                                        .setTitle('🧹Message deleted')
                                        .setDescription(logMessageDescription)
                                        .setTimestamp()
                                        .setFooter({text:`ID: ${message.member.id}`});
                                    
                                    const context = await logChannel.send({embeds: [messageLogEmbed]}); // sending the embed to the defined channel for logging
                                    
                                    if(entry.extra?.channel.id == message.channel.id &&
                                        entry.targetId == message.author.id &&
                                        entry.createdTimestamp > (Date.now() - 2000) && !entry.target.bot){
                                        let modChannel = null;
                                        const fetchModLogs = new Promise((resolve, reject) => {
                                            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [message.guild.id, 'moderation'],
                                                (err, result) => {
                                                    if(err) {
                                                        console.error(err);
                                                        reject(err);
                                                    }
                                                    else if(result.rows.length > 0) {
                                                        modChannel = message.guild.channels.cache.get(result.rows[0].channel);
                                                    }
                                                    resolve(result);
                                                }
                                            )
                                        });
                                        await fetchModLogs;
                                        if(modChannel != null) {
                                            const embed = new EmbedBuilder()
                                                .setTitle('Action context')
                                                .addFields(
                                                    {
                                                        name: `Moderator`,
                                                        value: `${entry.executor}`,
                                                        inline: true
                                                    },
                                                    {
                                                        name: 'Message',
                                                        value: `[click](${message.url})`,
                                                        inline: true
                                                    },
                                                    {
                                                        name: 'Logs',
                                                        value: `[click](${context.url})`,
                                                        inline: true
                                                    }
                                                )
                                                .setColor(0xff0005)
                                                .setTimestamp()
                                                .setFooter({text:`Message ID: ${message.id}`})
                                            await modChannel.send({embeds:[embed]});
                                        }
                                    }

                                }
                            }
                        )
                    }
                    resolve(results);
                }
            )
        });
        await messageLogs;

        // if the message was used for reaction roles, the rows will be deleted
        const reactionRolePromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT messageid FROM reactionroles
                                    WHERE guild=$1 AND
                                        channel=$2 AND
                                        messageid=$3`,
                [message.guildId, message.channelId, message.id],
                async (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        poolConnection.query(`DELETE FROM reactionroles WHERE messageid=$1`, [message.id]);
                    }
                    resolve(result);
                })
            });

        await reactionRolePromise;
        
        // if the message was a select menu, the rows will be deleted
        const panelRolePromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT messageid FROM panelmessages
                                    WHERE guild=$1 AND
                                        channel=$2 AND
                                        messageid=$3`,
                [message.guildId, message.channelId, message.id],
                async (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        poolConnection.query(`DELETE FROM panelmessages WHERE messageid=$1`, [message.id]);
                    }
                    resolve(result);
                })
            });

        await panelRolePromise;
        
    }
};