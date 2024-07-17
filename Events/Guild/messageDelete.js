// Handling the event of a message being deleted

// logs and managing reaction roles messages being deleted.

const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
const {EmbedBuilder} = require("@discordjs/builders");
const fs = require('fs');
const path = require('path');
config();

module.exports = {
    name: 'messageDelete', // message - when a message is deleted, this event is triggered
    async execute(message) {
        if(!message.guildId) return;
        if(message.member == null) return;
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
                                    logMessageDescription += `**Message author**: ${message.member}\n`;
                                
                                    /*
                                    This code was left commented since it doesn't do its job properly
                                    will be left so as reference until resolved

                                    const entry = await message.guild.fetchAuditLogs({
                                        type: AuditLogEvent.MessageDelete
                                    }).then(audit => audit.entries.first());

                                    if(entry.extra.channel.id === message.channel.id &&
                                        (entry.target.id === message.author.id)

                                    ) {
                                        if(entry.extra.count == 1 && (entry.createdTimestamp > (Date.now() - 2000)) ||
                                        entry.extra.count > 1 && entry.changes
                                    )

                                        logMessageDescription += `**Deleted by**: ${entry.executor}\n`;
                                    }
                                    */
                                   
                                    //logging the channel where the message was created
                                    logMessageDescription += `**Channel**: ${message.channel}
                                            **[Jump to context](${message.url})**`
                                    
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
                                    
                                    await logChannel.send({embeds: [messageLogEmbed]}); // sending the embed to the defined channel for logging


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