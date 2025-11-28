const {Client, EmbedBuilder, SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');


// Select a message through its id and assign a specific reaction to a specific role so
// anyone that clicks the specific reaction, gets or removes the role.
// subcommand: add -> adds a role to a message
// subcommand: remove -> removes a role from a message
// subcommand: wipeall -> remove all roles from every message of the discord server.

module.exports = {
    name: 'reaction-roles',
    testOnly: false,
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('reaction-roles')
        .setDescription('Manage the reaction roles system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a reaction role to a message.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel of the targeted message.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)

                )
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('The Id of the targeted message.')
                        .setRequired(true)
                        .setMinLength(18)
                        .setMaxLength(20)    
                )
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The emoji of the reaction role.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(255)    
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to be selected for the specific reaction.')
                        .setRequired(true)    
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a reaction role from the targeted message.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel of the targeted message.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)

                )
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('The Id of the targeted message.')
                        .setRequired(true)
                        .setMinLength(18)
                        .setMaxLength(20)    
                )
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The emoji of the reaction role.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(255)    
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('wipeall')
                .setDescription('Remove all reaction roles from this server.')    
        )
        .addSubcommand(subcommand =>
            subcommand.setName('wipe-message')
                .setDescription('Remove all reaction roles from the targeted message.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel of the message.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)    
                )
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('The Id of the targeted message.')
                        .setRequired(true)
                        .setMinLength(18)
                        .setMaxLength(20)   
                )
        )
    
    ,
    botPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild],
    userPermissions: [PermissionFlagsBits.Administrator],

    async execute(interaction, client) {

        const subcommands = interaction.options.getSubcommand();
        const embed = new EmbedBuilder();

        if(subcommands === 'wipeall') {
            // checking beforehand if the server has any reaction roles set up
            let anyRowExists = false;
            const checkExistingRows = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT * FROM reactionroles WHERE guild=$1`, [interaction.guildId],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        anyRowExists = true;
                    }
                    resolve(result);
                });
            });
            await checkExistingRows;
            if(anyRowExists == false) {
                embed.setTitle('No existing reaction roles!')
                    .setDescription('There is no reaction role set up on this server.')
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            // wiping all reactions of the registered messages
            const allReactions = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT channel, messageid FROM reactionroles WHERE guild=$1`, [interaction.guildId],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        result.rows.forEach(async (row) => {
                            const channelWipe = await interaction.guild.channels.fetch(row.channel);
                            const messageWipe = await channelWipe.messages.fetch(row.messageid);
                            messageWipe.reactions.removeAll();
                        });
                    }
                    resolve(result);
                });
            });
            await allReactions;
            // wiping all the server reaction roles from database
           const wipeAllPromise = new Promise((resolve, reject) => {
                poolConnection.query(`DELETE FROM reactionroles WHERE guild=$1`, [interaction.guildId], (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }else {
                        resolve(result);
                    }
                });
            });
            await wipeAllPromise;

            embed.setTitle('Wipe complete')
                .setDescription('All reactions were wiped from the reactions roles messages.')
                .setColor('Green');
            return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});

        }

    
        const channel = interaction.options.getChannel('channel');
        try {
            await channel.messages.fetch(interaction.options.getString('message-id'));
        } catch (err) {
            embed.setTitle('The message id is invalid')
                .setDescription('You provided an invalid message id.')
                .setColor('Red');
            return interaction.reply({ embeds:[embed], flags: MessageFlags.Ephemeral });
        }
        const message = await channel.messages.fetch(interaction.options.getString('message-id'));      
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role') || null;
        let emojiExists = false; // if the emoji exists in the same guild, channel and message, results a positive, false otherwise

        const checkEmoji = new Promise((resolve, reject) => {
            poolConnection.query(
                `SELECT emoji 
                FROM reactionroles
                WHERE guild=$1 AND channel=$2 AND messageid=$3`,
                [interaction.guildId, channel.id, message.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else {
                        if(result.rows.length > 0) {
                            const emojis = result.rows.map(row => row.emoji);
                            emojiExists = emojis.includes(emoji);
                        }
                        resolve(result);
                    }
                    
                }
            )
        });
        await checkEmoji;

        if(subcommands === 'add') {
            if(emojiExists) {
                embed.setTitle('Reaction already exists')
                    .setDescription('The emoji provided already exists as a reaction.')
                    .setColor('Red');
                    return interaction.reply({ embeds:[embed], flags: MessageFlags.Ephemeral });
            }

            try{
                await message.react(emoji);
            } catch(err) {
                embed.setTitle('Invalid emoji')
                    .setDescription('The emoji provided is invalid!')
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral})
            }

            const addReactionPromise = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO reactionroles (guild, channel, messageid, roleid, emoji)
                                    VALUES($1, $2, $3, $4, $5)`,
                                    [interaction.guildId, channel.id, message.id, role.id, emoji],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
            await addReactionPromise;

            embed.setTitle('Reaction role added susccesfully')
                .setDescription(`${role} was added to the message using ${emoji}.`)
                .setColor('Green');
            return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});

        }
        else if(subcommands === 'remove') {
            if(emojiExists === false) {
                embed.setTitle('Invalid target')
                    .setDescription('The reaction targeted doesn\'t exist')
                    .setColor('Red');
                    return interaction.reply({ embeds:[embed], flags: MessageFlags.Ephemeral });
            }

            const removeReaction = new Promise((resolve, reject) => {
                poolConnection.query(`DELETE FROM reactionroles
                                    WHERE guild=$1 AND channel=$2 AND messageid=$3 AND emoji=$4`,
                                    [interaction.guildId, channel.id, message.id, emoji],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else  {
                        resolve(result);
                    }
                });
            });
            await removeReaction;
            // get the cache that contains the reaction to be removed
            // in order to check for the same reaction in the message reactions cache, the emoji input is a string that
            // looks like this <:name:2347234092349239> so there is a need for a match to be performed to get the name of the
            // targeted emoji
            const emojiNameMatch = emoji.match(/<:(.*):/); // find a match
            const emojiName = emojiNameMatch ? emojiNameMatch[1] : emoji; // emoji name will either be the name of the emoji or the character itself
            const botReaction = message.reactions.cache.find(
                reaction => 
                    reaction.users.cache.find(u => u.id == client.user.id) && reaction.emoji.name == emojiName
                
            )
            botReaction.users.remove(client.user.id).catch((err) => { console.error(err); });
            
            embed.setTitle('Reaction removed successfully')
                .setDescription(`The reaction role for ${emoji} was removed.`)
                .setColor('Green');
            interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});

        } else if(subcommands === 'wipe-message') {
            message.reactions.removeAll();
            const wipeMessagePromise = new Promise((resolve, reject) => {
                poolConnection.query(`DELETE FROM reactionroles WHERE guild=$1 AND messageid=$2`,
                [interaction.guildId, message.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    resolve(result);
                });
            });
            await wipeMessagePromise;
            embed.setTitle('Message wiped')
                .setDescription('The targeted message was wiped of reaction roles.')
                .setColor('Green');
            return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
        }
    }
}