/*
    Premium commands are commands accessible only by members that have the premium role designated for the specified server.
    Membership is gained and removed based on premium key codes generated and redeemed.

    Basically the role enables the member to use premium commands and the premium key codes keep track of who should recieve the role
    and whom should have it removed.
*/



const {SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const {text_classification, encryptor, decryptor} = require('../../utility_modules/utility_methods.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {config} = require('dotenv');
config();

const mod_api = process.env.MOD_API_URL;

async function checkModApi(api) { // checking if there is a connection to the specified api url
    try {

        const response = await axios.get(api);
        if (response.status === 200) {
            return true; // returns true if the connection was successful
        } else {
            return false; // returns false if the connection gives errors
        }
    } catch (error) {
        if (error.request) {
            // The request was made but no response was received
            console.log('No response received from API');
        }
    }
}


const Colors = {
    "red": 0xf62e36,
    "orange": 0xff7f50,
    "yellow": 0xebd406,
    "green": 0x019a66,
    "blue": 0x0079c2,
    "pink": 0xff80ed,
    "violet": 0x9A00FF,
    "black": 0x000001,
    "white": 0xffffff,
    "premium": 0xd214c7
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Premium related menus and options.')
        .addSubcommand(subcommand =>
            subcommand.setName('dashboard')
                .setDescription('Dashboard for premium users to access their features.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('menu')
                .setDescription('Opens the main menu to get more information and redeem premium key codes.')
        )
        ,

    async execute(interaction, client) {
        // checking if there are premium roles set up, if so, checking if the interaction member has one
        let premiumRoleId = null;
        const cmd = interaction.options.getSubcommand();
        const embed = new EmbedBuilder();
        const filter = (i) => i.user.id === interaction.user.id
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

        // if member somehow doesn't have the premium role, but is registered as premium user
        let roleMustBeAssigned = false;

        const fetchMembership = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT member FROM premiummembers WHERE guild=$1 AND member=$2`,
                [interaction.guild.id, interaction.user.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    if(result.rows.length > 0) {
                        roleMustBeAssigned = true;
                    }
                    resolve(result);
                }
            )
        });
        await fetchMembership;
        // using a boolean since assigning a role must be awaited and the promise doesn't wait until discord finishes its processes
        if(roleMustBeAssigned)
            await interaction.member.roles.add(premiumRole);

        if(!interaction.member.roles.cache.has(premiumRoleId)  && cmd == 'dashboard') {
            embed.setTitle('You lack premium status!') 
                .setColor(Colors['red'])
                .setDescription('You require an active premium status in order to use this command.')
            return interaction.reply({embeds: [embed], ephemeral: true});
        }

        let logChannel = null
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

        switch(cmd) {
            case 'menu': // while this is not a premium feature, here will be implemented commands about premium, such as info page, redeem codes and more
                const mainMenu = new EmbedBuilder()
                    .setAuthor({
                        name: `${interaction.user.username}`,
                        iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                    })
                    .setColor(Colors['premium'])
                    .setDescription('Redeem codes and find out about the premium features!\n\n_If the redeem button is disabled, you can not redeem another key while having premium!_')
                    .addFields(
                        {
                            name: 'Redeem',
                            value: `Redeem a premium key to unlock premium features!`
                        }
                    );

                    const redeemKeyButton = new ButtonBuilder() // redeem premium key
                        .setCustomId('redeem-key')
                        .setLabel('Redeem')
                        .setStyle(ButtonStyle.Success);
                    const closeMenuButton = new ButtonBuilder() // closes the menu
                        .setCustomId('close-menu')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger);
                    

                    if(interaction.member.roles.cache.has(premiumRoleId)) {
                        // premium users can not redeem another key while theirs is still active
                        redeemKeyButton.setDisabled(true);
                    }

                   

                    const mainMenuActionRow = new ActionRowBuilder()
                        .addComponents(redeemKeyButton, closeMenuButton);
                    
                    const mainMenuMessage = await interaction.reply({embeds: [mainMenu], components: [mainMenuActionRow], ephemeral: true});
                    
                    const redeemKeyInput = new TextInputBuilder()
                        .setCustomId('redeem-key-input')
                        .setLabel('The code of the key')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(5)
                        .setMaxLength(10)
                    
                    const redeemModal = new ModalBuilder()
                        .setCustomId(`redeem-modal-${interaction.user.id}`)
                        .setTitle('Redeem premium key')

                    let filterRedeemModal = (interaction) => interaction.customId === `redeem-modal-${interaction.user.id}`;

                    const redeemCodeRow = new ActionRowBuilder()
                        .addComponents(redeemKeyInput)

                    redeemModal.addComponents(redeemCodeRow);

                    let collectorMenu = mainMenuMessage.createMessageComponentCollector({
                        ComponentType: ComponentType.Button,
                        filterRedeemModal,
                        time: 120_000,
    
                    });

                    collectorMenu.on('collect', async (interaction) => {
                        switch (interaction.customId) {
                            case 'redeem-key':
                                interaction.showModal(redeemModal);

                                interaction.awaitModalSubmit({filterRedeemModal, time: 120_000})
                                    .then(async (modalInteraction) => {
                                        const codeInput = modalInteraction.fields.getTextInputValue('redeem-key-input');
                                        const encrypted_code = encryptor(codeInput);
                                        let usage;
                                        let duration = 0;
                                        let isValidKey = false;
                                        await modalInteraction.deferReply({ephemeral: true});
                                        const checkCode = new Promise((resolve, reject) => {
                                            poolConnection.query(`SELECT * FROM premiumkey WHERE guild=$1 AND code=$2`,
                                                [interaction.guild.id, encrypted_code],
                                                (err, result) => {
                                                    if(err) {
                                                        console.error(err);
                                                        reject(err);
                                                    }
                                                    if(result.rows.length > 0) {
                                                        if(result.rows[0].usesnumber && 
                                                            (result.rows[0].dedicateduser == null ||
                                                            result.rows[0].dedicateduser == interaction.user.id)) {
                                                                // meaning if there is still at least a usage left and there is no dedicated user or
                                                                // the dedicated user is the interaction user themselves, then it's valid
                                                                isValidKey = true;
                                                                usage = result.rows[0].usesnumber - 1;
                                                                duration = result.rows[0].expiresat;
                                                            }
                                                    }
                                                    resolve(result);
                                                }
                                            );
                                        });
                                        await checkCode;

                                        if(!isValidKey) { // if isValidKey remains false, then the code provided is invalid
                                            return await modalInteraction.editReply({content: 'The code key provided is invalid, reached maximum usage or is dedicated to another member!!', ephemeral: true});
                                        }

                                        poolConnection.query(`UPDATE premiumkey SET usesnumber=$1 WHERE guild=$2 AND code=$3`,
                                            [usage, interaction.guild.id, encrypted_code]
                                        ); // updating the premium key by decrementing the uses number

                                        // adding the new premium member
                                        poolConnection.query(`INSERT INTO premiummembers(member, guild, code)
                                            VALUES($1, $2, $3)`, [interaction.user.id, interaction.guild.id, encrypted_code]);
                                        
                                        // adding the premium role
                                        await interaction.member.roles.add(premiumRole);

                                        await modalInteraction.editReply({embeds: [
                                            new EmbedBuilder()
                                                .setAuthor({
                                                    name: `${modalInteraction.user.username} is now a premium member!`,
                                                    iconURL: modalInteraction.member.displayAvatarURL({extension: 'png'})
                                                })
                                                .setThumbnail('https://i.imgur.com/fPibNVC.png')
                                                .setTitle('Congratulation!')
                                                .setDescription(`You have redeemed a premium key!\nEligibility: ${duration > 0 ? `<t:${duration}:R>` : 'Permanent'}`)
                                                .setColor(Colors['premium'])
                                        ]});
                                        
                                        if(logChannel) {
                                            const logRedeemCode = new EmbedBuilder()
                                                .setAuthor({
                                                    name: modalInteraction.user.username,
                                                    iconURL: modalInteraction.member.displayAvatarURL({extension: 'png'})
                                                })
                                                .setColor(Colors['premium'])
                                                .addFields(
                                                    {
                                                        name: 'Member',
                                                        value: `${modalInteraction.member}`,
                                                        inline: true
                                                    },
                                                    {
                                                        name: 'Code',
                                                        value: `${codeInput}`,
                                                        inline: true
                                                    },
                                                    {
                                                        name: 'Expires',
                                                        value: `${duration > 0 ? `<t:${duration}:R>` : 'Permanent'}`,
                                                        inline: true
                                                    },
                                                    {
                                                        name: 'Uses left:',
                                                        value: `${usage}`,
                                                        inline: true
                                                    }
                                                )
                                                .setTimestamp()
                                                .setFooter({text: `ID: ${modalInteraction.user.id}`});
                                            await logChannel.send({embeds: [logRedeemCode]});
                                        }
                                    });
                            break;
                            case 'close-menu':
                                collectorMenu.stop();
                            break;
                        }
                    });

                collectorMenu.on('end', () => {
                    mainMenuMessage.delete();
                });
            break;
            case 'dashboard': // premium users can access their features from the dashboard
            // fetching information from database about the current member premium status
                let code = null;
                let createdAt = null;
                let expiresAt = null;
                let customRole = null;
                const premiumStatusPromise = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT * FROM premiummembers WHERE guild=$1 AND member=$2`, [interaction.guild.id, interaction.member.id],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            if(result.rows.length > 0) {
                                code = decryptor(result.rows[0].code.toString());
                                customRole = result.rows[0].customrole;
   
                            }
                            resolve(result);
                        }
                    );
                });
                await premiumStatusPromise;
                const premiumKeyPromise = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT * FROM premiumkey WHERE code=$1`, [encryptor(code)],
                        (err, res) => {
                            if(err) reject(err);
                            if(res.rows.length > 0) {
                                createdAt = res.rows[0].createdat;
                                expiresAt = res.rows[0].expiresat;
                            }
                            resolve(res);
                        }
                    );
                });
                await premiumKeyPromise;

                // fetching the role if it exists
                let roleMenuEmbed = new EmbedBuilder()
                    .setTitle('Role Menu')
                    .setAuthor({
                        name: `${interaction.member.user.username}'s premium dashboard`,
                        iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                    })
                    .setColor(Colors['premium'])
                    .addFields(
                        {
                            name: 'Edit name',
                            value: '- Edit the role\'s name.'
                        },
                        {
                            name: 'Set Color',
                            value: '- Add or change the role\'s color through hexcolor code.'
                        },
                        {
                            name: 'Color menu',
                            value: '- Open a select menu to pick a color from.'
                        },
                        {
                            name: 'Set icon',
                            value: '- Add or change the role\'s icon through URL.'
                        },
                        {
                            name: 'Delete',
                            value: '- Deletes the role.'
                        }

                    )
                
                if(interaction.guild.roles.cache.has(customRole)) {
                    customRole = await  interaction.guild.roles.cache.get(customRole);
                    if(customRole.iconURL()) {
                        roleMenuEmbed.setThumbnail(customRole.iconURL());
                    }
                    roleMenuEmbed.addFields(
                        {
                            name: 'Role:',
                            value: `${customRole}`,
                            inline: true
                        },
                        {
                            name: 'Color:',
                            value: `${customRole.hexColor}`,
                            inline: true
                        },
                    )
                }

                // declaring the embeded messages for each menu
                const embedMainMenu = new EmbedBuilder()
                    .setTitle('Dashboard')
                    .setAuthor({
                        name: `${interaction.member.user.username}'s premium dashboard`,
                        iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                    })
                    .setColor(Colors['premium'])
                    .setDescription('Access your desired menu through the buttons below.')
                    .addFields(
                        {
                            name: 'Status',
                            value: '- Details about your premium status.'
                        },
                        {
                            name: 'Role',
                            value: '- Your custom role menu.'
                        }
                    );
                const embedStatusMenu = new EmbedBuilder()
                    .setTitle('Premium Status')
                    .setAuthor({
                        name: `${interaction.member.user.username}'s premium dashboard`,
                        iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                    })
                    .setColor(Colors['premium'])
                    .setDescription('Information about your premium membership status on this server.')
                    .addFields(
                        {
                            name: 'Code',
                            value: `||${code}||`
                        },
                        {
                            name: 'Premium since',
                            value: `<t:${createdAt}:R>`,
                            inline: true
                        },
                        {
                            name: 'Expires:',
                            value: expiresAt > 0 ? `<t:${expiresAt}:R>` : `Permanent`,
                            inline: true
                        },
                        {
                            name: 'Custom role:',
                            value: `${customRole || 'None'}`
                        }

                    );
                
                const noRoleMenu = new EmbedBuilder()
                    .setTitle('You have no custom role yet!')
                    .setAuthor({
                        name: `${interaction.member.user.username}'s premium dashboard`,
                        iconURL: interaction.member.displayAvatarURL({extension: 'png'})
                    })
                    .setColor(Colors['premium'])
                    .setDescription('If you wish to create a custom role for yourself, press the `create` button below.\nPress the `back` button in order to go back to the main menu.')
                
                // declaring the buttons for each menu
                // usage will be commented
                const statusButton = new ButtonBuilder() // opens the membership status page
                    .setCustomId('status')
                    .setLabel('Status')
                    .setStyle(ButtonStyle.Primary)
                const roleMenuButton = new ButtonBuilder() // opens the custom role menu page
                    .setCustomId('role')
                    .setLabel('Role')
                    .setStyle(ButtonStyle.Primary)
                const backButton = new ButtonBuilder() // go back from any page to main menu
                    .setCustomId('back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Primary)
                const closeButton = new ButtonBuilder() // deletes the message
                    .setCustomId('close')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                const createRoleButton  = new ButtonBuilder() // create a new role by name | appears only on no role menu page
                    .setCustomId('create-role')
                    .setLabel('Create')
                    .setStyle(ButtonStyle.Success)
                // the following buttons are for the role menu page
                const editRoleName = new ButtonBuilder() // edits the role name
                    .setCustomId('edit-role-name')
                    .setLabel('Edit name')
                    .setStyle(ButtonStyle.Primary)
                const setColorButton = new ButtonBuilder() // sets or edits the current color by hexcode text input
                    .setCustomId('set-color')
                    .setLabel('Set color')
                    .setStyle(ButtonStyle.Primary)
                const colorMenuButton = new ButtonBuilder() // sets or edits the current color by opening a select menu and choosing from predefined colors 
                    .setCustomId('color-menu')
                    .setLabel('Color Menu')
                    .setStyle(ButtonStyle.Primary)
                const setIconButton = new ButtonBuilder() // sets or edits the current icon by URL input
                    .setCustomId('set-icon')
                    .setLabel('Set icon')
                    .setStyle(ButtonStyle.Primary)
                const deleteRoleButton = new ButtonBuilder() // deletes the role
                    .setCustomId('delete-role')
                    .setLabel('Delete')
                    .setStyle(ButtonStyle.Danger)
                const refreshRoleMenu = new ButtonBuilder() // updates the role menu interaction
                    .setCustomId('refresh-role-menu')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Primary)
                // declaring the row components for each menu
                const mainMenuRow = new ActionRowBuilder()
                    .addComponents(statusButton, roleMenuButton, closeButton);
                const statusMenuRow = new ActionRowBuilder()
                    .addComponents(backButton, closeButton);
                const noRoleMenuRow = new ActionRowBuilder()
                    .addComponents(createRoleButton, backButton, closeButton);

                const roleMenuRow = new ActionRowBuilder()
                    .addComponents(editRoleName, setColorButton, colorMenuButton, setIconButton, deleteRoleButton);
                const roleMenuRow2 = new ActionRowBuilder() // since an action row can not have more than 5 components, another one is required
                    .addComponents(backButton, refreshRoleMenu, closeButton);
                
                // building the main menu embed message
                const menuMessage = await interaction.reply({embeds: [embedMainMenu], components:[mainMenuRow], ephemeral: true})
                
                // the modals and text inputs to be be used
                const roleNameInput = new TextInputBuilder() // used for creating a role by name and editing a role name
                    .setCustomId('role-name')
                    .setLabel('The desired name of your custom role.')
                    .setMaxLength(32)
                    .setMinLength(1)
                    .setPlaceholder('Enter your role name.')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short);
                const roleHexcolorInput = new TextInputBuilder() // used for setting a color for the role
                    .setCustomId('role-hexcolor')
                    .setLabel('Provide the 6 digits hexcolor for your role.')
                    .setPlaceholder('Example: 9A00FF')
                    .setMaxLength(6)
                    .setMinLength(6)
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short);
                
                const roleNameModal = new ModalBuilder()
                    .setCustomId(`role-name-modal-${interaction.user.id}`)
                    .setTitle('Set the role name.')
                const roleColorModal = new ModalBuilder()
                    .setCustomId(`role-color-modal-${interaction.user.id}`)
                    .setTitle('Set the role color.')
                
                // a filter for which modal to handle
                let filterRoleNameModal = (interaction) => interaction.customId === `role-name-modal-${interaction.user.id}`;
                let filterHexcolorModal = (interaction) => interaction.customId === `role-color-modal-${interaction.user.id}`;
                // action row builders for modals
                const roleNameActionRow = new ActionRowBuilder().addComponents(roleNameInput);
                const roleColorActionRow = new ActionRowBuilder().addComponents(roleHexcolorInput);

                roleNameModal.addComponents(roleNameActionRow); // adding text input to the modal
                roleColorModal.addComponents(roleColorActionRow);

                // the collector of the message's components such as buttons
                let collector = menuMessage.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter,
                    time: 300_000,

                });

                collector.on('collect', async (interaction) => {
                    switch (interaction.customId) {
                        case 'refresh-role-menu':
                            roleMenuEmbed.setFields( // resetting fields and thumbnail in order to be up to date
                                {
                                    name: 'Edit name',
                                    value: '- Edit the role\'s name.'
                                },
                                {
                                    name: 'Set Color',
                                    value: '- Add or change the role\'s color through hexcolor code.'
                                },
                                {
                                    name: 'Color menu',
                                    value: '- Open a select menu to pick a color from.'
                                },
                                {
                                    name: 'Set icon',
                                    value: '- Add or change the role\'s icon through URL.'
                                },
                                {
                                    name: 'Delete',
                                    value: '- Deletes the role.'
                                },
                                {
                                    name: 'Role:',
                                    value: `${customRole}`,
                                    inline: true
                                },
                                {
                                    name: 'Color:',
                                    value: `${customRole.hexColor}`,
                                    inline: true
                                },
        
                            );
                            if(customRole.iconURL())
                                roleMenuEmbed.setThumbnail(customRole.iconURL());
                            else
                                roleMenuEmbed.setThumbnail(null);

                            interaction.update({embeds: [roleMenuEmbed], components: [roleMenuRow, roleMenuRow2], ephemeral: true});

                        break;
                        case 'close':
                            collector.stop();
                            break;
                        case 'status':
                            interaction.update({embeds: [embedStatusMenu], components: [statusMenuRow], ephemeral: true});
                        break;
                        case 'back':
                            interaction.update({embeds: [embedMainMenu], components: [mainMenuRow], ephemeral: true});
                        break;
                        case 'role':
                            if(!customRole) {
                                interaction.update({embeds: [noRoleMenu], components: [noRoleMenuRow], ephemeral: true});
                            } else {
                                interaction.update({embeds: [roleMenuEmbed], components: [roleMenuRow, roleMenuRow2], ephemeral: true});
                            }
                        break;
                        case 'create-role':
                            
                            // display modal
                            interaction.showModal(roleNameModal);
                            // await input
                            interaction.awaitModalSubmit({filterRoleNameModal, time: 120_000})
                                .then(async (modalInteraction) => {
                                    const roleName = modalInteraction.fields.getTextInputValue('role-name');
                                    // using the moderation API to check if the role name violates the rules
                                    if(checkModApi(mod_api)) { // checks connection
                                        const response = await text_classification(mod_api, roleName);
                                        if(response && !response.includes('OK')) {
                                            return modalInteraction.reply({content: 'The role name provided is not appropiated! If you think this is a mistake, contact a staff member.', ephemeral: true});
                                        }
                                    }
                                    customRole = await modalInteraction.guild.roles.create({
                                        name: roleName,
                                        position: premiumRole.position
                                    });

                                    if(logChannel) {
                                        const embedLog = new EmbedBuilder()
                                            .setAuthor({
                                                name: `${modalInteraction.user.username} created a custom role.`,
                                                iconURL: modalInteraction.user.displayAvatarURL({ extension: 'png' })
                                            })
                                            .setColor(Colors["premium"])
                                            .addFields({
                                                name: 'Role:',
                                                value: `${customRole}`
                                            })
                                            .setTimestamp()
                                            .setFooter({text: `ID: ${modalInteraction.user.id}`});
                                        
                                        await logChannel.send({embeds: [embedLog]});
                                    }
                                    await modalInteraction.member.roles.add(customRole); // assigning the new role

                                    await poolConnection.query(`UPDATE premiummembers SET customrole=$1 WHERE member=$2 AND guild=$3`,
                                        [customRole.id, modalInteraction.member.id, modalInteraction.guild.id]
                                    ); // updating the database about the custom role
                                    roleMenuEmbed.setFields(
                                        {
                                            name: 'Edit name',
                                            value: '- Edit the role\'s name.'
                                        },
                                        {
                                            name: 'Set Color',
                                            value: '- Add or change the role\'s color through hexcolor code.'
                                        },
                                        {
                                            name: 'Color menu',
                                            value: '- Open a select menu to pick a color from.'
                                        },
                                        {
                                            name: 'Set icon',
                                            value: '- Add or change the role\'s icon through URL.'
                                        },
                                        {
                                            name: 'Delete',
                                            value: '- Deletes the role.'
                                        },
                                        {
                                            name: 'Role:',
                                            value: `${customRole}`,
                                            inline: true
                                        },
                                        {
                                            name: 'Color:',
                                            value: `${customRole.hexColor}`,
                                            inline: true
                                        },
                
                                    )
                                    await modalInteraction.update({embeds: [roleMenuEmbed], components: [roleMenuRow, roleMenuRow2], ephemeral: true});
                                });
                        break;
                        case 'edit-role-name':
                            // display modal
                            interaction.showModal(roleNameModal);
                            // await input
                            interaction.awaitModalSubmit({filterRoleNameModal, time: 120_000})
                                .then(async (modalInteraction) => {
                                    const roleName = modalInteraction.fields.getTextInputValue('role-name');
                                    // using the moderation API to check if the role name violates the rules
                                    if(checkModApi(mod_api)) { // checks connection
                                        const response = await text_classification(mod_api, roleName);
                                        if(response && !response.includes('OK')) {
                                            return await modalInteraction.reply({content: 'The role name provided is not appropiated! If you think this is a mistake, contact a staff member.', ephemeral: true});
                                        }
                                    }
                                    customRole = await modalInteraction.guild.roles.edit(customRole, {
                                        name: roleName,
                                    });
                                    await modalInteraction.update({embeds: [roleMenuEmbed], components: [roleMenuRow, roleMenuRow2], ephemeral: true});
                                });
                        break;
                        case 'set-color':
                            interaction.showModal(roleColorModal);
                            interaction.awaitModalSubmit({filterHexcolorModal, time: 120_000})
                                .then(async (modalInteraction) => {
                                    const roleHexcolor = "#" + modalInteraction.fields.getTextInputValue('role-hexcolor');
                                    const hexColorRegex = /^#([A-Fa-f0-9]{6})$/;
                                    if(!hexColorRegex.test(roleHexcolor)) {
                                        // meaning the input is invalid
                                        return await modalInteraction.reply({content: 'Invalid input, a hexcolor should look like `#9A00FF`.', ephemeral: true});
                                    }
                                    customRole = await modalInteraction.guild.roles.edit(customRole, {
                                        color: roleHexcolor
                                    });

                                    roleMenuEmbed.setFields(
                                        {
                                            name: 'Edit name',
                                            value: '- Edit the role\'s name.'
                                        },
                                        {
                                            name: 'Set Color',
                                            value: '- Add or change the role\'s color through hexcolor code.'
                                        },
                                        {
                                            name: 'Color menu',
                                            value: '- Open a select menu to pick a color from.'
                                        },
                                        {
                                            name: 'Set icon',
                                            value: '- Add or change the role\'s icon through URL.'
                                        },
                                        {
                                            name: 'Delete',
                                            value: '- Deletes the role.'
                                        },
                                        {
                                            name: 'Role:',
                                            value: `${customRole}`,
                                            inline: true
                                        },
                                        {
                                            name: 'Color:',
                                            value: `${customRole.hexColor}`,
                                            inline: true
                                        },
                
                                    )
                                    await modalInteraction.update({embeds: [roleMenuEmbed], components: [roleMenuRow, roleMenuRow2], ephemeral: true});
                                });
                        break;
                        case 'color-menu':
                            let colorsArray = []; // building the options for the select menu
                            for(let color of Object.keys(Colors)) {
                                colorsArray.push(
                                    {
                                        label: color,
                                        description: color + " color",
                                        value: `#${Colors[color].toString(16).padStart(6, '0')}` // converting hexadecimal to string hexadecimal and formatting it for discord roles
                                    }
                                )
                            }
                            // creating a select menu with string inputs, creating an action row with select menu as component
                            const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId(`custom-color-menu`)
                                .setPlaceholder('Pick a color!')
                                .setMinValues(1)
                                .setMaxValues(1)
                                .addOptions( colorsArray )
                            const selectMenuRow = new ActionRowBuilder().addComponents(selectMenu);
                            const selectMenuEmbed = new EmbedBuilder()
                                .setTitle('Select the desired color')
                                .setColor(Colors["green"])

                            // storing the replies in order to update, collect events and delete them as needed
                            const selectMessage = await interaction.reply({embeds: [selectMenuEmbed], components: [selectMenuRow], ephemeral: true})
                            const selectReply = await interaction.fetchReply();
                            const selectCollector = await selectReply.createMessageComponentCollector({
                                ComponentType: ComponentType.StringSelect,
                                filter,
                                time: 120_000,
                            });

                            selectCollector.on('collect', async (interaction) => {
                                customRole = await customRole.edit({
                                    color: interaction.values[0]
                                });
                                roleMenuEmbed.setFields(
                                    {
                                        name: 'Edit name',
                                        value: '- Edit the role\'s name.'
                                    },
                                    {
                                        name: 'Set Color',
                                        value: '- Add or change the role\'s color through hexcolor code.'
                                    },
                                    {
                                        name: 'Color menu',
                                        value: '- Open a select menu to pick a color from.'
                                    },
                                    {
                                        name: 'Set icon',
                                        value: '- Add or change the role\'s icon through URL.'
                                    },
                                    {
                                        name: 'Delete',
                                        value: '- Deletes the role.'
                                    },
                                    {
                                        name: 'Role:',
                                        value: `${customRole}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Color:',
                                        value: `${customRole.hexColor}`,
                                        inline: true
                                    },
            
                                );
                                await interaction.reply({content:`Hexcolor updated to ${interaction.values[0]}`, ephemeral:true });
                                
                            });

                            selectCollector.on('end', () => {
                                selectMessage.delete();
                            })
                            
                        break;
                        case 'set-icon':
                            await interaction.reply({content: 'Send the image you want to set as the role\s icon.\nFile size must be less than `256KB`!', ephemeral: true})
                            const filterMessage = (message) => message.author.id === interaction.user.id // accept only the interaction user's inputs
                            const messageCollector = interaction.channel.createMessageCollector({
                                filterMessage,
                                max: 1,
                                time: 60_000
                            });
                            messageCollector.on('collect', async (message) => {
                                // handling, validating and setting the message attached image as role icon
                                if(message.attachments.size === 0) {
                                    return await interaction.followUp({content: 'No image was provided, try again!', ephemeral: true});
                                }
                                const imageAttachment = await message.attachments.first();
                                
                                if(!imageAttachment.contentType.includes('image')) {
                                    return await interaction.followUp({content:'Invalid file format!', ephemeral: true})
                                }

                                if(imageAttachment.size > 262100) {
                                    return await interaction.followUp({content: 'The image is too large! Must be below 256KB!', ephemeral: true});
                                }

                                customRole = await customRole.edit({
                                    icon: imageAttachment.url
                                });
                                roleMenuEmbed.setThumbnail(customRole.iconURL());
                                await message.delete(); // deleting the input message
                                await interaction.followUp({content: 'Role icon set successfully!', ephemeral: true});
                            });

                            messageCollector.on('end', (collected) => {
                                if(collected.size === 0) {
                                    interaction.followUp({content: 'No image was provided, try again!', ephemeral: true});
                                }
                                
                            });
                        break;
                        case 'delete-role':
                            await poolConnection.query(`UPDATE premiummembers SET customrole=NULL WHERE member=$1 AND guild=$2`,
                                [interaction.user.id, interaction.guild.id]
                            ); // updating the db
                            if(logChannel){
                                const deleteRoleLog = new EmbedBuilder()
                                    .setAuthor({
                                        name: `${interaction.user.username} deleted the custom role.`,
                                        iconURL: interaction.user.displayAvatarURL({ extension: 'png' })
                                    })
                                    .setColor(Colors["red"])
                                    .addFields({
                                        name: 'Role:',
                                        value: `${customRole.name}`
                                    })
                                    .setTimestamp()
                                    .setFooter({text: `ID: ${interaction.user.id}`});
                                await logChannel.send({embeds: [deleteRoleLog]});
                            }
                            
                            await customRole.delete();
                            
                            roleMenuEmbed.setThumbnail(null);
                            
                            interaction.update({embeds: [noRoleMenu], components: [noRoleMenuRow], ephemeral: true});
                        break;
                        
                    }

                });

                collector.on('end', () => {
                    menuMessage.delete();
                });
            break;
        }

    }

}