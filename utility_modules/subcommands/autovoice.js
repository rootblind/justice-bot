const {
    EmbedBuilder, ComponentType, ButtonBuilder, ButtonStyle, ActionRowBuilder, Collection,
    ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags

} = require("discord.js");
const {poolConnection} = require("../kayle-db.js");
const {timestamp_seconds, hasCooldown} = require("../utility_methods.js");

const managerEmbedMaker = (guild) => {
    return new EmbedBuilder()
        .setColor("Purple")
        .setAuthor({
            name: `${guild.name} voice room manager`,
            iconURL: guild.iconURL({extension: "png"})
        })
        .setTitle("Manage your voice using the buttons below")
        .setDescription("Creating a new autovoice has a 5 minute cooldown!")
        .addFields(
            {
                name: "Limit",
                value: "Change the maximum member limit on your voice channel."
            },
            {
                name: "Add/Remove access",
                value: "Add or remove access from the members selected."
            },
            {
                name: "Lock/Unlock",
                value: "Lock or unlock access for everyone to join the channel.\nPeople already in the channel will be granted access unless revoked."
            },
            {
                name: "Bot Access",
                value: "Toggle if bots can access the channel."
            },
            {
                name: "Status",
                value: "Check the settings of your autovoice and your cooldown until you can create a new one."
            }
        )
}

const managerButtons = () => {
    const limitButton = new ButtonBuilder()
        .setCustomId("limit-button")
        .setLabel("Limit")
        .setStyle(ButtonStyle.Primary)

    const accessButton = new ButtonBuilder()
        .setCustomId("access-button")
        .setLabel("Add/Remove Access")
        .setStyle(ButtonStyle.Danger)

    const lockButton = new ButtonBuilder()
        .setCustomId("lock-button")
        .setLabel("Lock/Unlock")
        .setStyle(ButtonStyle.Danger)

    const botAccessButton = new ButtonBuilder()
        .setCustomId("bot-access-button")
        .setLabel("Bot Access")
        .setStyle(ButtonStyle.Secondary)

    const statusButton = new ButtonBuilder()
        .setCustomId("status-button")
        .setLabel("Status")
        .setStyle(ButtonStyle.Secondary)

    return new ActionRowBuilder()
        .addComponents(limitButton, accessButton, lockButton, botAccessButton, statusButton);

}

async function limit_button(interaction, voice) {
    // change the user limit of the channel

    // input will be given through modal

    const userLimitInput = new TextInputBuilder()
        .setCustomId("user-limit-input")
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true)
        .setPlaceholder("A number between 2 and 99.")
        .setLabel("User limit")

    const modalActionRow = new ActionRowBuilder().addComponents(userLimitInput)

    const modal = new ModalBuilder()
        .setCustomId("user-limit-modal")
        .setTitle("Change user Limit")
        .addComponents(modalActionRow);

    await interaction.showModal(modal);

    try{
        const submit = await interaction.awaitModalSubmit({
            filter: (i) => i.user.id === interaction.user.id,
            time: 120_000
        });

        const limit = submit.fields.getTextInputValue("user-limit-input");
        if(Number.isNaN(Number(limit))) {
            return await submit.reply({
                flags: MessageFlags.Ephemeral,
                content: "The input provided must be a number!"
            });
        }

        if(Number(limit) < 2 || Number(limit) > 99) {
            return await submit.reply({
                flags: MessageFlags.Ephemeral,
                content: "The number provided must be between 2 and 99!"
            });
        }

        await voice.setUserLimit(Number(limit));
        await submit.reply({
            flags: MessageFlags.Ephemeral,
            content: `User limit is now set to **${limit}** people.`
        });
    } catch(err) {
        console.error(err);
        await interaction.followUp({
            flags: MessageFlags.Ephemeral,
            content: "Time ran out, try again!"
        });
    }
}

