import {
    ActionRowBuilder,
    ChannelType,
    Collection,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    Message,
    MessageFlags,
    OverwriteResolvable,
    OverwriteType,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    VoiceChannel
} from "discord.js";
import { anyBots, fetchGuildChannel, fetchGuildMember, hasBlockedContent, message_collector } from "../../utility_modules/discord_helpers.js";
import AutoVoiceSystemRepo from "../../Repositories/autovoicesystem.js";
import AutoVoiceRoomRepo from "../../Repositories/autovoiceroom.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { has_cooldown } from "../../utility_modules/utility_methods.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { channelLimitModal, channelNameModal, selectRegionRow } from "./autovoice_components.js";
import { local_config } from "../../objects/local_config.js";
import BlockSystemRepo from "../../Repositories/blocksystem.js";
import { add_block_collector, remove_block_collector, select_block_row, select_unblock_builder } from "../block/block_system.js";

const relevantPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak
]

/**
 * Create autovoice room for the member after doing the necessary checks
 */
export async function create_autovoice_room(autovoice: VoiceChannel, member: GuildMember) {
    const guild = member.guild;

    const autovoiceSystem = await AutoVoiceSystemRepo.getAutoVoiceSystem(guild.id, autovoice.id);
    if (autovoiceSystem === null) return;

    const isOwnerAlready = await AutoVoiceRoomRepo.isOwner(guild.id, member.id);
    const hasCooldown = await AutoVoiceRoomRepo.getCooldown(guild.id, member.id);

    if (isOwnerAlready || hasCooldown !== null) {
        try {
            await member.voice.setChannel(null); // disconnect from autovoice
        } catch (error) {
            await errorLogHandle(error);
        }

        return;
    } // owners and people on cooldown do not get a new room

    const category = autovoice.parent;
    if (category === null || autovoiceSystem.category !== category.id) {
        // this can happen when the autovoice channel is moved
        await AutoVoiceSystemRepo.deleteSystem(guild.id, autovoiceSystem.message);
        throw new Error("create_autovoice was called on an invalid autovoice. Deleting the system from database.");
    }

    const order = (await AutoVoiceRoomRepo.getLastOrder(guild.id)) + 1;

    const perms: OverwriteResolvable[] = [
        {
            id: member.id,
            allow: relevantPermissions
        }
    ];

    const mutualBlockedList = await BlockSystemRepo.getMutualRestrictedList(guild.id, member.id);
    for (const id of mutualBlockedList) { // deny access to mutual restricted members from the channel
        const user = await fetchGuildMember(guild, id);
        if (user) {
            perms.push(
                {
                    id: user.id,
                    type: OverwriteType.Member,
                    deny: relevantPermissions
                }
            )
        }
    }

    const voiceRoom = await category.children.create({
        name: `Room #${order}`,
        type: ChannelType.GuildVoice,
        permissionOverwrites: perms
        // TODO: AFTER SERVERROLES ALLOW STAFF ROLE
    });

    await AutoVoiceRoomRepo.put(guild.id, voiceRoom.id, member.id, order);
    await AutoVoiceRoomRepo.setCooldown(guild.id, member.id);
    try {
        member.voice.setChannel(voiceRoom);
    } catch (error) {
        await errorLogHandle(error);
    }
}

/**
 * Delete the channel provided if it's a voice room.
 * Necessary checks must be done before callind this method since the method only checks if the channel is AutoVoice Room
 */
export async function delete_autovoice_room(voiceRoom: VoiceChannel) {
    const guild = voiceRoom.guild;
    const isAutoVoiceRoom = await AutoVoiceRoomRepo.isAutoVoiceRoom(guild.id, voiceRoom.id);
    if (!isAutoVoiceRoom) return; // if the channel is not autovoice room, ignore it

    try {
        voiceRoom.delete();
        await AutoVoiceRoomRepo.deleteRoom(guild.id, voiceRoom.id);
    } catch (error) {
        await errorLogHandle(error);
    }

}

