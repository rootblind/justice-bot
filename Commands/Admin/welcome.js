const { SlashCommandBuilder, Client, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { poolConnection } = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome messagess')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName('set')
                .setDescription('Configurate how the new members are greeted!')
                .addSubcommand(subcommand =>
                    subcommand.setName('default-message')
                        .setDescription('Creates a new channel if one doesn\'t already exist and sets a default message.')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('custom-message')
                        .setDescription('Your own welcome message will be sent through an embed.')
                        .addChannelOption(option =>
                            option.setName('welcome-channel')
                                .setDescription('The channel where the welcome message will be sent.')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildText)
                        )

                        .addStringOption(option =>
                            option.setName('message-description')
                                .setDescription('The body of the welcome message.')
                                .setRequired(true)
                        )

                        .addBooleanOption(option =>
                            option.setName('author')
                                .setDescription('Choose to display the new member as the author.')
                        )
                        .addStringOption(option =>
                            option.setName('message-title')
                                .setDescription('The title of the welcome message.')
                        )
                        .addNumberOption(option =>
                            option.setName('hexcolor')
                                .setDescription('The hex color of the welcome message.')
                        )
                        .addStringOption(option =>
                            option.setName('image-link')
                                .setDescription('The image link of the embed message.')
                        )

                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('action')
                .setDescription('Take actions upon enabling/disabling the announcements or removing the welcome settings.')
                .addStringOption(option =>
                    option.setName('take')
                        .setDescription('Take action')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'Enable',
                                value: 'enable'
                            },
                            {
                                name: 'Disable',
                                value: 'disable'
                            },
                            {
                                name: 'Remove',
                                value: 'remove'
                            }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('change')
                .setDescription('Change the welcome message or its channel!')
                .addChannelOption(option =>
                    option.setName('welcome-channel')
                        .setDescription('Change the current welcome channel.')
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option.setName('message-description')
                        .setDescription('Change the current welcome message.')
                )
                .addBooleanOption(option =>
                    option.setName('author')
                        .setDescription('Change weather the author is displayed or not.')
                )
                .addStringOption(option =>
                    option.setName('message-title')
                        .setDescription('Change the current title')
                )
                .addNumberOption(option =>
                    option.setName('hexcolor')
                        .setDescription('Change the current color.')
                )
                .addStringOption(option =>
                    option.setName('image-link')
                        .setDescription('Change the image')
                )
        )
    ,

    async execute(interaction, client) {
        if (botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == 0) {
            console.error(`I am missing SendMessages permission in ${interaction.channel} channel.`);
        }
        else if (botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == -1) {
            const embed = EmbedBuilder()
                .setTitle('An error occurred while running this command!')
                .setColor('Red');
            return interaction.reply({ embeds: [embed], ephemeral: true });

        }


        const embed = new EmbedBuilder();

        // doing the required check on database
        if (!(await botUtils.doesTableExists('welcomescheme'))) {
            embed.setTitle('Table welcomeScheme does not exist.')
                .setDescription('This command requires `/default-database` to be ran by my Master first!')
                .setColor('Red');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }


        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const botMember = botUtils.getBotMember(client, interaction); // getting the bot member to check if the bot
        // has specific permissions
        switch (subcommand) {
            case 'default-message':
                // looks for a #welcome channel, if it doesn't exist, creates one
                let welcomeChannel = interaction.guild.channels.cache.find(channel =>
                    channel.name.toLowerCase().startsWith('welcome'));
                if (!welcomeChannel) { // if there is no welcome channel, we have to create one

                    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        embed.setTitle('Lack of permissions!')
                            .setDescription('I lack the ManageChannels permission!')
                            .setColor('Red');
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    welcomeChannel = await interaction.guild.channels.create({
                        name: 'welcome',
                        permissionOverwrites: [
                            {
                                id: interaction.guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
                            },
                            {
                                id: client.user.id,
                                allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                            }
                        ],
                        position: 0,
                    });
                }
                let welcomeMessage = `Welcome to ${interaction.guild.name}!`;
                let hasAuthorEmbed = true;
                let title = `A new summoner joined the server!`;
                let color = `0xc30000`;
                let imageLink = `https://i.ibb.co/yR5wwN3/6563b0990b825.jpg`;
                embed.setTitle(title)
                    .setDescription(welcomeMessage)
                    .setAuthor({ name: interaction.member.user.username, iconURL: interaction.member.displayAvatarURL({ format: 'jpg' }) })
                    .setImage(imageLink)
                    .setColor(Number(color))
                    .setTimestamp()
                    .setFooter({ text: `ID: ${interaction.member.id}` });

                await welcomeChannel.send({ content: `<@${interaction.member.id}> This is a demo:`, embeds: [embed] });
                const defaultPromise = new Promise((resolve, reject) => {
                    // Checking if a row already exists in welcomescheme. Update the existing row if it does
                    // or Insert a new one if it doesn't
                    // the bot is built for a single server in mind, that's why there is no unique identifier since
                    // there is no reason for more than one welcome scheme to exist
                    poolConnection.query('SELECT 1 FROM welcomescheme LIMIT 1', (err, result) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        } else {
                            if (result.rows.length > 0) {
                                poolConnection.query(
                                    'UPDATE welcomescheme SET channel=$1, message=$2, author=$3, title=$4, colorcode=$5, imagelink=$6 WHERE id=1',
                                    [welcomeChannel.id, welcomeMessage, hasAuthorEmbed, title, color, imageLink],
                                    (updateErr, updateResult) => {
                                        if (updateErr) {
                                            console.error('Error updating row', updateErr);
                                            reject(updateErr);
                                        } else {
                                            resolve(updateResult);
                                        }
                                    }
                                );
                            } else {
                                poolConnection.query(
                                    'INSERT INTO welcomescheme(active, channel, message, author, title, colorcode, imagelink) VALUES($1, $2, $3, $4, $5, $6, $7)',
                                    [true, welcomeChannel.id, welcomeMessage, hasAuthorEmbed, title, color, imageLink],
                                    (insertErr, insertResult) => {
                                        if (insertErr) {
                                            console.error('Error inserting row', insertErr);
                                            reject(insertErr);
                                        } else {
                                            resolve(insertResult);
                                        }
                                    }
                                );
                            }
                        }
                    });
                });

                await defaultPromise;
                break;
            case 'custom-message':
                const welcomeChannelCustom = interaction.options.getChannel('welcome-channel');
                const messageDescription = interaction.options.getString('message-description');
                const customAuthor = interaction.options.getBoolean('author') || null;
                const messageTitle = interaction.options.getString('message-title') || '';
                const embedColor = interaction.options.getNumber('hexcolor') || 0xc30000;
                const imageLinkCustom = interaction.options.getString('image-link') || '';

                // handling the inputs

                if (botUtils.botPermsCheckInChannel(client, welcomeChannelCustom, [PermissionFlagsBits.SendMessages]) == 0) {
                    console.error(`I am missing SendMessages permission in ${welcomeChannelCustom} channel.`);
                }
                else if (botUtils.botPermsCheckInChannel(client, welcomeChannelCustom, [PermissionFlagsBits.SendMessages]) == -1) {
                    const embed = EmbedBuilder()
                        .setTitle('An error occurred while running this command!')
                        .setColor('Red');
                    return interaction.reply({ embeds: [embed], ephemeral: true });

                }


                if (messageDescription.length > 255) {
                    embed.setTitle('Overflow!')
                        .setDescription('The description provided is too long!')
                        .setColor('Red');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (messageTitle && messageTitle.length > 255) {
                    embed.setTitle('Overflow!')
                        .setDescription('The title provided is too long!')
                        .setColor('Red');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (embedColor && embedColor > 0xffffff) {
                    embed.setTitle('Wrong input!')
                        .setDescription('The value of hexcolor must be something like 0xc30000.')
                        .setColor('Red');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (imageLinkCustom && imageLinkCustom.length > 255) {
                    embed.setTitle('Overflow!')
                        .setDescription('The image link provided is too long!')
                        .setColor('Red');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
                embed.setDescription(messageDescription);
                if (customAuthor)
                    embed.setAuthor({ name: interaction.member.user.username, iconURL: interaction.member.displayAvatarURL({ format: 'jpg' }) });
                if (messageTitle)
                    embed.setTitle(messageTitle);
                embed.setColor(embedColor);
                if (imageLinkCustom)
                    try {
                        embed.setImage(imageLinkCustom);
                    } catch (error) {
                        return interaction.reply({ content: 'Invalid image link provided!', ephemeral: true });
                    }
                embed.setTimestamp()
                    .setFooter({ text: `ID: ${interaction.member.id}` });

                await welcomeChannelCustom.send({ content: `<@${interaction.member.id}> This is a demo:`, embeds: [embed] });

                const customPromise = new Promise((resolve, reject) => {
                    // Checking if a row already exists in welcomescheme. Update the existing row if it does
                    // or Insert a new one if it doesn't
                    // the bot is built for a single server in mind, that's why there is no unique identifier since
                    // there is no reason for more than one welcome scheme to exist
                    poolConnection.query('SELECT 1 FROM welcomescheme LIMIT 1', (err, result) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        } else {
                            if (result.rows.length > 0) {
                                poolConnection.query(
                                    'UPDATE welcomescheme SET channel=$1, message=$2, author=$3, title=$4, colorcode=$5, imagelink=$6 WHERE id=1',
                                    [welcomeChannelCustom.id, messageDescription, customAuthor, messageTitle, botUtils.hexToString(embedColor), imageLinkCustom],
                                    (updateErr, updateResult) => {
                                        if (updateErr) {
                                            console.error('Error updating row', updateErr);
                                            reject(updateErr);
                                        } else {
                                            resolve(updateResult);
                                        }
                                    }
                                );
                            } else {
                                poolConnection.query(
                                    'INSERT INTO welcomescheme(active, channel, message, author, title, colorcode, imagelink) VALUES($1, $2, $3, $4, $5, $6, $7)',
                                    [true, welcomeChannelCustom.id, messageDescription, customAuthor, messageTitle, botUtils.hexToString(embedColor), imageLinkCustom],
                                    (insertErr, insertResult) => {
                                        if (insertErr) {
                                            console.error('Error inserting row', insertErr);
                                            reject(insertErr);
                                        } else {
                                            resolve(insertResult);
                                        }
                                    }
                                );
                            }
                        }
                    });
                });

                await customPromise;
                break;
            case 'action':
                const takeAction = interaction.options.getString('take');
                let query;
                const checkRowExists = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT 1 FROM welcomescheme LIMIT 1`,
                        (err, result) => {
                            if (err) {
                                console.error(err);
                                reject(err);
                            }
                            else {

                                if (result.rows.length > 0) {
                                    switch (takeAction) {
                                        case 'enable':
                                            // checking if there is a welcome message available


                                            query = `UPDATE welcomescheme SET active=true WHERE id=1`;
                                            embed.setTitle('The welcome event is now active')
                                                .setDescription('You\'ve enabled the welcome event!')
                                                .setColor('Green');
                                            break;
                                        case 'disable':
                                            query = `UPDATE welcomescheme SET active=false WHERE id=1`
                                            embed.setTitle('The welcome event is now deactivated')
                                                .setDescription('You\'ve disabled the welcome event!')
                                                .setColor('Green');
                                            break;
                                        case 'remove':
                                            query = `DELETE FROM welcomescheme WHERE id=1`
                                            embed.setTitle('The welcome scheme was cleared!')
                                                .setDescription('You\'ve removed the welcome event configuration.')
                                                .setColor('Green');
                                            break;
                                    }
                                    poolConnection.query(query, (err, result) => {
                                        if (err) {
                                            console.error(err);
                                        }
                                        else {
                                            poolConnection.query(`SELECT setval('welcomescheme_id_seq', 1, false);`, (err, result) => {
                                                if (err) console.error(err);
                                            });
                                        }
                                    });

                                }
                                else {
                                    embed.setTitle('The welcome message is missing!')
                                        .setDescription('You cannot perform actions on an unexisting welcome scheme!')
                                        .setColor('Red');
                                }
                                resolve(result);
                            }
                        });
                });

                await checkRowExists;
                return interaction.reply({ embeds: [embed] });
                break;

            case 'change':
                // to change something, the row needs to exist

                const changeChannel = interaction.options.getChannel('welcome-channel') || null;
                const changeDescription = interaction.options.getString('message-description') || null;
                const changeAuthor = interaction.options.getBoolean('author') || false;
                const changeTitle = interaction.options.getString('message-title') || null;
                const changeColor = interaction.options.getNumber('hexcolor') || null;
                const changeLink = interaction.options.getString('image-link') || null;

                // handling inputs
                let changeQuery = 'UPDATE welcomescheme SET ';
                let queryValues = [];
                let variableIndex = 1;
                if (changeChannel) {
                    if (botUtils.botPermsCheckInChannel(client, changeChannel, [PermissionFlagsBits.SendMessages]) == 0) {
                        console.error(`I am missing SendMessages permission in ${changeChannel} channel.`);
                    }
                    else if (botUtils.botPermsCheckInChannel(client, changeChannel, [PermissionFlagsBits.SendMessages]) == -1) {
                        const embed = EmbedBuilder()
                            .setTitle('An error occurred while running this command!')
                            .setColor('Red');
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    changeQuery = changeQuery + ` channel=$${variableIndex},`;
                    queryValues.push(changeChannel.id);
                    variableIndex += 1;
                }

                if (changeDescription) {
                    if (changeDescription.length > 255) {
                        embed.setTitle('Overflow!')
                            .setDescription('The description provided is too long!')
                            .setColor('Red');
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    changeQuery = changeQuery + ` message=$${variableIndex},`;
                    queryValues.push(changeDescription);
                    variableIndex += 1;

                }

                if (changeAuthor != null) {
                    changeQuery = changeQuery + ` author=$${variableIndex},`;
                    queryValues.push(changeAuthor);
                    variableIndex += 1;

                }

                if (changeTitle) {
                    if (changeTitle.length > 255) {
                        embed.setTitle('Overflow!')
                            .setDescription('The title provided is too long!')
                            .setColor('Red');
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }

                    changeQuery = changeQuery + ` title=$${variableIndex},`;
                    queryValues.push(changeTitle);
                    variableIndex += 1;
                }

                if (changeColor) {
                    if (changeColor > 0xffffff) {
                        embed.setTitle('Wrong input!')
                            .setDescription('The value of hexcolor must be something like 0xc30000.')
                            .setColor('Red');
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    changeQuery = changeQuery + ` colorcode=$${variableIndex},`;
                    queryValues.push(botUtils.hexToString(changeColor));
                    variableIndex += 1;
                }

                if (changeLink) {
                    if (changeLink.length > 255) {
                        embed.setTitle('Overflow!')
                            .setDescription('The image link provided is too long!')
                            .setColor('Red');
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    try {
                        embed.setImage(changeLink);
                    } catch (error) {
                        return interaction.reply({ content: 'Invalid image link provided!', ephemeral: true });
                    }
                    changeQuery = changeQuery + ` imagelink=$${variableIndex},`;
                    queryValues.push(changeLink);
                    variableIndex += 1;


                }
                


                changeQuery = changeQuery.slice(0, -1);
                changeQuery = changeQuery + ` WHERE id=1`;
                const _checkRowExists = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT 1 FROM welcomescheme LIMIT 1`,
                        (err, result) => {
                            if (err) {
                                console.error(err);
                                reject(err);
                            }
                            else {

                                if (result.rows.length > 0) {
                                    poolConnection.query(changeQuery, queryValues, (err, result) => {
                                        if (err) console.error(err);
                                    });
                                    poolConnection.query(`SELECT * FROM welcomescheme WHERE id=1`,
                                        (err, result) => {
                                            if (err) console.error(err);
                                            else {
                                                const demoChangeEmbedChannel = interaction.guild.channels.cache.get(result.rows[0].channel);
                                                if (result.rows[0].message)
                                                    embed.setDescription(result.rows[0].message);
                                                if (result.rows[0].author)
                                                    embed.setAuthor({ name: interaction.member.user.username, iconURL: interaction.member.displayAvatarURL({ format: 'jpg' }) });
                                                if (result.rows[0].title)
                                                    embed.setTitle(result.rows[0].title);
                                                if (result.rows[0].colorcode)
                                                    embed.setColor(Number(result.rows[0].colorcode));
                                                if (result.rows[0].imagelink)
                                                    embed.setImage(result.rows[0].imagelink)
                                                embed.setTimestamp()
                                                    .setFooter({ text: `ID: ${interaction.member.id}` });
                                                demoChangeEmbedChannel.send({ content: `<@${interaction.member.id}> This is a demo:`, embeds: [embed] });
                                            }
                                        }
                                    )
                                }
                                else {
                                    embed.setTitle('The welcome message is missing!')
                                        .setDescription('You must use `/welcome set` before trying to make changes.')
                                        .setColor('Red');
                                }
                                resolve(result);
                            }
                        })
                });
                await _checkRowExists;
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
                break;

        }

        return interaction.reply('The command was successful, check the channel where I tagged you for a demo.');


    }

};