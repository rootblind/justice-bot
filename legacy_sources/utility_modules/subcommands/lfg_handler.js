const {EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputStyle, TextInputBuilder,
    ComponentType, ChannelType, UserSelectMenuBuilder,
    PermissionFlagsBits,
    Collection,
    MessageFlags
} = require("discord.js");
const { poolConnection } = require("../kayle-db");
const {rankOptions, id2rank} = require("../../objects/select_role_options.js");
const { hasCooldown } = require("../utility_methods.js");

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
const lfg_buttons = (private) => {
    
    const joinButton = new ButtonBuilder()
        .setCustomId("join-button")
        .setStyle(ButtonStyle.Success)
        .setLabel("Join")

    const askToJoinButton = new ButtonBuilder()
        .setCustomId("ask-to-join-button")
        .setStyle(ButtonStyle.Success)
        .setLabel("Ask To Join")

    const deleteButton = new ButtonBuilder()
        .setCustomId("delete-button")
        .setStyle(ButtonStyle.Danger)
        .setLabel("Delete Lobby")

    const lfgButtonsRow = new ActionRowBuilder();

    if(private)
        lfgButtonsRow.addComponents(askToJoinButton);
    else
        lfgButtonsRow.addComponents(joinButton);

    lfgButtonsRow.addComponents(deleteButton);

    return lfgButtonsRow;

}

const validateRankReq = async (member, rankq, minrank, maxrank) => {
    const {rows: rankRolesData} = await poolConnection.query(`SELECT role FROM rankrole
        WHERE guild=$1 AND rankq=$2 AND rankid >= $3 AND rankid <= $4`,
        [member.guild.id, rankq, minrank, maxrank]
    );

    for(const row of rankRolesData) {
        if(await member.roles.cache.has(row.role))
            return true;
    }
    return false;
}

