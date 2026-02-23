import { GuildPremiumTier, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { fetchGuild, fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import { EmbedAuthorOptions, EmbedBuilder } from "@discordjs/builders";
import { chunkArray } from "../../utility_modules/utility_methods.js";

const lsCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("ls")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("List data about the bot.")
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("guilds")
                .setDescription("List details about guilds.")
                .addSubcommand(subcommand =>
                    subcommand.setName("general")
                        .setDescription("List general details about the guilds the bot is in.")
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 1,
        userPermissions: [],
        botPermissions: [],
        ownerOnly: true,
        group: "global",
        scope: "global",
        category: "Owner"
    },
    async execute(interaction, client) {
        const options = interaction.options;
        const subcommandGroup = options.getSubcommandGroup();
        const subcommand = options.getSubcommand();
        await interaction.deferReply();

        switch (subcommandGroup) {
            case "guilds": {
                const guilds = await client.guilds.fetch();
                switch (subcommand) {
                    case "general": {
                        const generalEmbeds: EmbedBuilder[] = [];
                        for (const guildAPI of guilds.values()) {
                            const embed = new EmbedBuilder()
                                .setFooter({ text: `Guild ID: ${guildAPI.id}` });
                            const author: EmbedAuthorOptions = {
                                name: guildAPI.name
                            }
                            const guildIcon = guildAPI.iconURL({ extension: "png" });
                            if (guildIcon) {
                                author.iconURL = guildIcon;
                                embed.setThumbnail(guildIcon);
                            }
                            embed.setAuthor(author)
                                .setFields(
                                    {
                                        name: "Created",
                                        value: `${guildAPI.createdAt ?? "Unknown"}`
                                    }
                                );

                            const guild = await fetchGuild(client, guildAPI.id);
                            if (guild) {
                                const bannerUrl = guild.bannerURL({ size: 1024 });
                                const guildDesc = guild.description;
                                if (guildDesc) embed.setDescription(guildDesc);
                                if (bannerUrl) embed.setImage(bannerUrl);

                                embed.addFields(
                                    {
                                        name: "Member count",
                                        value: `${guild.approximateMemberCount ?? "Unknown"} | ${guild.memberCount ?? "Unknown"}`
                                    },
                                    {
                                        name: "Boost Tier",
                                        value: `${GuildPremiumTier[guild.premiumTier]}`
                                    },
                                    {
                                        name: "Locale",
                                        value: `${guild.preferredLocale}`
                                    }
                                );

                                const owner = await fetchGuildMember(guild, guild.ownerId);
                                embed.addFields({
                                    name: "Owner",
                                    value: `${owner ? `${owner.user.toString()} | ${guild.ownerId}` : guild.ownerId}`
                                });

                                if (guild.vanityURLCode) {
                                    embed.addFields({
                                        name: "Vanity URL",
                                        value: `discord.gg/${guild.vanityURLCode}`
                                    });
                                    generalEmbeds.push(embed);
                                } else {
                                    try {
                                        const inviteChannel = guild.channels.cache.find(
                                            ch => ch.isTextBased()
                                                && ch.permissionsFor(guild.members.me!)
                                                    .has(PermissionFlagsBits.CreateInstantInvite)
                                        ) as TextChannel;

                                        if (inviteChannel) {
                                            const invite = await inviteChannel.createInvite({ maxAge: 3600, maxUses: 1 });
                                            embed.addFields({
                                                name: "Invite",
                                                value: `${invite.url ?? "Unknown"}`
                                            });
                                        }
                                        generalEmbeds.push(embed);
                                    } catch {
                                        generalEmbeds.push(embed);
                                    }
                                }
                            } else {
                                embed.setDescription("Failed to fetch the Guild object.");
                                generalEmbeds.push(embed);
                            }
                        }

                        const replyEmbedLimit = 10;
                        const chunkEmbeds = chunkArray<EmbedBuilder>(generalEmbeds, replyEmbedLimit);
                        for (const chunk of chunkEmbeds) {
                            if (!interaction.replied) {
                                await interaction.editReply({ embeds: chunk });
                            } else {
                                await interaction.followUp({ embeds: chunk });
                            }
                        }
                        break;
                    }
                }

                break;
            }
        }
    }
}

export default lsCommand;