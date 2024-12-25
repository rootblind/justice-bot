/*
    Fetch discordAPI about the server.
*/

const {SlashCommandBuilder, EmbedBuilder, CommandInteraction, ChannelType, GuildVerificationLevel, GuildExplicitContentFilter,
        GuildNSFWLevel, PermissionFlagsBits} = require('discord.js');

// credits: The North Solution on YouTube
module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Details about the server.'),
    async execute(interaction) {
        const {guild} = interaction;
        const {members, channels, emojis, roles, stickers} = guild;
        // Sort roles by position and filter out managed and unmanaged roles
        const sortedRoles = roles.cache.map(role => role).slice(1, roles.cache.size).sort((a,b) => b.position - a.position);
        const userRoles = sortedRoles.filter(role => !role.managed);
        const managedRole = sortedRoles.filter(role => role.managed);
        const botCount = members.cache.filter(member => member.user.bot).size;
        // Function to get the maximum number of roles to display within a certain character limit
        const maxDisplayRoles = (roles, maxFieldLength = 800) => {
            let totalLength = 0;
            const result = [];
            for(const role of roles) {
                const roleString = `<@${role.id}>`;
                if(roleString.length + totalLength > maxFieldLength)
                    break;
                totalLength += roleString.length + 1;
                result.push(roleString);
            }
            return result.length;
        }
        // Function to split a PascalCase string into words using a separator
        const splitPascal = (string, separator) => string.split(/(?=[A-U])/).join(separator);
        const toPascalCase = (string, separator = false) => {
            const pascal = string.charAt(0).toUpperCase() + string.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
            return separator ? splitPascal(pascal, separator) : pascal;
        };
        const getChannelTypeSize = type => channels.cache.filter(channel => type.includes(channel.type)).size;
        const totalChannels = getChannelTypeSize([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice,
        ChannelType.GuildForum, ChannelType.GuildPublicThread, ChannelType.GuildCategory, ChannelType.GuildNews]);
        const embed = new EmbedBuilder()
            .setColor('Purple')
            .setTitle(`${guild.name}'s info`)
            .setThumbnail(guild.iconURL({size: 1024}))
            .setImage(guild.bannerURL({size: 1024}))
            .addFields(
                {
                    name: 'Description', value: `📝${guild.description || 'None'}`
                },
                {
                    name: 'General',
                    value: [
                        `📝 **Created** <t:${parseInt(guild.createdTimestamp / 1000)}:R>`,
                        `🆔 **ID** ${guild.id}`,
                        `🛠 **Owner** <@${guild.ownerId}>`,
                        `📚 **Language** ${new Intl.DisplayNames(["en"], {type: 'language'}).of(guild.preferredLocale)}`,
                        `👋 **Vanity URL** ${guild.vanityURLCode || 'None'}`

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
                    name: `User roles(${maxDisplayRoles(userRoles)} of ${userRoles.length})`,
                    value: `${userRoles.slice(0, maxDisplayRoles(userRoles)).join(' ') || 'None'}`
                },
                {
                    name: `Bot roles (${maxDisplayRoles(managedRole)} of ${managedRole.length})`,
                    value: `${managedRole.slice(0, maxDisplayRoles(managedRole)).join(' ') || "None"}`
                },
                {
                    name: `Channels, Threads and Categories (${totalChannels})`,
                    value: [
                        `🖊 **Text Channels** ${getChannelTypeSize([ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildNews])}`,
                        `🔊 **Voice Channels** ${getChannelTypeSize([ChannelType.GuildVoice, ChannelType.GuildStageVoice])}`,
                        `💬 **Threads** ${getChannelTypeSize([ChannelType.GuildPublicThread])}`,
                        `📚 **Categories** ${getChannelTypeSize([ChannelType.GuildCategory])}`,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `Emojis & Stickers (${emojis.cache.size + stickers.cache.size})`,
                    value: [
                        `📺 **Animated** ${emojis.cache.filter(emoji => emoji.animated).size}`,
                        `😃 **Static** ${emojis.cache.filter(emoji =>!emoji.animated).size}`,
                        `🃏 **Stickers** ${stickers.cache.size}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `Nitro status`,
                    value: [
                        `💎 **Level** ${guild.premiumTier || "None"}`,
                        `❤ **Boosts** ${guild.premiumSubscriptionCount}`,
                        `👑 **Boosters** ${guild.members.cache.filter(member => member.roles.premiumSubscriberRole).size}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Banner', value: guild.bannerURL() ? "**Yes**" : "None"
                }
            );
    
        interaction.reply({embeds:[embed]});

        

    }
        
};