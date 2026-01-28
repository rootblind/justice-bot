import { ChannelType, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, VoiceChannel } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import AutoVoiceRoomRepo, { AUTOVOICE_COOLDOWN } from "../../Repositories/autovoiceroom.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { AutoVoiceRoom } from "../../Interfaces/database_types.js";
import { fetchGuildChannel, fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import { duration_timestamp, seconds_to_duration, time_unit_conversion } from "../../utility_modules/utility_methods.js";
import AutoVoiceSystemRepo from "../../Repositories/autovoicesystem.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";

const autovoice_admin: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("autovoice-admin")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Administrate autovoice rooms.")
        .addSubcommand(subcommand =>
            subcommand.setName("delete")
                .setDescription("Delete an autovoice room. Given the channel and the owner, channel has priority.")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The autovoice room to be removed.")
                        .addChannelTypes(ChannelType.GuildVoice)
                )
                .addUserOption(option =>
                    option.setName("owner")
                        .setDescription("The member owner of the room to be deleted.")
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("transfer-owner")
                .setDescription("Transfer ownership of the autovoice room to another member than the current one.")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The autovoice channel to have its ownership transfered.")
                        .addChannelTypes(ChannelType.GuildVoice)
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName("new-owner")
                        .setDescription("The member to be designated as the new owner of the autovoice room.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("timeout")
                .setDescription("Timeout a member from creating new autovoice rooms.")
                .addUserOption(option =>
                    option.setName("member")
                        .setDescription("The member to be set on timeout from creating autovoice rooms.")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("duration")
                        .setDescription("The duration of the timeout. Ex: 3h for 3 hours")
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(2)
                )
        )
        .toJSON(),
    async execute(interaction) {
        // TODO: ONCE LOGS ARE SET UP, ADD LOGGING FOR THESE ACTIONS
        const interactionMember = interaction.member as GuildMember;
        const guild = interactionMember.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        const voice = options.getChannel("channel");
        const owner = options.getUser("owner");
        const newOwner = options.getUser("new-owner");

        // check if there is any system to administrate on this guild
        const autoVoiceGuildSystems = await AutoVoiceSystemRepo.getGuildSystems(guild.id);
        if(autoVoiceGuildSystems.length === 0) {
            await interaction.reply({
                embeds: [
                    embed_error("No autovoice system was found for this guild.\nThere is nothing to administrate with this command.\nRun `/autovoice-setup` to get started.")
                ],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // validate voice if given
        if (voice instanceof VoiceChannel) {
            const isAutovoiceRoom = await AutoVoiceRoomRepo.isAutoVoiceRoom(guild.id, voice.id);
            if (!isAutovoiceRoom) {
                await interaction.reply({
                    embeds: [
                        embed_error("The channel provided is not an autovoice room!", "Invalid input")
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        // validate owner if given
        if (owner) {
            if(owner.bot) {
                await interaction.reply({
                    embeds: [
                        embed_error("You can not target bots!", "Invalid input")
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const isOwner = await AutoVoiceRoomRepo.isOwner(guild.id, owner.id);
            if (!isOwner) {
                await interaction.reply({
                    embeds: [
                        embed_error("The member provided as owner does not own an autovoice room.")
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        // validate new owner if given (must not own a room already)
        if (newOwner) {
            if(newOwner.bot) {
                await interaction.reply({
                    embeds: [
                        embed_error("You can not target bots!", "Invalid input")
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            const isOwner = await AutoVoiceRoomRepo.isOwner(guild.id, newOwner.id);
            if (isOwner) {
                await interaction.reply({
                    embeds: [
                        embed_error("You can not transfer ownership to someone who already owns a room.")
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        switch (subcommand) {
            case "delete": {
                if (voice === null && owner === null) {
                    await interaction.reply({
                        embeds: [
                            embed_error("At least one parameter must be given!", "No input provided")
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                // a room can be deleted by providing both the owner and the room itself
                // if both are given, the channel parameter takes priority

                if (voice instanceof VoiceChannel) {
                    // autovoice status already checked above
                    await AutoVoiceRoomRepo.deleteRoom(guild.id, voice.id);
                    try {
                        await voice.delete();
                        await interaction.reply({
                            embeds: [ embed_message("Green", `Successfully deleted **${voice.name}** autovoice.`) ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    } catch(error) {
                        await errorLogHandle(error);
                        await interaction.reply({
                            embeds: [ embed_error("Something went wrong while trying to delete the autovoice room...") ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                }

                if(owner !== null) {
                    // ownership status already checked above
                    // fetch room before deletion

                    const roomData = await AutoVoiceRoomRepo.getMemberRoom(guild.id, owner.id) as AutoVoiceRoom; // casting since existence was checked above
                    const channel = await fetchGuildChannel(guild, roomData.channel);
                    if(!(channel instanceof VoiceChannel)) {
                        await interaction.reply({
                            embeds: [
                                embed_error(`Failed to fetch ${owner.username}'s room (id: ${roomData.channel})`)
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    await AutoVoiceRoomRepo.deleteRoom(guild.id, channel.id);

                    try {
                        await channel.delete();
                        await interaction.reply({
                            embeds: [ embed_message("Green", `Successfully deleted **${channel.name}** autovoice.`) ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    } catch(error) {
                        await errorLogHandle(error);
                        await interaction.reply({
                            embeds: [ embed_error("Something went wrong while trying to delete the autovoice room...") ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                }
                break;
            }
            case "transfer-owner": {
                // new owner and voice are guaranteed by the subcommand since they are set required true
                // voice status and new owner status are checked above

                const roomData = await AutoVoiceRoomRepo.getRoom(guild.id, voice!.id) as AutoVoiceRoom; // voice already ensured
                if(newOwner!.id === roomData.owner) {
                    await interaction.reply({
                        embeds: [ embed_error("You can not transfer ownership to the current owner of the room!") ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                await AutoVoiceRoomRepo.changeOwnerRoom(guild.id, newOwner!.id, voice!.id); // update database
                await (voice as VoiceChannel).permissionOverwrites.edit(newOwner!, { // give the new owner permissions
                    ViewChannel: true,
                    SendMessages: true,
                    Connect: true,
                    Speak: true
                });

                await interaction.reply({
                    embeds: [ embed_message("Green", `${newOwner} is now the owner of ${voice}`) ],
                    flags: MessageFlags.Ephemeral
                });
                break;
            }
            case "timeout": {
                const user = options.getUser("member", true);
                if(user.bot) {
                    await interaction.reply({
                        embeds: [
                            embed_error("You can not target bots!", "Invalid input")
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
                if(staffRoleId) {
                    // if a staff server role is set, then members with the staff role are immune to this command
                    const memberObj = await fetchGuildMember(guild, user.id) as GuildMember;
                    if(memberObj.roles.cache.has(staffRoleId)) {
                        await interaction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [
                                embed_error("You can not do that to staff members!")
                            ]
                        });
                        return;
                    }
                }
                const durationString = options.getString("duration", true);

                const durationTimestamp = duration_timestamp(durationString);
                if(durationTimestamp === null) {
                    await interaction.reply({
                        embeds: [ embed_error("The input given doesn't respect the format.\nExamples of input: **1m** (minute) **2h** (hours) **3d** (days)") ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const seconds = durationTimestamp - Math.floor(Date.now() / 1000); // get the duration given in seconds

                if(seconds > time_unit_conversion("d") || seconds < AUTOVOICE_COOLDOWN) {
                    // if the duration is longer than a day
                    // or less than the actual cooldown
                    await interaction.reply({
                        embeds: [ embed_error(`Timeout can not be longer than a day or shorter than ${seconds_to_duration(AUTOVOICE_COOLDOWN)} (${AUTOVOICE_COOLDOWN} seconds)`) ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await AutoVoiceRoomRepo.setCooldown(guild.id, user.id, seconds);
                await interaction.reply({
                    embeds: [ embed_message("Green", `${user} was timed out until <t:${durationTimestamp}:f> from creating autovoice channels.`) ],
                    flags: MessageFlags.Ephemeral
                });

                break;
            }
        }
    },
    metadata: {
        botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        userPermissions: [PermissionFlagsBits.Administrator],
        cooldown: 5,
        scope: "guild",
        group: "autovoice",
        category: "Administrator"
    }
}

export default autovoice_admin;