async function access_button(interaction, voice) {
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId("select-member")
        .setPlaceholder("Give/remove access from members...")
        .setMinValues(1)
        .setMaxValues(10)

    const actionRow = new ActionRowBuilder().addComponents(userSelect)

    const reply = await interaction.reply({
        flags: MessageFlags.Ephemeral,
        components: [actionRow]
    });

    const fetchedReply = await interaction.fetchReply();

    const collector = fetchedReply.createMessageComponentCollector({
        ComponentType: ComponentType.UserSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 120_000
    });

    collector.on("end", async () => {
        try{
            await reply.delete();
        } catch(err) {}
    });

    collector.on("collect", async (selectInteraction) => {
        if(!selectInteraction.isUserSelectMenu) return;

        if(selectInteraction.customId == "select-member") {
            const gaveAccess = [];
            const revokedAccess = [];

            for(const userid of selectInteraction.values) {
                const member = await interaction.guild.members.fetch(userid);
                if(member.id == selectInteraction.user.id)
                    continue; // ignore self select
                if(voice.permissionsFor(member).has(PermissionFlagsBits.Connect)) {
                    // if the member has perms, deny them.
                    await voice.permissionOverwrites.edit(member.id, {
                        SendMessages: false,
                        Connect: false,
                        Speak: false,
                    });
                    revokedAccess.push(member);

                    // remove the member from the voice
                    if(member.voice.channelId == voice.id) {
                        member.voice.setChannel(null);
                    }
                } else {
                    await voice.permissionOverwrites.edit(member.id, {
                        SendMessages: true,
                        Connect: true,
                        Speak: true,
                    });
                    gaveAccess.push(member);
                }
            }

            let replyMessage = "Channel permissions changed.";
            if(gaveAccess.length > 0)
                replyMessage += `\nGave access to: ${gaveAccess.join(", ")}`;
            if(revokedAccess.length > 0)
                replyMessage += `\nRevoked access to: ${revokedAccess.join(", ")}`;

            await selectInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: replyMessage
            });

            await collector.stop();
        }
    });
}

async function lock_button(interaction, voice) {
    if(voice.permissionOverwrites.cache.find(
        perms => perms.id === interaction.guild.roles.everyone.id &&
        perms.deny.has(PermissionFlagsBits.Connect)
    )) { // if everyone role is denied, then the voice room is private and will be made public
        await voice.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
            SendMessages: true,
            Connect: true,
            Speak: true,
        });

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "Voice room set to **Public**."
        });
    } else {
        // if everyone role is not denied Connect perms, then the channel is public and will be made private granting access to people already
        // in the channel

        for(const member of voice.members) {
            await voice.permissionOverwrites.edit(member[0], {
                SendMessages: true,
                Connect: true,
                Speak: true,
            });
        }

        await voice.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
            SendMessages: false,
            Connect: false,
            Speak: false,
        });

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "The voice room is now private.\nAccess was granted to the members already in this channel."
        });
    }
}

