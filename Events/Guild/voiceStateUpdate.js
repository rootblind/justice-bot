const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require('discord.js')

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        if(!oldState) return;

        if(oldState.member.user.bot) return; // ignore bots

        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [oldState.guild.id, 'voice'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = oldState.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing
        const color = 0x2596be;
        if(!oldState.channelId) {
            const embed = new EmbedBuilder()
                .setDescription('Member just joined voice.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'Joined',
                        value: `${newState.channel}`,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            
            await logChannel.send({embeds:[embed]});

        } else if(!newState.channelId) {
            const embed = new EmbedBuilder()
                .setDescription('Member just left voice.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'Left',
                        value: `${oldState.channel}`,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setDescription('Member changed channels.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'From',
                        value: `${oldState.channel}`,
                        inline: true
                    },
                    {
                        name: 'To',
                        value: `${newState.channel}`,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(!oldState.serverMute && newState.serverMute) {
            const embed = new EmbedBuilder()
                .setDescription('Member was muted.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Muted',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(oldState.serverMute && !newState.serverMute) {
            const embed = new EmbedBuilder()
                .setDescription('Member was unmuted.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Unmuted',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(!oldState.serverDeaf && newState.serverDeaf) {
            const embed = new EmbedBuilder()
                .setDescription('Member was deafened.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Deafened',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(oldState.serverDeaf && !newState.serverDeaf) {
            const embed = new EmbedBuilder()
                .setDescription('Member was undeafened.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Undeafened',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            await logChannel.send({embeds:[embed]});

        } else if(!oldState.selfVideo && newState.selfVideo) {
            const embed = new EmbedBuilder()
                .setDescription('Member has their camera open.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Camera',
                        value: 'ON',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            await logChannel.send({embeds:[embed]});
        } else if(oldState.selfVideo && !newState.selfVideo) {
            const embed = new EmbedBuilder()
                .setDescription('Member closed their camera.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Camera',
                        value: 'OFF',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            await logChannel.send({embeds:[embed]});

        } else if(!oldState.streaming && newState.streaming) {
            const embed = new EmbedBuilder()
                .setDescription('Member is now streaming.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Stream',
                        value: 'ON',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            await logChannel.send({embeds:[embed]});
            
        } else if(oldState.streaming && !newState.streaming) {
            const embed = new EmbedBuilder()
                .setDescription('Member closed their stream.\n')
                .setAuthor(
                    {
                        name: `${oldState.member.user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: true
                    },
                    {
                        name: 'In channel',
                        value: `${newState.channel}`,
                        inline: true
                    },
                    {
                        name: 'Stream',
                        value: 'OFF',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${oldState.member.user.id}`})
            await logChannel.send({embeds:[embed]});
        }
        
        
        return;
    }
}