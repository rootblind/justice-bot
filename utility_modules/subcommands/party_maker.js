const {EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputStyle, TextInputBuilder,
    ComponentType, ChannelType, UserSelectMenuBuilder,
    PermissionFlagsBits,
    Collection,
    User,
    MessageFlags,
} = require("discord.js");

const {poolConnection} = require("../kayle-db.js");
const {rankOptions, id2rank} = require("../../objects/select_role_options.js");
const {lfg_buttons, lfg_collector} = require("./lfg_handler.js");
const { hasCooldown } = require("../utility_methods.js");
const { classifier } = require("../../utility_modules/filter.js")

const colorSelectOptions = [
    {
        label: "Custom Color",
        value: "0",
        description: "Open a modal to type your hexcode"
    },
    {
        label: "Red",
        value: "0xf62e36",
        description: "Red color"
    },
    {
        label: "Orange",
        value: "0xff7f50",
        description: "Orange color"
    },
    {
        label: "Yellow",
        value: "0xebd406",
        description: "Yellow color"
    },
    {
        label: "Green",
        value: "0x019a66",
        description: "Green color"
    },
    {
        label: "Blue",
        value: "0x0079c2",
        description: "Blue color"
    },
    {
        label: "Pink",
        value: "0xff80ed",
        description: "Pink color"
    },
    {
        label: "Violet",
        value: "0x9a00ff",
        description: "Violet color"
    },
    {
        label: "Black",
        value: "0x000001",
        description: "Black color"
    },
    {
        label: "White",
        value: "0xffffff",
        description: "White color"
    },
    {
        label: "Nitro",
        value: "0xd214c7",
        description: "Nitro color"
    }
]

const roleSelectOptions = [
    {
        label: "TOP",
        value: "top",
        description: "Top lane"
    },
    {
        label: "JUNGLE",
        value: "jg",
        description: "Jungle role"
    },
    {
        label: "MID",
        value: "mid",
        description: "Middle lane"
    },
    {
        label: "BOT",
        value: "bot",
        description: "Bottom lane"
    },
    {
        label: "SUPP",
        value: "supp",
        description: "Support role"
    }
]
const gamemodeSelectOptions = [
    {
        label: "Ranked Solo/Duo",
        value: "0",
        description: "Create a party for Ranked Solo/Duo"
    },
    {
        label: "Ranked Flex",
        value: "1",
        description: "Create a party for Ranked Flex"
    },
    {
        label: "Clash/Tournament",
        value: "2",
        description: "Create a party for clash/tournament"
    },
    {
        label: "Swiftplay",
        value: "3",
        description: "Create a party for Swiftplay"
    },
    {
        label: "Normal Draft",
        value: "4",
        description: "Create a party for Normal Draft"
    },
    {
        label: "ARAM",
        value: "5",
        description: "Create a party for ARAM"
    },
    {
        label: "TFT",
        value: "6",
        description: "Create a party for TFT"
    },
    {
        label: "Rotation Gamemode",
        value: "7",
        description: "Create a party for rotation gamemode such as URF, OFA, etc..."
    },
    {
        label: "Custom",
        value: "8",
        description: "Create a custom party"
    }
]

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

const partySizeDict = {
    0: 2,
    1: 5,
    2: 5,
    3: 5,
    4: 5,
    5: 5,
    6: "custom",
    7: "custom",
    8: "custom"
}

const partyMakerEmbed = (guild, color) => {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({name: `${guild.name} party maker`, iconURL: guild.iconURL({extension: "png"})})
        .setTitle("Create a party and play together!")
        .setDescription("Join the voice channel to create and manage your party.")
        .addFields(
            {
                name: "Create",
                value: "Open the menu to create a new party."
            },
            {
                name: "Drafts",
                value: "Create a party from your saved drafts."
            },
            {
                name: "Close",
                value: "Manually close your party."
            },
            {
                name: "Manage",
                value: "Open the party manager interface"
            },
            {
                name: "Preferences",
                value: "Set up preferences such as your block list and notifications."
            }
            
        )

}

const firstRowButtonsMenu = () => {
    
    const create = new ButtonBuilder()
        .setCustomId("create-button")
        .setLabel("Create")
        .setStyle(ButtonStyle.Success)

    const drafts = new ButtonBuilder()
        .setCustomId("drafts-button")
        .setLabel("Drafts")
        .setStyle(ButtonStyle.Success)
    
    const manage = new ButtonBuilder()
        .setCustomId("manage-party-button")
        .setLabel("Manage")
        .setStyle(ButtonStyle.Primary)

    const close = new ButtonBuilder()
        .setCustomId("close-party-button")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)

    const preferences = new ButtonBuilder()
        .setCustomId("preferences-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Preferences")

    return new ActionRowBuilder().addComponents(create, drafts, close, manage, preferences);
}

