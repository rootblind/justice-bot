/*
    Create and send an announcement message
*/ 
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} = require("discord.js");
const fs = require('graceful-fs');
const path = require('path');
const { poolConnection } = require("../../utility_modules/kayle-db.js");
const { Channel } = require("diagnostics_channel");

const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Build custom announcement embeds and save templates.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('simple-message')
                .setDescription('Quickly send a simple message.')
                .addStringOption(option =>
                    option.setName('send-as')
                        .setDescription('Post the announcement message under your name or under the server\'s name.')
                        .addChoices(
                            {
                                name: 'Yourself',
                                value: 'admin'
                            },
                            {
                                name: 'Server',
                                value: 'server'
                            },
                            {
                                name: 'Bot',
                                value: 'bot'
                            }
                        )
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('The channel to send the announcement message to.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message of the announcement.')
                        .setRequired(true)
                        .setMaxLength(4000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('builder')
                .setDescription('Build an announcement embeded message through interactive buttons.')
        )
    ,
    async execute(interaction, client) {
        const cmd = interaction.options.getSubcommand();
        let channel = interaction.options.getChannel('channel') || null;
        let profile = interaction.options.getString('send-as') || "admin";
        let message = interaction.options.getString('message') || null;
        let contentMessage = "";
        let mentionRolesString = "";
        let mentionEveryone = false;

        let author = {
            name: null,
            link: null,
            icon: null
        }

        let content = {
            title: null,
            description: null,
            footer: null
        }

        let images = {
            thumbnail: null,
            image: null
        }

        let field = {
            name: null,
            value: null,
            inline: false
        }

        // fetching the server activity logs if it exists
        const {rows: serverLogsData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE eventtype='server-activity' AND guild=$1`,
            [interaction.guild.id]
        );

        let logChannel = null;
        if(serverLogsData.length > 0) {
            logChannel = await interaction.guild.channels.fetch(serverLogsData[0].channel);
        }

        const initMessage = await interaction.deferReply({flags: MessageFlags.Ephemeral});

        switch(cmd) {
            case 'builder':
                let announcementBuilderEmbed = new EmbedBuilder().setTitle('Empty announcement'); // the initial embed when the command is being ran
                
                // declaring buttons
                const setColorButton = new ButtonBuilder()
                    .setCustomId('set-color-button')
                    .setStyle(ButtonStyle.Primary)
                    .setLabel('Color')
                const setAuthorButton = new ButtonBuilder()
                    .setCustomId('set-author-button')
                    .setStyle(ButtonStyle.Primary)
                    .setLabel('Author')
                const setContentButton = new ButtonBuilder()
                    .setCustomId('set-content-button')
                    .setStyle(ButtonStyle.Primary)
                    .setLabel('Content')
                const setImagesButton = new ButtonBuilder()
                    .setCustomId('set-images-button')
                    .setStyle(ButtonStyle.Primary)
                    .setLabel('Images')
                const addFieldButton = new ButtonBuilder()
                    .setCustomId('add-field-button')
                    .setStyle(ButtonStyle.Primary)
                    .setLabel('Add Field')
                const resetFieldsButton = new ButtonBuilder()
                    .setCustomId('reset-fields-button')
                    .setStyle(ButtonStyle.Danger)
                    .setLabel('Reset Fields')
                const resetEmbedButton = new ButtonBuilder()
                    .setCustomId('reset-embed-button')
                    .setLabel('Reset Embed')
                    .setStyle(ButtonStyle.Danger)
                const closeButton = new ButtonBuilder()
                    .setCustomId('close-button')
                    .setStyle(ButtonStyle.Danger)
                    .setLabel('Close')
                const exportJSON = new ButtonBuilder()
                    .setCustomId('export-json-button')
                    .setLabel('Export JSON')
                    .setStyle(ButtonStyle.Secondary)
                const importJSON = new ButtonBuilder()
                    .setCustomId('import-json-button')
                    .setLabel('Import JSON')
                    .setStyle(ButtonStyle.Secondary)
                const setProfileButton = new ButtonBuilder()
                    .setCustomId('set-profile-button')
                    .setLabel('Profile')
                    .setStyle(ButtonStyle.Success)
                const setRoleMentionButton = new ButtonBuilder()
                    .setCustomId('set-role-mention-button')
                    .setLabel('Role mention')
                    .setStyle(ButtonStyle.Success)
                const mentionEveryoneButton = new ButtonBuilder()
                    .setCustomId('mention-everyone-button')
                    .setLabel("@everyone")
                    .setStyle(ButtonStyle.Danger)
                const sendButton = new ButtonBuilder()
                    .setCustomId('send-button')
                    .setStyle(ButtonStyle.Success)
                    .setLabel('Send')
                // action rows for buttons
                const setEmbedFeaturesActionRow = new ActionRowBuilder()
                    .addComponents(setColorButton, setAuthorButton, setContentButton, setImagesButton, addFieldButton)
                const removeEmbedFeaturesActionRow = new ActionRowBuilder()
                    .addComponents(resetFieldsButton, resetEmbedButton, closeButton)
                const import_exportActionRow = new ActionRowBuilder()
                    .addComponents(importJSON, exportJSON)
                const announcementSetupActionRow = new ActionRowBuilder()
                    .addComponents(setProfileButton, setRoleMentionButton, mentionEveryoneButton)
                const sendAnnouncementButtonActionRow = new ActionRowBuilder()
                    .addComponents(sendButton)
                
                // text inputs

                const textHexColor = new TextInputBuilder()
                    .setCustomId("hexcolor")
                    .setLabel("Hexcolor")
                    .setPlaceholder("Example: 9A00FF")
                    .setMaxLength(6)
                    .setMinLength(6)
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short);

                const textAuthorName = new TextInputBuilder()
                    .setCustomId("author-name")
                    .setLabel("Author name")
                    .setMaxLength(256)
                    .setMinLength(1)
                    .setPlaceholder("Enter the author name")
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short);
                const textAuthorIcon = new TextInputBuilder()
                    .setCustomId("author-icon")
                    .setLabel("Image link.")
                    .setPlaceholder("Enter the link.")
                    .setMaxLength(256)
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short);
                const textAuthorLink = new TextInputBuilder()
                    .setCustomId("author-link")
                    .setMaxLength(256)
                    .setLabel("Author hyperlink")
                    .setPlaceholder("Enter the link.")
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short);
                

                const textContentDescription = new TextInputBuilder()
                    .setRequired(true)
                    .setCustomId('content-description')
                    .setMaxLength(4000)
                    .setLabel("Announcement message")
                    .setStyle(TextInputStyle.Paragraph)
                const textContentTitle = new TextInputBuilder()
                    .setCustomId("content-title")
                    .setMaxLength(256)
                    .setLabel("Embed Title")
                    .setPlaceholder("Enter the title.")
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short)
                const textContentFooter = new TextInputBuilder()
                    .setCustomId('content-footer')
                    .setMaxLength(2000)
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Footer...")
                    .setLabel("Footer")

                const textImageLink = new TextInputBuilder()
                    .setCustomId('image-link')
                    .setMaxLength(256)
                    .setRequired(false)
                    .setPlaceholder("Image link")
                    .setLabel("Set the image")
                    .setStyle(TextInputStyle.Short)
                const textThumbnailLink = new TextInputBuilder()
                    .setCustomId('thumbnail-link')
                    .setMaxLength(256)
                    .setRequired(false)
                    .setPlaceholder("Thumbnail link")
                    .setLabel("Set the thumbnail")
                    .setStyle(TextInputStyle.Short)

                const textFieldName = new TextInputBuilder()
                    .setCustomId('add-field-name')
                    .setMaxLength(256)
                    .setRequired(true)
                    .setLabel("Field name")
                    .setStyle(TextInputStyle.Short)
                const textFieldValue = new TextInputBuilder()
                    .setCustomId('add-field-value')
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setLabel("Field value")
                    .setStyle(TextInputStyle.Paragraph)
                const textFieldInline = new TextInputBuilder()
                    .setCustomId('add-field-inline')
                    .setRequired(false)
                    .setMaxLength(5)
                    .setMinLength(4)
                    .setLabel('Inline boolean')
                    .setPlaceholder("True/False")
                    .setStyle(TextInputStyle.Short)

                const textImportJSON = new TextInputBuilder()
                    .setCustomId('import-json-embed')
                    .setRequired(true)
                    .setLabel("JSON string")
                    .setStyle(TextInputStyle.Paragraph)

                // action rows for text inputs
                const hexColorActionRow = new ActionRowBuilder()
                    .addComponents(textHexColor)

                const authorNameActionRow = new ActionRowBuilder()
                    .addComponents(textAuthorName)
                const authorLinkActionRow = new ActionRowBuilder()
                    .addComponents(textAuthorLink)
                const authorIconActionRow = new ActionRowBuilder()
                    .addComponents(textAuthorIcon)

                const contentDescriptionActionRow = new ActionRowBuilder()
                    .addComponents(textContentDescription)
                const contentTitleActionRow = new ActionRowBuilder()
                    .addComponents(textContentTitle)
                const contentFooterActionRow = new ActionRowBuilder()
                    .addComponents(textContentFooter)

                const imageActionRow = new ActionRowBuilder()
                    .addComponents(textImageLink)
                const thumbnaulActionRow = new ActionRowBuilder()
                    .addComponents(textThumbnailLink)

                const fieldNameActionRow = new ActionRowBuilder()
                    .addComponents(textFieldName)
                const fieldValueActionRow = new ActionRowBuilder()
                    .addComponents(textFieldValue)
                const fieldInlineActionRow = new ActionRowBuilder()
                    .addComponents(textFieldInline)

                const importJSONActionRow = new ActionRowBuilder()
                    .addComponents(textImportJSON)

                // modals
                const setColorModal = new ModalBuilder()
                    .setTitle('Set color')
                    .setCustomId('set-color-modal')
                    .addComponents(hexColorActionRow)

                const setAuthorModal = new ModalBuilder()
                    .setCustomId('set-author-modal')
                    .setTitle('Embed author config')
                    .addComponents(authorNameActionRow, authorLinkActionRow, authorIconActionRow)
                
                const setContentModal = new ModalBuilder()
                    .setCustomId('set-content-modal')
                    .setTitle('Announcement content')
                    .addComponents(contentDescriptionActionRow, contentTitleActionRow, contentFooterActionRow)

                const setImagesModal = new ModalBuilder()
                    .setCustomId('set-images-modal')
                    .setTitle("Set embed images")
                    .addComponents(imageActionRow, thumbnaulActionRow)

                const addFieldModal = new ModalBuilder()
                    .setCustomId('add-field-modal')
                    .setTitle("New Field")
                    .addComponents(fieldNameActionRow, fieldValueActionRow, fieldInlineActionRow)
                
                const importJSONModal = new ModalBuilder()
                    .setCustomId('import-json-modal')
                    .setTitle("Import from JSON")
                    .addComponents(importJSONActionRow)
                
                await initMessage.edit({embeds: [announcementBuilderEmbed], 
                    components: [setEmbedFeaturesActionRow, removeEmbedFeaturesActionRow, import_exportActionRow, announcementSetupActionRow, sendAnnouncementButtonActionRow]});
                
                const filter = (i) => interaction.user.id === i.user.id; 

                const initMessageCollector = initMessage.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter,
                });

                initMessageCollector.on('collect', async (collectorInteraction) => {
                    switch(collectorInteraction.customId) {
                        case 'set-color-button':
                            await collectorInteraction.showModal(setColorModal);

                            try{
                                const submitColorModal = await collectorInteraction.awaitModalSubmit({
                                    filter: (interaction) => interaction.customId === 'set-color-modal',
                                    time: 600_000
                                });
                                await submitColorModal.deferReply({flags: MessageFlags.Ephemeral})
                                const hexColor = "#" + submitColorModal.fields.getTextInputValue('hexcolor');
                                const hexColorRegex = /^#([A-Fa-f0-9]{6})$/;
                                if (!hexColorRegex.test(hexColor)) {
                                    // meaning the input is invalid
                                    return await submitColorModal.editReply({
                                        content:
                                            "Invalid input, a hexcolor should look like `#9A00FF`.",
                                        flags: MessageFlags.Ephemeral,
                                    });
                                }
                                announcementBuilderEmbed.setColor(hexColor);
                                await initMessage.edit({embeds: [announcementBuilderEmbed]})
                                await submitColorModal.editReply({content: "Color upated."});
                            } catch(err) {
                                await collectorInteraction.followUp({flags: MessageFlags.Ephemeral, content: "No submission provided before the time ran out!"});
                            }

                        break;
                        case 'set-author-button':
                            await collectorInteraction.showModal(setAuthorModal);

                            try{
                                const submitAuthorModal = await collectorInteraction.awaitModalSubmit({
                                    filter: (interaction) => interaction.customId === 'set-author-modal',
                                    time: 600_000
                                });
                                await submitAuthorModal.deferReply({flags: MessageFlags.Ephemeral});

                                author["name"] = submitAuthorModal.fields.getTextInputValue("author-name");
                                author["link"] = submitAuthorModal.fields.getTextInputValue("author-link") || null;
                                author["icon"] = submitAuthorModal.fields.getTextInputValue("author-icon") || null;
                                
                                if((author["link"] && !urlPattern.test(author["link"])) ||
                                (author["icon"] && !urlPattern.test(author["icon"])) 
                            ) {
                                // if there was a link or an icon provided, check if it matches the url pattern
                                return await submitAuthorModal.editReply({embeds: [
                                    new EmbedBuilder()
                                        .setColor("Red")
                                        .setTitle('Invalid URL input')
                                        .setDescription('The image link and author hyperlink must be URLs')
                                ]});
                            }

                            // updating the embed after validation
                            const authorOptions = { name: author["name"]};
                            // creating the author options
                            if(author["icon"]) authorOptions["iconURL"] = author["icon"];
                            if(author["link"]) authorOptions["url"] = author["link"];

                            try{
                                announcementBuilderEmbed.setAuthor(authorOptions);
                            } catch(e) {
                                return await submitAuthorModal.editReply("One or both image links provided must be faulty!")
                            }
                            await initMessage.edit({embeds: [announcementBuilderEmbed]});
                            await submitAuthorModal.editReply("Author updated.");
                                
                            } catch(err) {
                                await collectorInteraction.followUp({flags: MessageFlags.Ephemeral, content: "No submission provided before the time ran out!"});
                            }
                        break;
                        case "set-content-button":
                            await collectorInteraction.showModal(setContentModal);

                            try {
                                const submitContentModal = await collectorInteraction.awaitModalSubmit({
                                    filter: (interaction) => interaction.customId === 'set-content-modal',
                                    time: 600_000
                                });

                                await submitContentModal.deferReply({flags: MessageFlags.Ephemeral});
                                content["description"] = submitContentModal.fields.getTextInputValue("content-description");
                                content["title"] = submitContentModal.fields.getTextInputValue("content-title") || null;
                                content["footer"] = submitContentModal.fields.getTextInputValue("content-footer") || null;

                                announcementBuilderEmbed.setDescription(content["description"]);
                                if(content["title"]) announcementBuilderEmbed.setTitle(content["title"]);
                                if(content["footer"]) announcementBuilderEmbed.setFooter({text:content["footer"]});

                                await initMessage.edit({embeds: [announcementBuilderEmbed]});
                                await submitContentModal.editReply("Content updated.");

                            } catch(err) {
                                await collectorInteraction.followUp({flags: MessageFlags.Ephemeral, content: "No submission provided before the time ran out!"});
                            }
                        break;
                        case "set-images-button":
                            await collectorInteraction.showModal(setImagesModal)

                            try{
                                const submitImagesModal = await collectorInteraction.awaitModalSubmit({
                                    filter: (interaction) => interaction.customId === 'set-images-modal',
                                    time: 600_000
                                });

                                await submitImagesModal.deferReply({flags: MessageFlags.Ephemeral});

                                images["thumbnail"] = submitImagesModal.fields.getTextInputValue('thumbnail-link') || null;
                                images["image"] = submitImagesModal.fields.getTextInputValue('image-link') || null;

                                if(!images["thumbnail"] && !images["image"])
                                {
                                    // if no link was provided, respond
                                    return await submitImagesModal.editReply("No images were provided, the embed remains unchanged.");
                                }

                                if((images["thumbnail"] && !urlPattern.test(images["thumbnail"])) ||
                                    (images["image"] && !urlPattern.test(images["image"]))) {
                                    return await submitImagesModal.editReply("Invalid input. An image link must be provided.");
                                }

                                // setting up the images provided
                                if(images["thumbnail"]) announcementBuilderEmbed.setThumbnail(images["thumbnail"]);
                                if(images["image"]) announcementBuilderEmbed.setImage(images["image"]);

                                await initMessage.edit({embeds: [announcementBuilderEmbed]});
                                await submitImagesModal.editReply("Embed images updated.");

                            } catch(err) {
                                await collectorInteraction.followUp({flags: MessageFlags.Ephemeral, content: "No submission provided before the time ran out!"});
                            }
                        break;
                        case "add-field-button":
                            // fields are limited to 25 per embed
                            if(announcementBuilderEmbed.data.fields)
                                if(announcementBuilderEmbed.data.fields.length + 1 > 25)
                                    return await collectorInteraction.reply({flags: MessageFlags.Ephemeral, content: "Fields are limited to a total of 25."});

                            await collectorInteraction.showModal(addFieldModal);

                            try{
                                const submitFieldModal = await collectorInteraction.awaitModalSubmit({
                                    filter: (interaction) => interaction.customId === 'add-field-modal',
                                    time: 600_000
                                });

                                await submitFieldModal.deferReply({flags: MessageFlags.Ephemeral});

                                field["name"] = submitFieldModal.fields.getTextInputValue('add-field-name');
                                field["value"] = submitFieldModal.fields.getTextInputValue('add-field-value');

                                if(submitFieldModal.fields.getTextInputValue('add-field-inline').toLowerCase() === 'true')
                                    field["inline"] = true;

                                announcementBuilderEmbed.addFields(field);

                                await initMessage.edit({embeds: [announcementBuilderEmbed]});
                                await submitFieldModal.editReply("Field added.");

                            } catch(err) {
                                await collectorInteraction.followUp({flags: MessageFlags.Ephemeral, content: "No submission provided before the time ran out!"});
                            }

                            
                        break;
                        case "reset-fields-button":
                            announcementBuilderEmbed.setFields()
                            await collectorInteraction.reply({flags: MessageFlags.Ephemeral, content: "Fields were reset."});
                            await initMessage.edit({embeds: [announcementBuilderEmbed]});
                        break;
                        case "reset-embed-button":
                            announcementBuilderEmbed = new EmbedBuilder().setTitle('Empty announcement');
                            await initMessage.edit({embeds: [announcementBuilderEmbed]});
                            await collectorInteraction.reply({flags: MessageFlags.Ephemeral, content: "The embed was reset."});
                        break;
                        case "close-button":
                            await initMessageCollector.stop();
                        break;

                        case "import-json-button":
                            collectorInteraction.showModal(importJSONModal);
                            let submitImportJSONModal;
                            try{
                                submitImportJSONModal = await collectorInteraction.awaitModalSubmit({
                                    filter: (interaction) => interaction.customId === 'import-json-modal',
                                    time: 600_000
                                });
                            } catch(err) {
                                await collectorInteraction.followUp({flags: MessageFlags.Ephemeral, content: "No submission provided before the time ran out!"});
                            }
                            await submitImportJSONModal.deferReply({flags: MessageFlags.Ephemeral});

                            const jsonString = submitImportJSONModal.fields.getTextInputValue("import-json-embed");
                            try {
                                const jsonObject = JSON.parse(jsonString); // if the input is not a json object, will throw an error
                                try{
                                    announcementBuilderEmbed = new EmbedBuilder(jsonObject); // if the json object is not formatted as embed, will throw an error
                                    await submitImportJSONModal.editReply("JSON Embed imported!");
                                    await initMessage.edit({embeds: [announcementBuilderEmbed]});
                                } catch(e) {
                                    return await submitImportJSONModal.editReply("Invalid Embed Object!");
                                }
                            } catch(err) {
                                return await submitImportJSONModal.editReply({content: "The string provided is not formatted as a JSON object!"})
                            }

                        break;
                        case "export-json-button":
                            // exporting the current embed to a json file
                            const filePath = path.join(__dirname, `../../temp/export_embed-${interaction.user.id}.json`);
                            await fs.promises.writeFile(filePath,
                                JSON.stringify(announcementBuilderEmbed.toJSON()), "utf-8");

                            await collectorInteraction.reply({content: "The exported embed:", files: [filePath]});
                            fs.unlink(filePath,
                                (err) => {
                                    if(err) throw err;
                                }
                            );

                        break;
                        case "set-profile-button":
                            const selectProfileOptions = [
                                {
                                    label: "Yourself",
                                    description: "Send the announcement under your name.",
                                    value: "admin"
                                },
                                {
                                    label: "Server",
                                    description: "Send the announcement under the server\'s name.",
                                    value: "server"
                                },
                                {
                                    label: "Bot",
                                    description: "Sent the announcement under the bot\'s name.",
                                    value: "bot"
                                }
                            ]

                            const selectProfileMenu = new StringSelectMenuBuilder()
                                .setCustomId("select-profile")
                                .setMinValues(1)
                                .setMaxValues(1)
                                .setPlaceholder("Select the profile...")
                                .addOptions( selectProfileOptions )

                            const selectProfileActionRow = new ActionRowBuilder()
                                .addComponents(selectProfileMenu)

                            const profileMenuMessage = await collectorInteraction.reply({flags: MessageFlags.Ephemeral, components: [selectProfileActionRow]});
                            const profileMenuReply = await collectorInteraction.fetchReply();

                            const collectorProfile = profileMenuReply.createMessageComponentCollector({
                                ComponentType: ComponentType.StringSelect,
                                time: 600_000
                            });

                            collectorProfile.on('collect', async (menuInteraction) => {
                                profile = menuInteraction.values[0];
                                await menuInteraction.reply({flags: MessageFlags.Ephemeral, content: `Profile set to ${profile}.`});
                            });

                            collectorProfile.on('end', async () => {
                                try{
                                    await profileMenuMessage.delete();
                                } catch(e) {};
                            });

                        break;
                        case "set-role-mention-button":
                            let maxRolesValue = collectorInteraction.guild.roles.cache.size <= 25 ?
                                collectorInteraction.guild.roles.cache.size : 25;
                            const roleMenu = new RoleSelectMenuBuilder()
                                .setCustomId("select-role-menu")
                                .setMinValues(1)
                                .setMaxValues(maxRolesValue)
                                .setPlaceholder("Select the roles to be mentioned.")

                            const roleMenuActionRow = new ActionRowBuilder()
                                .addComponents(roleMenu)

                            const roleMenuMessage = await collectorInteraction.reply({flags: MessageFlags.Ephemeral, components: [roleMenuActionRow]});
                            const roleMenuReply = await collectorInteraction.fetchReply();

                            const collectorRole = roleMenuReply.createMessageComponentCollector({
                                ComponentType: ComponentType.RoleSelect,
                                time: 600_000
                            })

                            collectorRole.on("collect", async (roleMenuInteraction) => {
                                mentionRolesString = "";
                                roleMenuInteraction.values.forEach((id) => {
                                    mentionRolesString += `<@&${id}> `
                                });

                                await roleMenuInteraction.reply({flags: MessageFlags.Ephemeral, content: "Roles selected: " + mentionRolesString});
                            });

                            collectorRole.on("end", async () => {
                                try{
                                    await roleMenuMessage.delete();
                                } catch(e) {};
                            })
                        break;
                        case "mention-everyone-button":
                            mentionEveryone = !mentionEveryone;
                            await collectorInteraction.reply({flags: MessageFlags.Ephemeral, content: `Mention everyone set to **${mentionEveryone}**.`});
                        break;
                        case "send-button":
                            if(mentionEveryone) contentMessage += `${collectorInteraction.guild.roles.everyone} `;
                            if(mentionRolesString) contentMessage += mentionRolesString;

                            let webhookOptions = {};
                            if(profile == "server") {
                                webhookOptions["name"] = collectorInteraction.guild.name;
                                webhookOptions["avatar"] = collectorInteraction.guild.iconURL({extension: 'png'});
                            } else if(profile == "admin") {
                                webhookOptions["name"] = collectorInteraction.member.displayName;
                                webhookOptions["avatar"] = collectorInteraction.member.displayAvatarURL({extension: 'png'});
                            } else {
                                webhookOptions["name"] = collectorInteraction.client.user.username;
                                webhookOptions["avatar"] = collectorInteraction.client.user.displayAvatarURL({extension: "png"});
                            }
                            
                            const maxValues = collectorInteraction.guild.channels.cache.size <= 25 ?
                                collectorInteraction.guild.channels.cache.size : 25;

                            const channelMenu = new ChannelSelectMenuBuilder()
                                .setMinValues(1)
                                .setMaxValues(maxValues)
                                .setCustomId("channel-select-menu")
                                .setPlaceholder("Select the channels to send the announcement to.")
                                .setChannelTypes(ChannelType.GuildText)
                                

                            const channelMenuActionRow = new ActionRowBuilder()
                                .addComponents(channelMenu);

                            const channelMenuMessage = await collectorInteraction.reply({flags: MessageFlags.Ephemeral, components: [channelMenuActionRow]});
                            const channelMenuReply = await collectorInteraction.fetchReply();

                            const channelCollector = channelMenuReply.createMessageComponentCollector({
                                ComponentType: ComponentType.ChannelSelect,
                                time: 60_000
                            });

                            channelCollector.on("collect", async (interaction) => {
                                let channels = [];
                                await interaction.values.forEach(async (id) => {
                                    channels.push(
                                        await interaction.guild.channels.fetch(id)
                                    );
                                });
                                channels.forEach(async (channel) => {
                                    const webhook = await channel.createWebhook(webhookOptions);
                                    const sendMessage = await webhook.send({content: contentMessage, embeds: [announcementBuilderEmbed]});
                                    await webhook.delete();
                                    
                                    if(logChannel) {
                                        await logChannel.send({embeds: [
                                            new EmbedBuilder()
                                                .setColor("Blue")
                                                .setAuthor({
                                                    name: `${interaction.user.username} posted an announcement`,
                                                    iconURL: interaction.user.displayAvatarURL({extension: 'png'})
                                                })
                                                .addFields(
                                                    {
                                                        name: 'Sent as',
                                                        value: webhookOptions['name']
                                                    },
                                                    {
                                                        name: 'Message',
                                                        value: `[reference](${sendMessage.url})`,
                                                        inline: true
                                                    },
                                                    {
                                                        name: 'Channel',
                                                        value: `${channel}`,
                                                        inline: true
                                                    }
                                                    
                                                )
                                                .setFooter({text: `ID: ${interaction.user.id}`})
                                                .setTimestamp()
                                        ]});
                                    }
                                });
                                await interaction.reply({flags: MessageFlags.Ephemeral, content: "Announcement sent successfully."});
                                channelCollector.stop();
                            });

                            channelCollector.on("end", async () => {
                                try{
                                    await channelMenuMessage.delete();
                                } catch(e) {};
                            })
                        break;
                    }
                });

                initMessageCollector.on('end', async () => {
                    try{
                        await initMessage.delete();
                    } catch(err){};
                });
            break;
            case 'simple-message':
                let profileOptions = {};
                if(profile === 'admin')
                {
                    profileOptions['name'] = interaction.member.displayName;
                    profileOptions['avatar'] = interaction.member.displayAvatarURL({extension: 'png'});
                } else if(profile === 'server') {
                    profileOptions['name'] = interaction.guild.name;
                    profileOptions['avatar'] = interaction.guild.iconURL({extension: 'png'});
                } else {
                    profileOptions['name'] = interaction.client.user.username;
                    profileOptions['avatar'] = interaction.client.user.displayAvatarURL({extension: 'png'});
                }
                
                const webhook = await channel.createWebhook(profileOptions);
                const simpleMessage = await webhook.send({content: message});
                await webhook.delete();

                // logging
                if(logChannel) {
                    await logChannel.send({embeds: [
                        new EmbedBuilder()
                            .setColor("Blue")
                            .setAuthor({
                                name: `${interaction.user.username} posted an announcement`,
                                iconURL: interaction.user.displayAvatarURL({extension: 'png'})
                            })
                            .addFields(
                                {
                                    name: 'Sent as',
                                    value: profileOptions['name']
                                },
                                {
                                    name: 'Message',
                                    value: `[reference](${simpleMessage.url})`,
                                    inline: true
                                },
                                {
                                    name: 'Channel',
                                    value: `${channel}`,
                                    inline: true
                                }
                                
                            )
                            .setFooter({text: `ID: ${interaction.user.id}`})
                            .setTimestamp()
                    ]});
                }

                await interaction.editReply({embeds: [
                    new EmbedBuilder()
                        .setColor("Blue")
                        .setTitle("Announcement sent successfully")
                        .addFields(
                            {
                                name: 'Profile',
                                value: profileOptions['name']
                            },
                            {
                                name: "Channel",
                                value: `${channel}`
                            }
                        )
                    ], flags: MessageFlags.Ephemeral});

            break;
        }
        
    }
}