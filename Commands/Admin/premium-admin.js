/*
    Administrative commands for premium membership such as generating, editing and deleting premium keys.
    Also managing the members themselves like claiming premium keys for them, removing them from premium membership and any aspect.

    Do note that the duration of premium membership is the same as the duration of the claimed key. The countdown starts when a key
    is created not when it's claimed.
*/

const {poolConnection} = require('../../utility_modules/kayle-db.js');

const {encryptor, decryptor} = require('../../utility_modules/utility_methods.js');

const {EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {config} = require('dotenv');
config();



const durationRegex = /^(\d+)([m,h,d,w,y])$/;


// takes durationString as input something like 3d, matches the value and the time unit, converts the time unit to seconds and then returns
// the timestamp of when the key will expire.
// Example: 3d will be converted to the current timestamp + 3 * 864000.
function duration_timestamp(durationString) {
    const match = durationString.match(durationRegex);
    if(match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const Unit = {
            "m": 60,
            "h": 3600,
            "d": 86400,
            "w": 604800,
            "y": 31556926
        }
        return parseInt(Date.now() / 1000) + value * Unit[unit]; // for some reason, timestamps are in milliseconds, but discord interprets as seconds
        // hence why Date.now() is divided by 1000
    } else {
        return null;
    }
}

function random_code_generation() { // generates a random key code, meaning a string with a random length between 5 and 10 that has random characters
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-?';
    const length = Math.floor(Math.random() * 6) + 5; // Random length between 5 and 10

    let randomString = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters[randomIndex];
    }

    return randomString;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium-admin')
        .setDescription('Administrative commands for premium membership.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName('key')
                .setDescription('Commands to administrate premium keys.')
                .addSubcommand(subcommand => 
                    subcommand.setName('generate')
                        .setDescription('Generate a new premium key.')
                        .addNumberOption(option =>
                            option.setName('uses-number')
                                .setDescription('How many times the code can be redeemed.')
                                .setMinValue(1)
                                .setMaxValue(100_000)

                        )
                        .addStringOption(option => 
                            option.setName('duration')
                                .setDescription('The duration of the premium code. Ex: 3d')
                                .setMaxLength(3)
                                .setMinLength(2)
                        )
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('Set a custom key code.')
                                .setMinLength(5)
                                .setMaxLength(10)
                        )
                        .addUserOption(option =>
                            option.setName('dedicated-user')
                                .setDescription('Set the key to be claimable only for a dedicated user.')
                        )
                )
                .addSubcommand(subcommand => 
                    subcommand.setName('remove')
                        .setDescription('Removes one or all keys and the premium memberships associated with it.')
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('The code key to be removed.')
                                .setMinLength(5)
                                .setMaxLength(10)
                                .setRequired(true)

                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('list')
                        .setDescription('List all codes or list details about a specific one.')
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('Show details about the specific code key.')
                                .setMinLength(5)
                                .setMaxLength(10)
                        )
                )
        )
    ,
    cooldown: 5,
    async execute(interaction, client) {
        const subcmd = interaction.options.getSubcommand();
        // fetching and checking if premium system is set up.
        let premiumRoleId = null;
        const fetchRoles = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND (roletype=$2)`,
                [interaction.guildId, 'premium'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        premiumRoleId = result.rows[0].role;
                    }
                    resolve(result);
                }
            )
        });
        await fetchRoles;

        if(!premiumRoleId)
        {
            embed.setTitle('No premium status role was set on this server.')
                .setDescription('No server roles were set up for such commands.')
                .setColor(0xff0004);
            return interaction.reply({embeds: [embed], ephemeral: true});
        }

        const premiumRole = interaction.guild.roles.cache.get(premiumRoleId);

        let logChannel = null // if defined, logging the premium activity
        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE eventtype=$1 AND guild=$2`, ['premium-activity', interaction.guild.id],
                (err, results) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    if(results.rows.length > 0) {
                        logChannel = interaction.guild.channels.cache.get(results.rows[0].channel);
                    }
                    resolve(results);
                }
            )
        });
        await fetchLogChannel;

        switch(subcmd) {
            case 'list': // listing premium keys and getting details about them
                const codeDetails = interaction.options.getString('code') || null;
                let generatedBy = null;
                let createdAt = null;
                let expiresAt = null;
                let usesNumber = null;
                let dedicateduser = null;
                await interaction.deferReply({ephemeral: true});
                // the command will do different things based on if a code is provided or not
                if(codeDetails)
                {
                    const codeDetailsEmbed = new EmbedBuilder();
                    let encryptedCode = encryptor(codeDetails);
                    const fetchCodePromise = new Promise((resolve, reject) => {
                        poolConnection.query(`SELECT * FROM premiumkey WHERE guild=$1 AND code=$2`, [interaction.guild.id, encryptedCode],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                if(result.rows.length > 0) {
                                    generatedBy = result.rows[0].generatedby;
                                    createdAt = result.rows[0].createdat;
                                    expiresAt = result.rows[0].expiresat;
                                    usesNumber = result.rows[0].usesnumber;
                                    dedicateduser = result.rows[0].dedicateduser;
                                }
                                resolve(result);
                            }
                        )
                    });
                    await fetchCodePromise;

                    // if any of the variables remains unchanged, it means there is no code as provided
                    if(generatedBy == null)
                        return await interaction.editReply({embeds: [
                            new EmbedBuilder()
                                .setTitle('Invalid key input')
                                .setDescription('The key provided doesn\'t exist!')
                                .setColor('Red')
                        ], ephemeral: true});
                    
                    generatedBy = await interaction.guild.members.cache.get(generatedBy) || generatedBy;

                    if(dedicateduser)
                        dedicateduser = await interaction.guild.members.cache.get(dedicateduser) || dedicateduser;

                    // building the embed
                    codeDetailsEmbed.setTitle(`Details about premium key: ${codeDetails}`)
                        .setFields(
                            {
                                name: 'Generated by',
                                value: `${generatedBy}`
                            },
                            {
                                name: 'Created at',
                                value: `<t:${createdAt}:R>`
                            },
                            {
                                name: 'Expires at',
                                value: expiresAt > 0 ? `<t:${expiresAt}:R>` : 'Permanent'
                            },
                            {
                                name: 'Uses left',
                                value: `${usesNumber}`
                            },
                            {
                                name: 'Dedicated user',
                                value: `${dedicateduser || 'None'}`
                            }
                        )
                        .setColor(0xd214c7)
                    await interaction.editReply({embeds: [codeDetailsEmbed], ephemeral: true});

                } else {
                    let listEmbed = new EmbedBuilder()
                        .setTitle('List of existing premium keys')
                    // keys will be paired with their status
                    // has: none -> unavailable
                    // has: dedicateduser -> Private
                    // has: usesnumber and no dedicateduser -> Avaliable
                    const keysArray = [];
                    const fetchDataForList = new Promise((resolve, reject) => {
                        poolConnection.query(`SELECT code, usesnumber, dedicateduser FROM premiumkey WHERE guild=$1`, [interaction.guild.id],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                if(result.rows.length > 0) {
                                    result.rows.forEach((row) => {
                                        let statusKey;
                                        if(row.dedicateduser)
                                            statusKey = 'Private';
                                        else if(!row.usesnumber)
                                            statusKey = 'Unavaliable';
                                        else
                                            statusKey = 'Avaliable'
                                        keysArray.push(
                                            { // relevant information: the actual code and boolean values about whether 
                                            // usesnumber is above 0 and whether the code has a dedicated user or not
                                                code: decryptor(row.code.toString()),
                                                status: statusKey
                                            }
                                        )
                                    })
                                }
                                else
                                    listEmbed.setDescription('No key registered, try generating some with `/premium-admin key generate`.')
                                resolve(result);
                            }
                        )
                    });
                    await fetchDataForList;

                    // if the array's length is greater than 0 it means the primarykey table is not empty
                    let keyCount = 0;
                    for(let key of keysArray) {
                        ++keyCount;
                        listEmbed.addFields(
                            {
                                name: `[${keyCount}] - Code: ${key.code}`,
                                value: `${key.status}`,
                            }
                        );
                        
                        if(keyCount % 25 == 0 || keyCount == keysArray.length) {
                            await interaction.followUp({embeds: [listEmbed], ephemeral: true});
                            listEmbed = new EmbedBuilder();
                        }
                        

                    }
                }
            break;
            case 'remove': // removes a code from the database and revokes premium membership of those whom got it from the deleted code
                let removeCode = interaction.options.getString('code');

                let deletedCount = 0; // the delete query will return how many rows of the matching code and guild will be deleted
                let membershipsRemoved = 0;
                removeCode = encryptor(removeCode); // encrypting the code for the db query

                // defer the reply because a lot of DB calls are made so a late response can be expected when there is a lot of data
                await interaction.deferReply({ephemeral: true});

                // here we remove the key from the database table of premiumkey and premiummembers and also removing the premium membership
                // of affected users
                
                const removeKeyPromise = new Promise((resolve, reject) => {
                    poolConnection.query(`DELETE FROM premiumkey WHERE code=$1 AND guild=$2`, [removeCode, interaction.guild.id], 
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            if(result.rowCount > 0) {
                                deletedCount = result.rowCount;
                                
                            }
                            resolve(result);
                        });
                });
                await removeKeyPromise;

                if(!deletedCount) { // if nothing was deleted, then it must mean there is no premium code for the guild
                    return await interaction.editReply({embeds: [
                        new EmbedBuilder()
                            .setTitle('Invalid code!')
                            .setDescription('The code provided doesn\'t exist!\nNothing was changed.')
                            .setColor('Red')
                    ], ephemeral: true})
                }

                const proceedRemoval = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT member, customrole FROM premiummembers WHERE guild=$1 AND code=$2`, [interaction.guild.id, removeCode],
                        async (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            if(result.rows.length > 0) {
                                membershipsRemoved = result.rowCount; // considering how many users are affected
                                // fetching each member to remove the premium role
                                const premiumMembers = result.rows.map(row => row.member);
                                premiumMembers.forEach(async (member) => {
                                    const guildMember = await interaction.guild.members.cache.get(member);
                                    await guildMember.roles.remove(premiumRole);
                                });
                                // once all affected users got their premium role removed, their custom roles must be deleted
                                const customRoles = result.rows.map(row => row.customrole).filter(role => role !== null); // the array of custom roles that exist
                                customRoles.forEach(async (customrole) => {
                                    const customRole = await interaction.guild.roles.fetch(customrole);
                                    await customRole.delete();
                                });

                                // clear all rows that contain the key
                                await poolConnection.query(`DELETE FROM premiummembers WHERE guild=$1 AND code=$2`, [interaction.guild.id, removeCode]);
                            }
                            resolve(result);
                        }
                    )
                });
                await proceedRemoval;

                // getting to this line means everything worked fine so a success reply can be sent
                await interaction.editReply({embeds: [
                    new EmbedBuilder()
                        .setTitle('Successfully removed the key!')
                        .setDescription('The key was removed along with the membership of those who claimed it.\n**Details:**')
                        .setColor('Green')
                        .addFields(
                            {
                                name: 'Members affected:',
                                value: `${membershipsRemoved}`
                            }
                        )
                ]});

                // logging the action
                if(logChannel) {
                    await logChannel.send({embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: `${interaction.user.username} removed a premium key`,
                                iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                            })
                            .addFields(
                                {
                                    name: 'Code:',
                                    value: `${interaction.options.getString('code')}`
                                }
                            )
                            .setTimestamp()
                            .setColor('Red')
                            .setFooter({text: `ID: ${interaction.user.id}`})
                    ]});
                }

            break;
            case 'generate':
                let duration = interaction.options.getString('duration') || 0; // not providing a duration means the key never expires
                let code = interaction.options.getString('code') || null; // not providing a code means the bot will generate one
                let usage = interaction.options.getNumber('uses-number') || 1; // will default to 1 if no usage number was provided
                const dedicatedUser = interaction.options.getUser('dedicated-user') || null; // not provided a dedicated user means anyone can redeem the key
                
                if(dedicatedUser) usage = 1; // if there is a dedicated user, then usage will be set to 1
                
                const embedError = new EmbedBuilder()
                    .setColor('Red')
                
                if(duration){ // validation for duration when specified
                    if(!durationRegex.test(duration))
                    {
                        embedError.setTitle('Invalid input!')
                            .setDescription('The duration format is invalid.\n Provide a duration that respects the format: <number: 1-99>< m | h | d | w | y >')
                        return await interaction.reply({embeds: [embedError], ephemeral: true});
                    }
                    const match = duration.match(durationRegex); // breaking the duration format into value and time unit in order to validate the input
                    if(parseInt(match[1]) < 1 || parseInt(match[1] > 99)) {
                        embedError.setTitle('Duration value is out of range')
                            .setDescription('The value must be a number between 0 and 99!')
                        
                        return await interaction.reply({embeds: [embedError], ephemeral: true});
                    }

                    duration = duration_timestamp(duration);
                }
                

                if(code == null) { // generating codes until a unique one is found
                    
                    const generateCode = new Promise((resolve, reject) => {
                        poolConnection.query(`SELECT code FROM premiumkey WHERE guild=$1`, [interaction.guild.id],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                code = encryptor(random_code_generation());
                                if(result.rows.length > 0) {
                                    const codes = result.rows.map(row => row.code);
                                    // keep generating codes until an unique one is found
                                    while(codes.includes(code))
                                        code = encryptor(random_code_generation());
                                }
                                resolve(result);
                            }
                        )
                    });
                    await generateCode;
                } else { // when a code is specified
                    let isKeyUnique = true;
                    code = encryptor(code); // checking if the code already exists
                    const checkDB = new Promise((resolve, reject) => {
                        poolConnection.query(`SELECT code FROM premiumkey WHERE guild=$1 AND code=$2`, [interaction.guild.id, code],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                if(result.rows.length > 0) {
                                    isKeyUnique = false;
                                }
                                resolve(result);
                            }
                        )
                    });
                    await checkDB;

                    if(!isKeyUnique) {
                        embedError.setTitle('The code already exists!')
                            .setDescription('You must provide an unique code for the key.')
                        return await interaction.reply({embeds: [embedError], ephemeral: true});
                    }
                }
            
            let dedicatedUserId = null; // when no dedicated user is defined, using definedUser.id will throw an error so it needs to be handled
            if(dedicatedUser)
                dedicatedUserId = dedicatedUser.id;

            // registering all the data about the key into database
            const registerNewKey = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO premiumkey(code, guild, generatedby, createdat, expiresat, usesnumber, dedicateduser)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [code, interaction.guild.id, interaction.user.id, parseInt(Date.now() / 1000), duration, usage, dedicatedUserId],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    }
                );
            });

            await registerNewKey;

            // logging and confirming the event
            const embedNewKeySuccess = new EmbedBuilder()
                .setAuthor({
                    name: `${interaction.user.username} generated a new key.`,
                    iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                })
                .setDescription('A new premium key was generated successfully!')
                .addFields(
                    {
                        name: 'Code:',
                        value: `${decryptor(code)}`
                    },
                    {
                        name: 'Generated by',
                        value: `${interaction.member}`
                    },
                    {
                        name: 'Expires:',
                        value: duration ? `<t:${duration}:R>` : 'Permanent'
                    },
                    {
                        name: 'Number of uses:',
                        value: `${usage}`
                    },
                    {
                        name: 'Dedicated user:',
                        value: `${dedicatedUser || 'None'}`
                    }

                )
                .setColor(0xd214c7)
                .setTimestamp()
                .setFooter({text: `ID: ${interaction.user.id}`});
            
            if(logChannel) {
                await logChannel.send({embeds: [embedNewKeySuccess]});
            }
            await interaction.reply({embeds: [embedNewKeySuccess], ephemeral: true});
                
            break;
        }
    }
}