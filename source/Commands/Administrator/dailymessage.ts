import { ChannelType, Guild, MessageFlags, PermissionFlagsBits, SendableChannels, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { dayTimeToCron, isDayTime, isSnowflake } from "../../utility_modules/utility_methods.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import DailyMessageRepo from "../../Repositories/dailymessage.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { DailyMessageObject } from "../../Interfaces/database_types.js";
import { build_cron_daily_message, init_daily_message_task } from "../../Systems/components/dailymessage.js";

const dailyMessage: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("dailymessage")
        .setDescription("Schedule a daily message to be sent in the specified channel.")
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Set a daily message to be sent")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The channel to send the daily message into.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("message")
                        .setDescription("The message to be sent daily.")
                        .setMinLength(1)
                        .setMaxLength(3000)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("time")
                        .setDescription("The time of the day to send the daily message.")
                        .setMinLength(5)
                        .setMaxLength(5)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setDescription("Remove a daily message schedule.")
                .addStringOption(option =>
                    option.setName("messageid")
                        .setDescription("The message ID of the daily message to be removed.")
                        .setMinLength(17)
                        .setMaxLength(19)
                        .setRequired(true)
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.MentionEveryone
        ],
        scope: "global",
        category: "Administrator",
        group: "global"
    },
    async execute(interaction) {
        const guild = interaction.guild as Guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case "set": {
                const channel = options.getChannel("channel", true) as SendableChannels;
                const message = options.getString("message", true);
                const time = options.getString("time", true);

                if (!isDayTime(time)) {
                    await interaction.reply({
                        embeds: [embed_message("Red", "The time of the day provided is not valid. Example: `22:01`.")],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                const cronSchedule = dayTimeToCron(time);
                try {
                    const messageSent = await channel.send(message);
                    // register message
                    const dailyMessage: DailyMessageObject = {
                        guild: guild.id,
                        channel: channel.id,
                        message: message,
                        messageid: messageSent.id,
                        schedule: cronSchedule
                    }
                    await DailyMessageRepo.insert(dailyMessage);
                    // initialize the cron task builder
                    const dailyMessageTask = await init_daily_message_task(guild, dailyMessage);
                    await build_cron_daily_message(dailyMessageTask);

                    await interaction.reply({
                        embeds: [embed_message("Green", `${channel}: ` + message, `Daily message at ${time}`)],
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    await interaction.reply({
                        embeds: [embed_error("Something went wrong while trying to send the message...")],
                        flags: MessageFlags.Ephemeral
                    });
                    await errorLogHandle(error);
                }
                break;
            }
            case "remove": {
                const messageId = options.getString("messageid", true);
                if (!isSnowflake(messageId)) {
                    await interaction.reply({
                        embeds: [embed_message("Red", "The message ID provided is not valid.")],
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await DailyMessageRepo.delete(guild.id, messageId);
                await interaction.reply({
                    embeds: [embed_message("Green", `Last daily message for this schedule: ${messageId}`, "Daily message stopped")],
                    flags: MessageFlags.Ephemeral
                });
                break;
            }
        }
    }
}
export default dailyMessage;