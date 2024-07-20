const {EmbedBuilder} = require("@discordjs/builders");
const { poolConnection } = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');


module.exports = {
    name: 'guildMemberRemove', // user-activity this event triggers when a member leaves the server
    async execute(member) {
        if(!member.joinedAt) return;
        if(member.user.bot) return;
        // logging when a member leaves the server
        const userLogs = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [member.guild.id, 'user-activity'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        const userLogsChannel = member.guild.channels.cache.get(result.rows[0].channel);
                        const userLogsEmbed = new EmbedBuilder()
                            .setAuthor(
                                {
                                    name: member.user.username,
                                    iconURL: member.displayAvatarURL({ format: 'jpg' })
                                }
                            )
                            .setTitle('User left')
                            .setDescription(`${member.user.username} left the server.`)
                            .setColor(0xfb0003)
                            .setTimestamp()
                            .setFooter({text:`ID: ${member.id}`})
                            .addFields(
                                {
                                    name: 'Joined the server',
                                    value: `${botUtils.formatDate(member.joinedAt)} | [${botUtils.formatTime(member.joinedAt)}]`
                                }
                            );
                        
                        userLogsChannel.send({embeds: [userLogsEmbed]});
                    }

                    resolve(result);
                }
            )
        });
        await userLogs;
    }
};