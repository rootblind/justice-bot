import { ChannelType, EmbedBuilder, Guild, GuildExplicitContentFilter, GuildNSFWLevel, GuildVerificationLevel, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";

const serverInfo: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Details about the server.")
        .toJSON(),
    metadata: {
        userPermissions: [],
        botPermissions: [],
        cooldown: 5,
        group: "global",
        category: "Info",
        scope: "global"
    },
    async execute(interaction) {
        const guild = interaction.guild as Guild;
        const { members, channels, emojis, stickers } = guild;
        const botCount = members.cache.filter(member => member.user.bot).size;
        const totalChannels = channels.cache.size;

        // Function to split a PascalCase string into words using a separator
        const splitPascal = (string: string, separator: string) => string.split(/(?=[A-U])/).join(separator);

        const getChannelTypeSize = (...type: ChannelType[]) => channels.cache.filter(channel => type.includes(channel.type)).size;

        const embed = new EmbedBuilder()
            .setColor("Purple")
            .setTitle(`${guild.name}'s info`)
            .setThumbnail(guild.iconURL({ size: 1024 }))
            .setImage(guild.bannerURL({ size: 1024 }))
            .setFields(
                {
                    name: 'Description',
                    value: `📝${guild.description || 'None'}`
                },
                {
                    name: 'General',
                    value: [
                        `📝 **Created** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
                        `🆔 **ID** ${guild.id}`,
                        `🛠 **Owner** <@${guild.ownerId}>`,
                        `📚 **Language** ${new Intl.DisplayNames(["en"], { type: 'language' }).of(guild.preferredLocale)}`,
                        `👋 **Vanity URL** ${guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'None'}`

                    ].join('\n')
                },
                {
                    name: 'Security',
                    value: [
                        `❌ **Explicit Filter** ${splitPascal(GuildExplicitContentFilter[guild.explicitContentFilter], "")}`,
                        `🔞 **NSFW Level** ${splitPascal(GuildNSFWLevel[guild.nsfwLevel], " ")}`,
                        `🚨 **Verification Level** ${splitPascal(GuildVerificationLevel[guild.verificationLevel], " ")}`

                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Member count',
                    value: [
                        `😎 **Humans** ${guild.memberCount - botCount}`,
                        `💻 **Bots** ${botCount}`

                    ].join('\n'),
                    inline: true
                },
                {
                    name: `Channels, Threads and Categories (${totalChannels})`,
                    value: [
                        `🖊 **Text Channels** ${getChannelTypeSize(ChannelType.GuildText)}`,
                        `🔊 **Voice Channels** ${getChannelTypeSize(ChannelType.GuildVoice, ChannelType.GuildStageVoice)}`,
                        `💬 **Threads** ${getChannelTypeSize(ChannelType.PublicThread)}`,
                        `📚 **Categories** ${getChannelTypeSize(ChannelType.GuildCategory)}`,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `Emojis & Stickers (${emojis.cache.size + stickers.cache.size})`,
                    value: [
                        `📺 **Animated** ${emojis.cache.filter(emoji => emoji.animated).size}`,
                        `😃 **Static** ${emojis.cache.filter(emoji => !emoji.animated).size}`,
                        `🃏 **Stickers** ${stickers.cache.size}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `Nitro status`,
                    value: [
                        `💎 **Level** ${guild.premiumTier || "None"}`,
                        `❤ **Boosts** ${guild.premiumSubscriptionCount}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Banner', value: guild.bannerURL() ? "**Yes**" : "None"
                }
            );

        await interaction.reply({ embeds: [embed] });
    }
}

export default serverInfo;