async function bot_access_button(interaction, voice) {
    const {rows: botRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='bot'`,
        [interaction.guild.id]
    );

    if(botRoleData.length == 0) {
        return await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "You can not do that since there is no bot role defined on this server."
        });
    }

    let botrole = null;
    try {
        botrole = await interaction.guild.roles.fetch(botRoleData[0].role);
    } catch(err) {
        return await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: 'Something went wrong with the bot role.'
        });
    }

    if(voice.permissionOverwrites.cache.find(
        perms => perms.id === botrole.id && perms.deny.has(PermissionFlagsBits.Connect)
    )) {
        // if bots are denied, grant access
        await voice.permissionOverwrites.edit(botrole.id, {
            SendMessages: true,
            Connect: true,
            Speak: true,
        });

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "Bots can now join your voice!"
        });
    } else {
        await voice.permissionOverwrites.edit(botrole.id, {
            SendMessages: false,
            Connect: false,
            Speak: false,
        });

        // remove bots from voice

        for(const member of voice.members.values()) {
            if(member.user.bot)
                member.voice.setChannel(null);
        }

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "Now bots can no longer join this voice."
        });
    }
}

async function status_button(interaction, voice) {
    const channelStatus = {
        private: false,
        limit: voice.userLimit,
        botAccess: true,
        expires: timestamp_seconds()
    }

    // checking if private
    if(voice.permissionOverwrites.cache.find(
        perms => perms.id === interaction.guild.roles.everyone.id &&
        perms.deny.has(PermissionFlagsBits.Connect)
    )) {
        channelStatus.private = true;
    }

    // checking if bots have access denied
    const {rows: botRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='bot'`,
        [interaction.guild.id]
    );
    
    if(botRoleData.length) {
        let botrole = null;
        try {
            botrole = await interaction.guild.roles.fetch(botRoleData[0].role);
        } catch(err) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: 'Something went wrong with the bot role.'
            });
        }

        if(voice.permissionOverwrites.cache.find(
            perms => perms.id === botrole.id && perms.deny.has(PermissionFlagsBits.Connect)
        )) {
            channelStatus.botAccess = false;
        }
    }

    // cooldown expiration
    const {rows: cooldownData} = await poolConnection.query(`SELECT expires FROM autovoicecd WHERE guild=$1 AND member=$2`,
        [interaction.guild.id, interaction.member.id]
    );

    if(cooldownData.length) {
        channelStatus.expires = cooldownData[0].expires;
    }

    const embed = new EmbedBuilder()
        .setColor("Aqua")
        .setAuthor({
            name: `${interaction.user.username} autovoice status`,
            iconURL: interaction.user.displayAvatarURL({extension: "png"})
        })
        .addFields(
            {
                name: "Status",
                value: `${channelStatus.private ? "Private" : "Public"}`
            },
            {
                name: "User limit",
                value: `${channelStatus.userLimit ? channelStatus.userLimit : "None"}`
            },
            {
                name: "Bot access",
                value: `${channelStatus.botAccess ? "Granted" : "Denied"}`
            },
            {
                name: "Cooldown expire",
                value: `<t:${channelStatus.expires}:R>`
            }
        )

    return await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [embed]
    });
}

async function load_autovoice_collector(message) {
    const internalcooldowns = new Collection();

    const collector = message.createMessageComponentCollector({
        ComponentType: ComponentType.Button
    });

    collector.on("collect", async (interaction) => {
        if(!interaction.isButton()) return;
        const userCooldown = hasCooldown(interaction.user.id, internalcooldowns, 5_000);

        if(userCooldown) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You're pressing buttons too fast! Cooldown: <t:${timestamp_seconds(userCooldown)}:R>`
            });
        }

        internalcooldowns.set(interaction.user.id, Date.now())
        setTimeout(() => internalcooldowns.delete(interaction.user.id), 5_000);

        // every button except status will require the user to be in his the voice room

        // fetching the channel
        const {rows: voiceData} = await poolConnection.query(`SELECT channel FROM autovoiceroom WHERE guild=$1 AND owner=$2`,
            [interaction.guild.id, interaction.user.id]
        );

        if(voiceData.length == 0) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You do not own a voice room."
            });
        }

        if(interaction.customId != "status-button" && interaction.member.voice.channelId != voiceData[0].channel) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You must be in your voice room to do that.\nJoin **Auto Voice** channel if you don\'t have one."
            });
        }

        const voice = await interaction.guild.channels.fetch(voiceData[0].channel);

        switch(interaction.customId) {
            case "limit-button":
                await limit_button(interaction, voice);
            break;
            case "access-button":
                await access_button(interaction, voice);
            break;
            case "lock-button":
                await lock_button(interaction, voice);
            break;
            case "bot-access-button":
                await bot_access_button(interaction, voice);
            break;
            case "status-button":
                await status_button(interaction, voice);
            break;
        }

    });

}

async function autovoice_manager(manager) {
    // manager is the manager text channel

    const message = await manager.send({
        embeds: [ managerEmbedMaker(manager.guild) ],
        components: [ managerButtons() ]
    });

    await poolConnection.query(`INSERT INTO autovoicemanager(guild, message) VALUES($1, $2)`, [manager.guild.id, message.id]);

    await load_autovoice_collector(message);
}

