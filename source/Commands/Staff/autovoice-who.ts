import { ChannelType, Guild, InteractionReplyOptions, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, VoiceChannel } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { EmbedBuilder } from "discord.js"
import { fetchGuildChannel, fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import AutoVoiceRoomRepo from "../../Repositories/autovoiceroom.js";

const autovoiceWho: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("autovoice-who")
        .setDescription("Check details about who owns an autovoice channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName("user")
                .setDescription("Check if the user owns a channel.")
        )
        .addChannelOption(option =>
            option.setName("autovoice")
                .setDescription("Check details and who owns the channel")
                .addChannelTypes(ChannelType.GuildVoice)
        )
        .addBooleanOption(option =>
            option.setName("ephemeral")
                .setDescription("Toggle whether to display the information only to you.")
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.ManageChannels],
        group: "autovoice",
        category: "Staff",
        scope: "guild"
    },
    async execute(interaction) {
        const guild = interaction.guild as Guild;
        const options = interaction.options;
        const user = options.getUser("user");
        const channel = options.getChannel("autovoice") as VoiceChannel | null;
        const ephemeral = options.getBoolean("ephemeral");

        // this command will try to compile two embeds, one for the user and one for the channel if given.
        if (user === null && channel === null) {
            await interaction.reply({
                embeds: [embed_message("Red", "You must at least give one parameter as input.", "No input given")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const embedsForReply: EmbedBuilder[] = [];
        // first the user
        if (user) {
            if (user.bot) {
                await interaction.reply({
                    embeds: [embed_message("Red", "You can not target bots with this command")],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            const member = await fetchGuildMember(guild, user.id);
            if (!member) {
                await interaction.reply({
                    embeds: [embed_message("Red", "The user provided is not a member of this channel")],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            const embedMember = new EmbedBuilder()
                .setColor("Aqua")
                .setAuthor({ name: member.user.username })
                .setThumbnail(member.displayAvatarURL({ size: 1024 }))
                .setFooter({ text: `Member ID: ${member.id}` });

            const memberOwnedRoom = await AutoVoiceRoomRepo.getMemberRoom(guild.id, member.id);
            const memberCooldown = await AutoVoiceRoomRepo.getCooldown(guild.id, member.id);

            if (memberOwnedRoom) {
                const memberRoomChannel = await fetchGuildChannel(guild, memberOwnedRoom.channel) as VoiceChannel;
                embedMember.addFields({
                    name: "Owns Autovoice",
                    value: memberRoomChannel.toString()
                });
            } else {
                embedMember.addFields({
                    name: "Owns Autovoice",
                    value: "None"
                });
            }

            embedMember.addFields(
                {
                    name: "Cooldown",
                    value: memberCooldown ? `<t:${memberCooldown}:R>` : "None"
                },
                {
                    name: "Current channel",
                    value: member.voice.channel ? member.voice.channel.toString() : "None"
                }
            )
            embedsForReply.push(embedMember)
        }

        if (channel) {
            const embedChannel = new EmbedBuilder()
                .setColor("Aqua")
                .setTitle(`${channel.name} channel`)
                .setFooter({ text: `Autovoice ID: ${channel.id}` });
            const autovoiceRow = await AutoVoiceRoomRepo.getRoom(guild.id, channel.id);
            if (autovoiceRow) {
                const roomOwner = await fetchGuildMember(guild, autovoiceRow.owner);
                embedChannel.addFields(
                    {
                        name: "Owner",
                        value: roomOwner ? roomOwner.toString() : `<@${autovoiceRow.owner}>`
                    },
                    {
                        name: "Order",
                        value: `${autovoiceRow.order_room}`
                    },
                    {
                        name: "Created",
                        value: `<t:${autovoiceRow.timestamp}:R>`
                    }
                )
            } else {
                embedChannel.setDescription(`${channel} is not an autovoice channel.`)
            }

            embedsForReply.push(embedChannel);
        }

        const replyOptions: InteractionReplyOptions = { embeds: embedsForReply };
        if (ephemeral) replyOptions.flags = MessageFlags.Ephemeral;
        await interaction.reply(replyOptions);

    }
}

export default autovoiceWho;