export async function attach_autovoice_manager_collector(message: Message) {
    const buttonCooldowns = new Collection<string, number>();
    const innerCooldown = 5;
    const collector = await message_collector<ComponentType.Button>(
        message,
        {
            componentType: ComponentType.Button
        },
        async (buttonInteraction) => {
            const member = buttonInteraction.member as GuildMember;
            const guild = member.guild;

            const userCooldown = has_cooldown(member.id, buttonCooldowns, innerCooldown);
            if (userCooldown) {
                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [embed_message("Red", `You are pressing buttons too fast! <t:${userCooldown}:R>`)]
                });
                return;
            } else {
                buttonCooldowns.set(member.id, Math.floor(Date.now() / 1000));
                setTimeout(() => buttonCooldowns.delete(member.id), innerCooldown * 1000);
            }

            // ensure that the member is in their own channel when using manage buttons
            const memberRoomData = await AutoVoiceRoomRepo.getMemberRoom(guild.id, member.id);
            if (
                buttonInteraction.customId !== "autovoice-status-button" &&
                buttonInteraction.customId !== "claim-owner-button"
            ) {
                // all buttons except status require the member to be in the owned autovoice
                if (member.voice.channel === null || memberRoomData === null) {
                    // 
                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("You must be in your own autovoice room to do that!")]
                    });

                    return;
                }
                if (memberRoomData.channel !== member.voice.channelId) {
                    // if the member is in an autovoice owned by someone else
                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("You can't do that with someone else's autovoice room!")]
                    });

                    return;
                }
            }

            switch (buttonInteraction.customId) {
                case "name-channel-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    await buttonInteraction.showModal(channelNameModal);
                    try {
                        const submit = await buttonInteraction.awaitModalSubmit({
                            filter: (i) => i.user.id === member.id,
                            time: 120_000
                        });

                        await submit.deferReply({ flags: MessageFlags.Ephemeral });
                        const newName = submit.fields.getTextInputValue("channel-name-input");

                        const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
                        const badName = await hasBlockedContent(newName, localTriggers, guild);
                        if (badName) {
                            await submit.editReply({ embeds: [embed_error("Bad word usage in the name!", "Blocked words detected.")] })
                            return;
                        }

                        try {
                            await room.edit({ name: newName });
                            await submit.editReply({ embeds: [embed_message("Green", `Your channel was renamed to **${newName}**`)] });
                        } catch (error) {
                            await errorLogHandle(error);
                        }
                    } catch {
                        await buttonInteraction.followUp({ flags: MessageFlags.Ephemeral, embeds: [embed_message("Red", "Time ran out, interaction expired.")] });
                    }
                    break;
                }
                case "limit-channel-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    await buttonInteraction.showModal(channelLimitModal);
                    try {
                        const submit = await buttonInteraction.awaitModalSubmit({
                            filter: (i) => i.user.id === member.id,
                            time: 120_000
                        });

                        const limit = Number(submit.fields.getTextInputValue("channel-limit-input"));
                        if (Number.isNaN(limit)) { // invalid characters that are not digits
                            await submit.reply({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_error("You must provide a valid number (0 - 99).")]
                            });
                        }

                        if (limit < room.members.size && limit > 0) {
                            // limit = 0 means remove limit
                            // if the limit given is not to be removed and is under the number of members currently on the room
                            await submit.reply({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_error(`There are currently ${room.members.size} members on your room, limit can not be less than that.\n0 may be given as it removes the limit.`)]
                            });
                        }

                        try {
                            await room.setUserLimit(limit);
                        } catch (error) {
                            await errorLogHandle(error);
                        }

                        await submit.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_message("Green", `Your room has its limit set to ${limit ? limit : "none"}.`)]
                        });
                    } catch {
                        await buttonInteraction.followUp({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_message("Red", "Time ran out, interaction expired.")]
                        });
                    }
                    break;
                }
                case "hide-channel-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    const viewChannelPermission = room.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.ViewChannel);

                    await room.permissionOverwrites.edit(guild.roles.everyone, {
                        ViewChannel: !viewChannelPermission
                    });

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_message("Aqua", `Your channel is now ${viewChannelPermission ? "Hidden.\nOnly you and trusted members can see this channel.\nMembers currently on the channel can see it too until they leave." : "Visible"}`)]
                    });

                    break;
                }
                case "lock-channel-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    const lock = room.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.Connect);
                    await room.permissionOverwrites.edit(guild.roles.everyone, {
                        Connect: !lock,
                        SendMessages: !lock,
                        Speak: !lock,
                    });
                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_message("Aqua", `Your channel is now ${lock ? "Locked.\nOnly you and trusted members can join and speak in this channel.\nMembers currently on the voice channel that are not trusted will lack permissions." : "Unlocked"}`)]
                    });

                    break;
                }
                case "region-channel-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        components: [selectRegionRow]
                    });

                    const reply = await buttonInteraction.fetchReply();
                    const collector = await message_collector<ComponentType.StringSelect>(
                        reply,
                        {
                            componentType: ComponentType.StringSelect,
                            lifetime: 120_000,
                            filter: (i) => i.user.id === member.id
                        },
                        async (selectInteraction) => {
                            if (selectInteraction.customId !== "select-room-region") return;
                            if (member.voice.channelId !== room.id) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It looks like you left the channel while performing this action...")]
                                });
                                collector.stop();
                                return;
                            }
                            const isStillOwner = await AutoVoiceRoomRepo.isRoomOwner(guild.id, member.id, room.id);
                            if (!isStillOwner) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It seems like you are no longer the owner of this room!")]
                                });
                                collector.stop();
                                return;
                            }

                            const region = selectInteraction.values[0];
                            if (typeof region !== "string") return;
                            if (region === "automatic") {
                                await room.setRTCRegion(null); // null sets region to automatic
                            } else {
                                await room.setRTCRegion(region);
                            }

                            await selectInteraction.reply({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_message("Green", `Your room region is now set to ${region}.`)]
                            })
                        },
                        async () => {
                            await buttonInteraction.followUp({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_message("Aqua", "Interaction ended.")]
                            });
                        }
                    );
                    break;
                }
                case "trust-member-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    const userListOnRoom = room.members
                        .filter((m) => m.user.id !== member.id)
                        .map((m) => m.user.id);
                    const selectUsers = new UserSelectMenuBuilder()
                        .setCustomId("select-user-trust")
                        .setMinValues(1)
                        .setMaxValues(10)
                        .setPlaceholder("Select users to be trusted and granted access.")
                        .setDefaultUsers(userListOnRoom);

                    const selectUsersRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectUsers);

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        components: [selectUsersRow]
                    });

                    const reply = await buttonInteraction.fetchReply();
                    const collector = await message_collector<ComponentType.UserSelect>(
                        reply,
                        {
                            componentType: ComponentType.UserSelect,
                            lifetime: 120_000,
                            filter: (i) => i.user.id === member.id
                        },
                        async (selectInteraction) => {
                            if (selectInteraction.customId !== "select-user-trust") return;
                            if (member.voice.channelId !== room.id) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It looks like you left the channel while performing this action...")]
                                });
                                collector.stop();
                                return;
                            }

                            const isStillOwner = await AutoVoiceRoomRepo.isRoomOwner(guild.id, member.id, room.id);
                            if (!isStillOwner) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It seems like you are no longer the owner of this room!")]
                                });
                                collector.stop();
                                return;
                            }

                            if (selectInteraction.values.includes(member.id)) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("You can not target yourself!")]
                                });
                                collector.stop();
                                return;
                            }

                            const mutualRestricted = await BlockSystemRepo.getMutualRestrictedList(guild.id, member.id);
                            const selectedIds = new Set(selectInteraction.values);
                            if (mutualRestricted.some(id => selectedIds.has(id))) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [
                                        embed_error(
                                            "One or more of the members selected are being blocked by you or they have you on their blocklist!",
                                            "Mutual restriction"
                                        )
                                    ]
                                });

                                collector.stop();
                                return;
                            }

                            const botSelected = await anyBots(guild, selectInteraction.values);
                            if (botSelected) {
                                await selectInteraction.reply({
                                    embeds: [embed_error("You can not target bots!")],
                                    flags: MessageFlags.Ephemeral
                                });
                                collector.stop();
                                return;
                            }

                            for (const user of selectInteraction.values) {
                                // TODO DO NOT ALLOW TARGETING STAFF MEMBERS
                                await room.permissionOverwrites.edit(user, {
                                    ViewChannel: true,
                                    Connect: true,
                                    Speak: true,
                                    SendMessages: true
                                });
                            }

                            const allowedMembers = selectInteraction.values.map(u => `<@${u}>`).join(" ");
                            await selectInteraction.reply({
                                flags: MessageFlags.Ephemeral,
                                embeds: [
                                    embed_message(
                                        "Green",
                                        `${allowedMembers} ${selectInteraction.values.length > 1 ? "are" : "is"} now trusted on your room.`
                                    )
                                ]
                            });
                            collector.stop();
                        },
                        async () => {
                            await buttonInteraction.followUp({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_message("Red", "Interaction ended.")]
                            });
                            try {
                                await buttonInteraction.deleteReply();
                            } catch (error) {
                                await errorLogHandle(error);
                            }
                        }
                    );
                    break;
                }
                case "untrust-member-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    const userListOnRoom = room.members
                        .filter((m) => m.user.id !== member.id)
                        .map((m) => m.user.id);
                    const selectUsers = new UserSelectMenuBuilder()
                        .setCustomId("select-user-untrust")
                        .setMinValues(1)
                        .setMaxValues(10)
                        .setPlaceholder("Select users to be untrusted and denied access.")
                        .setDefaultUsers(userListOnRoom);

                    const selectUsersRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectUsers);

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        components: [selectUsersRow]
                    });

                    const reply = await buttonInteraction.fetchReply();
                    const collector = await message_collector<ComponentType.UserSelect>(
                        reply,
                        {
                            componentType: ComponentType.UserSelect,
                            lifetime: 120_000,
                            filter: (i) => i.user.id === member.id
                        },
                        async (selectInteraction) => {
                            if (selectInteraction.customId !== "select-user-untrust") return;
                            if (member.voice.channelId !== room.id) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It looks like you left the channel while performing this action...")]
                                });
                                collector.stop();
                                return;
                            }

                            const isStillOwner = await AutoVoiceRoomRepo.isRoomOwner(guild.id, member.id, room.id);
                            if (!isStillOwner) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It seems like you are no longer the owner of this room!")]
                                });
                                collector.stop();
                                return;
                            }

                            if (selectInteraction.values.includes(member.id)) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("You can not target yourself!")]
                                });
                                collector.stop();
                                return;
                            }

                            const mutualRestricted = await BlockSystemRepo.getMutualRestrictedList(guild.id, member.id);
                            const selectedIds = new Set(selectInteraction.values);
                            if (mutualRestricted.some(id => selectedIds.has(id))) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [
                                        embed_error(
                                            "One or more of the members selected are being blocked by you or they have you on their blocklist!",
                                            "Mutual restriction"
                                        )
                                    ]
                                });

                                collector.stop();
                                return;
                            }

                            const botSelected = await anyBots(guild, selectInteraction.values);
                            if (botSelected) {
                                await selectInteraction.reply({
                                    embeds: [embed_error("You can not target bots!")],
                                    flags: MessageFlags.Ephemeral
                                });
                                collector.stop();
                                return;
                            }

                            for (const user of selectInteraction.values) {
                                // TODO DO NOT ALLOW TARGETING STAFF MEMBERS
                                await room.permissionOverwrites.edit(user, {
                                    ViewChannel: false,
                                    Connect: false,
                                    Speak: false,
                                    SendMessages: false
                                });

                                const untrustedMember = await fetchGuildMember(guild, user);
                                if (untrustedMember && untrustedMember.voice.channelId === room.id) {
                                    // if the untrusted member is in the room, kick the member out
                                    try {
                                        await untrustedMember.voice.setChannel(null);
                                    } catch (error) {
                                        await errorLogHandle(error);
                                    }
                                }
                            }

                            const deniedMembers = selectInteraction.values.map(u => `<@${u}>`).join(" ");
                            await selectInteraction.reply({
                                flags: MessageFlags.Ephemeral,
                                embeds: [
                                    embed_message(
                                        "Green",
                                        `${deniedMembers} ${selectInteraction.values.length > 1 ? "are" : "is"} now untrusted on your room.`
                                    )
                                ]
                            });
                            collector.stop();
                        },
                        async () => {
                            await buttonInteraction.followUp({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_message("Red", "Interaction ended.")]
                            });

                            try {
                                await buttonInteraction.deleteReply();
                            } catch (error) {
                                await errorLogHandle(error);
                            }
                        }
                    );
                    break;
                }
                case "block-member-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        components: [select_block_row()]
                    });

                    const reply = await buttonInteraction.fetchReply();
                    await add_block_collector(reply, member, buttonInteraction)
                        .then(async (blocks) => {
                            const isStillOwner = await AutoVoiceRoomRepo.isRoomOwner(guild.id, member.id, room.id);
                            if (!isStillOwner) return;
                            for (const userId of blocks) {
                                try {
                                    if (member.voice.channelId === room.id) {
                                        await room.permissionOverwrites.edit(userId, {
                                            SendMessages: false,
                                            ViewChannel: false,
                                            Connect: false,
                                            Speak: false
                                        });

                                        const blockedMember = await fetchGuildMember(guild, userId);
                                        if (blockedMember && blockedMember.voice.channelId === room.id) {
                                            await blockedMember.voice.setChannel(null);
                                        }
                                    }
                                } catch (error) {
                                    await errorLogHandle(error);
                                }
                            }
                        });

                    break;
                }
                case "unblock-member-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
                    const blocklist = await BlockSystemRepo.getMemberBlockList(guild.id, member.id);
                    if (blocklist.length === 0) {
                        await buttonInteraction.editReply({
                            embeds: [embed_message("Aqua", "Your blocklist is empty")]
                        });

                        return;
                    }
                    const unblockMenu = await select_unblock_builder(guild, blocklist);
                    await buttonInteraction.editReply({ components: [unblockMenu] });
                    const reply = await buttonInteraction.fetchReply();
                    const ids = await remove_block_collector(reply, member, buttonInteraction);
                    if (ids.length) {
                        await buttonInteraction.followUp({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_message("Aqua", "Unblocking someone doesn't grant them access to this channel, add them to trusted members.")]
                        });
                    }

                    break;
                }
                case "claim-owner-button": {
                    if (member.voice.channel === null) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("You must be in an autovoice to do that!")]
                        });
                        return;
                    }
                    if (memberRoomData !== null) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("You already own a room, you can't claim another one!")]
                        });
                        return;
                    }
                    const room = member.voice.channel as VoiceChannel;
                    const currentRoomData = await AutoVoiceRoomRepo.getRoom(guild.id, room.id);
                    if (!currentRoomData) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("You must be in an autovoice to do that!")]
                        });
                        return;
                    }

                    const currentOwner = await fetchGuildMember(guild, currentRoomData.owner);
                    if (currentOwner && currentOwner.voice.channelId === room.id) {
                        // the owner is still in the room
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("You can't claim a room when the owner is still there.")]
                        });
                        return;
                    }

                    await AutoVoiceRoomRepo.changeOwnerRoom(guild.id, member.id, room.id);
                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_message("Green", `You are now the owner of ${room}`)]
                    });
                    break;
                }
                case "transfer-owner-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    const memberList = room.members.map((m) => m).filter((m) => m.id !== member.id);
                    if (memberList.length === 0) {
                        await buttonInteraction.reply({
                            embeds: [embed_error("You have no one to transfer the ownership to!", "You're the only one in the room")],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const options = []
                    for (const member of memberList) {
                        options.push({
                            label: member.user.username,
                            value: member.id,
                            description: `Assign ${member.user.username} as the new owner`
                        });
                    }

                    const selectNewOwner = new StringSelectMenuBuilder()
                        .setCustomId("select-new-owner")
                        .setPlaceholder("Select a new owner from the room...")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(options);

                    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectNewOwner);

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        components: [actionRow]
                    });

                    const reply = await buttonInteraction.fetchReply();

                    const collector = await message_collector<ComponentType.StringSelect>(
                        reply,
                        {
                            componentType: ComponentType.StringSelect,
                            lifetime: 120_000,
                            filter: (i) => i.user.id === member.id
                        },
                        async (selectInteraction) => {
                            if (selectInteraction.customId !== "select-new-owner") return;
                            if (!selectInteraction.values[0]) return;
                            const newOwnerId = selectInteraction.values[0];

                            const isStillOwner = await AutoVoiceRoomRepo.isRoomOwner(guild.id, member.id, room.id);
                            if (!isStillOwner) {
                                await selectInteraction.reply({
                                    flags: MessageFlags.Ephemeral,
                                    embeds: [embed_error("It seems like you are no longer the owner of this room!")]
                                });
                                collector.stop();
                                return;
                            }

                            // give perms to the new owner
                            await room.permissionOverwrites.edit(newOwnerId, {
                                ViewChannel: true,
                                SendMessages: true,
                                Connect: true,
                                Speak: true
                            });


                            await AutoVoiceRoomRepo.changeOwnerRoom(guild.id, newOwnerId, room.id);
                            await selectInteraction.reply({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_message("Green", `<@${newOwnerId}> is the new owner of ${room}.`)]
                            });
                            collector.stop();
                        },
                        async () => {
                            await buttonInteraction.followUp({
                                flags: MessageFlags.Ephemeral,
                                embeds: [embed_message("Aqua", "Interaction ended.")]
                            });
                            await buttonInteraction.deleteReply();
                        }
                    )
                    break;
                }
                case "delete-channel-button": {
                    const room = await fetchGuildChannel(guild, memberRoomData!.channel);
                    if (!(room instanceof VoiceChannel)) {
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_error("Failed to fetch your room from database to discord, might no longer exist")]
                        });

                        // if failed to build channel object, delete the row
                        await AutoVoiceRoomRepo.deleteRoom(guild.id, memberRoomData!.channel);
                        return;
                    }

                    await AutoVoiceRoomRepo.deleteRoom(guild.id, room.id);
                    try {
                        await room.delete(`${member.user.username} deleted their room through the manager.`);
                    } catch (error) {
                        await errorLogHandle(error);
                    }

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_message("Green", "You deleted your own autovoice room.")]
                    });
                    break;
                }
                case "autovoice-status-button": {
                    const embed = new EmbedBuilder()
                        .setColor("Aqua")
                        .setAuthor({
                            name: `${member.user.username} autovoice status`,
                            iconURL: member.displayAvatarURL({ extension: "jpg" })
                        });

                    const cooldown = await AutoVoiceRoomRepo.getCooldown(guild.id, member.id);
                    embed.addFields({
                        name: "Cooldown",
                        value: `${cooldown ? `<t:${cooldown}:R>` : "None"}`
                    });

                    embed.addFields({
                        name: "Currently in",
                        value: member.voice.channel ? `${member.voice.channel}` : "None"
                    });

                    if (memberRoomData) {
                        const voice = await fetchGuildChannel(guild, memberRoomData.channel);
                        if (voice instanceof VoiceChannel) {
                            const everyone = guild.roles.everyone;
                            embed.addFields(
                                {
                                    name: "Voice room",
                                    value: `${voice}`
                                },
                                {
                                    name: "Visibility",
                                    value: voice.permissionsFor(everyone).has(PermissionFlagsBits.ViewChannel) ? "Visible" : "Hidden"
                                },
                                {
                                    name: "Accessability",
                                    value: voice.permissionsFor(everyone).has(PermissionFlagsBits.Connect) ? "Unlocked" : "Locked"
                                }
                            );
                        } else {
                            embed.addFields({
                                name: "Voice room",
                                value: "None"
                            });
                        }

                    } else {
                        embed.addFields({
                            name: "Voice room",
                            value: "None"
                        });
                    }

                    await buttonInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [ embed ]
                    });

                    break;
                }
            }
        },
        async () => { }
    )

    return collector;
}