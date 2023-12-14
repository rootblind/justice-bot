/*
    The bot-profile command provides control over the bot's display. It's faster than navigating to the dev portal.
*/

const {SlashCommandBuilder, Client, PermissionFlagsBits, EmbedBuilder, ActivityType, DiscordAPIError} = require('discord.js');
const botUtils = require('../../utility_modules/utility_methods.js'); 
const fs = require('fs');
const {config} = require('dotenv');
config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-profile')
        .setDescription('Change a few aspects of my profile.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup => 
            subcommandGroup.setName('presence')
                .setDescription('Presence configuration.')
                .addSubcommand(subcommand =>
                    subcommand.setName('default')
                        .setDescription('Set the configuration of presence to default-presence-presets.')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('custom-config')
                        .setDescription('Provide a custom configuration for presence.')
                        .addAttachmentOption(option => 
                            option.setName('config-json')
                                .setDescription('The configuration must be a JSON, check default-presence-presets.json to get the idea.')
                                .setRequired(true)
                                
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('auto-update')
                        .setDescription('Toggle if presence is auto updated or not and the delay')
                        .addBooleanOption(option =>
                            option.setName('toggle')
                                .setDescription('Toggle the auto-update')
                                .setRequired(true)
                        )
                        .addNumberOption(option =>
                            option.setName('delay')
                                .setDescription('Set the delay of auto updates in seconds.')
                                .setMinValue(0)
                                .setMaxValue(86400)  
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('update')
                        .setDescription('Manually update the presence.')
                        .addStringOption(option =>
                            option.setName('activity-type')
                                .setDescription('The activity type to be displayed.')
                                .setRequired(true)
                                .addChoices(
                                    {
                                        name: 'Playing',
                                        value: 'Playing'
                                    },
                                    {
                                        name: 'Watching',
                                        value: 'Watching'
                                    },
                                    {
                                        name: 'Listening',
                                        value: 'Listening'
                                    }
                                )
                        )
                        .addStringOption(option =>
                            option.setName('activity-name')
                                .setDescription('The activity name to be displayed.')
                                .setRequired(true)
                                .setMaxLength(32)
                                .setMinLength(1)
                        )
                )
            

        )
        .addSubcommand(subcommand =>
            subcommand.setName('change-username')
                .setDescription('Change my username, only once an hour restriction!')
                .addStringOption(option =>
                    option.setName('new-name')
                        .setDescription('The new username to be provided.')
                        .setMinLength(3)
                        .setMaxLength(32)
                        .setRequired(true)    
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('change-avatar')
                .setDescription('Change the current avatar with another one from the /assets/avatar directory.')
                .addStringOption(option =>
                    option.setName('image-name')
                        .setDescription('Provide the name of the new avatar and its file extension.')
                        .setRequired(true)
                )
        )
        ,
    
    async execute(interaction, client){
        
        if(interaction.user.id != process.env.OWNER)
        {
            return interaction.reply({content: `You are not my master!`, ephemeral: true});
        }
        if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == 0)
            {
                console.error(`I am missing SendMessages permission in ${interaction.channel} channel.`);
            }
            else if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == -1){
                const embed = EmbedBuilder()
                    .setTitle('An error occurred while running this command!')
                    .setColor('Red');
                return interaction.reply({embeds:[embed], ephemeral:true});
                
            }
        
        const subcommand = interaction.options.getSubcommand();
        const embed = new EmbedBuilder();
        // the neccessary asynchronous methods to handle the configs
        const readFile = async (filePath, encoding) => {
            try{
                const data = fs.readFileSync(filePath, encoding);
                return JSON.parse(data);
            } catch(error) {
                console.error(error);
            }
        };
        const writeFile = async (filePath, data) => {
            try{ // Format the JSON for better readability
                const jsonString = JSON.stringify(data, null, 2);
                fs.writeFileSync(filePath, jsonString, 'utf8');
            } catch(error) {
                console.error(error);
            }
        }
        
        const presenceConfig = await readFile('./objects/presence-config.json', 'utf8');
        /* 
            The presence config file looks something like this:
            {
                "status": "enable", -> auto-update toggle
                "delay": 60, -> auto-update delay in seconds
                "type": 0 -> type 0 means the presets are provided by default-presence-presets
                          -> type 1 means the presets are custom and provided by custom-presence-presets
                                which is created upon the first run of the custom-config subcommand
            }
        */
        // In order to change the JSON configuration, the file must be read in an object
        // the object must be modified and then the file has to be re-written with the modified object.
        switch(subcommand) {
            case 'default':
                presenceConfig.type = 0;
                await writeFile('./objects/presence-config.json', presenceConfig);
                embed.setTitle('Presence configuration')
                    .setDescription('The presence configuration was commuted to the default file.')
                    .addFields(
                        {
                            name: 'Status', value: presenceConfig["status"], inline: true
                        },
                        {
                            name: 'Delay(seconds)', value: String(presenceConfig["delay"]), inline: true
                        },
                        {
                            name: 'Type', value: String(presenceConfig["type"]), inline: true
                        }
                    )
                    .setColor('Green')
            break;

            case 'custom-config':
                
                const attachedFile = interaction.options.getAttachment('config-json');
                // validating input
                // checking if the attachment is of the right content type
                if(attachedFile.contentType != 'text/plain; charset=utf-8') {
                    embed.setTitle('Invalid content type!')
                        .setDescription('The attachment must be a text/json file!')
                        .setColor('Red');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }

                const presets = await botUtils.handleFetchFile(attachedFile); //fetching the json file
                const keysToCheck = ['Playing', 'Watching', 'Listening'];
                const keysValidator = keysToCheck.every(key => presets.hasOwnProperty(key));
                if(keysValidator == false) {
                    embed.setTitle('Invalid file contents!')
                        .setDescription('The file provided does not meet the expected content.')
                        .setColor('Red');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }

                // If the file passes the validation, then it is accepted as the new presets
                presenceConfig.type = 1;
                await writeFile('./objects/presence-config.json', presenceConfig);
                await writeFile('./objects/custom-presence-presets.json', presets);
                embed.setTitle('Presence configuration')
                    .setDescription('The presence configuration was commuted to a new one.')
                    .addFields(
                        {
                            name: 'Status', value: presenceConfig["status"], inline: true
                        },
                        {
                            name: 'Delay(seconds)', value: String(presenceConfig["delay"]), inline: true
                        },
                        {
                            name: 'Type', value: String(presenceConfig["type"]), inline: true
                        }
                    )
                    .setColor('Green')
            
            break;
            case 'auto-update':
            const autoUpdateToggle = interaction.options.getBoolean('toggle');
            // if the value is not provided or invalid, the delay does not change
            presenceConfig.delay = interaction.options.getNumber('delay') || presenceConfig.delay;
            presenceConfig.status = autoUpdateToggle ? "enable" : "disable"; // if toggle is true, then auto-update is enabled
            await writeFile('./objects/presence-config.json', presenceConfig);
            embed.setTitle('Presence configuration')
                    .setDescription('The auto-update was changed.')
                    .addFields(
                        {
                            name: 'Status', value: presenceConfig["status"], inline: true
                        },
                        {
                            name: 'Delay(seconds)', value: String(presenceConfig["delay"]), inline: true
                        },
                        {
                            name: 'Type', value: String(presenceConfig["type"]), inline: true
                        }
                    )
                    .setColor('Green')

            break;
            case 'update':
                const activityName = interaction.options.getString('activity-name');
                const activityType = interaction.options.getString('activity-type');
                client.user.setPresence({
                    activities: [
                        {
                            name: activityName,
                            type: ActivityType[activityType]
                        }
                    ],
                    status: 'online'
                });
                presenceConfig.status = 'disable';
                await writeFile('./objects/presence-config.json', presenceConfig);
                embed.setTitle('Presence was manually updated')
                    .setDescription(`I am ${activityType}: ${activityName} now.\nAuto-update was disabled.`)
                    .setColor('Purple');
            break;
            case 'change-username':
                const newUsername = interaction.options.getString('new-name').split(" ").join("");
                const oldUsername = client.user.username;
                try{
                    await client.user.setUsername(newUsername);
                    
                } catch(error) {
                    
                    if(error instanceof DiscordAPIError) {
                        if(error.code === 50035 && error.message.includes('USERNAME_TOO_MANY_USERS')) {
                            embed.setTitle('Too many users with this name!')
                                .setDescription('Try a different one instead.')
                                .setColor('Red');
                        }
                        else embed.setTitle('Username could not be changed!')
                                .setDescription('API limit exceeded, please try again in a few hours.')
                                .setColor('Red');
                    }
                    else{
                            embed.setTitle('Unexpected API errors.')
                                .setDescription('Check the console.')
                                .setColor('Red');
                            console.error(error);
                            
                    }
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
                embed.setTitle(`Username change`)
                        .setDescription(`Username changed from ${oldUsername} to ${newUsername}.`)
                        .setColor('Green')
                        .setAuthor({
                            name: client.user.username,
                            iconURL: client.user.avatarURL()
                        });

            break;

            case 'change-avatar':
                const imageName = interaction.options.getString('image-name');

                // in order to validate the image name, the /assets/avatar/ directory must be read for its files.
                const avatarDirectoryPath = './assets/avatar/';
                try{
                    await fs.promises.access(`${avatarDirectoryPath}${imageName}`);
                    embed.setTitle('Avatar updated successfully')
                        .setDescription(`The avatar was changed to ${imageName}.`)
                        .setColor('Aqua');
                } catch(error) {
                    embed.setTitle('Invalid avatar name')
                        .setDescription('The image name provided is invalid, check spelling and make sure the extension matches.')
                        .setColor('Red');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
                
                try{
                    client.user.setAvatar(`${avatarDirectoryPath}${imageName}`);
                } catch(error) {
                    console.error(error);
                    return interaction.reply({content:'Something went wrong, check the console!', ephemeral: true});
                }
            break;
            
            

        }
       
        return interaction.reply({embeds: [embed]});
    }


}