/*
    server-logs are the bot's function to store different events in specified channels, such as
    deleted messages, edited messages, bans, etc
*/

const { SlashCommandBuilder, Client, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { poolConnection } = require('../../utility_modules/kayle-db.js');

// this function checks if a row of the event type exists, if it does, it updates the row, otherwise it inserts a new row
// setLogChannel is used to update log channels for the set subcommand group
async function setLogChannel(guild, channel, eventType) {
    poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [guild, eventType],
        (err, result) => {
            if(err) {
                console.error(err);
                reject(err);
            }
            else if(result.rows.length > 0) {
                // updating the log channel to be ignored from logging
                poolConnection.query(`UPDATE serverlogsignore SET channel=$1 WHERE guild=$2 AND channel=$3`, [channel, guild, result.rows[0].channel],
                    (err) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                    }
                );
                poolConnection.query(`UPDATE serverlogs SET channel=$1
                    WHERE guild=$2 AND eventtype=$3`,
                [channel, guild, eventType], (err) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                });
            }
            else if(result.rows.length == 0) {
                poolConnection.query(`INSERT INTO serverlogsignore(guild, channel) VALUES ($1, $2)`, [guild, channel], (err) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                    }
                )
                poolConnection.query(`INSERT INTO serverlogs(guild, channel, eventtype)
                    VALUES($1, $2, $3)`, [guild, channel, eventType],
                (err) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                });
            }
        }
    );
}


