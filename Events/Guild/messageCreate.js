const {config} = require('dotenv');
config();
const {EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, StringSelectMenuBuilder} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {csvAppend} = require('../../utility_modules/utility_methods.js');
const {classifier} = require('../../utility_modules/filter.js');
const fs = require('graceful-fs');

const axios = require('axios')

async function checkModApi(api) { // checking if there is a connection to the specified api url
    try {

        const response = await axios.get(api);
        if (response.status === 200) {
            return true; // returns true if the connection was successful
        } else {
            return false; // returns false if the connection gives errors
        }
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log('Error response from API:', error.response.status);
        } else if (error.request) {
            // The request was made but no response was received
            console.log('No response received from API');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.log('Error setting up request:', error.message);
        }
    }
}


module.exports = {
    name: 'messageCreate',

    async execute(message) {
        if(!message.guildId || !message.member || message.author.bot) return;

        
        
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [message.guildId, 'flagged-messages'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = message.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        let isChannelIgnored = false;

        const fetchIgnoreList = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogsignore WHERE guild=$1 AND channel=$2`, [message.channel.guildId, message.channel.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        isChannelIgnored = true
                    }
                    resolve(result);
                }
            );
        });
        await fetchIgnoreList;

        if(isChannelIgnored) return; // if the channel is ignored from this type of logging, ignore the event

        const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
            [message.guild.id]
        )
        
        const mod_api = process.env.MOD_API_URL; // for ease of coding
        if(!(await checkModApi(mod_api))) return; // at the moment, the event of sending a message has no other goal other than
        // evaluating the messages through the mod_api

        const response = await classifier(message.content, mod_api).catch(err => {console.error(err);});
        
        if(response)
        {
            if(!response.labels.includes('OK')) { // ignoring OK messages
                // note for stage two: each message will have buttons:
                // Confirm: Confirms that the labels are correct and stores the message and labels as they are in the dataset
                // Correct: Opens a select menu in order to select the appropiated labels and store the corrected version in the dataset
                const embed = new EmbedBuilder()
                    .setTitle('Flagged Message')
                    .setAuthor({
                        name: message.author.username,
                        iconURL: message.member.displayAvatarURL({format: 'jpg'})
                    })
                    .setColor(0xff0005)
                    .addFields(
                        {
                            name: 'Channel',
                            value: `${message.channel}`
                        },
                        {
                            name: 'Flags',
                            value: `${response['labels'].join(', ')}`
                        },
                        {
                            name: "RegEx Matches",
                            value: `${response.matches.join(", ")}`
                        },
                        {
                            name: "Score",
                            value: `${response.score}`
                        },
                        {
                            name: 'Link',
                            value: `[reference](${message.url})`
                        }
                    )
                    .setTimestamp()
                    .setFooter({text:`ID: ${message.author.id}`})
                
                if(message.content.length <= 3000)
                    embed.setDescription(`**Content**: ${response['text']}`)
                else { // handling large messages through temp files and posting the file instead of overflowing the embed description
                    const filePath = path.join(__dirname, `../../temp/${message.id}.txt`);
                    fs.writeFile(filePath, message.content, (err) => {
                    console.error(err);
                    });
                    const sendFile = await logChannel.send({files:[filePath]});
                    embed.setDescription(`[[Content]](${sendFile.url})`);
                    fs.unlink(filePath, (err) => {
                        if(err) throw err;
                    });
                }

                // declaring the confirm correct buttons
                const confirmFlagsButton = new ButtonBuilder() // used to store the message and its labels as it is
                    .setCustomId(`confirm`)
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success)
                const correctFlagsButton = new ButtonBuilder() // used to correct and store the message and its corrected labels
                    .setCustomId(`correct`)
                    .setLabel('Correct')
                    .setStyle(ButtonStyle.Primary)
                const isOKBUtton = new ButtonBuilder() // the message is a false positive
                    .setCustomId('ok-button')
                    .setLabel('OK')
                    .setStyle(ButtonStyle.Primary)

                const flaggedMessageActionRow = new ActionRowBuilder()
                    .addComponents(confirmFlagsButton, isOKBUtton, correctFlagsButton)

                const flaggedMessage = await logChannel.send({embeds:[embed], components: [flaggedMessageActionRow]});

                // creating a button collector
                const collector = flaggedMessage.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.member.roles.cache.has(staffRoleData[0].role),
                    time: 43_200_000
                });

                collector.on('collect', async (interaction) => {
                    let justiceLogChannel = null;
                    const fetchLogChannel = new Promise((resolve, reject) => {
                        poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [message.guildId, 'justice-logs'],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                else if(result.rows.length > 0) {
                                    justiceLogChannel = message.guild.channels.cache.get(result.rows[0].channel);
                                }
                                resolve(result);
                            }
                        )
                    });
                    await fetchLogChannel;
                    // creating a labels object for the flags in order to write the confirmed flags to the csv
                    const flagTags = {
                        OK: 0,
                        Aggro: 0,
                        Violence: 0,
                        Sexual: 0,
                        Hateful: 0,
                    }
                    if(interaction.customId === 'confirm') {
                        for(let label of response['labels']) {
                            if(label == 'OK')
                            {
                                flagTags['OK'] = 1;
                                break;
                            }
                            flagTags[label] = 1;
                        }
                        if(justiceLogChannel)
                            await justiceLogChannel.send({embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setAuthor({
                                        name: `${interaction.user.username} confirmed a flagged message.`,
                                        iconURL: interaction.user.displayAvatarURL({extension: 'png'})
                                    })
                                    .addFields(
                                        {
                                            name: 'Flags',
                                            value: `${response['labels'].join(', ')}`,
                                            inline: true
                                        },
                                        {
                                            name: 'Message',
                                            value: `[click](${flaggedMessage.url})`,
                                            inline: true
                                        }
                                    )
                                    .setTimestamp()
                                    .setFooter({text: `ID: ${interaction.user.id}`})
                            ]});
                        await interaction.reply({ephemeral: true, content:`Confirmed tags: ${response['labels'].join(', ')}\nMessage ID: ${flaggedMessage.id}`});
                        // appending the message
                        csvAppend(response['text'], flagTags, 'flag_data.csv');
                        collector.stop();
                    
                    }
                    else if(interaction.customId === 'correct') {
                        const tags = ["Aggro","Violence", "Sexual","Hateful"]
                        const  selectMenuOptions = [];
                        for(let x of tags) {
                            selectMenuOptions.push({
                                label: x,
                                description: `Flag as ${x}`,
                                value: x
                            })
                        }
                        const selectFlagsMenu = new StringSelectMenuBuilder()
                            .setCustomId('select-flags-menu')
                            .setPlaceholder('Pick the correct flags for the message.')
                            .setMinValues(1)
                            .setMaxValues(tags.length)
                            .addOptions( selectMenuOptions )

                        const selectFlagsActionRow = new ActionRowBuilder().addComponents(selectFlagsMenu);

                        const selectFlagsMessage = await interaction.reply({ephemeral: true, components: [selectFlagsActionRow], embeds: [
                            new EmbedBuilder()
                                .setDescription('Please select all the appropiate flags for the message.')
                                .addFields(
                                    {
                                        name: 'Aggro',
                                        value: 'Provoking someone else into an argument.'
                                    },
                                    {
                                        name: 'Violence',
                                        value: 'Threats or encouraging violence against another person.'
                                    },
                                    {
                                        name: 'Sexual',
                                        value: 'Usage of sexual words to insult or to describe a sexual activity.'
                                    },
                                    {
                                        name: 'Hateful',
                                        value: 'Hateful messages and slurs against minorities and other people.'
                                    }
                                )
                        ]});

                        const selectFlagsReply = await interaction.fetchReply();
                        const selectCollector = await selectFlagsReply.createMessageComponentCollector({
                            ComponentType: ComponentType.StringSelect,
                            time: 300_000,
                        });

                        selectCollector.on('collect', async (interaction) => {
                            for(let label of interaction.values) {
                                flagTags[label] = 1;
                            }
                            await interaction.reply({ephemeral: true, content:`The flags were corrected to: ${interaction.values.join(', ')}\nMessage ID: ${flaggedMessage.id}`});
                            if(justiceLogChannel)
                                await justiceLogChannel.send({embeds: [
                                    new EmbedBuilder()
                                        .setColor('Green')
                                        .setAuthor({
                                            name: `${interaction.user.username} corrected a flagged message.`,
                                            iconURL: interaction.user.displayAvatarURL({extension: 'png'})
                                        })
                                        .addFields(
                                            {
                                                name: 'Flags',
                                                value: `${interaction.values.join(', ')}`,
                                                inline: true
                                            },
                                            {
                                                name: 'Message',
                                                value: `[click](${flaggedMessage.url})`,
                                                inline: true
                                            }
                                        )
                                        .setTimestamp()
                                        .setFooter({text: `ID: ${interaction.user.id}`})
                                ]});
                            selectCollector.stop();
                        });
                        selectCollector.on('end', async () => {
                            await selectFlagsMessage.delete();
                            // appending the message
                            csvAppend(response['text'], flagTags, 'flag_data.csv');
                            collector.stop();
                        });
                    } else if(interaction.customId === 'ok-button') {
                        flagTags['OK'] = 1;
                        await interaction.reply({ephemeral: true, content: `You have flagged this message as being OK as the flags were a false positive.\nMessage ID: ${flaggedMessage.id}`});
                        if(justiceLogChannel)
                            await justiceLogChannel.send({embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setAuthor({
                                        name: `${interaction.user.username} corrected a flagged message.`,
                                        iconURL: interaction.user.displayAvatarURL({extension: 'png'})
                                    })
                                    .addFields(
                                        {
                                            name: 'Flags',
                                            value: `OK`,
                                            inline: true
                                        },
                                        {
                                            name: 'Message',
                                            value: `[click](${flaggedMessage.url})`,
                                            inline: true
                                        }
                                    )
                                    .setTimestamp()
                                    .setFooter({text: `ID: ${interaction.user.id}`})
                            ]});
                        // appending the message
                        csvAppend(response['text'], flagTags, 'flag_data.csv');
                        collector.stop();
                    }
                    
                });
                collector.on('end', () => {
                    flaggedMessage.edit({components: []});
                })
            }
        }

    }
};