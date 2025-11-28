const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require('discord.js');
const {create_autovoice, remove_autovoice} = require("../../utility_modules/subcommands/autovoice.js");

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        if(!oldState) return;
        if(!oldState.member) return;
        if(!oldState.member.user) return;
        if(oldState.member.user.bot) return; // ignore bots
        const user = oldState.member.user;
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
                        name: `${user.username}`,
                        iconURL: oldState.member.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: false
                    },
                    {
                        name: 'Joined',
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            
            await logChannel.send({embeds:[embed]});

        } else if(!newState.channelId) {
            const embed = new EmbedBuilder()
                .setDescription('Member just left voice.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: false
                    },
                    {
                        name: 'Left',
                        value: `${oldState.channel} - ${oldState.channel?.name}`,
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setDescription('Member changed channels.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
                    }
                )
                .setColor(color)
                .addFields(
                    {
                        name: 'Member',
                        value: `${oldState.member}`,
                        inline: false
                    },
                    {
                        name: 'From',
                        value: `${oldState.channel} - ${oldState.channel.name}`,
                        inline: false
                    },
                    {
                        name: 'To',
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(!oldState.serverMute && newState.serverMute) {
            const embed = new EmbedBuilder()
                .setDescription('Member was muted.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Muted',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(oldState.serverMute && !newState.serverMute) {
            const embed = new EmbedBuilder()
                .setDescription('Member was unmuted.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Unmuted',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(!oldState.serverDeaf && newState.serverDeaf) {
            const embed = new EmbedBuilder()
                .setDescription('Member was deafened.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Deafened',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            
            await logChannel.send({embeds:[embed]});
        } else if(oldState.serverDeaf && !newState.serverDeaf) {
            const embed = new EmbedBuilder()
                .setDescription('Member was undeafened.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Current state',
                        value: 'Undeafened',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            await logChannel.send({embeds:[embed]});

        } else if(!oldState.selfVideo && newState.selfVideo) {
            const embed = new EmbedBuilder()
                .setDescription('Member has their camera open.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Camera',
                        value: 'ON',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            await logChannel.send({embeds:[embed]});
        } else if(oldState.selfVideo && !newState.selfVideo) {
            const embed = new EmbedBuilder()
                .setDescription('Member closed their camera.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Camera',
                        value: 'OFF',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            await logChannel.send({embeds:[embed]});

        } else if(!oldState.streaming && newState.streaming) {
            const embed = new EmbedBuilder()
                .setDescription('Member is now streaming.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Stream',
                        value: 'ON',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            await logChannel.send({embeds:[embed]});
            
        } else if(oldState.streaming && !newState.streaming) {
            const embed = new EmbedBuilder()
                .setDescription('Member closed their stream.\n')
                .setAuthor(
                    {
                        name: `${user.username}`,
                        iconURL: user.displayAvatarURL({extension: 'jpg'})
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
                        value: `${newState.channel} - ${newState.channel.name}`,
                        inline: true
                    },
                    {
                        name: 'Stream',
                        value: 'OFF',
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({text: `ID: ${user.id}`})
            await logChannel.send({embeds:[embed]});
        }
        
        // if party rooms are empty, they should be cleared and deleted
        const {rows: partyRoomData} = await poolConnection.query(`SELECT * FROM partyroom
            WHERE guild=$1 AND channel=$2`,
            [oldState.guild.id, oldState.channelId]
        );

        const id2gamemode = {
            0: "Solo/Duo",
            1: "Flex",
            2: "Clash/Tournament",
            3: "SwiftPlay",
            4: "Normal Draft",
            5: "ARAM",
            6: "TFT",
            7: "Rotation Gamemode",
            8: "Custom"
        }
        
        if(partyRoomData.length > 0) {
            if(!oldState.channel.members.size) {
                // looking for thread to delete
                // fetching the lfg channel
                const {rows: lfgChannelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
                    WHERE guild=$1 AND channeltype='lfg-${partyRoomData[0].region}'`, [oldState.guild.id]);

                const lfgChannel = await oldState.guild.channels.fetch(lfgChannelData[0].channel);

                // fetching the party owner
                let partyOwnerUsername = "";

                try{
                    const partyOwner = await oldState.guild.members.fetch(partyRoomData[0].owner);
                    partyOwnerUsername = partyOwner.user.username;
                } catch(err) {};

                const thread = await lfgChannel.threads.cache.find(t => t.name === `${partyOwnerUsername}-party`);

                try{
                    await thread.delete();
                } catch(err) {};

                // fetching the lfg message to be deleted
                let message = null;
                try{
                    message = await lfgChannel.messages.fetch(partyRoomData[0].message)
                } catch(err) {};

                if(message) {
                    try{
                        await message.delete();
                    } catch(err) {};
                }

                // clearing the database table
                await poolConnection.query(`DELETE FROM partyroom WHERE guild=$1 AND channel=$2`, [oldState.guild.id, oldState.channelId]);

                // deleting the channel
                try{
                    await oldState.channel.delete();
                } catch(err) {};

                // logs
                const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs
                    WHERE guild=$1 AND eventtype=$2`, [oldState.guild.id, "lfg-logs"]);

                let logChannel = null;

                try{
                    logChannel = await oldState.guild.channels.fetch(logChannelData[0].channel);
                } catch(err) {};

                if(logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setAuthor({
                                    name: `[${partyRoomData[0].region.toUpperCase()}] ${partyOwnerUsername} party`,
                                    iconURL: oldState.guild.iconURL({extension: "png"})
                                })
                                .setTimestamp()
                                .setFooter({text: `Owner ID: ${partyRoomData[0].owner}`})
                                .setTitle("Party Closed")
                                .addFields(
                                    {
                                        name: "Created",
                                        value: `<t:${partyRoomData[0].timestamp}:R>`
                                    },
                                    {
                                        name: "Closed by",
                                        value: `System - ${oldState.guild.client.user}`
                                    },
                                    {
                                        name: "Gamemode",
                                        value: id2gamemode[partyRoomData[0].gamemode]
                                    },
                                    {
                                        name: "IGN",
                                        value: partyRoomData[0].ign
                                    },
                                    {
                                        name: "Description",
                                        value: `${partyRoomData[0].description || "None"}`
                                    }
                                )
                        ]
                    });
                }
            }
            
        }

        // if auto voice exists
        const {rows: autovoiceBool} = await poolConnection.query(`SELECT EXISTS
            (SELECT 1 FROM autovoicechannel WHERE guild=$1 AND type='autovoice')`, [oldState.guild.id]);
        if(autovoiceBool[0].exists) {
            // auto voice create and auto voice remove depend on this channel existing
            if(newState.channel)
                await create_autovoice(newState.channel, newState.member);
            if(oldState.channel)
                await remove_autovoice(oldState.channel, oldState.member);
        }

        return;
    }
}