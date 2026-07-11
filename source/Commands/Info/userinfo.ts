import { EmbedBuilder, Guild, GuildMember, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { fetchGuildMember, permission_names } from "../../utility_modules/discord_helpers.js";

const userInfo: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Information about the user.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to fetch.")
        )
        .toJSON(),
    metadata: {
        userPermissions: [],
        botPermissions: [],
        cooldown: 5,
        scope: "global",
        group: "global",
        category: "Info"
    },
    async execute(interaction) {
        const guild = interaction.guild as Guild;
        const options = interaction.options;
        const user = options.getUser("user") ?? interaction.user;
        let member: GuildMember | null = null;
        if (user.id === interaction.user.id) {
            member = interaction.member as GuildMember;
        } else {
            member = await fetchGuildMember(guild, user.id);
        }

        const avatar = member ? member.displayAvatarURL({ extension: "png" }) : user.displayAvatarURL({ extension: "png" });
        const name = member ? member.displayName : user.username;

        const embed = new EmbedBuilder()
            .setColor("Purple")
            .setTitle(`${name}`)
            .setThumbnail(avatar)
            .setFooter({ text: `User ID: ${user.id}` });

        if (member) {
            embed.setImage(member.bannerURL({ size: 1024 }));
            embed.addFields({ name: "Tag", value: `${member}` });
            if (member.premiumSinceTimestamp) {
                embed.addFields({
                    name: "Nitro booster",
                    value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`
                });
            }
            if (member.voice.channel) {
                embed.addFields({
                    name: "Currently in",
                    value: `${member.voice.channel}`
                });
            }
            if (member.communicationDisabledUntilTimestamp) {
                embed.addFields({
                    name: "Timeout Expires",
                    value: `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
                });
            }

            const permissionsArray = permission_names(member.permissions.toArray());
            embed.addFields({
                name: "Permissions",
                value: `${permissionsArray.length <= 10 ? permissionsArray.join(", ") : `${permissionsArray.slice(0, 10).join(", ")} and ${permissionsArray.length - 10} more...`}`
            })

            if (member.joinedTimestamp) {
                embed.addFields(
                    {
                        name: "Joined Server",
                        value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                    }
                );
            }
        }

        embed.addFields(
            {
                name: "Joined Discord",
                value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`
            }
        )
        if (user.primaryGuild?.tag) {
            embed.addFields({
                name: "Guild Tag",
                value: user.primaryGuild.tag
            });
        }
        if (user.bot) {
            embed.setDescription("This user is a bot.");
        }

        await interaction.reply({ embeds: [embed] });
    }
}

export default userInfo;