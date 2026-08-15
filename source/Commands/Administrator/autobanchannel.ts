import {
    CategoryChannel,
    ChannelType,
    GuildMember,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import AutoBanChannelRepo from "../../Repositories/autobanchannel.js";

const autobanChannelCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("autoban-channel")
        .setDescription("Set a channel to indefinitely ban anyone that types in it.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Create a new channel as autoban channel.")
                .addStringOption(option =>
                    option.setName("channel-name")
                        .setDescription("The name of the autoban channel.")
                        .setMaxLength(20)
                        .setMinLength(1)
                )
                .addChannelOption(option =>
                    option.setName("parent-category")
                        .setDescription("Set the category you desire to have the channel under.")
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption(option =>
                    option.setName("send-message")
                        .setDescription("Send an embeded message to be displayed in the channel.")
                        .setMinLength(4)
                        .setMaxLength(2000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("disable")
                .setDescription("Forget the autoban channel to disable this function.")
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageChannels
        ],
        scope: "guild",
        group: "moderation",
        category: "Administrator"
    },
    async execute(interaction) {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case "set": {
                const channelName = options.getString("channel-name") ?? "autoban-channel";
                const category = options.getChannel("parent-category") as CategoryChannel | null;
                const message = options.getString("send-message");

                await interaction.deferReply();

                try {
                    const newAutobanChannel = await guild.channels.create({
                        name: channelName,
                        parent: category
                    });

                    // register the channel
                    await AutoBanChannelRepo.put(guild.id, newAutobanChannel.id);

                    if (message) { // send the message
                        try {
                            await newAutobanChannel.send({
                                embeds: [embed_message("Red", message)]
                            });
                        } catch (error) {
                            await errorLogHandle(error);
                        }
                    }

                    await interaction.editReply({
                        embeds: [
                            embed_message("Green", `${newAutobanChannel} has been set as autoban channel.`)
                        ]
                    });
                } catch (error) {
                    await errorLogHandle(error);
                    await interaction.editReply({
                        embeds: [
                            embed_error("Something went wrong while creating the channel.")
                        ]
                    });
                    return;
                }
                break;
            }
            case "disable": {
                const channelId = await AutoBanChannelRepo.get(guild.id);
                if (!channelId) {
                    await interaction.reply({
                        embeds: [
                            embed_message("Red", "There is no autoban channel set up.")
                        ]
                    });
                    return;
                }
                await AutoBanChannelRepo.delete(guild.id);
                await interaction.reply({
                    embeds: [embed_message("Green", "The autoban channel has been forgotten.")]
                });
                break;
            }
        }
    }
}

export default autobanChannelCommand;