async function create_autovoice(channel, member) {
    // logic will be implemented through this method in order to reduce the lines of code inside voiceStateUpdate
    const guild = channel.guild;

    // checking if the channel is the autovoice channel
    const {rows: inAutoVoice} = await poolConnection.query(`SELECT EXISTS
        (SELECT 1 FROM autovoicechannel WHERE guild=$1 AND channel=$2 AND type='autovoice')`,
        [guild.id, channel.id]
    );
    if(!inAutoVoice[0].exists) {
        // if the new state voice channel is registered in autovoicechannel as "autovoice" type
        return false; // return false if the channel is not autovoice
    }

    // checking if the member already has a room
    const {rows: isAlreadyOwner} = await poolConnection.query(`SELECT EXISTS
        (SELECT 1 FROM autovoiceroom WHERE guild=$1 AND owner=$2)`,
        [guild.id, member.id]
    );

    if(isAlreadyOwner[0].exists) {
        return false; // return false if the member already has a room
    }

    // checking if the member is on cooldown
    const {rows: cooldownData} = await poolConnection.query(`SELECT expires FROM autovoicecd
        WHERE guild=$1 AND member=$2`, [guild.id, member.id]);

    if(cooldownData.length) { 
        if(cooldownData[0].expires > timestamp_seconds()) {
            return false; // return false if the member is still on cooldown
        }
        else {
            // if the cooldown expired, remove it
            await poolConnection.query(`DELETE FROM autovoicecd WHERE guild=$1 AND member=$2`, [guild.id, member.id]);
        }
    }

    // the bot will create an autovoice if the member joined auto voice room, doesn't own a room yet and isn't on cooldown

    const {rows: autovoiceCategoryData} = await poolConnection.query(`SELECT channel FROM autovoicechannel
        WHERE guild=$1 AND type='category'`, [guild.id]);

    const category = await guild.channels.fetch(autovoiceCategoryData[0].channel);
    
    let order = 1;

    const {rows: voiceRoomData} = await poolConnection.query(`SELECT order_room FROM autovoiceroom
        WHERE guild=$1
        ORDER BY order_room DESC
        LIMIT 1`,
        [guild.id]
    ); // fetching the order number of the last voice

    if(voiceRoomData.length)
        order = Number(voiceRoomData[0].order_room) + 1;

    const voice = await guild.channels.create({
        name: `Voice Room #${order}`,
        type: ChannelType.GuildVoice,
        parent: category
    });

    await member.voice.setChannel(voice); // move member to the voice

    await poolConnection.query(`INSERT INTO autovoiceroom(guild, channel, owner, timestamp, order_room)
        VALUES($1, $2, $3, $4, $5)`, [guild.id, voice.id, member.id, timestamp_seconds(), order]); // register room

    // register cooldown
    await poolConnection.query(`INSERT INTO autovoicecd(guild, member, expires)
        VALUES($1, $2, $3)`, [guild.id, member.id, timestamp_seconds() + 300]);
}

async function remove_autovoice(channel, member) {
    const guild = channel.guild;
    
    // once an autovoice is empty, it must be removed
    const {rows: isVoiceRoom} = await poolConnection.query(`SELECT EXISTS
        (SELECT 1 FROM autovoiceroom WHERE guild=$1 AND channel=$2)`,
        [guild.id, channel.id]
    );

    if(!isVoiceRoom[0].exists) {
        return false; // ignore if this channel is not an auto voice room
    }

    if(channel.members.size) {
        return false; // ignore if the channel is not empty after the member leaves
    }

    // delete the channel and remove it from db
    try{
        await channel.delete();
    } catch(err) {
        console.error(err);
    }

    await poolConnection.query(`DELETE FROM autovoiceroom WHERE guild=$1 AND channel=$2`, [guild.id, channel.id]);
}

module.exports = {
    autovoice_manager,
    load_autovoice_collector,
    create_autovoice,
    remove_autovoice
}