module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('server-logs')
        .setDescription('Log server events and messages.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName('set')
                .setDescription('Set channels for logging.')
                .addSubcommand(subcommand =>
                    subcommand.setName('auto')
                        .setDescription('Automatically create and set channels for logging.')

                )
                .addSubcommand(subcommand =>
                    subcommand.setName('all')
                        .setDescription('Log everything in one channel')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('moderation')
                        .setDescription('Moderation logs')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('voice')
                        .setDescription('Voice channels logs')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('messages')
                        .setDescription('Messages logs')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('user-activity')
                        .setDescription('User activity logs such as join/leave or changing their name.')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('server-activity')
                        .setDescription('Server activity logs such as channels being changed.')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('flagged-messages')
                        .setDescription('Messages flagged by the bot.')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('premium-activity')
                        .setDescription('Premium activity logs.')
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('The channel for the logs to be stored in.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a logging category.')
                .addStringOption(option =>
                    option.setName('log-type')
                        .setDescription('The logs type to be removed.')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'All',
                                value: 'all'
                            },
                            {
                                name: 'Moderation',
                                value: 'moderation'
                            },
                            {
                                name: 'Voice',
                                value: 'voice'
                            },
                            {
                                name: 'Messages',
                                value: 'messages'
                            },
                            {
                                name: 'User Activity',
                                value: 'user-activity'
                            },
                            {
                                name: 'Server Activity',
                                value: 'server-activity'
                            },
                            {
                                name: 'Flagged Messages',
                                value: 'flagged-messages'
                            },
                            {
                                name: 'Premium Activity',
                                value: 'premium-activity'
                            }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('ignore')
                .setDescription('Ignore specific channels from being logged')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to be added/removed from ignore list.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('info')
            .setDescription('Display all event types that have an associated channel and ignored channels.')
        ),
    botPermissions: [PermissionFlagsBits.ManageChannels],

    async execute(interaction, client){

        const embed = new EmbedBuilder().setTitle('Error').setColor('Red').setDescription('Something went wrong...');
        const subcommand = interaction.options.getSubcommand();
        const channelLogs = interaction.options.getChannel('channel') || null;// if any command is ran that requires a channel, it will be stored here
        

        switch(subcommand) {
            case 'auto':
                // auto subcommand defaults to creating its own category and channels with its own perms
                // will log the events as set below

                let botRoleId = client.user.id; // if no bot role type is specified it will default to itself (the bot)
                let staffRoleId = interaction.user.id; // if no staff role type is specified it will default to the user of the command
                // since the user must be of Admin perms anyway

                // fetching the staff and bot role ids from the database if existing

                const botRoleFetch = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype=$2`, [interaction.guildId, 'bot'],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            } else if(result.rows.length > 0)
                                botRoleId = result.rows[0].role;
                            
                            resolve(result);
                        }
                    )
                });
                await botRoleFetch;
                const staffRoleFetch = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype=$2`, [interaction.guildId, 'staff'],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            } else if(result.rows.length > 0)
                                staffRoleId = result.rows[0].role;
                            resolve(result);
                        }
                    )
                });
                await staffRoleFetch;
                // this object has the perms that will be set to the auto logs channels
                const channelPerms =  [
                    {
                        id: await interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    {
                        id: botRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: staffRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]; // the perms for the bot and staff roles
                await interaction.deferReply(); // extend the discord time out
                // the category
                const logsCategory = await interaction.guild.channels.create({
                    name: 'serverlogs',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: channelPerms
                });
                // the moderation channel
                const modLogs = await logsCategory.children.create({
                    name: 'modlogs',
                    type: ChannelType.GuildText,
                    parent: logsCategory,

                });
                // the voice channel
                const voiceLogs = await logsCategory.children.create({
                    name: 'voicelogs',
                    type: ChannelType.GuildText,
                    parent: logsCategory,

                });
                //the messages channel
                const messagesLogs = await logsCategory.children.create({
                    name: 'messageslogs',
                    type: ChannelType.GuildText,
                    parent: logsCategory,

                });
                //the user activity channel
                const userLogs = await logsCategory.children.create({
                    name: 'userlogs',
                    type: ChannelType.GuildText,
                    parent: logsCategory,

                });
                const serverActivity = await logsCategory.children.create({
                    name: 'server-activity',
                    type: ChannelType.GuildText,
                    parent: logsCategory
                });
                const flaggedMessages = await logsCategory.children.create({
                    name: 'flagged-messages',
                    type: ChannelType.GuildText,
                    parent: logsCategory
                });
                const premiumActivity = await logsCategory.children.create({
                    name: 'premium-activity',
                    type: ChannelType.GuildText,
                    parent: logsCategory
                });
                
                // In the following lines, the auto logs channels will be registered into the database
                // if there is any event type assigned to a channel, all rows for the guild will be deleted
                // in order to override the current channels if any and to replace them with the auto channels
                // since the set subcommand group should either set an event to a channel or replace the channel for the specified event
                // also, the channels that were set to be ignored because they were logging channels will be removed from ignore list
                const serverLogsAuto = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT eventtype FROM serverlogs WHERE guild=$1`, [interaction.guildId],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            else if(result.rows.length > 0) {
                                poolConnection.query(`DELETE FROM serverlogs WHERE guild=$1`, [interaction.guildId],
                                    (err) => {
                                        if(err) {
                                            console.error(err);
                                            reject(err);
                                        }
                                    }
                                )
                                poolConnection.query(`DELETE FROM serverlogsignore WHERE guild=$1`, [interaction.guildId],
                                    (err) => {
                                        if(err) {
                                            console.error(err);
                                            reject(err);
                                        }
                                    }
                                )
                            }
                            poolConnection.query(`INSERT INTO serverlogs (guild, channel, eventtype) 
                                VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7), ($1, $8, $9), ($1, $10, $11), ($1, $12, $13), ($1, $14, $15)`,
                            [interaction.guildId, modLogs.id, 'moderation', voiceLogs.id, 'voice', messagesLogs.id, 'messages', userLogs.id, 'user-activity', serverActivity.id, 'server-activity', flaggedMessages.id, 'flagged-messages', premiumActivity.id, 'premium-activity'],
                            (err) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                            }
                        )
                            resolve(result);
                        }
                    )
                });
            await serverLogsAuto;
            // logging channels need to be ignored
            const ignoreLogs = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO serverlogsignore (guild, channel)
                    VALUES ($1, $2), ($1, $3), ($1, $4), ($1, $5), ($1, $6), ($1, $7)`,
                    [interaction.guildId, modLogs.id, voiceLogs.id, messagesLogs.id, userLogs.id, serverActivity.id, flaggedMessages.id, premiumActivity.id],
                    (err, result) => {
                        if(err) reject(err);
                        resolve(result);
                    }
                );
            });
            await ignoreLogs;
            embed.setTitle('Server Logs set to Auto')
                .setColor('Aqua')
                .setDescription(`Channels set for logging:` )
                .addFields(
                    {
                        name: 'Moderation Logs',
                        value: `${modLogs}`,
                        inline: true
                    },
                    {
                        name: 'Voice Logs',
                        value: `${voiceLogs}`,
                        inline: true
                    },
                    {
                        name: 'Messages Logs',
                        value: `${messagesLogs}`,
                        inline: true
                    },
                    {
                        name: 'User Logs',
                        value: `${userLogs}`,
                        inline: true
                    },
                    {
                        name: 'Server Activity',
                        value: `${serverActivity}`,
                        inline: true
                    },
                    {
                        name: 'Flagged Messages',
                        value: 'flagged-messages'
                    },
                    {
                        name: 'Premium Activity',
                        value: 'premium-activity'
                    }
                )
            return await interaction.editReply({embeds: [embed]})
            break;
            case 'all':
                const eventTypes = ["moderation", "voice", "messages", "user-activity", "server-activity", "flagged-messages", "premium-activity"] // array used to iterate in for checking all event types
                // using the map function
                // set all will set all events to a single channel
                await Promise.all(eventTypes.map(async (xEvent) => {
                        setLogChannel(interaction.guildId, channelLogs.id, xEvent);
                }));
            
            embed.setTitle('Server logs set')
                .setColor('Green')
                .setDescription(`All events will be logged in ${channelLogs}.`);
            break;
            case 'moderation':
            case 'messages':
            case 'voice':
            case 'user-activity':
            case 'server-activity':
            case 'flagged-messages':
            case 'premium-activity':
                await setLogChannel(interaction.guildId, channelLogs.id, subcommand);
                embed.setTitle(`${subcommand} logs set`)
                    .setColor('Green')
                    .setDescription(`${subcommand} logs were set to ${channelLogs}`);
            break;

            case 'remove': // remove all or a specific event from being logged
                const logType = interaction.options.getString('log-type');
                if(logType == 'all') {
                    poolConnection.query(`DELETE FROM serverlogs WHERE guild=$1`, [interaction.guildId]); // delete all rows of the server
                    poolConnection.query(`DELETE FROM serverlogsignore WHERE guild=$1`, [interaction.guildId]); // delete all rows of the server
                }
                else {
                    poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [interaction.guildId, logType],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            else if(result.rows.length > 0) {
                                poolConnection.query(`DELETE FROM serverlogsignore WHERE guild=$1 AND channel=$2`, [interaction.guildId, result.rows[0].channel]);
                            }
                        }
                    )
                    poolConnection.query(`DELETE FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [interaction.guildId, logType]);
                }
                embed.setTitle(`${logType} logs were removed.`)
                    .setColor('Green')
                    .setDescription('Operation was successfully.');
            break;

            case 'ignore': // channels to be ignored from being logged
            // if the specified channel already exists within the database, it will be removed, added otherwise
                const checkIgnoreList = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT 1 FROM serverlogsignore WHERE guild=$1 AND channel=$2 LIMIT 1`,
                        [interaction.guildId, channelLogs.id],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            else if(result.rows.length > 0) { // removing the channel from ignore list if it exists
                                poolConnection.query(`SELECT 1 FROM serverlogs WHERE guild=$1 AND channel=$2 LIMIT 1`, [interaction.guildId, channelLogs.id],
                                    (err, result) => {
                                        if(err) {
                                            console.error(err);
                                            reject(err);
                                        }
                                        else if(result.rows.length > 0) {
                                            embed.setTitle('Invalid operation')
                                                .setColor('Red')
                                                .setDescription('You can not remove a logging channel from ignore list!')
                                        }
                                        else if(result.rows.length == 0) {
                                            poolConnection.query(`DELETE FROM serverlogsignore WHERE guild=$1 AND channel=$2`,
                                                [interaction.guildId, channelLogs.id], (err) => {
                                                    if(err) {
                                                        console.error(err);
                                                        reject(err);
                                                    }
                                                }
                                            );
                                            embed.setDescription(`${channelLogs} has been removed from ignore list.`)
                                                .setTitle('Ignore list updated');
                                        }
                                    }
                                )
                                
                            }
                            else if(result.rows.length == 0) { // adding channel to ignore list if it doesn't already exists
                                poolConnection.query(`INSERT INTO serverlogsignore(guild, channel) VALUES($1, $2)`,
                                    [interaction.guildId, channelLogs.id]
                                );
                                embed.setDescription(`${channelLogs} has been added from ignore list.`)
                                    .setTitle('Ignore list updated');
                            }
                            resolve(result);
                        }
                    )
                });
                await checkIgnoreList;
            break;
            
            case 'info': // a preview of what setup has been done
                embed.setTitle('Server logs setup')
                    .setColor('Purple');
                
                // fetching and embeding logs channels if any
                const fetchServerLogsTable = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT * FROM serverlogs WHERE guild=$1`, [interaction.guildId],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            else if(result.rows.length > 0) {
                                result.rows.forEach(row => {
                                    const currentEventChannel = interaction.guild.channels.cache.get(row.channel);
                                    embed.addFields(
                                        {
                                            name: `${row.eventtype}`,
                                            value: `${currentEventChannel}`,
                                            inline: false
                                        }
                                    )
                                });
                            }
                            else if(result.rows.length == 0) {
                                embed.addFields({
                                    name: 'Logs channels',
                                    value: 'None were set',
                                    inline: true
                                });
                            }
                            resolve(result);
                        }
                    );
                });
            await fetchServerLogsTable;
            
            // fetching and embeding ignored channels if any
            let ignoredChannels = [];// making an array of ignored channels, if there is no ignored channel, then ignoredChannels == 0 -> true
            const fetchLogsIgnoreTable = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT channel FROM serverlogsignore WHERE guild=$1 `, [interaction.guildId],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        else if(result.rows.length > 0) {
                            result.rows.forEach(row => {
                                const currentChannel = interaction.guild.channels.cache.get(row.channel);
                                ignoredChannels.push(currentChannel);
                            });
                        }
                        else if (result.rows.length == 0) {
                            embed.setDescription('No channels are on ignore list.');
                        }
                        resolve(result);
                    }
                );
            });
            await fetchLogsIgnoreTable;
            if(ignoredChannels != 0) {
                embed.setDescription(`Ignored channels: ${ignoredChannels}`);
            }
            break;

        }

        return await interaction.reply({embeds: [embed]});
        
    }
};