async function create_button(interaction, cooldowns, partyCooldowns, cd) {
    const reply = await interaction.deferReply({flags: MessageFlags.Ephemeral});
    const fetchedReply = await interaction.fetchReply();

    const {rows : isPremiumMember} = await poolConnection.query(`SELECT EXISTS
        (SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2)`,
        [interaction.guild.id, interaction.member.id]);

    const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype='lfg-logs'`,
        [interaction.guild.id]
    );

    let logChannel = null;

    try{
        logChannel = await interaction.guild.channels.fetch(logChannelData[0].channel);
    } catch(err) {
        console.error(err);
    }

    const partyObj = {
        owner: interaction.member,
        region: "None",
        gamemode: "None",
        ign: "Unspecified",
        size: 0,
        hasAccess: [interaction.member],
        lfmembercount: null,
        minrank: null,
        maxrank: null,
        reqroles: [],
        description: null,
        channel: null,
        message: null,
        hexcolor: 0,
        private: false, // [true] private party is invite-only, joining the voice channels is based on perms otherwise it's public [false]
        timestamp: parseInt(Date.now() / 1000),
        isPremium: isPremiumMember[0].exists
    } // all selections will be stored in this object

    const partyEmbedRefresh = () => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `[${partyObj.region.toUpperCase()}] ${interaction.user.username} ${partyObj.private ? "private" : "public"} party`,
                iconURL: interaction.user.displayAvatarURL({extension: "png"})
            })
            .setColor(partyObj.hexcolor)
            .setDescription("- **IGN** button must be used before being able to **Send** or to **Save Draft**\n- Color button is a premium feature")
            .setFields(
                {
                    name: "Gamemode",
                    value: id2gamemode[partyObj.gamemode]
                },
                {
                    name: "Owner",
                    value: `${interaction.user}`
                },
                {
                    name: "IGN",
                    value: partyObj.ign
                },
                {
                    name: "Looking for",
                    value: `+${partyObj.lfmembercount}`
                },
                {
                    name: "Roles Required",
                    value: `${partyObj.reqroles.length ? partyObj.reqroles.map(r => r.toUpperCase()).join(", ") : "Any"}`
                }
            )
        
        if(partyObj.gamemode < 3)
            embed.addFields(
                {
                    name: "Rank range",
                    value: `${id2rank[partyObj.minrank]} - ${id2rank[partyObj.maxrank]}`
                }
            )
        
        if(partyObj.description != null)
            embed.setDescription(partyObj.description);

        if(partyObj.channel != null)
            embed.addFields({name: "Voice", value: `${partyObj.channel}`});
        return embed;
    }
    // fetching the voice channel
    const {rows: lfgchannelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
        WHERE guild=$1 AND channeltype='main-lobby'`, [interaction.guild.id]);

    if(lfgchannelData.length == 0) {
        return await reply.edit({content: "The lobby voice channel could not be found."});
    }

    let createLobbyChannel = null;

    try{
        createLobbyChannel = await interaction.guild.channels.fetch(lfgchannelData[0].channel);
    } catch(err) {
        return await reply.edit({content: "Wrong lfg channel configuration."});
    }

    if(interaction.member.voice.channelId != createLobbyChannel.id) {
        // if the member is not in the create lobby channel
        return reply.edit({content: `You must be in the ${createLobbyChannel} voice channel first.`})
    }

    let partyCreateEmbed = new EmbedBuilder()
        .setColor("Purple")
        .setAuthor({name: `Creating your party...`, iconURL: interaction.member.displayAvatarURL({extension: "png"})})
        .setDescription("Select your region")
        .setFields(
            {
                name: "EUNE",
                value: "If you play on EUNE",
            },
            {
                name: 'EUW',
                value: "If you play on EUW",
            }
        )
    
    // buttons
    const euneRegionButton = new ButtonBuilder()
        .setCustomId("eune")
        .setLabel("EUNE")
        .setStyle(ButtonStyle.Primary)

    const euwRegionButton = new ButtonBuilder()
        .setCustomId("euw")
        .setLabel("EUW")
        .setStyle(ButtonStyle.Primary)

    const ignButton = new ButtonBuilder()
        .setCustomId("ign")
        .setLabel("IGN")
        .setStyle(ButtonStyle.Success)

    const reqRolesButton = new ButtonBuilder()
        .setCustomId("req-roles")
        .setLabel("Roles")
        .setStyle(ButtonStyle.Secondary)
    
    const addInfoButton = new ButtonBuilder()
        .setCustomId("add-info")
        .setLabel("Add Info")
        .setStyle(ButtonStyle.Secondary)

    const sendLFGButton = new ButtonBuilder()
        .setCustomId("send-lfg")
        .setLabel("Send")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)

    const addMembersButton = new ButtonBuilder()
        .setCustomId('add-members-button')
        .setLabel("Add Access")
        .setStyle(ButtonStyle.Secondary)
    
    const setColorButton = new ButtonBuilder()
        .setCustomId('set-color-button')
        .setLabel("Color")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!partyObj.isPremium)

    const saveDraftButton = new ButtonBuilder()
        .setCustomId('save-draft-button')
        .setLabel("Save Draft")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)

    const privateToggleButton = new ButtonBuilder()
        .setCustomId("private-toggle")
        .setLabel("Private Toggle")
        .setStyle(ButtonStyle.Secondary);

    const aboutButton = new ButtonBuilder()
        .setCustomId("about-button")
        .setLabel("About")
        .setStyle(ButtonStyle.Secondary);

    const setLfSlots = new ButtonBuilder()
        .setCustomId("set-lf-slots")
        .setLabel("Set Slots")
        .setStyle(ButtonStyle.Secondary)

    const regionButtons = new ActionRowBuilder()
        .addComponents(euneRegionButton, euwRegionButton);

    const secondRowButtons = new ActionRowBuilder()
        .addComponents(ignButton, setLfSlots, privateToggleButton, aboutButton, sendLFGButton);
    const firstRowButtons = new ActionRowBuilder()
        .addComponents(reqRolesButton, addMembersButton, addInfoButton, setColorButton, saveDraftButton)
    // select menus
    const selectGamemode = new StringSelectMenuBuilder()
		.setCustomId('select-gamemode')
		.setPlaceholder('Pick a gamemode...')
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions(gamemodeSelectOptions);
    
    const selectRanks = new StringSelectMenuBuilder()
        .setCustomId("select-ranks")
        .setPlaceholder("Select min/max ranks...")
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(rankOptions)

    const selectReqRoles = new StringSelectMenuBuilder()
        .setCustomId("select-req-roles")
        .setPlaceholder("Select the roles you are looking for...")
        .setMinValues(1)
        .setMaxValues(5)
        .addOptions(roleSelectOptions)

    const selectMembers = new UserSelectMenuBuilder()
        .setCustomId("select-members")
        .setMinValues(1)
        .setPlaceholder("Select the members that you already have...")

    const selectColor = new StringSelectMenuBuilder()
        .setCustomId("select-color")
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder("Give some color to your party!")
        .addOptions(colorSelectOptions)

    const selectDraftSlot = new StringSelectMenuBuilder()
        .setCustomId('select-draft-slot')
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder("Select the slot you want the draft to be saved...");
    
    const selectColorsRow = new ActionRowBuilder()
        .addComponents(selectColor);
    const selectDraftSlotRow = new ActionRowBuilder()
        .addComponents(selectDraftSlot);
    const selectReqRolesRow = new ActionRowBuilder()
        .addComponents(selectReqRoles);
    const selectMembersRow = new ActionRowBuilder()
        .addComponents(selectMembers)
    const selectGamemodeActionRow = new ActionRowBuilder()
        .addComponents(selectGamemode);
    const selectRanksActionRow = new ActionRowBuilder()
        .addComponents(selectRanks);


    // modals
    const partySlotsTextInput = new TextInputBuilder()
        .setCustomId("party-slots-input")
        .setRequired(true)
        .setPlaceholder("4 as in lf +4")
        .setLabel("Lf members")
        .setMaxLength(2)
        .setMaxLength(1)
        .setStyle(TextInputStyle.Short)

    const partySlotRow = new ActionRowBuilder()
        .addComponents(partySlotsTextInput)

    const partySlotsModal = new ModalBuilder()
        .setCustomId("party-slots-modal")
        .setTitle("How many party members are you looking for?")
        .addComponents(partySlotRow)

    const ignTextInput = new TextInputBuilder()
        .setCustomId("ign-text-input")
        .setRequired(true)
        .setPlaceholder("example#tag")
        .setLabel("Summoner Name")
        .setMaxLength(22)
        .setMinLength(3)
        .setStyle(TextInputStyle.Short)
    const ignRow = new ActionRowBuilder()
        .addComponents(ignTextInput)

    const ignModal = new ModalBuilder()
        .setTitle("In-game name")
        .setCustomId("ign-modal")
        .addComponents(ignRow)

    const descriptionTextInput = new TextInputBuilder()
        .setCustomId("description-text-input")
        .setRequired(true)
        .setLabel("Description")
        .setMaxLength(300)
        .setMinLength(4)
        .setStyle(TextInputStyle.Paragraph)

    const addInfoRow = new ActionRowBuilder().addComponents(descriptionTextInput)

    const addInfoModal = new ModalBuilder()
        .setCustomId("add-info-modal")
        .setTitle("Add information")
        .addComponents(addInfoRow);

    const draftNameTextInput = new TextInputBuilder()
        .setCustomId("draft-name-input")
        .setRequired(true)
        .setLabel("Draft Name")
        .setMaxLength(32)
        .setMinLength(2)
        .setStyle(TextInputStyle.Short)
    const draftNameRow = new ActionRowBuilder()
        .addComponents(draftNameTextInput);
    const draftNameModal = new ModalBuilder()
        .setCustomId("draft-name-modal")
        .setTitle("Name your draft")
        .addComponents(draftNameRow);
    
    const hexcolorInput = new TextInputBuilder()
        .setCustomId("hexcolor-input")
        .setLabel("Provide the 6 digits hexcolor for your role.")
        .setPlaceholder("Example: 9A00FF")
        .setMaxLength(6)
        .setMinLength(6)
        .setRequired(true)
        .setStyle(TextInputStyle.Short);
    const hexcolorInputRow = new ActionRowBuilder()
        .addComponents(hexcolorInput);
    const hexcolorModal = new ModalBuilder()
        .setCustomId("hexcolor-modal")
        .setTitle("Set your custom hexcolor")
        .addComponents(hexcolorInputRow);
    const partySizeInput = new TextInputBuilder()
        .setRequired(true)
        .setPlaceholder("Number...")
        .setCustomId("party-size-input")
        .setLabel("Party size")
        .setMaxLength(2)
        .setMinLength(1)
        .setStyle(TextInputStyle.Short)
    
    const partySizeModalRow = new ActionRowBuilder()
        .addComponents(partySizeInput);

    const partySizeModal = new ModalBuilder()
        .setCustomId("party-size-modal")
        .setTitle("What's the party size?")
        .addComponents(partySizeModalRow);

    await reply.edit({embeds: [partyCreateEmbed], components: [regionButtons]}); // the menu to choose the region and start the party creation process

    const buttonCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 600_000
    });

    const selectCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 600_000
    });

    const userCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.UserSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 600_000
    });

    const internalCooldowns = new Collection();
    const internalcooldown = 2_000;

    buttonCollector.on("end", async () => {
        try{
            await reply.edit({embeds: [], components: [], content: "The party creation process ended.\nOpen a new one if needed."});
            selectCollector.stop();
            userCollector.stop();
        } catch(err) {};
    });

    buttonCollector.on("collect", async (buttonInteraction) => {
        if(buttonInteraction.member.voice.channelId != createLobbyChannel.id)
        {
            // check if the user is still connected to the voice channel
            return await reply.edit({content: `You must be in the ${createLobbyChannel} voice channel first.`})
        }
        if(!buttonInteraction.isButton()) return;
        
        const userInternalCooldown = hasCooldown(buttonInteraction.user.id, internalCooldowns, internalcooldown);

        if(userInternalCooldown) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You are pressing buttons too fast! <t:${parseInt(userInternalCooldown / 1000)}:R>`
            })
        }

        internalCooldowns.set(buttonInteraction.user.id, Date.now());
        setTimeout(() => internalCooldowns.delete(buttonInteraction.user.id), internalcooldown);

        switch(buttonInteraction.customId) {
            case "eune":
            case "euw":
                // the region is stored and the gamemode selection process will start
                partyObj.region = buttonInteraction.customId;
                partyCreateEmbed.setFields()
                    .setAuthor({
                        name: `[${partyObj.region.toUpperCase()}] ${buttonInteraction.user.username} party`,
                        iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                    })
                    .setDescription("Select the gamemode you want to play with the party")

                await reply.edit({embeds: [partyCreateEmbed], components: [selectGamemodeActionRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `Party set on ${partyObj.region.toUpperCase()} region`});
            break;
            case "ign":
                await buttonInteraction.showModal(ignModal);
                try{
                    const submitIgn = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });
                    const ignRegex = /^.{3,16}#.{3,5}$/;
                    const ign = submitIgn.fields.getTextInputValue("ign-text-input");

                    if(!ignRegex.test(ign)) {
                        return await submitIgn.reply({flags: MessageFlags.Ephemeral, content: "The summoner name format is invalid. <3-16 characters>#<3-5 characters>"})
                    }

                    partyObj.ign = ign;
                    await submitIgn.reply({flags: MessageFlags.Ephemeral, content: `IGN set to **${ign}**`});
                    sendLFGButton.setDisabled(false);
                    saveDraftButton.setDisabled(false);
                    await reply.edit({embeds: [partyEmbedRefresh()], components: [firstRowButtons, secondRowButtons]});
                } catch(err) {
                    await buttonInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."})
                }
            break;
            case "req-roles":
                await reply.edit({components: [firstRowButtons, secondRowButtons, selectReqRolesRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "Specify the roles you are looking for in your party."});
            break;
            case "add-members-button":
                selectMembers.setMaxValues(10 < partyObj.size - 2 ? 10 : partyObj.size - 2);
                
                if(partyObj.gamemode == 0) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "You can not add more people to solo/duo."
                    });
                }

                await reply.edit({components: [firstRowButtons, secondRowButtons, selectMembersRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `Select the members of your party. No more than ${partyObj.size - 2} members.\nIf you see 0, then why LFG if you have a full party.`});
            break;
            case "add-info":
                await buttonInteraction.showModal(addInfoModal);
                try{
                    const submitInfo = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });
                    const description = submitInfo.fields.getTextInputValue("description-text-input");
                    const response = await classifier(description);
                    if(response) {
                        if(!response.labels.includes("OK")) {
                            return await submitInfo.reply({
                                flags: MessageFlags.Ephemeral,
                                value: "Please avoid using slurs or derogatory language!"
                            })
                        }
                    }
                    // here a filter would be implemented for improper language
                    partyObj.description = description;
                    await submitInfo.reply({flags: MessageFlags.Ephemeral, content: "A description has been provided."});
                    await reply.edit({embeds: [partyEmbedRefresh()]});
                } catch(err) {
                    await buttonInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."})
                }
            break;
            case "set-color-button":
                await reply.edit({components: [firstRowButtons, secondRowButtons, selectColorsRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "Set the color of the embed message."});
            break;
            case "save-draft-button":
                await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

                const totalSlots = partyObj.isPremium ? 5 : 2; // if the member is a premium member, they have 5 slots, 2 if normal member

                const {rows : memberDraftData} = await poolConnection.query(`SELECT slot, draftname
                    FROM partydraft
                    WHERE guild=$1 AND owner=$2
                    ORDER BY slot ASC`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]);

                const selectDraftSlotOptions = [];

                // initializing the options
                for(let i = 1; i <= totalSlots; i++) {
                    selectDraftSlotOptions.push(
                        {
                            label: `Slot ${i} is empty`,
                            value: `${i}`,
                            description: `Slot ${i}`
                        }
                    )
                }

                // replacing initial options with the ones existing
                if(memberDraftData.length)
                    for(const row of memberDraftData) {
                        selectDraftSlotOptions[row.slot - 1] = {
                            label: `${row.draftname}`,
                            value: `${row.slot}`,
                            description: `Slot ${row.slot}`
                        }
                    }

                selectDraftSlot.setOptions(selectDraftSlotOptions);

                await reply.edit({components: [firstRowButtons, secondRowButtons, selectDraftSlotRow]});
                await buttonInteraction.editReply({content: "Select the slot where your party draft will be stored.\nSelecting a slot that is already in use will override the previous draft."});
            break;
            case "set-lf-slots":
                await buttonInteraction.showModal(partySlotsModal);
                try {
                    const submitSlots = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });

                    const partySlots = submitSlots.fields.getTextInputValue("party-slots-input");
                    if(Number.isNaN(Number(partySlots))) {
                        return await submitSlots.reply({flags: MessageFlags.Ephemeral, content: "The input given is not a number."});
                    }

                    if(Number(partySlots) < 1 || Number(partySlots) > partyObj.size - 1) {
                        return await submitSlots.reply({
                            flags: MessageFlags.Ephemeral,
                            content: `You must provide a number between 1 and ${partyObj.size - 1}.`
                        })
                    }

                    partyObj.lfmembercount = partySlots;
                    await reply.edit({embeds: [partyEmbedRefresh()]});
                    await submitSlots.reply({flags: MessageFlags.Ephemeral, content: `Looking for +${partyObj.lfmembercount}`});
                } catch(err) {
                    return await buttonInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Timed out, try again."});
                }

            break;
            case "private-toggle":
                partyObj.private = !partyObj.private; // toggle the value
                await reply.edit({embeds: [partyEmbedRefresh()]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `Party has been set to ${partyObj.private ? "Private" : "Public"}`})
            break;
            case "about-button":
                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: `${buttonInteraction.member}`,
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Aqua")
                            .setTitle("About: Create LFG")
                            .setDescription("The buttons are used to set specifications about the party/lobby you want to create.\nYour selections will be implemented into the embeded message that will be sent.")
                            .setFields(
                                {
                                    name: "IGN",
                                    value: "Set the summoner name of the account you're creating the party from."
                                },
                                {
                                    name: "Roles",
                                    value: "The roles required for your party."
                                },
                                {
                                    name: "Add Access",
                                    value: "The people that you start your party with.\nOn your LFG message will be displayed as `Looking for +<number of members>`\nExample: Looking for +1"
                                },
                                {
                                    name: "Add Info",
                                    value: "Set the embed message description with your custom message."
                                },
                                {
                                    name: "Color",
                                    value: "Choose between a preset of colors or set a custom color.\nThe color will border the left side of the embed.\nPremium feature only."
                                },
                                {
                                    name: "Save Draft",
                                    value: "Save the current draft specifications (except the members access) for future use."
                                },
                                {
                                    name: "Set Slots",
                                    value: "Based on the access given to members and party size, Looking for is calculated, but you can override it manually."
                                },
                                {
                                    name: "Private Toggle",
                                    value: "By default a party is private, you can taggle it to be either public or private."
                                }
                            )
                    ]
                });
            break;
            case "send-lfg":
                const {rows: partyRoomData} = await poolConnection.query(`SELECT EXISTS
                    (SELECT 1 FROM partyroom WHERE guild=$1 AND owner=$2)`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                if(partyRoomData[0].exists) {
                    // if the party member is also the owner
                    return await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `You do already have an active party, close it before creating a new one!`});
                }

                if(partyObj.isPremium)
                {
                    cd = 600_000; // cd reduced for premiums
                }

                if(buttonInteraction.member.voice.channelId != createLobbyChannel.id) // member must be in the creation channel
                {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `You must be in the ${createLobbyChannel} voice channel to do that!`
                    });
                }
                
                const userSendCooldown = hasCooldown(buttonInteraction.user.id, cooldowns, cd);

                let onCooldownContent = `You are still on cooldown, you must wait before creating a new LFG - <t:${parseInt(userSendCooldown / 1000)}:R>`

                if(!partyObj.isPremium) onCooldownContent += `\nThe premium cooldown is shorter! <t:${parseInt((cooldowns.get(buttonInteraction.user.id) + 600_000) / 1000)}:R>`

                if(userSendCooldown) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: onCooldownContent
                    });
                }

                cooldowns.set(buttonInteraction.user.id, Date.now());
                setTimeout(() => cooldowns.delete(buttonInteraction.user.id), cd);

                await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

                const registerParty = async () => {
                    try{
                        await poolConnection.query(`INSERT INTO partyroom (
                                guild, owner, ign, region, gamemode, size, private, minrank, maxrank,
                                reqroles, description, channel, message, hexcolor, timestamp
                            )
                            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                            [
                                buttonInteraction.guild.id, buttonInteraction.member.id, partyObj.ign, partyObj.region,
                                partyObj.gamemode, partyObj.size, partyObj.private, partyObj.minrank, partyObj.maxrank,
                                partyObj.reqroles, partyObj.description, partyObj.channel.id, partyObj.message.id, 
                                partyObj.hexcolor, partyObj.timestamp
                            ]
                        );
                    } catch(err) { console.error(err); }
                }

                // creating the channel

                // doing channel perms if the channel is private
                const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
                    [buttonInteraction.guild.id]
                );

                const channelPerms = [];

                // people blocked by partyowner
                const {rows: blocklist} = await poolConnection.query(`SELECT blocked FROM lfgblock WHERE guild=$1 AND blocker=$2`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                // people that blocked partyowner
                const {rows: blockerslist} = await poolConnection.query(`SELECT blocker FROM lfgblock WHERE guild=$1 AND blocked=$2`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                // denying permissions for blocked
                for(const row of blocklist) {
                    try{
                        channelPerms.push(
                            {
                                id: row.blocked,
                                deny: [
                                    PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
                                    PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                                ]
                            }
                        )
                    } catch(err) { console.error(err) };
                }

                // denying permissions for blockers
                for(const row of blockerslist) {
                    try{
                        channelPerms.push(
                            {
                                id: row.blocker,
                                deny: [
                                    PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
                                    PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                                ]
                            }
                        )
                    } catch(err) { console.error(err) };
                }

                if(partyObj.private) {
                    for(const member of partyObj.hasAccess){
                        channelPerms.push(
                            {
                                id: member.id,
                                allow: [
                                    PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.Connect,
                                    PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                                ]
                            }
                        )
                    }
                    channelPerms.push(
                        {
                            id: buttonInteraction.guild.roles.everyone.id,
                            deny: [
                                PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
                                PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                            ]
                        },
                        {
                            id: staffRoleData[0].role, // staff members have access on private channels
                            allow: [
                                PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.Connect,
                                PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                            ]
                        }
                    );
                }

                // fetching the proper category
                const {rows: regionCategoryData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
                    WHERE guild=$1 AND channeltype='category-${partyObj.region}'`, [buttonInteraction.guild.id]);
                const {rows: regionlfgData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
                    WHERE guild=$1 AND channeltype='lfg-${partyObj.region}'`, [buttonInteraction.guild.id]);
                const {rows: regionPingRoleData} = await poolConnection.query(`SELECT role FROM serverroles 
                    WHERE guild=$1 AND roletype='lfg-${partyObj.region}'`, [buttonInteraction.guild.id]);
                const {rows: [{countparties}]} = await poolConnection.query(`SELECT COUNT(*) AS countparties FROM
                        partyroom WHERE guild=$1 AND gamemode=$2 AND region=$3`,
                        [buttonInteraction.guild.id, partyObj.gamemode, partyObj.region]
                    );
                
                const regionCategory = await buttonInteraction.guild.channels.fetch(regionCategoryData[0].channel);
                const regionLFG = await buttonInteraction.guild.channels.fetch(regionlfgData[0].channel);

                const pingRole = await buttonInteraction.guild.roles.fetch(regionPingRoleData[0].role);

                partyObj.channel = await buttonInteraction.guild.channels.create({
                    name: `${id2gamemode[partyObj.gamemode]} [${Number(countparties) + 1}]`,
                    type: ChannelType.GuildVoice,
                    permissionOverwrites: channelPerms,
                    parent: regionCategory,
                    userLimit: partyObj.size
                });

                // moving the member to the party channel
                await buttonInteraction.member.voice.setChannel(partyObj.channel);

                const lfgEmbed = partyEmbedRefresh();
                lfgEmbed
                    .setTimestamp()
                    .setFooter({text:`OWNER ID: ${buttonInteraction.user.id}`})
                    .setDescription(partyObj.description);
                
                await buttonInteraction.editReply({flags: MessageFlags.Ephemeral, content: `Party created successfully\nChannel: ${partyObj.channel}\nLFG: ${regionLFG}`});
                
                const messageBody = {
                    embeds: [lfgEmbed],
                    components: [lfg_buttons(partyObj.private)],
                    content: `${pingRole}`   
                }

                partyCooldowns.set(partyObj.channel.id, Date.now());
                setTimeout(() => partyCooldowns.delete(partyObj.channel.id), cd);

                partyObj.message = await regionLFG.send(messageBody);
                await registerParty();
                await lfg_collector(partyObj.message);

                // lfg history
                await poolConnection.query(`INSERT INTO partyhistory(
                        guild, owner, ign, region, gamemode, size, private, minrank, maxrank, reqroles,
                        description, timestamp
                    )
                    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        buttonInteraction.guild.id, buttonInteraction.user.id, partyObj.ign, partyObj.region,
                        partyObj.gamemode, partyObj.size, partyObj.private, partyObj.minrank, partyObj.maxrank,
                        partyObj.reqroles, partyObj.description, partyObj.timestamp
                    ]
                );

                if(logChannel) {
                    // logs for creation of the party
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setAuthor({
                                    name: `[${partyObj.region.toUpperCase()}] ${buttonInteraction.user.username} party`,
                                    iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                                })
                                .setTimestamp()
                                .setFooter({text: `ID: ${buttonInteraction.user.id}`})
                                .setTitle("Party Created")
                                .addFields(
                                    {
                                        name: "Gamemode",
                                        value: id2gamemode[partyObj.gamemode]
                                    },
                                    {
                                        name: "IGN",
                                        value: partyObj.ign
                                    },
                                    {
                                        name: "Description",
                                        value: `${partyObj.description || "None"}`
                                    }
                                )
                        ]
                    });
                }

                buttonCollector.stop();
            break;
        }
    });

    selectCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isStringSelectMenu()) return;
        if(selectInteraction.member.voice.channelId != createLobbyChannel.id) return;


        switch(selectInteraction.customId) {
            case "select-gamemode":
                partyObj.gamemode = Number(selectInteraction.values[0]);

                if(partyObj.gamemode == 0)
                    addMembersButton.setDisabled(true);
                
                if(partyObj.gamemode < 6) {
                    // party size
                    // for solo/duo, flex, clash, normal, swift play and aram
                    // rotation gamemode, tft and custom will be set by the user
                    await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Gamemode set to ${id2gamemode[partyObj.gamemode]}`});
                    partyObj.size = partySizeDict[partyObj.gamemode];
                } else if(partyObj.gamemode >= 6) {
                    // will be redirected to setting the number of party members
                    await selectInteraction.showModal(partySizeModal);
                    try{
                        const submitPartySize = await selectInteraction.awaitModalSubmit({
                            filter: (i) => i.user.id === selectInteraction.user.id,
                            time: 120_000
                        });
                        const partySize = submitPartySize.fields.getTextInputValue("party-size-input");
                        if(Number.isNaN(partySize) || Number(partySize) < 2) {
                            // if user gives garbage input
                           return await submitPartySize.reply({flags: MessageFlags.Ephemeral, content: "Invalid party size. Must be 2-99"})
                        }
                        else
                            {
                                partyObj.size = Number(partySize);
                                await submitPartySize.reply({flags: MessageFlags.Ephemeral, content: `Party size set to ${partyObj.size}`});
                            }
                    } catch(err) {
                        await selectInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."})
                    }
                }

                partyObj.lfmembercount = partyObj.size - partyObj.hasAccess.length;

                if(partyObj.gamemode < 3) {
                    // for the ranked related gamemodes, will be redirected to setting the min-max rank
                    await reply.edit({
                        embeds: [partyCreateEmbed.setDescription("Select two ranks as the minimum and maximum ranks required to join the party")],
                        components: [selectRanksActionRow]
                    });
                } else {
                    // the other gamemodes skip the party size specification/minmax rank specification
                    // and all selections will take the user to the menu where party members are selected, as well as specifying available roles
                    await reply.edit({
                        embeds: [partyEmbedRefresh()],
                        components: [firstRowButtons, secondRowButtons]
                    });
                }
            break;
            case "select-ranks":
                // two ranks are selected, the lower rank will be set as min and the higher rank will be set as max
                if(Number(selectInteraction.values[0]) < Number(selectInteraction.values[1])) {
                    partyObj.maxrank = Number(selectInteraction.values[1]);
                    partyObj.minrank = Number(selectInteraction.values[0]);
                }
                else {
                    partyObj.maxrank = Number(selectInteraction.values[0]);
                    partyObj.minrank = Number(selectInteraction.values[1]);
                }
                await reply.edit({
                    embeds: [partyEmbedRefresh()],
                    components: [firstRowButtons, secondRowButtons]
                });
                await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Ranks range: ${id2rank[partyObj.minrank]} - ${id2rank[partyObj.maxrank]}`});
            break;
            case "select-req-roles":
                partyObj.reqroles = [];
                selectInteraction.values.forEach(role => {
                    partyObj.reqroles.push(role.toUpperCase());
                });
                await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Roles specified: ${partyObj.reqroles.join(", ")}`});
                await reply.edit({embeds: [partyEmbedRefresh()], components: [firstRowButtons, secondRowButtons]});
            break;
            case "select-color":
                const colorInput = selectInteraction.values[0];
                if(colorInput == "0") {
                    await selectInteraction.showModal(hexcolorModal);
                    try {
                        const submitHexcolor = await selectInteraction.awaitModalSubmit({
                            filter: (i) => i.user.id === selectInteraction.user.id,
                            time: 120_000
                        });

                        const hexcolor = "0x" + submitHexcolor.fields.getTextInputValue("hexcolor-input");
                        const hexColorRegex = /^0x([A-Fa-f0-9]{6})$/;
                        if (!hexColorRegex.test(hexcolor)) {
                            // meaning the input is invalid
                            return await submitHexcolor.reply({
                                content:
                                    "Invalid input, a hexcolor should look like this `9A00FF`.",
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        partyObj.hexcolor = Number(hexcolor);
                        await submitHexcolor.reply({flags: MessageFlags.Ephemeral, content: `Color set to ${hexcolor}`});
                    } catch(err) {
                        await selectInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."});
                    }
                } else {
                    partyObj.hexcolor = Number(selectInteraction.values[0]);
                    await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Hexcolor set to ${selectInteraction.values[0]}`});
                }

                await reply.edit({embeds: [partyEmbedRefresh()], components: [firstRowButtons, secondRowButtons]});
                
            break;
            case "select-draft-slot":
                const slot = Number(selectInteraction.values[0]);
                await selectInteraction.showModal(draftNameModal);
                try {
                    const submitDraftName = await selectInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === selectInteraction.user.id,
                        time: 120_000
                    });

                    const draftName = submitDraftName.fields.getTextInputValue("draft-name-input");
                    const regex = /^[a-zA-Z0-9 +-_]+$/;
                    if(!regex.test(draftName)) {
                        return await submitDraftName.reply({flags: MessageFlags.Ephemeral, content: "Invalid input. Valid characters: a-z A-Z 0-9 +-_ and space"});
                    }
                    await submitDraftName.deferReply({flags: MessageFlags.Ephemeral});
                    try{
                        // inserting in database
                        await poolConnection.query(`INSERT INTO partydraft(
                                slot, draftname, guild, owner, ign, region, gamemode, size, private, minrank, maxrank,
                                reqroles, description, hexcolor
                            )
                            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                            ON CONFLICT ON CONSTRAINT unique_guild_owner_slot
                            DO UPDATE SET
                                ign = EXCLUDED.ign,
                                draftname = EXCLUDED.draftname,
                                region = EXCLUDED.region,
                                gamemode = EXCLUDED.gamemode,
                                size = EXCLUDED.size,
                                private = EXCLUDED.private,
                                minrank = EXCLUDED.minrank,
                                maxrank = EXCLUDED.maxrank,
                                reqroles = EXCLUDED.reqroles,
                                description = EXCLUDED.description,
                                hexcolor = EXCLUDED.hexcolor`,
                                [
                                    slot, draftName, selectInteraction.guild.id, selectInteraction.member.id, partyObj.ign,
                                    partyObj.region, partyObj.gamemode, partyObj.size, partyObj.private, partyObj.minrank, partyObj.maxrank,
                                    partyObj.reqroles, partyObj.description, partyObj.hexcolor
                                ]
                            );
                    } catch(err) { console.error(err); }

                    await submitDraftName.editReply({content: `Draft **${draftName}** is stored in Slot ${slot}`});
                    await reply.edit({components: [firstRowButtons, secondRowButtons]});
                }catch(err) {
                    await selectInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."});
                }
            break;
        }
    });

    userCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isUserSelectMenu()) return;
        if(selectInteraction.member.voice.channelId != createLobbyChannel.id) return;

        switch(selectInteraction.customId) {
            case "select-members":
                await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});

                const {rows: blocklist} = await poolConnection.query(`SELECT blocked FROM lfgblock WHERE guild=$1 AND blocker=$2`,
                    [selectInteraction.guild.id, selectInteraction.member.id]
                );

                const {rows: blockerlist} = await poolConnection.query(`SELECT blocker FROM lfgblock WHERE guild=$1 AND blocked=$2`,
                    [selectInteraction.guild.id, selectInteraction.member.id]
                );

                partyObj.hasAccess = [selectInteraction.member];

                for(const user of selectInteraction.values) {
                    if(user != selectInteraction.user.id) {
                        if(blockerlist.some(row => row.blocker === user) || 
                            blocklist.some(row => row.blocked === user)) {
                            return await selectInteraction.editReply({content: "Some of the users you added are either in your blocklist or have blocked you."})
                        }

                        const member = await selectInteraction.guild.members.fetch(user);
                        partyObj.hasAccess.push(member);
                    }
                }
                partyObj.lfmembercount = partyObj.size - partyObj.hasAccess.length;
                await reply.edit({embeds: [partyEmbedRefresh()], components: [firstRowButtons, secondRowButtons]});
                await selectInteraction.editReply({flags: MessageFlags.Ephemeral, content: `Added access to: ${partyObj.hasAccess.join(", ")}\nIn order to clear the access list, select only yourself.`});
            break;
        }
    });

}

async function drafts_button(interaction, cooldowns, partyCooldowns, cd) {
    const reply = await interaction.deferReply({flags: MessageFlags.Ephemeral});
    const fetchedReply = await interaction.fetchReply();

    // fetching the voice channel
    const {rows: lfgchannelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
        WHERE guild=$1 AND channeltype='main-lobby'`, [interaction.guild.id]);

    if(lfgchannelData.length == 0) {
        return await reply.edit({content: "The lobby voice channel could not be found."});
    }

    let createLobbyChannel = null;

    try{
        createLobbyChannel = await interaction.guild.channels.fetch(lfgchannelData[0].channel);
    } catch(err) {
        return await reply.edit({content: "Wrong lfg channel configuration."});
    }

    const {rows: draftsData} = await poolConnection.query(`SELECT * FROM partydraft WHERE guild=$1 AND owner=$2
        ORDER BY slot ASC`,
        [interaction.guild.id, interaction.user.id]
    );

    if(draftsData.length == 0) {
        return await reply.edit({
            content: `You have no party draft saved, use the \`Create\` button to create a party draft and save it.`
        });
    }

    const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype='lfg-logs'`,
        [interaction.guild.id]
    );

    let logChannel = null;

    try{
        logChannel = await interaction.guild.channels.fetch(logChannelData[0].channel);
    } catch(err) {
        console.error(err);
    }

    const {rows: isPremiumMember} = await poolConnection.query(`SELECT EXISTS
        (SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2)`,
        [interaction.guild.id, interaction.user.id]
    );

    if(isPremiumMember[0].exists)
        cd = 600_000; // reduced cd for premium

    const draftEmbedBuilder = (partydraft) => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `[${partydraft.region.toUpperCase()}] ${interaction.user.username} ${partydraft.private ? "private" : "public"} party`,
                iconURL: interaction.user.displayAvatarURL({extension: "png"})
            })
            .setColor(partydraft.hexcolor)
            .setFields(
                {
                    name: "Gamemode",
                    value: id2gamemode[partydraft.gamemode]
                },
                {
                    name: "Owner",
                    value: `${interaction.user}`
                },
                {
                    name: "IGN",
                    value: partydraft.ign
                },
                {
                    name: "Looking for",
                    value: `+${partydraft.slots}`
                },
                {
                    name: "Roles Required",
                    value: `${partydraft.reqroles.length ? partydraft.reqroles.map(r => r.toUpperCase()).join(", ") : "Any"}`
                }
            )
        
        if(partydraft.gamemode < 3)
            embed.addFields(
                {
                    name: "Rank range",
                    value: `${id2rank[partydraft.minrank]} - ${id2rank[partydraft.maxrank]}`
                }
            )
        
        if(partydraft.description != null)
            embed.setDescription(partydraft.description);
        
        return embed;

    }

    // preparing the select menu
    const selectDraftOptions = [];
    const embedDraftList = new EmbedBuilder()
        .setColor("Purple")
        .setAuthor({name: `${interaction.user.username} draft list`, iconURL: interaction.user.displayAvatarURL({extension: "png"})})

    for(const row of draftsData) {
        selectDraftOptions.push(
            {
                label: row.draftname,
                value: `${row.slot}`,
                description: `Slot ${row.slot}`
            }
        )

        embedDraftList.addFields(
            {
                name: `[${row.slot}] ${row.draftname}`,
                value: `${id2gamemode[row.gamemode]}`
            }
        );
    }

    const selectDraft = new StringSelectMenuBuilder()
        .setCustomId("select-draft")
        .setPlaceholder("Select a draft...")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(selectDraftOptions)

    const selectDraftRow = new ActionRowBuilder().addComponents( selectDraft );

    const sendButton = new ButtonBuilder()
        .setCustomId("send-button")
        .setLabel("Send")
        .setStyle(ButtonStyle.Success)

    const setSlotsButton = new ButtonBuilder()
        .setCustomId("set-slots-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("LF Slots")

    const partySlotsTextInput = new TextInputBuilder()
        .setCustomId("party-slots-input")
        .setRequired(true)
        .setPlaceholder("4 as in lf +4")
        .setLabel("Lf members")
        .setMaxLength(2)
        .setMaxLength(1)
        .setStyle(TextInputStyle.Short)

    const partySlotRow = new ActionRowBuilder()
        .addComponents(partySlotsTextInput)

    const partySlotsModal = new ModalBuilder()
        .setCustomId("party-slots-modal")
        .setTitle("How many party members are you looking for?")
        .addComponents(partySlotRow)

    await reply.edit({embeds: [embedDraftList], components: [selectDraftRow]});

    const selectCollector = await fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300_000
    });

    const buttonCollector = await fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300_000
    });

    let slot = null;

    const internalCooldowns = new Collection();
    const intcd = 5_000;

    selectCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isStringSelectMenu()) return;

        slot = Number(selectInteraction.values[0]);
        const partyObj = draftsData.find(r => r.slot == slot);

        partyObj.slots = partyObj.size - 1;

        await reply.edit({
            flags: MessageFlags.Ephemeral,
            embeds: [draftEmbedBuilder(partyObj)],
            components: [selectDraftRow, new ActionRowBuilder().addComponents(sendButton, setSlotsButton)]
        });

        await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Selected slot ${slot}`});
    });

    buttonCollector.on("collect", async (buttonInteraction) => {
        if(!buttonInteraction.isButton()) return;

        const usercd = hasCooldown(buttonInteraction.user.id, internalCooldowns, intcd);

        if(usercd) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You are pressing the buttons too fast! <t:${parseInt(usercd / 1000)}:R>`
            });
        }

        internalCooldowns.set(buttonInteraction.user.id, Date.now());
        setTimeout(() => internalCooldowns.delete(buttonInteraction.user.id), intcd);

        const partyObj = draftsData.find(r => r.slot == slot);

        switch(buttonInteraction.customId) {
            case "send-button":
                if(buttonInteraction.member.voice.channelId != createLobbyChannel.id) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `You must be in the ${createLobbyChannel} voice channel to do that.`
                    });
                }

                // if the user is a party owner, block his request
                const {rows: partyRoomData} = await poolConnection.query(`SELECT EXISTS
                    (SELECT 1 FROM partyroom WHERE guild=$1 AND owner=$2)`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                if(partyRoomData[0].exists) {
                    // if the party member is also the owner
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `You do already have an active party, close it before creating a new one!`
                    });
                }

                const userSendCooldown = hasCooldown(buttonInteraction.user.id, cooldowns, cd);

                let onCooldownContent = `You are still on cooldown, you must wait before creating a new LFG - <t:${parseInt(userSendCooldown / 1000)}:R>`

                if(!isPremiumMember[0].exists)
                    onCooldownContent += `\nThe premium cooldown is shorter! <t:${parseInt((cooldowns.get(buttonInteraction.user.id) + 600_000) / 1000)}:R>`;
                    
                if(userSendCooldown) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: onCooldownContent
                    });
                }

                cooldowns.set(buttonInteraction.user.id, Date.now());
                setTimeout(() => cooldowns.delete(buttonInteraction.user.id), cd);

                await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

                const registerParty = async () => {
                    try{
                        await poolConnection.query(`INSERT INTO partyroom (
                                guild, owner, ign, region, gamemode, size, private, minrank, maxrank,
                                reqroles, description, channel, message, hexcolor, timestamp
                            )
                            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                            [
                                buttonInteraction.guild.id, buttonInteraction.member.id, partyObj.ign, partyObj.region,
                                partyObj.gamemode, partyObj.size, partyObj.private, partyObj.minrank, partyObj.maxrank,
                                partyObj.reqroles, partyObj.description, partyObj.channel.id, partyObj.message.id, 
                                partyObj.hexcolor, partyObj.timestamp
                            ]
                        );
                    } catch(err) { console.error(err); }
                }

                // creating the channel

                // doing channel perms if the channel is private
                const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
                    [buttonInteraction.guild.id]
                );

                const channelPerms = [];

                // people blocked by partyowner
                const {rows: blocklist} = await poolConnection.query(`SELECT blocked FROM lfgblock WHERE guild=$1 AND blocker=$2`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                // people that blocked partyowner
                const {rows: blockerslist} = await poolConnection.query(`SELECT blocker FROM lfgblock WHERE guild=$1 AND blocked=$2`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                // denying permissions for blocked
                for(const row of blocklist) {
                    try{
                        channelPerms.push(
                            {
                                id: row.blocked,
                                deny: [
                                        PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
                                        PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                                ]
                            }
                        )
                    }catch(err) { console.error(err) };
                }

                // denying permissions for blockers
                for(const row of blockerslist) {
                    try{
                        channelPerms.push(
                            {
                                id: row.blocker,
                                deny: [
                                    PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
                                    PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                                ]
                            }
                        )
                    } catch(err) { console.error(err) };
                }

                if(partyObj.private) {
                    channelPerms.push(
                        {
                            id: buttonInteraction.guild.roles.everyone.id,
                            deny: [
                                PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
                                PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                            ]
                        },
                        {
                            id: staffRoleData[0].role, // staff members have access on private channels
                            allow: [
                                PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.Connect,
                                PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                            ]
                        },
                        {
                            id: buttonInteraction.user.id,
                            allow: [
                                PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.Connect,
                                PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions
                            ]
                        }
                    );
                }

                // fetching the proper category
                const {rows: regionCategoryData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
                    WHERE guild=$1 AND channeltype='category-${partyObj.region}'`, [buttonInteraction.guild.id]);
                const {rows: regionlfgData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
                    WHERE guild=$1 AND channeltype='lfg-${partyObj.region}'`, [buttonInteraction.guild.id]);
                const {rows: regionPingRoleData} = await poolConnection.query(`SELECT role FROM serverroles 
                    WHERE guild=$1 AND roletype='lfg-${partyObj.region}'`, [buttonInteraction.guild.id]);
                const {rows: [{countparties}]} = await poolConnection.query(`SELECT COUNT(*) AS countparties FROM
                        partyroom WHERE guild=$1 AND gamemode=$2 AND region=$3`,
                        [buttonInteraction.guild.id, partyObj.gamemode, partyObj.region]
                    );

                const regionCategory = await buttonInteraction.guild.channels.fetch(regionCategoryData[0].channel);
                const regionLFG = await buttonInteraction.guild.channels.fetch(regionlfgData[0].channel);

                const pingRole = await buttonInteraction.guild.roles.fetch(regionPingRoleData[0].role);
                
                partyObj.channel = await buttonInteraction.guild.channels.create({
                    name: `${id2gamemode[partyObj.gamemode]} [${Number(countparties) + 1}]`,
                    type: ChannelType.GuildVoice,
                    permissionOverwrites: channelPerms,
                    parent: regionCategory,
                    userLimit: partyObj.size
                });

                partyCooldowns.set(partyObj.channel.id, cd);
                setTimeout(() => partyCooldowns.delete(partyObj.channel.id), cd);

                partyObj.timestamp = parseInt(Date.now() / 1000);

                // moving the member to the party channel
                await buttonInteraction.member.voice.setChannel(partyObj.channel);

                const lfgEmbed = draftEmbedBuilder(partyObj);
                lfgEmbed
                    .addFields({name: "Voice", value: `${partyObj.channel}`})
                    .setTimestamp()
                    .setFooter({text:`OWNER ID: ${buttonInteraction.user.id}`})
                    .setDescription(partyObj.description);
                
                await buttonInteraction.editReply({flags: MessageFlags.Ephemeral, content: `Party created successfully\nChannel: ${partyObj.channel}\nLFG: ${regionLFG}`});
                
                const messageBody = {
                    content: `${pingRole}`,
                    embeds: [lfgEmbed],
                    components: [lfg_buttons(partyObj.private)]    
                }
                

                partyObj.message = await regionLFG.send(messageBody);
                await registerParty();
                await lfg_collector(partyObj.message);
                    // lfg history
                await poolConnection.query(`INSERT INTO partyhistory(
                        guild, owner, ign, region, gamemode, size, private, minrank, maxrank, reqroles,
                        description, timestamp
                    )
                    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        buttonInteraction.guild.id, buttonInteraction.user.id, partyObj.ign, partyObj.region,
                        partyObj.gamemode, partyObj.size, partyObj.private, partyObj.minrank, partyObj.maxrank,
                        partyObj.reqroles, partyObj.description, partyObj.timestamp
                    ]
                );

                if(logChannel) {
                    // logs for creation of the party
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setAuthor({
                                    name: `[${partyObj.region.toUpperCase()}] ${buttonInteraction.user.username} party`,
                                    iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                                })
                                .setTimestamp()
                                .setFooter({text: `ID: ${buttonInteraction.user.id}`})
                                .setTitle("Party Created")
                                .addFields(
                                    {
                                        name: "Gamemode",
                                        value: id2gamemode[partyObj.gamemode]
                                    },
                                    {
                                        name: "Owner",
                                        value: `${buttonInteraction.user}`
                                    },
                                    {
                                        name: "IGN",
                                        value: partyObj.ign
                                    },
                                    {
                                        name: "Description",
                                        value: `${partyObj.description || "None"}`
                                    }
                                )
                        ]
                    });
                }
                selectCollector.stop();
            break;
            case "set-slots-button":
                await buttonInteraction.showModal(partySlotsModal);
                try {
                    const submitSlots = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });

                    const partySlots = submitSlots.fields.getTextInputValue("party-slots-input");
                    if(Number.isNaN(Number(partySlots))) {
                        return await submitSlots.reply({flags: MessageFlags.Ephemeral, content: "The input given is not a number."});
                    }

                    if(Number(partySlots) < 1 || Number(partySlots) > partyObj.size - 1) {
                        return await submitSlots.reply({
                            flags: MessageFlags.Ephemeral,
                            content: `You must provide a number between 1 and ${partyObj.size - 1}.`
                        })
                    }

                    partyObj.slots = partySlots;

                    await reply.edit({embeds: [draftEmbedBuilder(partyObj)]});
                    await submitSlots.reply({flags: MessageFlags.Ephemeral, content: `Looking for +${partyObj.slots}`});
                } catch(err) {
                    return await buttonInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Timed out, try again."});
                }

            break;
        }
        
    });


    selectCollector.on("end", async () => {
        try{
            await reply.delete();
        } catch(err) {};

        buttonCollector.stop();
    })



}

async function close_party_button(interaction) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const {rows: partyData} = await poolConnection.query(`SELECT * FROM partyroom WHERE guild=$1 AND owner=$2`,
        [interaction.guild.id, interaction.member.id]
    );

    if(partyData.length == 0) {
        return await interaction.editReply({flags: MessageFlags.Ephemeral, content: "You don't own a party."})
    }
    
    // logs
    const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype='lfg-logs'`,
        [interaction.guild.id]
    );

    let logChannel = null;

    try{
        logChannel = await interaction.guild.channels.fetch(logChannelData[0].channel);
    } catch(err) {
        console.error(err);
    }

    const {rows: lfgChannelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel 
        WHERE guild=$1 AND channeltype='lfg-${partyData[0].region}'`, [interaction.guild.id])

    const lfgChannel = await interaction.guild.channels.fetch(lfgChannelData[0].channel);
    const partyOwner = await interaction.guild.members.fetch(partyData[0].owner);

    try{
        const partyThread = await lfgChannel.threads.cache.find(t => t.name === `${partyOwner.user.username}-party`);
        await partyThread.delete();
    } catch(err) {};

    try{
        const message = await lfgChannel.messages.fetch(partyData[0].message);
        await message.delete();
    } catch(err) {};
    
    try{
        const channel = await interaction.guild.channels.fetch(partyData[0].channel);
        await channel.delete();
    } catch(err) {};

    if(logChannel) {
        await logChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor("Red")
                    .setAuthor({
                        name: `[${partyData[0].region.toUpperCase()}] ${partyOwner.user.username} party`,
                        iconURL: partyOwner.displayAvatarURL({extension: "png"})
                    })
                    .setTimestamp()
                    .setFooter({text: `Owner ID: ${partyOwner.id}`})
                    .setTitle("Party Closed")
                    .addFields(
                        {
                            name: "Created",
                            value: `<t:${partyData[0].timestamp}:R>`
                        },
                        {
                            name: "Closed by",
                            value: `${interaction.member}`
                        },
                        {
                            name: "Gamemode",
                            value: id2gamemode[partyData[0].gamemode]
                        },
                        {
                            name: "IGN",
                            value: partyData[0].ign
                        },
                        {
                            name: "Description",
                            value: `${partyData[0].description || "None"}`
                        }
                    )
            ]
        });
    }

    await poolConnection.query(`DELETE FROM partyroom WHERE guild=$1 AND owner=$2`, [interaction.guild.id, interaction.member.id]);
    return await interaction.editReply({flags: MessageFlags.Ephemeral, content: "Party closed"});
}

async function preferences_button(interaction, blockCDs, blockCD) {
    const reply = await interaction.deferReply({flags: MessageFlags.Ephemeral});
    const fetchedReply = await interaction.fetchReply();

    const preferencesEmbed = new EmbedBuilder()
        .setColor("Aqua")
        .setAuthor({name: `${interaction.user.username} LFG Preferences`, iconURL: interaction.user.displayAvatarURL({extension: "png"})})
        .setFields(
            {
                name: "Notify",
                value: "Manage your notification settings."
            },
            {
                name: "Block list",
                value: "All the people you lfg blocked"
            },
            {
                name: "Block/Unblock",
                value: "Block/Unblock someone from your LFG parties."
            },
            
        )

    const {rows: pingRolesData} = await poolConnection.query(`SELECT role, roletype FROM serverroles 
        WHERE guild=$1 AND roletype='lfg-eune' OR roletype='lfg-euw'`,
        [interaction.guild.id]
    );

    const selectPingOptions = [];
    pingRolesData.forEach((row) => {
        selectPingOptions.push(
            {
                label: `#${row.roletype}`,
                value: `${row.roletype}`,
                description: `Enable / Disable pings for #${row.roletype}`
            }
        )
    });

    
    const blockUnblockButton = new ButtonBuilder()
        .setCustomId("block-unblock-button")
        .setLabel("Block/Unblock")
        .setStyle(ButtonStyle.Danger)

    const blocklistButton = new ButtonBuilder()
        .setCustomId("block-list-button")
        .setLabel("Block list")
        .setStyle(ButtonStyle.Secondary)

    const notifyButton = new ButtonBuilder()
        .setCustomId("notify-button")
        .setLabel("Notify")
        .setStyle(ButtonStyle.Secondary)

    const preferencesButtonsRow = new ActionRowBuilder()
        .addComponents(notifyButton, blocklistButton, blockUnblockButton)

    const userSelectMenu = new UserSelectMenuBuilder()
        .setCustomId("user-select-menu")
        .setPlaceholder("Select an user to block/unblock")
        .setMinValues(1)
        .setMaxValues(1)

    const selectNotification = new StringSelectMenuBuilder()
        .setCustomId("select-notification-row")
        .setPlaceholder("Select the type of notification you want to enable/disable.")
        .setMinValues(1)
        .setMaxValues(2)
        .addOptions(selectPingOptions)

    const userSelectRow = new ActionRowBuilder()
        .addComponents( userSelectMenu );

    const selectNotificationRow = new ActionRowBuilder()
        .addComponents( selectNotification )

    // internal cooldowns
    const internalCooldowns = new Collection();
    const intcd = 3_000;

    await reply.edit({
        embeds:  [preferencesEmbed],
        components: [ preferencesButtonsRow ]
    });

    const buttonCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300_000
    });

    const userCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.UserSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300_000
    });

    const selectCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300_000
    })

    buttonCollector.on("collect", async (buttonInteraction) => {
        if(!buttonInteraction.isButton()) return;

        // internal buttons cooldown
        const userIntCD = hasCooldown(buttonInteraction.user.id, internalCooldowns, intcd);
        if(userIntCD) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You are pressing buttons too fast! <t:${parseInt(userIntCD / 1000)}:R>`
            });
        }
        internalCooldowns.set(buttonInteraction.user.id, Date.now());
        setTimeout(() => internalCooldowns.delete(buttonInteraction.user.id), intcd);

        switch(buttonInteraction.customId) {
            case "block-unblock-button":
                // checking cooldown
                const userBlockCD = hasCooldown(buttonInteraction.user.id, blockCDs, blockCD);

                if(userBlockCD) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `Your block button is on cooldown! <t:${parseInt(userBlockCD / 1000)}:R>`
                    });
                }

                blockCDs.set(buttonInteraction.user.id, Date.now());
                setTimeout(() => blockCDs.delete(buttonInteraction.user.id), blockCD);

                await reply.edit({components: [preferencesButtonsRow, userSelectRow]});
                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "Selecting a member will block/unblock them from joining your party from now on."
                });
            break;
            case "block-list-button":
                await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

                // fetching the block list of the member
                const {rows: blockListData} = await poolConnection.query(`SELECT * FROM lfgblock
                    WHERE guild=$1 AND blocker=$2 ORDER BY id DESC`,
                    [buttonInteraction.guild.id, buttonInteraction.user.id]
                )

                let embedBlockList = new EmbedBuilder()
                    .setColor("Red")
                    .setAuthor({
                        name: `${buttonInteraction.user.username} LFG block list`, 
                        iconURL: buttonInteraction.user.displayAvatarURL({extension: "png"})
                    });

                if(blockListData.length == 0) {
                    return await buttonInteraction.editReply({
                        embeds: [embedBlockList.setDescription("The list is empty.")]
                    });
                }
                
                const embedListArray = [];

                let description = ""; // 4096 character limit
                let counter = 0;

                for(const row of blockListData) {
                    ++counter;
                    let member = null;
                    try{
                        member = await buttonInteraction.guild.members.fetch(row.blocked);
                    } catch(err) { continue; }

                    if(!member) continue; // making sure that non guild members are not included

                    const memberString = `${member}, `;

                    if(counter == blockListData.length) {
                        // got to the last row
                        description += memberString.slice(0, -2);
                        embedListArray.push( embedBlockList.setDescription(description) );
                        
                    } else if(description.length + memberString.length < 4096) {
                        // if the description does not exceed the limit
                        description += memberString;
                    } else if(description.length + memberString.length >= 4096) {
                        // when it exceeds the character limit
                        embedListArray.push( embedBlockList.setDescription(description) );
                        description = memberString;
                        embedBlockList = new EmbedBuilder()
                            .setColor("Red");
                    }
                }

                for(const i in embedListArray) {
                    await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        embeds: [ embedListArray[i] ]
                    })
                }
                
            break;
            case "notify-button":
                await reply.edit({components: [preferencesButtonsRow, selectNotificationRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "Select the notification roles for your region."});
            break;

        }
    });

    userCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isUserSelectMenu()) return;
        
        if(selectInteraction.user.id === selectInteraction.values[0]) {
            return await selectInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You can not select yourself!"
            });
        }
        switch(selectInteraction.customId) {
            case "user-select-menu":
                const member = await selectInteraction.guild.members.fetch(selectInteraction.values[0]);

                const {rows: isAlreadyBlocked} = await poolConnection.query(`SELECT EXISTS
                    (SELECT 1 FROM lfgblock WHERE guild=$1 AND blocker=$2 AND blocked=$3)`,
                    [selectInteraction.guild.id, selectInteraction.user.id, member.id]
                );

                if(isAlreadyBlocked[0].exists) {
                    // if the member is already blocked, unblock them.

                    await poolConnection.query(`DELETE FROM lfgblock 
                        WHERE guild=$1 AND blocker=$2 AND blocked=$3`,
                        [selectInteraction.guild.id, selectInteraction.user.id, member.id]
                    );

                    await reply.edit({components: [ preferencesButtonsRow ]});
                    await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `You have unblocked ${member} from joining your party in the future.`
                    });
                } else {
                    // else if the member is not blocked, block them

                    await poolConnection.query(`INSERT INTO lfgblock(guild, blocker, blocked) VALUES($1, $2, $3)`,
                        [selectInteraction.guild.id, selectInteraction.user.id, member.id]
                    );
                    
                    await reply.edit({components: [ preferencesButtonsRow ]});

                    await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `You have blocked ${member} from joining your party in the future.`
                    });

                }
            break;
        }
        
    });

    selectCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isStringSelectMenu()) return;
        await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});

        const member = selectInteraction.member;
        let roles = {added: [], removed: []};
        for(const roletype of selectInteraction.values) {
            const row = pingRolesData.find(r => r.roletype === roletype);
            const roleid = row.role;

            if(await member.roles.cache.has(roleid)) {
                roles.removed.push(`<@&${roleid}>`);
                await member.roles.remove(roleid);
            } else {
                roles.added.push(`<@&${roleid}>`);
                await member.roles.add(roleid);
            }
        }
        await selectInteraction.editReply({
            content: `Ping roles updated\nAdded: ${roles.added.join(', ') || "None"}\nRemoved: ${roles.removed.join(", ") || "None"}`
        });
        
        await reply.edit({components: [preferencesButtonsRow]});

    })

    buttonCollector.on("end", async () => {
        try{
            await reply.edit({
                content: "Preferences menu timed out, start a new one if needed.",
                components: []
            });
        } catch(err) {};
        userCollector.stop();
        selectCollector.stop();
    })
        
}

async function manage_party_button(interaction, cooldowns, partyCooldowns, changeGamemodeCooldowns, cd) {
    const reply = await interaction.deferReply({flags: MessageFlags.Ephemeral});
    const fetchedReply = await interaction.fetchReply();

    // checking if the member is a party owner and fetching the party data
    const {rows: partyRoomData} = await poolConnection.query(`SELECT * FROM partyroom WHERE guild=$1 AND owner=$2`,
        [interaction.guild.id, interaction.user.id]
    );

    if(partyRoomData.length == 0) {
        return await reply.edit({
            content: "You don't own a party room to manage! `Create` one first."
        });
    }

    let selectedgamemode = partyRoomData[0].gamemode;

    let partyChannel = null;

    try{
        partyChannel = await interaction.guild.channels.fetch(partyRoomData[0].channel);
    } catch(err) {
        console.error(err);
        return await reply.edit({
            content: "There was an error while trying to fetch the party room voice channel."
        });
    }

    if(interaction.member.voice.channelId != partyChannel.id) {
        return await reply.edit({
            content: `You must be in your party voice channel to do that! ${partyChannel}`
        });
    }


    //fetching blocked blocker data
    // blockers are the members that blocked the user
    const {rows: blockerData} = await poolConnection.query(`SELECT blocker FROM lfgblock WHERE guild=$1 AND blocked=$2`,
        [interaction.guild.id, interaction.user.id]
    );
    // blocked are members blocked by the user
    const {rows: blockedData} = await poolConnection.query(`SELECT blocked FROM lfgblock WHERE guild=$1 AND blocker=$2`,
        [interaction.guild.id, interaction.user.id]
    );

    // logs
    const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs
        WHERE guild=$1 AND eventtype=$2`, [interaction.guild.id, "lfg-logs"]);

    let logChannel = null;

    try{
        logChannel = await oldState.guild.channels.fetch(logChannelData[0].channel);
    } catch(err) {};

    // if the member is premium, bump cooldown is lowe
    const {rows: isPremiumData} = await poolConnection.query(`SELECT EXISTS
        (SELECT 1 FROM premiummembers WHERE guild=$1 AND member=$2)`,
        [interaction.guild.id, interaction.user.id]
    );

    const {rows: mainLobbyData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
        WHERE guild=$1 AND channeltype='main-lobby'`, [interaction.guild.id]);

    if(mainLobbyData.length == 0) {
        return await reply.edit({content: "The lobby voice channel could not be found."});
    }

    let createLobbyChannel = null;

    try{
        createLobbyChannel = await interaction.guild.channels.fetch(mainLobbyData[0].channel);
    } catch(err) {
        return await reply.edit({content: "Wrong lfg channel configuration."});
    }

    const {rows: lfgChannelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
        WHERE guild=$1 AND channeltype='lfg-${partyRoomData[0].region}'`,
        [interaction.guild.id]
    );

    const lfgChannel = await interaction.guild.channels.fetch(lfgChannelData[0].channel);

    if(isPremiumData[0].exists) {
        cd = 600_000;
    }


    const manager_embed = () => {
        const manageEmbed = new EmbedBuilder()
            .setColor(partyRoomData[0].hexcolor)
            .setAuthor({
                name: `[${partyRoomData[0].region.toUpperCase()}] ${interaction.user.username} party manager`,
                iconURL: interaction.user.displayAvatarURL({extension: "png"})
            })
            .setTitle("Manage your party room")
            .addFields(
                {
                    name: "Use the buttons to manage your party room",
                    value: `**Bump LFG**\nReposts your message and deletes the previous one
                    **Add/Remove Access**\nGive or remove someone's permission to join the voice channel.
                    **Transfer Ownership**\nTransfer ownership to someone from the party.

                    **IGN**\nChange the summoner name.
                    **Roles**\nChange the roles required in your party.
                    **Private Toggle**\nWhether your party is private or public.
                    **Lf Slots**\nFor how many members you are looking for.
                    **Info**\nChange the LFG description.
                    **Color**\nChange the color of your LFG message (premium only).
                    `
                }
            )

        return manageEmbed;
    }

    const partyEmbedRefresh = (partyObj, user) => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `[${partyObj.region.toUpperCase()}] ${user.username} ${partyObj.private ? "private" : "public"} party`,
                iconURL: user.displayAvatarURL({extension: "png"})
            })
            .setColor(partyObj.hexcolor)
            .setFields(
                {
                    name: "Gamemode",
                    value: id2gamemode[partyObj.gamemode]
                },
                {
                    name: "Owner",
                    value: `${user}`
                },
                {
                    name: "IGN",
                    value: partyObj.ign
                },
                {
                    name: "Looking for",
                    value: `+${partyObj.lfmembercount}`
                },
                {
                    name: "Roles Required",
                    value: `${partyObj.reqroles.length ? partyObj.reqroles.map(r => r.toUpperCase()).join(", ") : "Any"}`
                }
            )
            .setFooter({text: `OWNER ID: ${partyObj.owner}`})
            .setTimestamp()
        
        if(partyObj.gamemode < 3)
            embed.addFields(
                {
                    name: "Rank range",
                    value: `${id2rank[partyObj.minrank]} - ${id2rank[partyObj.maxrank]}`
                }
            )
        
        if(partyObj.description != null)
            embed.setDescription(partyObj.description);

        if(partyObj.channel != null)
            embed.addFields({name: "Voice", value: `${partyObj.channel}`});
        return embed;
    }

    const partyObjBuilder = (owner, ign, region, gamemode, private, hexcolor, lfmembercount, reqroles, minrank, maxrank, description, channel) => {
        return {
            owner: owner,
            ign: ign,
            region: region,
            gamemode: gamemode,
            private: private,
            hexcolor: hexcolor,
            lfmembercount: lfmembercount,
            reqroles: reqroles,
            minrank: minrank,
            maxrank: maxrank,
            description: description,
            channel: channel
        }
    }

    // buttons

    const bumpMessageButton = new ButtonBuilder()
        .setCustomId("bump-button")
        .setStyle(ButtonStyle.Success)
        .setLabel("Bump LFG")

    const addRemoveAccessButton = new ButtonBuilder()
        .setCustomId("add-remove-access")
        .setStyle(ButtonStyle.Danger)
        .setLabel("Add/Remove Access")

    const transferOwnershipButton = new ButtonBuilder()
        .setCustomId("transfer-ownership-button")
        .setStyle(ButtonStyle.Danger)
        .setLabel("Transfer ownership")
    
    const changeIgnButton = new ButtonBuilder()
        .setCustomId("change-ign-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("IGN")

    const changeGamemodeButton = new ButtonBuilder()
        .setCustomId("change-gamemode-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Gamemode")

    const changeRolesButton = new ButtonBuilder()
        .setCustomId("change-roles-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Roles")

    const changeColorButton = new ButtonBuilder()
        .setCustomId("change-color-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Color")
        .setDisabled(!isPremiumData[0].exists)
    
    const changeDescriptionButton = new ButtonBuilder()
        .setCustomId("change-description-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Info")

    const changeLfMembersButton = new ButtonBuilder()
        .setCustomId("change-lf-button")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Lf Slots")

    const togglePrivateButton = new ButtonBuilder()
        .setCustomId("toggle-private-button")
        .setLabel("Private Toggle")
        .setStyle(ButtonStyle.Secondary)

    const changeRoomSize = new ButtonBuilder()
        .setCustomId("change-size")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Room Size")

    const firstRow = new ActionRowBuilder()
        .addComponents(bumpMessageButton, addRemoveAccessButton, transferOwnershipButton);

    const secondRow = new ActionRowBuilder()    
        .addComponents(changeGamemodeButton, changeIgnButton, changeRolesButton, togglePrivateButton, changeLfMembersButton)

    const thirdRow = new ActionRowBuilder()
        .addComponents(changeDescriptionButton, changeColorButton, changeRoomSize)


    // select menu
    const selectColor = new StringSelectMenuBuilder()
        .setCustomId("select-color")
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder("Give some color to your party!")
        .addOptions(colorSelectOptions)

    const userSelectMenu = new UserSelectMenuBuilder()
        .setCustomId("user-select-menu")
        .setPlaceholder("Add/Remove access from the selected users")
        .setMinValues(1)
        .setMaxValues(10 <= partyChannel.userLimit ? 10 : partyChannel.userLimit)

    const transferOwnershipSelect = new StringSelectMenuBuilder()
        .setCustomId("transfer-ownership-select")
        .setPlaceholder("Select the party member to be designated as owner")
        .setMinValues(1)
        .setMaxValues(1)

    const selectGamemode = new StringSelectMenuBuilder()
		.setCustomId('select-gamemode')
		.setPlaceholder('Pick a gamemode...')
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions(gamemodeSelectOptions);
    
    const selectRanks = new StringSelectMenuBuilder()
        .setCustomId("select-ranks")
        .setPlaceholder("Select min/max ranks...")
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(rankOptions)

    const selectReqRoles = new StringSelectMenuBuilder()
        .setCustomId("select-req-roles")
        .setPlaceholder("Select the roles you are looking for...")
        .setMinValues(1)
        .setMaxValues(5)
        .addOptions(roleSelectOptions)

    const selectGamemodeActionRow = new ActionRowBuilder()
        .addComponents(selectGamemode);

    const selectRanksActionRow = new ActionRowBuilder()
        .addComponents(selectRanks);

    const selectReqRolesActionRow = new ActionRowBuilder()
        .addComponents(selectReqRoles);

    const userSelectRow = new ActionRowBuilder()
        .addComponents( userSelectMenu );

    const selectMembersOwnershipRow = new ActionRowBuilder()
        .addComponents(transferOwnershipSelect)

    const selectColorsRow = new ActionRowBuilder()
        .addComponents(selectColor);
    
    // modals
    const changeSizeInput = new TextInputBuilder()
        .setCustomId("room-size-input")
        .setRequired(true)
        .setPlaceholder("5...")
        .setLabel("Voice Room Size")
        .setMinLength(1)
        .setMaxLength(2)
        .setStyle(TextInputStyle.Short)
    const roomSizeRow = new ActionRowBuilder()
        .addComponents(changeSizeInput)
    const roomSizeModal = new ModalBuilder()
        .setTitle("Party Room Size")
        .setCustomId("room-size-modal")
        .addComponents(roomSizeRow)

    const ignTextInput = new TextInputBuilder()
        .setCustomId("ign-text-input")
        .setRequired(true)
        .setPlaceholder("example#tag")
        .setLabel("Summoner Name")
        .setMaxLength(22)
        .setMinLength(3)
        .setStyle(TextInputStyle.Short)
    const ignRow = new ActionRowBuilder()
        .addComponents(ignTextInput)

    const ignModal = new ModalBuilder()
        .setTitle("In-game name")
        .setCustomId("ign-modal")
        .addComponents(ignRow)

    const partySizeInput = new TextInputBuilder()
        .setRequired(true)
        .setPlaceholder("Number...")
        .setCustomId("party-size-input")
        .setLabel("Party size")
        .setMaxLength(2)
        .setMinLength(1)
        .setStyle(TextInputStyle.Short)
    
    const partySizeModalRow = new ActionRowBuilder()
        .addComponents(partySizeInput);

    const partySizeModal = new ModalBuilder()
        .setCustomId("party-size-modal")
        .setTitle("What's the party size?")
        .addComponents(partySizeModalRow);

    const descriptionTextInput = new TextInputBuilder()
        .setCustomId("description-text-input")
        .setRequired(true)
        .setLabel("Description")
        .setMaxLength(300)
        .setMinLength(4)
        .setStyle(TextInputStyle.Paragraph)

    const hexcolorInput = new TextInputBuilder()
        .setCustomId("hexcolor-input")
        .setLabel("Provide the 6 digits hexcolor for your role.")
        .setPlaceholder("Example: 9A00FF")
        .setMaxLength(6)
        .setMinLength(6)
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

    const hexcolorInputRow = new ActionRowBuilder()
        .addComponents(hexcolorInput);

    const hexcolorModal = new ModalBuilder()
        .setCustomId("hexcolor-modal")
        .setTitle("Set your custom hexcolor")
        .addComponents(hexcolorInputRow);

    const addInfoRow = new ActionRowBuilder().addComponents(descriptionTextInput)

    const addInfoModal = new ModalBuilder()
        .setCustomId("add-info-modal")
        .setTitle("Add information")
        .addComponents(addInfoRow);

    await reply.edit({
        embeds: [manager_embed()],
        components: [firstRow, secondRow, thirdRow]
    });

    const buttonCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: (i) => i.user.id === partyRoomData[0].owner,
        time: 300_000
    });

    const selectUserCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.UserSelect,
        filter: (i) => i.user.id === partyRoomData[0].owner,
        time: 300_000
    });

    const selectCollector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === partyRoomData[0].owner,
        time: 300_000
    });

    // button cooldowns
    const internalCooldowns = new Collection();
    const internalcooldown = 10_000;

    buttonCollector.on("collect", async (buttonInteraction) => {
        if(buttonInteraction.member.voice.channelId != partyChannel.id) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You need to be in ${partyChannel} voice channel to do that!`
            });
        }
        if(!buttonInteraction.isButton()) return;

        const userInternalCooldown = hasCooldown(buttonInteraction.user.id, internalCooldowns, internalcooldown);

        if(userInternalCooldown) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You are pressing buttons too fast! <t:${parseInt(userInternalCooldown / 1000)}:R>`
            });
        }

        internalCooldowns.set(buttonInteraction.user.id, Date.now());
        setTimeout(() => internalCooldowns.delete(buttonInteraction.user.id), internalcooldown);

        switch(buttonInteraction.customId) {
            case "change-size":
                await buttonInteraction.showModal(roomSizeModal);
                try{
                    const submitSize = await buttonInteraction.awaitModalSubmit({
                        time: 120_000,
                        filter: (i) => i.user.id === buttonInteraction.user.id
                    });

                    const size = submitSize.fields.getTextInputValue("room-size-input");

                    if(Number.isNaN(Number(size))) {
                        return await submitSize.reply({
                            flags: MessageFlags.Ephemeral,
                            content: "Invalid input. The input given is not a number!"
                        });
                    }

                    if(Number(size) > 99 || Number(slots) < 2) {
                        return await submitSlots.reply({
                            flags: MessageFlags.Ephemeral,
                            content: `Number given must be between 2 and 99`
                        });
                    }

                    await partyChannel.setUserLimit(Number(size));
                    await submitSize.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `Party room voice size set to ${size}.`
                    });
                } catch(err) {
                    return await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Something went wrong or the interaction timed out."
                    });
                }
            break;
            case "bump-button":
                if(partyChannel.members.size === partyChannel.userLimit) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "Your party is already full, there is no need to bump!"
                    })
                }

                const userCooldown = hasCooldown(buttonInteraction.user.id, cooldowns, cd);
                const partyCooldown = hasCooldown(partyChannel.id, partyCooldowns, cd);

                if(partyCooldown) {
                    let response = `The party is still on cooldown, you must wait before bumping the LFG - <t:${parseInt(partyCooldown / 1000)}:R>`
                    if(!isPremiumData[0].exists)
                        response += `\nThe premium cooldown is shorter! <t:${parseInt((partyCooldowns.get(partyChannel.id) + 600_000) / 1000)}:R>`

                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: response
                    });
                }

                if(userCooldown) {
                    let response = `You or the party are still on cooldown, you must wait before bumping the LFG - <t:${parseInt(userCooldown / 1000)}:R>`
                    if(!isPremiumData[0].exists)
                        response += `\nThe premium cooldown is shorter! <t:${parseInt((cooldowns.get(buttonInteraction.user.id) + 600_000) / 1000)}:R>`

                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: response
                    });
                }

                cooldowns.set(buttonInteraction.user.id, Date.now());
                partyCooldowns.set(partyChannel.id, Date.now());

                setTimeout(() => {
                    cooldowns.delete(buttonInteraction.user.id);
                    partyCooldowns.delete(partyChannel.id);
                
                }, cd);

                await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

                const partyObj = partyObjBuilder(
                    partyRoomData[0].owner,
                    partyRoomData[0].ign, partyRoomData[0].region, partyRoomData[0].gamemode, partyRoomData[0].private,
                    partyRoomData[0].hexcolor, partyChannel.userLimit - partyChannel.members.size, partyRoomData[0].reqroles,
                    partyRoomData[0].minrank, partyRoomData[0].maxrank, partyRoomData[0].description, partyChannel
                );

                const {rows: pingRoleData} = await poolConnection.query(`SELECT role FROM serverroles
                        WHERE guild=$1 AND roletype='lfg-${partyObj.region}'`,
                        [buttonInteraction.guild.id]
                    );

                const pingRole = await buttonInteraction.guild.roles.fetch(pingRoleData[0].role);
                
                const oldMessage = await lfgChannel.messages.fetch(partyRoomData[0].message);

                const bumpMessageBody = {
                    embeds: [partyEmbedRefresh(partyObj, buttonInteraction.user)],
                    components: [lfg_buttons(partyObj.private)],
                    content: `${pingRole}`
                }

                partyObj.message = await lfgChannel.send(bumpMessageBody); // resending the message
                partyRoomData[0].message = partyObj.message.id;
                await poolConnection.query(`UPDATE partyroom SET message=$1
                    WHERE guild=$2 AND owner=$3`,
                    [partyObj.message.id, buttonInteraction.guild.id, buttonInteraction.user.id]
                ); // updating database

                try{
                    await oldMessage.delete();
                } catch(err) {};

                await lfg_collector(partyObj.message); // starting the collector for the new message

                await buttonInteraction.editReply({
                    content: `Bumped! ${partyObj.message.url}`
                });

                if(logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setAuthor({
                                    name: `[${partyObj.region.toUpperCase()}] ${buttonInteraction.user.username} party`,
                                    iconURL: buttonInteraction.member.displayAvatarURL({extension: "png"})
                                })
                                .setTitle("LFG Bump")
                                .setFooter({text: `Owner ID: ${buttonInteraction.user.id}`})
                                .setTimestamp()
                                .setDescription(`Created <t:${partyRoomData[0].timestamp}:R>`)
                        ]
                    });
                }

            break;
            case "add-remove-access":
                await reply.edit({
                    components: [firstRow, secondRow, thirdRow, userSelectRow]
                });
                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "Add/Remove someone's access from your party."
                });
            break;
            case "transfer-ownership-button":
                if(partyChannel.members.size < 2) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "You have no one to transfer your ownership to."
                    });
                }

                const selectMembersOptions = [];

                partyChannel.members.forEach((member) => {
                    if(member.id != buttonInteraction.user.id)
                        selectMembersOptions.push(
                            {
                                label: `${member.displayName}`,
                                value: `${member.id}`,
                                description: `Transfer the party to ${member.displayName}`
                            }
                        )
                });

                transferOwnershipSelect.setOptions(selectMembersOptions);

                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "**Select the member you want designated as party owner**."
                });

                await reply.edit({components: [firstRow, secondRow, thirdRow, selectMembersOwnershipRow]});
            break;
            case "change-ign-button":
                await buttonInteraction.showModal(ignModal);
                let oldIgn = partyRoomData[0].ign;
                try{
                    const submitIgn = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });
                    const ignRegex = /^.{3,16}#.{3,5}$/;
                    const ign = submitIgn.fields.getTextInputValue("ign-text-input");
                    if(!ignRegex.test(ign)) {
                        return await submitIgn.reply({flags: MessageFlags.Ephemeral, content: "The summoner name format is invalid. <3-16 characters>#<3-5 characters>"})
                    }

                    partyRoomData[0].ign = ign;

                    await submitIgn.reply({flags: MessageFlags.Ephemeral, content: `IGN set to **${ign}**`});
                } catch(err) {
                    await buttonInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."})
                }

                let message = null;

                try{
                    message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                } catch(err) {
                    return await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Failed to fetch the message."
                    });
                };

                const changeIgnPartyObj = partyRoomData[0];
                changeIgnPartyObj.channel = await buttonInteraction.guild.channels.fetch(partyRoomData[0].channel);
                changeIgnPartyObj.lfmembercount = changeIgnPartyObj.channel.userLimit - changeIgnPartyObj.channel.members.size;
                
                try{
                    await message.edit({
                        embeds: [
                            partyEmbedRefresh(changeIgnPartyObj, buttonInteraction.user)
                        ]
                    });
                } catch(err) {
                    return await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "There was an error while trying to edit the summoner name."
                    });
                }

                if(logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setAuthor({
                                    name: `[${partyRoomData[0].region.toUpperCase()}] ${buttonInteraction.user.username} party`,
                                    iconURL: buttonInteraction.member.displayAvatarURL({extension: "png"})
                                })
                                .setTitle("IGN changed")
                                .setFooter({text: `Owner ID: ${buttonInteraction.user.id}`})
                                .setTimestamp()
                                .setFields(
                                    {
                                        name: "From",
                                        value: oldIgn
                                    },
                                    {
                                        name: "To",
                                        value: partyRoomData[0].ign
                                    }
                                )
                        ]
                    });
                }

                await poolConnection.query(`UPDATE partyroom SET ign=$1 WHERE guild=$2 AND owner=$3`,
                    [changeIgnPartyObj.ign, buttonInteraction.guild.id, buttonInteraction.user.id]
                );
            break;
            case "change-gamemode-button":
                const changeOnCooldown = hasCooldown(buttonInteraction.user.id, changeGamemodeCooldowns, 500_000);
                if(changeOnCooldown) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `Changing the gamemode is on cooldown <t:${parseInt(changeOnCooldown / 1000)}:R>`
                    });
                }

                await reply.edit({components: [firstRow, secondRow, thirdRow, selectGamemodeActionRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `Select the gamemode to change the party to.`});
            break;
            case "change-roles-button":
                await reply.edit({components: [firstRow, secondRow, thirdRow, selectReqRolesActionRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "Specify the roles you are looking for in your party."});
            break;
            case "toggle-private-button":
                partyRoomData[0].private = !partyRoomData[0].private;
                const togglePrivatePartyObj = partyRoomData[0];
                togglePrivatePartyObj.channel = partyChannel;
                togglePrivatePartyObj.lfmembercount = partyChannel.userLimit - partyChannel.members.size;

                try{
                    const message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    await message.edit({
                        embeds: [
                            partyEmbedRefresh(togglePrivatePartyObj, buttonInteraction.user)
                        ]
                    });
                } catch(err) {
                    return await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "Something went wrong, maybe the message is missing."
                    });
                }
                
                // if public
                let perms = {
                    SendMessages: true,
                    Connect: true,
                    Speak: true,
                    AddReactions: true,
                    Stream: true
                }

                if(togglePrivatePartyObj.private)
                {
                    perms = { // if private
                        SendMessages: false,
                        Connect: false,
                        Speak: false,
                        AddReactions: false,
                        Stream: false
                    }

                    for(const member of partyChannel.members.values()) {
                        await partyChannel.permissionOverwrites.edit(member.id, 
                            {
                                SendMessages: true,
                                Connect: true,
                                Speak: true,
                                AddReactions: true,
                                Stream: true
                            }
                        )
                    }
                }

                await partyChannel.permissionOverwrites.edit(buttonInteraction.guild.roles.everyone.id, perms);

                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: `Party has been set to ${togglePrivatePartyObj.private ? "Private" : "Public"}`
                });
            break;
            case "change-lf-button":
                await buttonInteraction.showModal(partySizeModal);

                try{
                    const submitSlots = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });

                    const slots = submitSlots.fields.getTextInputValue("party-size-input");

                    if(Number.isNaN(Number(slots))) {
                        return await submitSlots.reply({
                            flags: MessageFlags.Ephemeral,
                            content: "Invalid input. The input given is not a number!"
                        });
                    }

                    if(Number(slots) > (partyChannel.userLimit - partyChannel.members.size) || Number(slots) < 0) {
                        return await submitSlots.reply({
                            flags: MessageFlags.Ephemeral,
                            content: `Number given must be between 0 and party room free slots (0 - ${partyChannel.userLimit - partyChannel.members.size})`
                        });
                    }

                    partyRoomData[0].lfmembercount = Number(slots);

                    await submitSlots.reply({
                        flags: MessageFlags.Ephemeral,
                        content: `Looking for \`+${partyRoomData[0].lfmembercount}\` members`
                    })

                } catch(err) {
                    return await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Modal got timed out. Please try again."
                    });
                }

                const lfslotsPartyObj = partyRoomData[0];
                lfslotsPartyObj.channel = partyChannel;

                try{
                    const message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    await message.edit({
                        embeds: [
                            partyEmbedRefresh(lfslotsPartyObj, buttonInteraction.user)
                        ]
                    });
                } catch(err) {
                    return await buttonInteraction.followUp({
                        content: "Something went wrong, maybe the message was deleted.",
                        flags: MessageFlags.Ephemeral
                    });
                }
            break;
            case "change-description-button":
                await buttonInteraction.showModal(addInfoModal);
                let oldDesc = partyRoomData[0].description;
                try{
                    const submitDesc = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === buttonInteraction.user.id,
                        time: 120_000
                    });

                    const desc = submitDesc.fields.getTextInputValue("description-text-input");

                    const responseDesc = await classifier(desc);
                    if(responseDesc) {
                        if(!responseDesc.labels.includes("OK")) {
                            return await submitDesc.reply({
                                flags: MessageFlags.Ephemeral,
                                value: "Please avoid using slurs or derogatory language!"
                            })
                        }
                    }

                    partyRoomData[0].description = desc;

                    await submitDesc.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "Description changed."
                    });

                } catch(err) {
                    return await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: `Modal timed out, try again.`
                    });
                }

                const descPartyObj = partyRoomData[0];
                descPartyObj.lfmembercount = partyChannel.userLimit - partyChannel.members.size;
                descPartyObj.channel = partyChannel;

                try{
                    const message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    await message.edit({
                        embeds: [
                            partyEmbedRefresh(descPartyObj, buttonInteraction.user)
                        ]
                    });
                } catch(err) {
                    return await buttonInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Something went wrong, maybe the message was deleted."
                    });
                }

                await poolConnection.query(`UPDATE partyroom SET description=$1 WHERE guild=$2 AND owner=$3`,
                    [descPartyObj.description, buttonInteraction.guild.id, buttonInteraction.user.id]
                );

                if(logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setAuthor({
                                    name: `[${partyRoomData[0].region.toUpperCase()}] ${buttonInteraction.user.username} party`,
                                    iconURL: buttonInteraction.member.displayAvatarURL({extension: "png"})
                                })
                                .setTitle("Description changed")
                                .setFooter({text: `Owner ID: ${buttonInteraction.user.id}`})
                                .setTimestamp()
                                .setFields(
                                    {
                                        name: "From",
                                        value: oldDesc
                                    },
                                    {
                                        name: "To",
                                        value: partyRoomData[0].description
                                    }
                                )
                        ]
                    });
                }

            break;
            case "change-color-button":
                await reply.edit({components: [firstRow, secondRow, thirdRow, selectColorsRow]});
                await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "Set the color of the embed message."});
            break;
        }
    });

    

    selectCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isStringSelectMenu()) return;
        switch(selectInteraction.customId) {
            case "transfer-ownership-select":

                // ownership can not be transfered to another party owner
                const {rows: isAlreadyPartyOwner} = await poolConnection.query(`SELECT EXISTS 
                    (SELECT 1 FROM partyroom WHERE guild=$1 AND owner=$2)`,
                    [selectInteraction.guild.id, selectInteraction.values[0]]
                );

                if(isAlreadyPartyOwner[0].exists) {
                    return await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "You can not transfer ownership to someone that already owns a party!"
                    });
                }

                await selectInteraction.showModal(ignModal);
                try{
                    const submitIgn = await selectInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === selectInteraction.user.id,
                        time: 120_000
                    });
                    const ignRegex = /^.{3,16}#.{3,5}$/;
                    const ign = submitIgn.fields.getTextInputValue("ign-text-input");
                    if(!ignRegex.test(ign)) {
                        return await submitIgn.reply({flags: MessageFlags.Ephemeral, content: "The summoner name format is invalid. <3-16 characters>#<3-5 characters>"})
                    }

                    const responseIgn = await classifier(ign);
                    if(responseIgn) {
                        if(!responseIgn.labels.includes("OK")) {
                            return await submitIgn.reply({
                                flags: MessageFlags.Ephemeral,
                                value: "Please avoid using slurs or derogatory language!"
                            })
                        }
                    }

                    partyRoomData[0].ign = ign;

                    await submitIgn.reply({flags: MessageFlags.Ephemeral, content: `IGN set to **${ign}**`});
                } catch(err) {
                    await selectInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."})
                }

                const member = partyChannel.members.find(m => m.id == selectInteraction.values[0]);
                partyRoomData[0].owner = member.id;

                const partyObj = partyRoomData[0];
                partyObj.channel = partyChannel;
                partyObj.message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                partyObj.lfmembercount = partyChannel.userLimit - partyChannel.members.size;

                await poolConnection.query(`UPDATE partyroom SET owner=$1, ign=$4 WHERE guild=$2 AND owner=$3`,
                    [member.id, selectInteraction.guild.id, selectInteraction.user.id, partyObj.ign]
                );

                const thread = await lfgChannel.threads.cache.find(t => t.name === `${selectInteraction.user.username}-party`);
                if(thread) await thread.delete();

                await partyObj.message.edit({
                    embeds: [
                        partyEmbedRefresh(partyObj, member.user)
                    ]
                });

                await selectInteraction.followUp({
                    flags: MessageFlags.Ephemeral,
                    content: "The ownership transfer was completed successfully!"
                });

                await reply.edit({
                    embeds: [],
                    components: [],
                    content: "You are no longer the party owner!"
                });

                if(logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setAuthor({
                                    name: `[${partyRoomData[0].region.toUpperCase()}] ${member.user.username} party`,
                                    iconURL: selectInteraction.member.displayAvatarURL({extension: "png"})
                                })
                                .setTitle("Ownership Transfer")
                                .setFooter({text: `New Owner ID: ${member.id}`})
                                .setTimestamp()
                                .setFields(
                                    {
                                        name: "From",
                                        value: `${selectInteraction.member}`
                                    },
                                    {
                                        name: "To",
                                        value: `${member}`
                                    }
                                )
                        ]
                    });
                }
                
            break;
            case 'select-gamemode':
                const partyObjGamemode = partyRoomData[0];
                partyObjGamemode.gamemode = Number(selectInteraction.values[0]);

                if(partySizeDict[partyObjGamemode.gamemode] < partyChannel.members.size)  {
                    return await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "The gamemode selected has a party size smaller than people currently on your party room."
                    });
                }
                
                if(partyObjGamemode.gamemode < 6) {
                    // party size
                    // for solo/duo, flex, clash, normal, swift play and aram
                    // rotation gamemode, tft and custom will be set by the user
                    await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Gamemode set to ${id2gamemode[partyObjGamemode.gamemode]}`});
                    partyObjGamemode.size = partySizeDict[partyObjGamemode.gamemode];
                } else if(partyObjGamemode.gamemode >= 6) {
                    // will be redirected to setting the number of party members
                    await selectInteraction.showModal(partySizeModal);
                    try{
                        const submitPartySize = await selectInteraction.awaitModalSubmit({
                            filter: (i) => i.user.id === selectInteraction.user.id,
                            time: 120_000
                        });
                        const partySize = submitPartySize.fields.getTextInputValue("party-size-input");
                        if(Number.isNaN(partySize) || Number(partySize) <  2 || Number(partySize) < partyChannel.members.size) {
                            // if user gives garbage input
                           return await submitPartySize.reply({
                                flags: MessageFlags.Ephemeral,
                                content: "Invalid party size. Must provide a number higher or equal than the total number of members in your party room."
                            });
                        }
                        else{
                                partyObjGamemode.size = Number(partySize);
                                partyRoomData[0].size = Number(partySize);
                                await submitPartySize.reply({flags: MessageFlags.Ephemeral, content: `Party size set to ${partyObjGamemode.size}`});
                        }
                    } catch(err) {
                        await selectInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."})
                    }
                }

                partyObjGamemode.lfmembercount = partyObjGamemode.size - partyChannel.members.size;

                if(partyObjGamemode.gamemode < 3) {
                    // for the ranked related gamemodes, will be redirected to setting the min-max rank
                    await reply.edit({
                        components: [firstRow, secondRow, thirdRow, selectRanksActionRow]
                    });
                } else {
                    partyRoomData[0].size = partyObjGamemode.size;
                    partyRoomData[0].gamemode = partyObjGamemode.gamemode;

                    const {rows: [{countgamemode}]} = await poolConnection.query(`SELECT COUNT(*) AS countgamemode FROM
                        partyroom WHERE guild=$1 AND gamemode=$2`, [selectInteraction.guild.id, partyRoomData[0].gamemode]);

                    await partyChannel.edit({
                            name: `${id2gamemode[partyRoomData[0].gamemode]} [${Number(countgamemode) + 1}]`,
                            userLimit: partyRoomData[0].size
                    });

                    await poolConnection.query(`UPDATE partyroom SET size=$1, gamemode=$2
                        WHERE guild=$3 AND owner=$4`,
                        [partyRoomData[0].size, partyRoomData[0].gamemode, selectInteraction.guild.id, selectInteraction.user.id]
                    );

                    const message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    partyObjGamemode.channel = partyChannel;

                    await message.edit({
                        embeds: [partyEmbedRefresh(partyObjGamemode, selectInteraction.user)]
                    });
                    // the other gamemodes skip the party size specification/minmax rank specification
                    // and all selections will take the user to the menu where party members are selected, as well as specifying available roles
                    await reply.edit({
                        components: [firstRow, secondRow, thirdRow]
                    });
                    
                    changeGamemodeCooldowns.set(selectInteraction.user.id, Date.now());
                    setTimeout(() => changeGamemodeCooldowns.delete(selectInteraction.user.id), 500_000)
                }
                
                selectedgamemode = partyObjGamemode.gamemode;
            break;
            case "select-ranks":
                await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});
                const selectRankParty = partyRoomData[0];
                selectRankParty.gamemode = selectedgamemode;

                if(Number(selectInteraction.values[0]) < Number(selectInteraction.values[1])) {
                    selectRankParty.maxrank = Number(selectInteraction.values[1]);
                    selectRankParty.minrank = Number(selectInteraction.values[0]);
                }
                else {
                    selectRankParty.maxrank = Number(selectInteraction.values[0]);
                    selectRankParty.minrank = Number(selectInteraction.values[1]);
                }

                partyRoomData[0].gamemode = selectedgamemode;
                partyRoomData[0].maxrank = selectRankParty.maxrank;
                partyRoomData[0].minrank = selectRankParty.minrank;
                partyRoomData[0].size = partySizeDict[selectedgamemode];

                selectRankParty.size = partySizeDict[selectedgamemode];
                selectRankParty.lfmembercount = selectRankParty.size - partyChannel.members.size;

                const {rows: [{countgamemode}]} = await poolConnection.query(`SELECT COUNT(*) AS countgamemode FROM
                        partyroom WHERE guild=$1 AND gamemode=$2`, [selectInteraction.guild.id, partyRoomData[0].gamemode]);

                await poolConnection.query(`UPDATE partyroom SET gamemode=$1, size=$2, minrank=$3, maxrank=$4
                    WHERE guild=$5 AND owner=$6`,
                    [
                        selectedgamemode, selectRankParty.size, selectRankParty.minrank, selectRankParty.maxrank,
                        selectInteraction.guild.id, selectInteraction.user.id
                    ]
                );

                await partyChannel.edit({
                    name: `${id2gamemode[partyRoomData[0].gamemode]} [${Number(countgamemode) + 1}]`,
                    userLimit: partyRoomData[0].size
                });
                selectRankParty.channel = partyChannel;

                try{
                    const message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    await message.edit({
                        embeds: [partyEmbedRefresh(selectRankParty, selectInteraction.user)]
                    });
                } catch(err){
                    return await selectInteraction.editReply({
                        content: "Something went wrong, maybe the message was deleted."
                    });
                }

                await reply.edit({
                    components: [firstRow, secondRow, thirdRow]
                });

                changeGamemodeCooldowns.set(selectInteraction.user.id, Date.now());
                setTimeout(() => changeGamemodeCooldowns.delete(selectInteraction.user.id), 500_000)
                
                await selectInteraction.editReply({flags: MessageFlags.Ephemeral, content: `Ranks range: ${id2rank[selectRankParty.minrank]} - ${id2rank[selectRankParty.maxrank]}`});
            break;
            case "select-req-roles":
                const selectRolesPartyObj = partyRoomData[0];
                selectRolesPartyObj.channel = partyChannel;
                selectRolesPartyObj.lfmembercount = partyChannel.userLimit - partyChannel.members.size;
                selectRolesPartyObj.reqroles = [];

                selectInteraction.values.forEach(role => {
                    selectRolesPartyObj.reqroles.push(role.toUpperCase());
                });

                await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Roles specified: ${selectRolesPartyObj.reqroles.join(", ")}`});
                
                await reply.edit({components: [firstRow, secondRow, thirdRow]});

                try{
                    const selectRoleMessage = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    await selectRoleMessage.edit({
                        embeds: [partyEmbedRefresh(selectRolesPartyObj, selectInteraction.user)]
                    });
                } catch(err) {
                    return await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "Something went wrong, maybe the message no longer exists"
                    });
                }

                await poolConnection.query(`UPDATE partyroom SET reqroles=$1 WHERE guild=$2 AND owner=$3`,
                    [selectRolesPartyObj.reqroles, selectInteraction.guild.id, selectInteraction.user.id]
                );

            break;
            case "select-color":
                const colorInput = selectInteraction.values[0];
                const colorPartyObj = partyRoomData[0];
                colorPartyObj.channel = partyChannel;
                colorPartyObj.lfmembercount = partyChannel.userLimit - partyChannel.members.size;

                if(colorInput == "0") {
                    await selectInteraction.showModal(hexcolorModal);
                    try {
                        const submitHexcolor = await selectInteraction.awaitModalSubmit({
                            filter: (i) => i.user.id === selectInteraction.user.id,
                            time: 120_000
                        });

                        const hexcolor = "0x" + submitHexcolor.fields.getTextInputValue("hexcolor-input");
                        const hexColorRegex = /^0x([A-Fa-f0-9]{6})$/;
                        if (!hexColorRegex.test(hexcolor)) {
                            // meaning the input is invalid
                            return await submitHexcolor.reply({
                                content:
                                    "Invalid input, a hexcolor should look like this `9A00FF`.",
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        colorPartyObj.hexcolor = Number(hexcolor);
                        partyRoomData[0].hexcolor = Number(hexcolor);
                        await submitHexcolor.reply({flags: MessageFlags.Ephemeral, content: `Color set to ${hexcolor}`});
                    } catch(err) {
                        await selectInteraction.followUp({flags: MessageFlags.Ephemeral, content: "Time ran out, try again."});
                    }
                } else {
                    colorPartyObj.hexcolor = Number(selectInteraction.values[0]);
                    partyRoomData[0].hexcolor = Number(selectInteraction.values[0]);
                    await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Hexcolor set to ${selectInteraction.values[0]}`});
                }

                try{
                    const message = await lfgChannel.messages.fetch(partyRoomData[0].message);
                    await message.edit({
                        embeds: [partyEmbedRefresh(colorPartyObj, selectInteraction.user)]
                    });
                } catch(err) {
                    return await selectInteraction.followUp({
                        flags: MessageFlags.Ephemeral,
                        content: "Something went wrong, maybe the message was deleted."
                    });
                }

                await poolConnection.query(`UPDATE partyroom SET hexcolor=$1 WHERE guild=$2 AND owner=$3`,
                    [partyRoomData[0].hexcolor, selectInteraction.guild.id, selectInteraction.user.id]
                );

                await reply.edit({embeds: [manager_embed()], components: [firstRow, secondRow, thirdRow]});
            break;
        }
    });

    selectUserCollector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isUserSelectMenu()) return;

        await selectInteraction.deferReply({flags: MessageFlags.Ephemeral});

        const hasAccessArray = [];
        const accessDeniedArray = [];

        for(const user of selectInteraction.values) {
            // cannot do anything to blocked/blocker user
            if(blockedData.find(row => row.blocked == user) ||
                blockerData.find(row => row.blocker == user)
            ) {
                return await selectInteraction.editReply({
                    content: "You can not change the access of people that you either blocked you or you blocked them yourself!"
                });
            }

            const member = await selectInteraction.guild.members.fetch(user);

            
           
            if(partyChannel.permissionOverwrites.cache.find(
                perms => perms.id === member.id && perms.allow.has(PermissionFlagsBits.Connect)
            )) {
                // if it has permission, remove it
                await partyChannel.permissionOverwrites.edit(user, {
                    SendMessages: false,
                    Connect: false,
                    Speak: false,
                    AddReactions: false,
                    Stream: false
                });

                accessDeniedArray.push(member);

                if(member.voice.channelId === partyChannel.id) {
                    // if the member get access denied while on voice, will be moved to main lobby
                    await member.voice.setChannel(createLobbyChannel);
                }
            } else {
                // otherwise give perms
                await partyChannel.permissionOverwrites.edit(user, {
                    SendMessages: true,
                    Connect: true,
                    Speak: true,
                    AddReactions: true,
                    Stream: true
                });

                hasAccessArray.push(member);

            }

        }

        await reply.edit({components: [firstRow, secondRow, thirdRow]})

        await selectInteraction.editReply({
            content: `Channel permissions changed.\nHas access: ${hasAccessArray.join(", ") || "None"}\nAccess Denied: ${accessDeniedArray.join(", ") || "None"}`
        });

    });

    buttonCollector.on("end", async () => {
        try{
            await reply.edit({
                content: "The Party Manager timed out, start a new one if needed.",
                components: [],
                embeds: []
            });
        } catch(err) {};

        selectUserCollector.stop();
        selectCollector.stop();
    })
}

async function load_collector(message) {
    // assumes the interface and channels already exists in the database, does no checking

    const collector = message.createMessageComponentCollector({
        ComponentType: ComponentType.Button
    });

    // internal buttons cooldown

    const internalCooldowns = new Collection();
    const internalcooldown = 3_000;

    const sendLFGCooldowns = new Collection(); // the send buttons share the same cooldown (from drafts and create)
    const partyCooldowns = new Collection();
    let sendCooldown = 900_000;
    

    // block/unblock cooldowns
    const blockUnblockCDs = new Collection();
    const blockUnblockCD = 10_000;

    const changeGamemodeCooldowns = new Collection();

    collector.on("collect", async (buttonInteraction) => {
        if(!buttonInteraction.isButton()) return;
        const userCooldown = hasCooldown(buttonInteraction.user.id, internalCooldowns, internalcooldown);

        if(userCooldown) {
            return await buttonInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You're pressing buttons too fast! Cooldown: <t:${parseInt(userCooldown / 1000)}:R>`
            });
        }

        internalCooldowns.set(buttonInteraction.user.id, Date.now());
        setTimeout(() => internalCooldowns.delete(buttonInteraction.user.id), internalcooldown);

        switch(buttonInteraction.customId) {
            case "create-button":
                // if the user is a party owner, block his request
                const {rows: partyRoomData} = await poolConnection.query(`SELECT EXISTS
                    (SELECT 1 FROM partyroom WHERE guild=$1 AND owner=$2)`,
                    [buttonInteraction.guild.id, buttonInteraction.member.id]
                );

                if(partyRoomData[0].exists) {
                    // if the party member is also the owner
                    return await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `You do already have an active party, close it before creating a new one!`});
                }

                await create_button(buttonInteraction, sendLFGCooldowns, partyCooldowns, sendCooldown);
            break;
            case "manage-party-button":
                await manage_party_button(buttonInteraction, sendLFGCooldowns, partyCooldowns, changeGamemodeCooldowns, sendCooldown);
            break;
            case "close-party-button":
                await close_party_button(buttonInteraction);
            break;
            case "preferences-button":
                await preferences_button(buttonInteraction, blockUnblockCDs, blockUnblockCD);
            break;
            case "drafts-button":
                await drafts_button(buttonInteraction, sendLFGCooldowns, partyCooldowns, sendCooldown);
            break;
        }
    });
}

