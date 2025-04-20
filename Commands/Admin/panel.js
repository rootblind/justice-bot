/*
    The panel command tree is handled through select menu interaction.
    The user can create a new named panel or delete an existing one
        add/remove roles, choose where to be sent and list the existing panels

    For ease of use, a default simple color panel can be chosen.
    The panels are stored in the panelscheme
*/
const {SlashCommandBuilder, PermissionFlagsBits, Client, EmbedBuilder, ActionRowBuilder,
        StringSelectMenuBuilder, ChannelType, Embed,
        MessageFlags} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const fs = require('fs');
const {config} = require('dotenv');
config();
// panel: create, delete, add-role, remove-role, list, send
module.exports = {
    testOnly: false,
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Managing role panels.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('default')
                .setDescription('Create some basic roles if they don\'t exist and create a panel that contains them.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('create')
                .setDescription('Create a new panel.')
                .addStringOption(option =>
                    option.setName('new-panel')
                        .setDescription('Name of the new panel.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(31)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('delete') 
                .setDescription('Delete an existing panel.') 
                .addStringOption(option =>
                    option.setName('panel-name')
                        .setDescription('Name of the new panel.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(31)
                ) 
        )
        .addSubcommand(subcommand =>
            subcommand.setName('add-role')
                .setDescription('Add a role to the specified panel.')
                .addStringOption(option =>
                    option.setName('panel-name')
                        .setDescription('The panel to add the role to.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(31)
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to be added to the panel.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('The description of the role.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(255)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove-role')
                .setDescription('Remove a role from the specified panel.')
                .addStringOption(option =>
                    option.setName('panel-name')
                        .setDescription('The panel to remove the role from.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(31)
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to be removed from the panel.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all existing panels of this server.')
                .addStringOption(option =>
                    option.setName('panel-name')
                        .setDescription('The panel to be listed.')
                    .setMinLength(1)
                    .setMaxLength(31) 
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('send')
                .setDescription('Send the select menu of a panel.')
                .addStringOption(option =>
                    option.setName('panel-name')
                        .setDescription('The panel to remove the role from.')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(31)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel where the select menu will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option.setName('menu-description')
                        .setDescription('The description of the select menu.')   
                        .setMaxLength(255) 
                )
        )
        
    ,
    botPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages],
    userPermissions: [PermissionFlagsBits.Administrator],

    async execute(interaction, client) {
        // since most subcommands require a panel name that already exists, validation shall be done before the switch statement
        // if panelName is not null, then it must exist within the database, otherwise the input is invalid.
        const panelName = interaction.options.getString('panel-name') || null;
        let panelNameValid; // boolean indicating weather the panel exists or not
        const subcommands = interaction.options.getSubcommand();
        const embed = new EmbedBuilder();
        const me = interaction.guild.members.cache.get(process.env.CLIENT_ID);


        if(!botUtils.isAlphanumeric(panelName)) {
            embed.setTitle('Invalid input!')
                .setDescription('Panel name must be alphanumeric!')
                .setColor('Red');
            return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
        }
        // checking if the panel name does exist (and is valid)
        if(panelName != null) {
            const panelNamePromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT panelname FROM panelheaders WHERE guild=${interaction.guild.id}`,
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length == 0) {
                            panelNameValid = true;
                        } else {
                            const existingPanelNames = result.rows.map(row => row.panelname);
                            panelNameValid = (existingPanelNames.includes(panelName));
                        }
                        resolve(result);
                    }
                )
            });
            await panelNamePromise;
            if(!panelNameValid) {
                embed.setName('Panel name does not already exists')
                    .setColor('Red')
                    .setDescription('Provide an unique panel name!')
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
        }
        
        switch (subcommands) {
            case 'default':
            // checking if default already exists
            let defaultPanelValid;
            const defaultPanelPromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT panelname FROM panelheaders WHERE guild=${interaction.guild.id}`,
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length == 0) {
                            defaultPanelValid = true;
                        } else {
                            const existingPanelNames = result.rows.map(row => row.panelname);
                            defaultPanelValid = !(existingPanelNames.includes('default'));
                        }
                        resolve(result);
                    }
                )
            });
            await defaultPanelPromise;
            if(!defaultPanelValid) {
                embed.setTitle('Default panel already exists')
                    .setColor('Red')
                    .setDescription('You can not have two default panels!')
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            // a JSON default will be used
            const readFile = async (filePath, encoding) => {
                try {
                    const data = fs.readFileSync(filePath, encoding);
                    return JSON.parse(data);
                } catch (error) {
                    console.error(error);
                }
            };
            // opening the JSON file, making an array of the colors that do not exist and create these roles.
            const colorDefaultObject = await readFile('./objects/color-defaults.json', 'utf-8');
            const colorKeys = Object.keys(colorDefaultObject);
            const missingColors = [];
            colorKeys.forEach((color) => {
                if(!interaction.guild.roles.cache.find(role => role.name === color)) {
                    missingColors.push(color);
                }
            });
            try {
                missingColors.forEach((color) => {
                    interaction.guild.roles.create({
                        name: colorDefaultObject[color]['name'],
                        color: parseInt(colorDefaultObject[color]['color'], 16),
                        permissions: []
                    });
                });
            } catch(error) {
                console.error(error);
                embed.setTitle('Error')
                    .setColor('Red')
                    .setDescription('Something went wrong with creating the roles.')
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            // storing data into the database
            colorKeys.forEach(async (color) => {
                if(interaction.guild.roles.cache.find(r => r.name === color)) {
                    let role = interaction.guild.roles.cache.find(r => r.name === color);
                    const defaultAddRolePromise = new Promise((resolve, reject) => {
                        poolConnection.query(`INSERT INTO panelscheme (guild, panelname, roleid, description)
                            VALUES($1, $2, $3, $4)`,
                            [interaction.guild.id, 'default', role.id, `${role.name} color`], (err, result) => {
                                    if(err) {console.error(err); reject(err);}
                                    else resolve(result);
                                }
                            );
                    });
                    
                    await defaultAddRolePromise;
                   
                }
            });

            const defaultAddHeader = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO panelheaders (guild, panelname)
                    VALUES($1, $2)`, [interaction.guild.id, 'default'], (err, result) => {
                        if(err){
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    });
            });
            await defaultAddHeader;
            embed.setTitle('Default panel has been initialized')
                .setColor('Green')
                .setDescription('The panel has been created with the following roles:');
            const colorRoles = interaction.guild.roles.cache.map(role => {
                if(colorKeys.includes(role.name)) return role;});
            embed.addFields({
                name: 'List',
                value: `${colorRoles.join('\n') || 'None'}`
            });
            return interaction.reply({embeds: [embed]});

            break;
            case 'create':
            // validate new-panel
            const newPanel = interaction.options.getString('new-panel');
            if(!botUtils.isAlphanumeric(newPanel)) {
                embed.setTitle('Invalid input!')
                    .setDescription('Panel name must be alphanumeric!')
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            let validateNewPanelName; // false if already exists, true if it doesn't
            const validateNewPanelPromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT panelname FROM panelheaders WHERE guild=${interaction.guild.id}`,
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length == 0) {
                            validateNewPanelName = true;
                        } else {
                            const existingPanelNames = result.rows.map(row => row.panelname);
                            validateNewPanelName = !(existingPanelNames.includes(newPanel));
                        }
                        resolve(result);
                    }
                )
            });
            await validateNewPanelPromise;
            if(!validateNewPanelName) {
                embed.setTitle('Duplicate panel name!')
                    .setDescription(`The panel name provided "${newPanel}" already exists.`)
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            // if newPanel is alphanumeric and does not already exist, it's good to go
            // inserting it into the panel headers
            const newPanelHeaderPromise = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO panelheaders(guild, panelname)
                    VALUES($1, $2)`, [interaction.guild.id, newPanel],
                    (err, result) => {
                        if(err){
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    });
            });
            await newPanelHeaderPromise;
            embed.setTitle(`A new panel was created!`)
                .setDescription(`"${newPanel}"  has been added as a panel header.\nUse /panel add-role next.`)
                .setColor('Green');
            return interaction.reply({embeds: [embed]});
            break;
            
            case 'delete':
            // since panel-name is validated above the switch statement, there is no other validation to be done.

            // delete the panel from panelscheme
            const deletePanel = new Promise((resolve, reject) => {
                poolConnection.query(`DELETE FROM panelscheme WHERE panelname=$1 AND guild=$2`,
                    [panelName, interaction.guild.id], (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    });
            });
            // delete the panel from headers
            const deleteHeader = new Promise((resolve, reject) => {
                poolConnection.query(`DELETE FROM panelheaders WHERE panelname=$1 AND guild=$2`,
                    [panelName, interaction.guild.id], (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    });
            });
            await deletePanel;
            await deleteHeader;
            embed.setTitle('Panel deleted successfully!')
                .setDescription(`${panelName} panel has been deleted!`)
                .setColor('Green')
            interaction.reply({embeds: [embed]});
            break;

            case 'add-role':
            const addRole = interaction.options.getRole('role');
            const addDescription = interaction.options.getString('description');

            // borrowed the validation from role.js
            if(interaction.member.roles.highest.position <= addRole.position && interaction.guild.ownerId !== interaction.member.id)
                {
                    embed.setColor('Red').setDescription('Your highest role is too low!');
                    return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
                }

            if(addRole.id == interaction.guild.roles.everyone.id)
                {
                    embed.setColor('Red').setDescription('You can not access @everyone');
                    return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
                }

            if(me.roles.highest.position <= addRole.position)
                {
                    embed.setColor('Red').setDescription('My highest role is too low!');
                    return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
                }
           // Excluding bot roles as valid inputs
            if(addRole.managed)
                {
                    embed.setColor('Red').setDescription('Bot roles are not manageable!');
                    return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
                }
            //check if role is already in the panel
            let validateRoleInPanel;
            const findRoleInPanel = new Promise((resolve, reject) =>{
                poolConnection.query(`SELECT roleid FROM panelscheme WHERE guild=${interaction.guild.id}
                    AND panelname='${panelName}'`, (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length == 0) {
                            validateRoleInPanel = false;
                        } else if(result.rows.length > 0) {
                            const existingTables = result.rows.map(row => row.roleid);
                            validateRoleInPanel = existingTables.includes(addRole.id);
                        }
                        resolve(result);
                    });
            });
            await findRoleInPanel;
            if(validateRoleInPanel) {
                embed.setTitle('Role is already in panel')
                    .setDescription('The role can not be added twice in the same panel.')
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            // after all of that, addRole must be valid
            const addRolePromise = new Promise((resolve, reject) =>{
                poolConnection.query(`INSERT INTO panelscheme(guild, panelname, roleid, description)
                    VALUES($1, $2, $3, $4)`,
                    [interaction.guild.id, panelName, addRole.id, addDescription],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    });
            });
            await addRolePromise;
            embed.setTitle('Role added')
                .setDescription(`${addRole} has been added to the ${panelName} panel.`)
                .setColor('Green');
            return interaction.reply({embeds: [embed]});
            break;

            case 'remove-role':
            const removeRole = interaction.options.getRole('role');
            let rRoleInPanel;
            const findRemoveRole = new Promise((resolve, reject) =>{
                poolConnection.query(`SELECT roleid FROM panelscheme WHERE guild=${interaction.guild.id}
                    AND panelname='${panelName}'`, (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length == 0) {
                            rRoleInPanel = false;
                        } else if(result.rows.length > 0) {
                            const existingTables = result.rows.map(row => row.roleid);
                            rRoleInPanel = existingTables.includes(removeRole.id);
                        }
                        resolve(result);
                    });
            });
            await findRemoveRole;
            if(!rRoleInPanel) { // rRoleInPanel is true if removeRole is in panel
                embed.setTitle('Nothing was removed')
                    .setDescription(`${removeRole} is not part of the specified panel`)
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }

            const removeRolePromise = new Promise((resolve, reject) => {
                poolConnection.query(` DELETE FROM panelscheme WHERE guild=$1 AND panelname=$2 AND roleid=$3`,
                    [interaction.guild.id, panelName, removeRole.id],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        resolve(result);
                    });
            });
            await removeRolePromise;
            embed.setTitle('Role removed from panel')
                .setDescription(`You have successfully removed ${removeRole} from ${panelName} panel.`)
                .setColor('Green');
            return interaction.reply({embeds: [embed]});
            break;

            case 'list' :
            const listType = panelName == null; // if panelName is not provided (panelName = null) then it lists all panels
            // otherwise lists a specific panel and its roles
            // Before listing the roles, there needs to be a check in case a role was deleted, but not removed
                // from the panel
            let rolesToBeCleared;
            const checkRolesValidPromise = new Promise((resolve, rejects) => {
                poolConnection.query(`SELECT roleid FROM panelscheme WHERE guild=$1`,
                    [interaction.guild.id],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            rejects(err);
                        } else {
                            // making a set of the results
                            const roleIds = new Set(result.rows.map(row => row.roleid));
                            // filtering only the role Ids that are in the database and not in the guild roles
                            rolesToBeCleared = Array.from(roleIds).filter(roleId => !interaction.guild.roles.cache.has(roleId));
                            
                        }
                        resolve(result);
                    })
            });
            await checkRolesValidPromise;
            if(rolesToBeCleared.length > 0) {
                rolesToBeCleared.forEach(async roleId => {
                    const cleanPromise = new Promise((resolve, reject) => {
                        poolConnection.query(`DELETE FROM panelscheme WHERE roleid=$1 AND guild=$2`,
                        [roleId, interaction.guild.id],
                        (err, result) => {
                            if(err) { console.error(err); reject(err); }
                            resolve(result);
                        });
                    });
                    await cleanPromise;
                });
            }
            if(listType) {
                embed.setTitle('List all panels');
                const listPanelHeaders = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT panelName FROM panelheaders WHERE guild=${interaction.guild.id}`,
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else {
                            const panelHeadersArray = result.rows.map(row => row.panelname);
                            embed.addFields({
                                name: 'Headers',
                                value: `${panelHeadersArray.join('\n') || 'None'}`
                            });
                        }
                        resolve(result);
                    });
                });
                await listPanelHeaders;
            }
            else {
                embed.setTitle(`List all roles of **${panelName}**`)
                
                const listPanelRoles = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT roleid FROM panelscheme WHERE guild=$1 AND panelname=$2`,
                        [interaction.guild.id, panelName],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            } else {
                                const roleIdsArray = result.rows.map(row => row.roleid);
                                const roleObjectArray = interaction.guild.roles.cache.map(role => {
                                    if(roleIdsArray.includes(role.id))
                                        return role;
                                    
                                });
                                embed.addFields({
                                    name: `${panelName}`,
                                    value: `${roleObjectArray.join('\n') || "None"}`
                                });
                                
                            }
                            resolve(result);
                        });
                });
                await listPanelRoles;
            }
            embed.setColor('Purple');
            return interaction.reply({embeds: [embed]});
            break;

            case 'send':
            let panelIsEmpty;
            let panelRolesArray = [];
            const getPanelScheme = new Promise((resolve, reject) => {
                // get all rows of the panel
                poolConnection.query(`SELECT * FROM panelscheme WHERE guild=$1 AND panelname=$2`,
                    [interaction.guild.id, panelName],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length == 0) {
                            panelIsEmpty = true;
                        } else {
                            panelIsEmpty = false;
                            result.rows.forEach(row => { // iterate through each row to make an array of objects to be sent as arrow menu
                                const role = interaction.guild.roles.cache.get(row.roleid);
                                panelRolesArray.push(
                                    {
                                        label: role.name,
                                        value: role.id,
                                        description: row.description,
                                    }
                                )
                            })
                        }
                        resolve(result);
                    });
            });
            await getPanelScheme;
            if(panelIsEmpty) {
                embed.setTitle('Panel is empty')
                    .setDescription('There is nothing to be sent, add some roles first.')
                    .setColor('Red');
                return interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
            }
            // if panel is not empty, then panelRolesArray must contain all roles as objects for select menu
            const components = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('role-panel')
                        .setPlaceholder('Select the desired roles...')
                        .setMinValues(0)
                        .setMaxValues(panelRolesArray.length)
                        .addOptions(
                            panelRolesArray
                        )
                )
            ]
            const sendChannel = interaction.options.getChannel('channel') || interaction.channel;
            // the description for embed
            const menuDesc = interaction.options.getString('menu-description') || 'Pick some roles.';
            embed.setColor('Purple')
                .setDescription(menuDesc);
            
            sendChannel.send({embeds: [embed], components: components})
                .then(async(x) =>{ // registering the message in the panelmessage table
                    const registerMessagePromise = new Promise((resolve, reject) => {
                        poolConnection.query(`INSERT INTO panelmessages(guild, channel, messageid, panelname)
                                            VALUES($1, $2, $3, $4)`,
                                            [interaction.guild.id, sendChannel.id, x.id, panelName],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }
                                resolve(result);
                            });
                    });
                    await registerMessagePromise;
                });
            
            
            
            return interaction.reply({embeds: [
                new EmbedBuilder()
                    .setTitle('The panel has been sent')
                    .setColor('Green')
                    .setDescription(`The panel was sent successfully in ${sendChannel.name}.`)
            ], flags: MessageFlags.Ephemeral});
            break;
        }

        
    }


    
}