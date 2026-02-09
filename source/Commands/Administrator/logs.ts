import {
    APIApplicationCommandOptionChoice,
    ChannelType,
    GuildBasedChannel,
    GuildMember,
    OverwriteResolvable,
    OverwriteType,
    PermissionFlagsBits,
    RestOrArray,
    SlashCommandBuilder,
    TextChannel
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { EVENT_GUILD_LOGS, EventGuildLogsString } from "../../Interfaces/database_types.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { buildCategory, fetchGuildChannel, fetchLogsChannel, setLogChannel } from "../../utility_modules/discord_helpers.js";
import { get_env_var } from "../../utility_modules/utility_methods.js";
import ServerLogsRepo from "../../Repositories/serverlogs.js";
import ServerLogsIgnoreRepo from "../../Repositories/serverlogsignore.js";
import { embed_current_logs_list, embed_error, embed_message } from "../../utility_modules/embed_builders.js";
const logs_options: RestOrArray<APIApplicationCommandOptionChoice<string>> = [
    {
        name: "All",
        value: "all"
    },
    ...EVENT_GUILD_LOGS
        .filter((e) => e !== "ticket-support") // ticket logs are set by the ticket system
        .map(type => {
            return {
                name: type.replace("-", " ").toUpperCase(),
                value: type
            }
        })
]

const logsCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Set up event logging by assigning channels to the desired events.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("auto-setup")
                .setDescription("Automatically generate all the channels needed.")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Assign a channel to an event type to start logging.")
                .addStringOption(option =>
                    option.setName("event")
                        .setDescription("Pick the event type to has a channel assigned")
                        .setRequired(true)
                        .addChoices(...logs_options)
                )
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The channel to be assigned to an event logging.")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setDescription("Remove the logging of an event type or all logs and ignored channels.")
                .addStringOption(option =>
                    option.setName("event")
                        .setDescription("Pick the event type to stop logging.")
                        .setRequired(true)
                        .addChoices(...logs_options)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("ignore")
                .setDescription("Ignore a text channel from being logged.")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The text channel to be ignored")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("unignore")
                .setDescription("Remove ignored channels from the list. Logging channels can not be unignored.")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The text channel to be removed from ignore list.")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("info")
                .setDescription("Display the current events being logged and ignored channels.")
        )
        .toJSON(),

    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const client = guild.client;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case "auto-setup": {
                await interaction.deferReply();

                const botRoleId = await ServerRolesRepo.getGuildBotRole(guild.id);
                const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);

                const allowPerms = [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ];

                const denyPerms = [ PermissionFlagsBits.ManageMessages ];

                const channelPerms: OverwriteResolvable[] = [
                    {
                        id: guild.roles.everyone.id,
                        deny: allowPerms
                    }
                ];

                // if any of the roles are not set, replace them with a fallback value
                if (botRoleId) {
                    channelPerms.push({
                        id: botRoleId,
                        allow: allowPerms
                    });
                } else {// if no bot role, the client grants itself perms
                    channelPerms.push({
                        id: client.user.id,
                        type: OverwriteType.Member,
                        allow: allowPerms
                    });
                }

                if (staffRoleId) {
                    channelPerms.push({
                        id: member.id,
                        type: OverwriteType.Member,
                        allow: allowPerms,
                        deny: denyPerms
                    });
                }// if no staff role, then add nothing since the member is already admin

                const channelOptions = EVENT_GUILD_LOGS
                    .filter((e) => e !== "ticket-support") // ticket logs are set by the ticket system
                    .filter((e) => e !== "justice-logs" || member.id === get_env_var("OWNER")) // only bot owner controls justice-logs
                    .map((e) => {
                        return {
                            name: e,
                            type: Number(ChannelType.GuildText)
                        }
                    })

                const channelsBuilt = await buildCategory(guild, "serverlogs", channelPerms, channelOptions);
                const logsChannels = channelsBuilt.filter((channel) => channel.type === ChannelType.GuildText);
                const channelsToRegister = logsChannels.map((channel) => {
                    return {
                        id: channel.id,
                        event: channel.name as EventGuildLogsString
                    }
                });

                const channelIds = logsChannels.map(channel => channel.id);

                // database handle
                const currentServerLogs = await ServerLogsRepo.getAllGuildChannels(guild.id);
                if (currentServerLogs.length) await ServerLogsIgnoreRepo.deleteBulk(guild.id, currentServerLogs); // remove previous logs from the ignore list if they exist
                // register the channels into the server logs and the ignore list
                await ServerLogsRepo.putBulk(guild.id, channelsToRegister);
                await ServerLogsIgnoreRepo.putBulk(guild.id, channelIds);

                const embedLogsChannels = logsChannels.map((row) => {
                    return {
                        channel: row,
                        event: row.name as EventGuildLogsString
                    }
                });

                await interaction.editReply({ embeds: [embed_current_logs_list(guild, embedLogsChannels)] });

                break;
            }
            case "set": {
                const event = options.getString("event", true);
                const channel = options.getChannel("channel", true) as TextChannel;

                if (event === "justice-bot" && member.id !== get_env_var("OWNER")) {
                    await interaction.reply({
                        embeds: [embed_error("Only the bot owner can log this kind of event!")]
                    });
                    return;
                }

                if (event === "all") {
                    const eventTypes = EVENT_GUILD_LOGS
                        .filter((e) => e !== "ticket-support" && (e !== "justice-logs" || member.id === get_env_var("OWNER")));

                    const registerArray = eventTypes.map((e) => {
                        return {
                            id: channel.id,
                            event: e as EventGuildLogsString
                        }
                    });

                    const currentServerLogs = await ServerLogsRepo.getAllGuildChannels(guild.id);
                    if (currentServerLogs.length) await ServerLogsIgnoreRepo.deleteBulk(guild.id, currentServerLogs);
                    await ServerLogsRepo.putBulk(guild.id, registerArray);
                    await ServerLogsIgnoreRepo.put(guild.id, channel.id);

                    await interaction.reply({
                        embeds: [embed_message("Green", `All events will be logged in ${channel}.`, "Server logs set")]
                    });
                } else {
                    await setLogChannel(guild.id, channel.id, event as EventGuildLogsString);
                    const eventName = event.replace("-", " ").toUpperCase();
                    await interaction.reply({
                        embeds: [embed_message("Green", `${eventName} events will be logged in ${channel}.`, `${eventName} logs set`)]
                    });
                }
                break;
            }
            case "remove": {
                const event = options.getString("event", true);
                const eventName = event.replace("-", " ").toUpperCase();
                if (event === "all") {
                    await ServerLogsRepo.deleteAllEvents(guild.id);
                    await ServerLogsIgnoreRepo.deleteGuildIgnore(guild.id);
                } else {
                    const channelId = await ServerLogsRepo.getGuildEventChannel(guild.id, event as EventGuildLogsString);
                    if (channelId === null) {
                        await interaction.reply({
                            embeds: [
                                embed_error(`This guild is not logging ${eventName} logs, there is nothing to be removed.`)
                            ]
                        });
                        return;
                    }

                    await ServerLogsRepo.deleteGuildEventChannel(guild.id, event as EventGuildLogsString);
                    await ServerLogsIgnoreRepo.stopIgnoringChannel(guild.id, channelId);
                }

                await interaction.reply({
                    embeds: [embed_message("Green", "Event logs removed successfully", `${eventName} logs were removed`)]
                });
                break;
            }
            case "ignore": {
                const channel = options.getChannel("channel", true) as TextChannel;

                // check if the channel is already ignored
                const alreadyIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
                if (alreadyIgnored) {
                    await interaction.reply({
                        embeds: [
                            embed_error("The channel targeted is already on the ignore list for logs!")
                        ]
                    });

                    return;
                }

                await ServerLogsIgnoreRepo.put(guild.id, channel.id);
                await interaction.reply({
                    embeds: [
                        embed_message("Green", `${channel} was added to the logs ignore list.`)
                    ]
                });
                break;
            }
            case "unignore": {
                const channel = options.getChannel("channel", true);

                // check if the channel is ignored
                const alreadyIgnored = await ServerLogsIgnoreRepo.isChannelIgnored(guild.id, channel.id);
                if (!alreadyIgnored) {
                    await interaction.reply({
                        embeds: [
                            embed_error("This channel is not on the logs ignore list!")
                        ]
                    });

                    return;
                }

                // block unignoring logs channels
                const isLogsChannel = await ServerLogsRepo.isLogsChannel(guild.id, channel.id);
                if (!isLogsChannel) {
                    await interaction.reply({
                        embeds: [
                            embed_error("You can not unignore active server logs channels!")
                        ]
                    });

                    return;
                }

                await ServerLogsIgnoreRepo.stopIgnoringChannel(guild.id, channel.id);
                await interaction.reply({
                    embeds: [
                        embed_message("Green", `Logging will no longer ignore ${channel}.`)
                    ]
                });
                break;
            }
            case "info": {
                await interaction.deferReply();
                const embed = embed_message("Aqua", " ", "Server logs");
                const serverLogs = await ServerLogsRepo.getGuildLogs(guild.id);
                if (serverLogs.length) {
                    for (const row of serverLogs) {
                        const logChannel = await fetchLogsChannel(guild, row.eventtype as EventGuildLogsString);
                        // failing to fetch the channel means there is faulty data
                        if (logChannel === null) {
                            await ServerLogsRepo.deleteGuildEventChannel(guild.id, row.eventtype as EventGuildLogsString);
                            await ServerLogsIgnoreRepo.stopIgnoringChannel(guild.id, row.channel);
                            continue;
                        }

                        embed.addFields({
                            name: `${row.eventtype}`,
                            value: `${logChannel}`,
                            inline: true
                        });
                    }
                } else {
                    embed.addFields({
                        name: "Logs Channels",
                        value: "None",
                        inline: true
                    });
                }

                const ignoredChannelIds = await ServerLogsIgnoreRepo.getGuildIgnoreList(guild.id);
                const ignoredChannels: GuildBasedChannel[] = [];
                if(ignoredChannelIds.length) {
                    for(const id of ignoredChannelIds) {
                        const channel = await fetchGuildChannel(guild, id);
                        // if the channel is ignored, but fails to be fetched, handle faulty database row
                        if(channel === null) {
                            await ServerLogsIgnoreRepo.stopIgnoringChannel(guild.id, id);
                            continue;
                        }
                        ignoredChannels.push(channel);
                    }
                    embed.setDescription("Ignored channels: " + ignoredChannels.join(" "));
                } else {
                    embed.setDescription("No channel is being ignored by logs at the moment.");
                }

                await interaction.editReply({ embeds: [ embed ] });
                break;
            }
        }
    },
    metadata: {
        cooldown: 10,
        botPermissions: [
            PermissionFlagsBits.ViewAuditLog,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages
        ],
        userPermissions: [PermissionFlagsBits.Administrator],
        scope: "global",
        category: "Administrator",
        group: "global"
    }
}

export default logsCommand;