async function party_maker(interaction) {
    const {rows : channelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel 
        WHERE guild=$1 AND channeltype='party-manager'`,
        [interaction.guild.id]);
    const {rows : messageData} = await poolConnection.query(`SELECT message FROM partymaker WHERE guild=$1`, [interaction.guild.id]);
    
    if(channelData.length == 0) return false; // if the setup isn't properly completed, force quit

    let partymakerChannel = null;
    let partymakerMessage = null;

    try{
        partymakerChannel = await interaction.guild.channels.fetch(channelData[0].channel);
    } catch(err) {
        console.error(err);
        return false;
    }

    if(messageData.length > 0) { // if the interface exists, loads it, create the message otherwise
        try{
            partymakerMessage = await partymakerChannel.messages.fetch(messageData[0].message);
        } catch(err) {
            console.error(err);
            return false;
        }
    } else {
        partymakerMessage = await partymakerChannel.send({
            embeds: [partyMakerEmbed(interaction.guild, "Purple")],
            components: [firstRowButtonsMenu()]
        });

        await poolConnection.query(`INSERT INTO partymaker(guild, message) VALUES($1, $2)`,
            [interaction.guild.id, partymakerMessage.id]
        );
    }

    await load_collector(partymakerMessage);

}

module.exports = { party_maker, load_collector };