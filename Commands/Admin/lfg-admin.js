const {SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputStyle, TextInputBuilder,
    PermissionFlagsBits, ComponentType, ChannelType,
    MessageFlags,
} = require('discord.js');

const {poolConnection} = require("../../utility_modules/kayle-db.js");
const {rankOptions, rank2id, id2rank} = require("../../objects/select_role_options.js");
const {party_maker} = require("../../utility_modules/subcommands/party_maker.js")

//TODO: cooldown starts from 0; admins can set server cooldown on creation of lobby and ask to join

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lfg-admin')
        .setDescription('Administrate the lfg system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandgroup =>
            subcommandgroup.setName("setup")
                .setDescription("Setup the lfg system")
                .addSubcommand(subcommand =>
                    subcommand.setName("roles")
                        .setDescription("Setup the rank roles for lfg.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("channels")
                        .setDescription("Create the neccessary channels.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("interfaces")
                        .setDescription("Create the neccessary interfaces for lfg.")
                )
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("list")
                .setDescription("List all the current rank-role pairs")
                .addSubcommand(subcommand =>
                    subcommand.setName("ranks")
                        .setDescription("List rank roles")
                )
        ),
        botPermissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers
        ],
        cooldown: 60
    ,
    async execute(interaction, client) {
        const {rows: lfgRolesData} = await poolConnection.query(`SELECT role FROM serverroles 
            WHERE guild=$1 AND (roletype='lfg-eune' OR roletype='lfg-euw')`,
            [interaction.guild.id]
        );

        if(lfgRolesData.length < 2) {
            return await interaction.reply({flags: MessageFlags.Ephemeral, content: "You are missing the LFG EUNE/EUW roles."})
        }
        const cmd = interaction.options.getSubcommand();
        const reply = await interaction.deferReply();
        switch(cmd) {
            case "roles":
                // the setup consists of defining the ranked queue + in-game rank + server role pairs
                // then specifying the channel where lfgs will be logged
                // and lastly building a category with the needed channels for voice
                const setupEmbed = new EmbedBuilder()
                    .setTitle("LFG Setup - Rank Roles")
                    .setColor("Aqua")
                    .setDescription("Define the role-rank-ranked queue pairs.\nClick on the button for the ranked queue, use the first select menu to pick the in-game rank and the second select menu to pair it with a role on the server.")
                
                const sdButton = new ButtonBuilder()
                    .setCustomId("sd-button")
                    .setLabel("Solo/Duo")
                    .setStyle(ButtonStyle.Success)
                const flexButton = new ButtonBuilder()
                    .setCustomId("flex-button")
                    .setLabel("Flex")
                    .setStyle(ButtonStyle.Success)
                const closeButton = new ButtonBuilder()
                    .setCustomId('close')
                    .setLabel("Close")
                    .setStyle(ButtonStyle.Danger)
                
                const rankedButtonsRow = new ActionRowBuilder()
                    .addComponents(sdButton, flexButton, closeButton);
                
                reply.edit({embeds: [setupEmbed], components: [rankedButtonsRow]});

                const setupButtonCollector = reply.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.user.id === interaction.user.id
                });

                setupButtonCollector.on("collect", async (buttonInteraction) => {
                    switch(buttonInteraction.customId) {
                        case "close":
                            // deletes the setup message
                            setupButtonCollector.stop();
                        break;
                        case "sd-button":
                        case "flex-button":
                            const rankqCase = { "sd-button" : 0, "flex-button" : 1};
                            const rankqDict = {0 : "Solo/Duo", 1: "Flex"};
                            const rankSelectMenu = new StringSelectMenuBuilder()
                                .setCustomId('select-rank')
                                .setPlaceholder("Select the rank")
                                .setMinValues(1)
                                .setMaxValues(1)
                                .addOptions(rankOptions)

                            const roleSelectMenu = new RoleSelectMenuBuilder()
                                .setCustomId("select-role")
                                .setPlaceholder("Select the role for the rank")
                                .setMinValues(1)
                                .setMaxValues(1)
                            
                            const rankMenuRow = new ActionRowBuilder()
                                .addComponents(rankSelectMenu)
                            const roleMenuRow = new ActionRowBuilder()
                                .addComponents(roleSelectMenu)

                            const rankEmbed = new EmbedBuilder()
                                .setColor("Aqua")
                                .setTitle("Select Rank Menu")
                                .setAuthor({name: rankqDict[rankqCase[buttonInteraction.customId]]})
                                .setDescription("Waiting for a rank to be picked...")

                            const message = await buttonInteraction.reply({embeds: [rankEmbed], components: [rankMenuRow]});
                            const messageFetched = await buttonInteraction.fetchReply();

                            const rankMenuCollector = messageFetched.createMessageComponentCollector({
                                ComponentType: ComponentType.StringSelect,
                                filter: (i) => i.user.id === interaction.user.id
                            });

                            let rankid = null;

                            rankMenuCollector.on("collect", async (selectInteraction) => {
                                const selectOption = selectInteraction.values[0];
                                if(selectInteraction.customId === "select-rank") {
                                    rankEmbed.setDescription(`Pairing a role with the **${id2rank[Number(selectOption)]}** rank...`)
                                        .setTitle("Select Rank Role Menu")
                                    rankid = Number(selectOption);
                                    await message.edit({embeds: [rankEmbed], components: [roleMenuRow]});
                                    await selectInteraction.reply({content: `${id2rank[Number(selectOption)]} rank selected`, flags: MessageFlags.Ephemeral});
                                } else {
                                    // when a role-rank pair is selected, the previous row will be removed if it exists
                                    const role = await interaction.guild.roles.fetch(selectOption);
                                    await poolConnection.query(`DELETE FROM rankrole WHERE guild=$1 AND role=$2`, [interaction.guild.id, selectOption]);
                                    await poolConnection.query(`INSERT INTO rankrole(guild, rankid, rankq, role)
                                        VALUES($1, $2, $3, $4)`,
                                        [interaction.guild.id, rankid, rankqCase[buttonInteraction.customId], selectOption]
                                    );

                                    try{
                                        await message.delete();
                                    } catch(err) {};
                                    await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `**${id2rank[rankid]}** rank has been paired to ${role}.`});
                                }
                            })
                        break;
                    }
                });

                setupButtonCollector.on("end", async () => {
                    try{
                        await reply.delete();
                    } catch(err) {};
                });

            break;
            case "channels":
                const channelsEmbed = new EmbedBuilder()
                    .setTitle("LFG Setup - Channels")
                    .setDescription("A category with the necessary channels will be created.")
                    .setColor("Aqua")

                const createChannelsButton = new ButtonBuilder()
                    .setCustomId("create-channels-button")
                    .setLabel("Create")
                    .setStyle(ButtonStyle.Success)

                const createButtonRow = new ActionRowBuilder()
                    .addComponents(createChannelsButton)

                await reply.edit({embeds: [channelsEmbed],
                    components: [createButtonRow]
                });

                const channelsCollector = reply.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.user.id === interaction.user.id
                });

                channelsCollector.on("collect", async (buttonInteraction) => {
                    if(buttonInteraction.customId === "create-channels-button") {
                        // clearing the previous configuration
                        await poolConnection.query(`DELETE FROM serverlfgchannel WHERE guild=$1`, [interaction.guild.id]);
                        await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});
                        const {rows : staffRoleData} = await poolConnection.query(`SELECT role, roletype FROM serverroles WHERE
                            guild=$1 AND (roletype=$2 OR roletype=$3)`,
                            [interaction.guild.id, "staff", "bot"]);
                        
                        let staffRoleId = null;
                        let botRoleId = null;

                        for(const data of staffRoleData) {
                            if(data.roletype == "bot")
                                botRoleId = data.role;
                            else
                                staffRoleId = data.role;
                        }
                        
                        const channelPerms =  [
                            {
                                id: await interaction.guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads],
                            },
                            {
                                id: botRoleId,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
                                    PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.CreatePrivateThreads,
                                    PermissionFlagsBits.CreatePublicThreads
                                ]
                            },
                            {
                                id: staffRoleId,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
                                    PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.CreatePrivateThreads,
                                    PermissionFlagsBits.CreatePublicThreads
                                ]
                            }
                        ]; // the perms for the bot and staff roles

                        const registerChannel = async (channel, type) => {
                            await poolConnection.query(`INSERT INTO serverlfgchannel(guild, channel, channeltype)
                                VALUES($1, $2, $3)`, [interaction.guild.id, channel, type]);
                        }

                        // creating the channels
                        const lfgCategory = await interaction.guild.channels.create({
                            name: "Looking For Game",
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: channelPerms
                        });
                        await registerChannel(lfgCategory.id, "category-pm"); // category party maker

                        const lfgeuneCategory = await interaction.guild.channels.create({
                            name: "EUNE",
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: channelPerms
                        });
                        await registerChannel(lfgeuneCategory.id, "category-eune");

                        const lfgeuwCategory = await interaction.guild.channels.create({
                            name: "EUW",
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: channelPerms
                        });
                        await registerChannel(lfgeuwCategory.id, "category-euw");

                        const mainLobby = await interaction.guild.channels.create({
                            name: "Main Lobby",
                            type: ChannelType.GuildVoice,
                            permissionOverwrites: [
                                {
                                    id: await interaction.guild.roles.everyone.id,
                                    deny: [
                                        PermissionFlagsBits.SendMessages, PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.Stream, PermissionFlagsBits.UseSoundboard
                                    ]
                                }
                            ],
                            parent: lfgCategory
                        });
                        await registerChannel(mainLobby.id, "main-lobby");

                        const lfgeuneChannel = await interaction.guild.channels.create({
                            name: "lfg-eune",
                            type: ChannelType.GuildText,
                            parent: lfgeuneCategory
                        });
                        await registerChannel(lfgeuneChannel.id, "lfg-eune");

                        const lfgeuwChannel = await interaction.guild.channels.create({
                            name: "lfg-euw",
                            type: ChannelType.GuildText,
                            parent: lfgeuwCategory
                        });
                        await registerChannel(lfgeuwChannel.id, "lfg-euw");

                        const partyManager = await interaction.guild.channels.create({
                            name: "party-manager",
                            type: ChannelType.GuildText,
                            parent: lfgCategory,
                        });
                        await partyManager.setPosition(0);
                        await registerChannel(partyManager.id, "party-manager")

                        // adding the lfg text channels to ignore list
                        await poolConnection.query(`INSERT INTO serverlogsignore(guild, channel)
                            VALUES ($1, $2), ($1, $3), ($1, $4)`,
                            [buttonInteraction.guild.id, lfgeuneChannel.id, lfgeuwChannel.id, partyManager.id]
                        );

                        // sending webhook messages in the lfg channel to redirect members to party manager

                        const webhookEmbed = new EmbedBuilder()
                            .setColor("Purple")
                            .setImage("https://i.ibb.co/XZpXhtZS/proxy-image-1.jpg")
                            .setTitle("You scrolled up there and still nothing?")
                            .setDescription(`Unable to find a fitting party?\nTry creating your own! ➡ ${partyManager}`)

                        const euneWebhook = await lfgeuneChannel.createWebhook({
                            name: `${buttonInteraction.guild.name} EUNE`,
                            avatar: buttonInteraction.guild.iconURL({extension: "png"}),
                            reason: "sending webhook messages in the lfg channel to redirect members to party manager"
                        });

                        const euwWebhook = await lfgeuwChannel.createWebhook({
                            name: `${buttonInteraction.guild.name} EUW`,
                            avatar: buttonInteraction.guild.iconURL({extension: "png"}),
                            reason: "sending webhook messages in the lfg channel to redirect members to party manager"
                        });

                        await euneWebhook.send({embeds: [ webhookEmbed ]});
                        await euneWebhook.delete();
                        await euwWebhook.send({embeds: [ webhookEmbed ]});
                        await euwWebhook.delete();


                        await buttonInteraction.editReply({content: "The Category **Looking For Game** has been created."});
                    }
                });

                channelsCollector.on("end", async () => {
                    try{
                        await reply.delete();

                    } catch(err) {};
                });

                
            break;
            case "interfaces":
                await poolConnection.query(`DELETE FROM partymaker WHERE guild=$1`, [interaction.guild.id]);
                const {rows : lfgChannelData} = await poolConnection.query(`SELECT * FROM serverlfgchannel WHERE guild=$1`, [interaction.guild.id]);
                if(lfgChannelData.length == 0) {
                    return await reply.edit("LFG Channels setup is needed before executing this command.");
                }
                await party_maker(interaction);
                await reply.edit("Executed");
            break;
            case "ranks":
                const {rows: rankRoleData} = await poolConnection.query(`SELECT * FROM rankrole WHERE guild=$1 ORDER BY rankid ASC`, [interaction.guild.id]);
                let sdText = "";
                let flexText = "";
                for(const row of rankRoleData) {
                    let role = null;
                    
                    try{
                        role = await interaction.guild.roles.fetch(row.role);
                    } catch(err) { console.error(err); }
                    if(row.rankq == 0) {
                        sdText += `**${id2rank[row.rankid]}** - ${role}\n`
                    } else {
                        flexText += `**${id2rank[row.rankid]}** - ${role}\n`
                    }
                }
                
                if(!sdText) sdText = "Empty";
                if(!flexText) flexText = "Empty";

                const embedList = new EmbedBuilder()
                    .setTitle("LFG Admin - List rank roles")
                    .setDescription("`Clear` will remove all pairs.")
                    .setColor("Aqua")
                    .setFields(
                        {
                            name: "Solo/Duo",
                            value: sdText,
                        },
                        {
                            name: "Flex",
                            value: flexText,
                        }
                    )
                
                const clearListButton = new ButtonBuilder()
                    .setCustomId("clear-list-button")
                    .setLabel("Clear")
                    .setStyle(ButtonStyle.Danger)

                const clearRow = new ActionRowBuilder()
                    .addComponents(clearListButton);
                
                if(rankRoleData.length == 0) clearListButton.setDisabled(true);
                
                await reply.edit({embeds: [embedList], components: [clearRow]});

                const listCollector = reply.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.user.id === interaction.user.id
                });

                listCollector.on("collect", async (buttonInteraction) => {
                    if(buttonInteraction.customId === "clear-list-button") {
                        await poolConnection.query(`DELETE FROM rankrole WHERE guild=$1`, [interaction.guild.id]);
                        clearListButton.setDisabled(true);
                        await reply.edit({embeds: [
                                embedList.setFields({name: "Solo/Duo", value: "Empty"}, {name: "Flex", value: "Empty"})
                            ],
                            components: [clearRow]
                        });
                        
                        await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "Rank Role List has been cleared."})
                    }
                })
            break;
        }
    }
}