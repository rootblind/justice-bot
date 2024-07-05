// Handling the event of a message being deleted

// logs and managing reaction roles messages being deleted.

const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
const {EmbedBuilder} = require("@discordjs/builders");
const {AuditLogEvent} = require('discord.js')
config();

module.exports = {
    name: 'messageDelete', // when a message is deleted, this event is triggered
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
                                    let logMessageDescription = "";
                                    if(message.attachments) {
                                        await message.attachments.forEach(a => {
                                            logChannel.send({files:[a.url]});
                                            logMessageDescription += `[${a.name}](${a.url})\n`
                                        });

                                    }
                                    
                                    logMessageDescription += `${message.content}\n
                                            **Message author**: ${message.member}\n`;
                                    await message.guild.fetchAuditLogs({
                                        type: AuditLogEvent.MessageDelete,
                                    })
                                    .then(async audit => {
                                        const {executor} = audit.entries.first();
                                        if(executor != message.author)
                                            logMessageDescription += `**Deleted by**: ${executor}\n`
                                    });
                                    logMessageDescription += `**Channel**: ${message.channel}
                                            **[Jump to context](${message.url})**`
                                    
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
                                    
                                    await logChannel.send({embeds: [messageLogEmbed]});


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