async function lfg_collector(message) {
    const collector = message.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        time: 43_200_000
    });

    let askButtonCooldown = 30_000;

    const askCooldowns = new Collection();
    const otherButtonsCooldowns = new Collection();

    collector.on("collect", async (buttonInteraction) => {
        if(!buttonInteraction.isButton()) return;

        // member must be in a voice channel if wants to join
        if(buttonInteraction.member.voice.channelId == null && buttonInteraction.customId != "delete-button") {
            return await buttonInteraction.reply({flags: MessageFlags.Ephemeral,
                content: "You must be in a voice channel in order to join."
            });
        }

        if(buttonInteraction.customId === "ask-to-join-button") {
            const userCooldown = hasCooldown(buttonInteraction.user.id, askCooldowns, askButtonCooldown);
            if(userCooldown) {
                return await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: `This button is on cooldown! <t:${parseInt(userCooldown / 1000)}:R>`
                });
            }

            // if there is no cooldown
            askCooldowns.set(buttonInteraction.user.id, Date.now());
            setTimeout(() => askCooldowns.delete(buttonInteraction.user.id), askButtonCooldown);
            
        } else {
            const userCooldown = hasCooldown(buttonInteraction.user.id, otherButtonsCooldowns, 1_500);
            if(userCooldown) {
                return await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: `This button is on cooldown! <t:${parseInt(userCooldown / 1000)}:R>`
                });
            }

            // if there is no cooldown
            otherButtonsCooldowns.set(buttonInteraction.user.id, Date.now());
            setTimeout(() => otherButtonsCooldowns.delete(buttonInteraction.user.id), 1_500);
        }

        const {rows: partyRoomData} = await poolConnection.query(`SELECT * FROM partyroom WHERE guild=$1 AND message=$2`,
            [message.guild.id, message.id]
        );
    
        let channel = null;
        try{
            channel = await message.guild.channels.fetch(partyRoomData[0].channel);
        } catch(err) {
            console.error(err, partyRoomData[0].channel);
        }
        
        let partyOwner = null;
        try{
            partyOwner = await message.guild.members.fetch(partyRoomData[0].owner);
        } catch(err) {
            console.error(err, partyRoomData[0].owner);
        }
    
        const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
            [message.guild.id]
        );

        // delete button is treated differently
        

        // the party owner can not join his own party
        if(buttonInteraction.customId != "delete-button" && buttonInteraction.member.id === partyOwner.id) {
            return await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "You are the party owner, you can not join your own party"});
        }

        // checking if the room is full
        if(buttonInteraction.customId != "delete-button" && channel.members.size + 1 > channel.userLimit) {
            return await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: "The party you are trying to join is full."})
        }

        // check if member is already part of the party
        if(buttonInteraction.customId == "ask-to-join-button" && channel.permissionsFor(buttonInteraction.member).has(PermissionFlagsBits.Connect)) {
            return await buttonInteraction.reply({flags: MessageFlags.Ephemeral, content: `You do already have permission to join ${channel}!`});
        }

        await buttonInteraction.deferReply({flags: MessageFlags.Ephemeral});

        // deny access to blocklisted member
        const {rows: isBlocked} = await poolConnection.query(`SELECT EXISTS
            (SELECT 1 FROM lfgblock 
                WHERE guild=$1 
                    AND (blocker=$2 AND blocked=$3)
                    OR (blocker=$3 AND blocked=$2))`,
            [buttonInteraction.guild.id, partyOwner.id, buttonInteraction.member.id]
        ); // if X has Y on his blocklist or Y has X on his blocklist deny access

        if(buttonInteraction.customId != "delete-button" && isBlocked[0].exists) {
            return await buttonInteraction.editReply({content: "You or the party owner have each other on your blocklists."});
        }

        /* rank restriction is disabled
        let validateJoin = true; // for ranked queue
        // validation is needed to deny people that do not meet the rank requirements
        if(partyRoomData[0].gamemode == 1) // flex
            validateJoin = await validateRankReq(
                buttonInteraction.member, 1, partyRoomData[0].minrank,
                partyRoomData[0].maxrank
            );
        else if(partyRoomData[0].gamemode < 3) {
            // solo/duo or clash; clash gamemode id is 2 but there are rank roles only for flex and solo duo
            validateJoin = await validateRankReq(
                buttonInteraction.member, 0, partyRoomData[0].minrank,
                partyRoomData[0].maxrank
            );
        }
                // if the gamemode is anything besides ranked, the validation returns true
        if(!validateJoin && buttonInteraction.customId != "delete-button") {
            return await buttonInteraction.editReply({
                content: `You do not meet the rank range required by the party (**${id2rank[partyRoomData[0].minrank]}** - **${id2rank[partyRoomData[0].maxrank]}**) in ${id2gamemode[partyRoomData[0].gamemode]}\nUse @Orianna bot config to get your ranked roles on this server!`
            });
        }
        */

        switch(buttonInteraction.customId) {
            case "join-button":
                try{
                    await buttonInteraction.member.voice.setChannel(channel);
                } catch(err) {
                    console.error(err);
                    return await buttonInteraction.editReply({content: "Something went wrong, maybe the voice channel no longer exists??"});
                }
                await buttonInteraction.editReply({content: `You joined ${channel} voice channel.`});
            break;
            case "ask-to-join-button":
                // creates a private thread in order to ask the party owner if you are allowed to join
                let thread = await message.channel.threads.cache.find(t => t.name === `${partyOwner.user.username}-party`);

                if(!thread)
                {
                    thread = await message.channel.threads.create({
                        name: `${partyOwner.user.username}-party`,
                        autoArchiveDuration: 4320,
                        type: ChannelType.PrivateThread,
                        invitable: false
                    });
                }

                await thread.members.add(buttonInteraction.user.id, partyOwner.id);
                
                
                const threadMessageBody = {};

                threadMessageBody.embeds = [
                    new EmbedBuilder()
                        .setAuthor({name: "Join Request"})
                        .setDescription(`${buttonInteraction.member} wants to join your party.\nRequest expires: <t:${parseInt(Date.now() / 1000) + 180}:R>`)
                        .setFields(
                            {
                                name: "Accept",
                                value: "Grants permission to join"
                            },
                            {
                                name: "Reject",
                                value: "Removes the member from this thread (no response is an auto reject)"
                            },
                            {
                                name: "Block",
                                value: "Block this member from joining your lobbies"
                            }
                        )
                        .setColor(partyRoomData[0].hexcolor)
                ]

                const acceptButton = new ButtonBuilder()
                    .setCustomId("accept-button")
                    .setLabel("Accept")
                    .setStyle(ButtonStyle.Success)

                const rejectButton = new ButtonBuilder()
                    .setCustomId("reject-button")
                    .setLabel("Reject")
                    .setStyle(ButtonStyle.Primary)

                const blockButton = new ButtonBuilder()
                    .setCustomId("block-button")
                    .setLabel("BLOCK")
                    .setStyle(ButtonStyle.Danger)

                const joinRequestRow = new ActionRowBuilder()
                    .addComponents(acceptButton, rejectButton, blockButton)

                threadMessageBody.components = [ joinRequestRow ];

                threadMessageBody.content = `${partyOwner} : ${buttonInteraction.member} wants to join your party`;

                const threadReply = await thread.send(threadMessageBody);
                const threadReplyFetch = await threadReply.fetch();

                const requestCollector = threadReplyFetch.createMessageComponentCollector({
                    ComponentType: ComponentType.Button,
                    filter: (i) => i.user.id === partyOwner.id,
                    time: 181_000
                });

                requestCollector.on("collect", async (requestInteraction) => {
                    if(!requestInteraction.isButton()) return;

                    switch(requestInteraction.customId) {
                        case "accept-button":
                            await requestInteraction.deferReply({
                                flags: MessageFlags.Ephemeral
                            });

                            if(buttonInteraction.member.voice.channelId == null) {
                                return await requestInteraction.editReply({content: "The user is not in a voice channel.", flags: MessageFlags.Ephemeral});
                            }
                            try{
                                await channel.permissionOverwrites.create(
                                    buttonInteraction.member.id,
                                    {
                                        Speak: true,
                                        Connect: true,
                                        Stream: true
                                    }
                                );
                                await buttonInteraction.member.voice.setChannel(channel);
                            } catch(err) {
                                console.error(err);
                                return await requestInteraction.editReply({content: "The user is not in a voice channel.", flags: MessageFlags.Ephemeral});
                            }
                            await requestInteraction.editReply({
                                content: `${buttonInteraction.member} has been granted access to your party.`,
                                flags: MessageFlags.Ephemeral
                            });
                        break;
                        case "reject-button":
                            await thread.members.remove(buttonInteraction.member.id);
                            await requestInteraction.reply({content: `${buttonInteraction.member}'s request was rejected.`, flags: MessageFlags.Ephemeral});
                            await buttonInteraction.followUp({flags: MessageFlags.Ephemeral, content: `${buttonInteraction.member} Your request was rejected.`});
                        break;
                        case "block-button":
                            await thread.members.remove(buttonInteraction.member.id);
                            await buttonInteraction.followUp({
                                flags: MessageFlags.Ephemeral, 
                                content: `${buttonInteraction.member} you have been blocked from joining ${partyOwner}'s lobbies.`
                            });

                            try{
                                await poolConnection.query(`INSERT INTO lfgblock(guild, blocker, blocked)
                                    VALUES($1, $2, $3)`, [buttonInteraction.guild.id, partyOwner.id, buttonInteraction.member.id]);
                            } catch(err) { console.error(err); };
                            await requestInteraction.reply({
                                flags: MessageFlags.Ephemeral,
                                content: `${buttonInteraction.member} has been added to your blocklist and won't be able to join your lobbies.`
                            });

                        break;
                    }

                    await requestCollector.stop();
                });

                requestCollector.on("end", async () => {
                    try{
                        await threadReply.delete();
                    } catch(err) {};
                });

                await buttonInteraction.editReply(`Approval from ${partyOwner} has been requested at ${thread}`);
            break;
            case "delete-button":
                if(buttonInteraction.member.id != partyOwner.id
                    && !buttonInteraction.member.roles.cache.has(staffRoleData[0].role)
                ) {
                    return await buttonInteraction.editReply({content: "You are neither the party owner nor a staff member!"});
                }

                // remove party registry
                await poolConnection.query(`DELETE FROM partyroom WHERE guild=$1 AND owner=$2`, 
                    [buttonInteraction.guild.id, partyOwner.id]
                );

                // stop collector, delete message and the channel
                
                try{
                    await message.delete();
                } catch(err) {};
                
                try{
                    await channel.delete();
                } catch(err) {};
                
                try{
                    const thread = await message.channel.threads.cache.find(t => t.name === `${partyOwner.user.username}-party`)
                    await thread.delete();
                } catch(err) {};

                await buttonInteraction.editReply({content: "Party Deleted."});

                // logs
                const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs
                    WHERE guild=$1 AND eventtype=$2`, [buttonInteraction.guild.id, "lfg-logs"]);

                let logChannel = null;

                try{
                    logChannel = await buttonInteraction.guild.channels.fetch(logChannelData[0].channel);
                } catch(err) {};

                if(logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setAuthor({
                                    name: `[${partyRoomData[0].region.toUpperCase()}] ${partyOwner.user.username} party`,
                                    iconURL: partyOwner.displayAvatarURL({extension: "png"})
                                })
                                .setTimestamp()
                                .setFooter({text: `Owner ID: ${partyOwner.id}`})
                                .setTitle("Party Closed")
                                .addFields(
                                    {
                                        name: "Created",
                                        value: `<t:${partyRoomData[0].timestamp}:R>`
                                    },
                                    {
                                        name: "Closed by",
                                        value: `${buttonInteraction.member}`
                                    },
                                    {
                                        name: "Gamemode",
                                        value: id2gamemode[partyRoomData[0].gamemode]
                                    },
                                    {
                                        name: "IGN",
                                        value: partyRoomData[0].ign
                                    },
                                    {
                                        name: "Description",
                                        value: `${partyRoomData[0].description || "None"}`
                                    }
                                )
                        ]
                    });
                }
                await collector.stop();
            break;
        }
    });

    collector.on("end", async () => {
        // if no other function of the bot cleaned the channel and the database, end event will do
        const {rows: channelData} = await poolConnection.query(`SELECT channel FROM partyroom WHERE guild=$1 AND message=$2`,
            [message.guild.id, message.id]
        );

        if(channelData.length) {
            try{
                const channel = await message.guild.channels.fetch(channelData[0].channel);
                if(channel.members.size == 0) {
                    await channel.delete();
                }

                // in the event where there are still members in the partyroom and this event is called through timeout
                // the channel will be deleted by other functions of the bot, therefore, the database row will be cleared anyway
                await poolConnection.query(`DELETE FROM partyroom WHERE guild=$1 AND message=$2`, [message.guild.id, message.id]);
            } catch(err) {};
        }

        // when the collector is stopped or the time runs out, doing the neccessary checks and actions
        try{
            await message.delete();
        } catch(err) {};

        
    });
}

module.exports = {
    lfg_collector,
    lfg_buttons
}