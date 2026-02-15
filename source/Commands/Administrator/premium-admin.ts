import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    Role,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PremiumMembersRepo from "../../Repositories/premiummembers.js";
import { fetchGuildMember, fetchGuildRole, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import { embed_error } from "../../utility_modules/embed_builders.js";

const premiumAdmin: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("premium-admin")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Administrate premium features.")
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("member")
                .setDescription("Administrate premium memberships and members.")
                .addSubcommand(subcommand =>
                    subcommand.setName('create-customrole')
                        .setDescription('Create a custom role for the specified premium member.')
                        .addUserOption(option =>
                            option.setName('member')
                                .setDescription('The premium member to create the role for.')
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName('role-name')
                                .setDescription('The name of the role.')
                                .setMaxLength(100)
                                .setRequired(true)
                        )
                        .addNumberOption(option =>
                            option.setName('hexcolor')
                                .setDescription('The hexcode of the role')
                                .setMinValue(0)
                                .setRequired(true)
                        )
                        .addAttachmentOption(option =>
                            option.setName('image-icon')
                                .setDescription('Upload an image as the role icon')
                        )
                        .addStringOption(option =>
                            option.setName('emoji-icon')
                                .setDescription('Emoji as role icon.')

                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('set-customrole')
                        .setDescription('Set the custom role of a member from existing ones.')
                        .addUserOption(option =>
                            option.setName('member')
                                .setDescription('The targeted member.')
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option.setName('role')
                                .setDescription('The role to be set.')
                                .setRequired(true)
                        )
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [
            PermissionFlagsBits.Administrator
        ],
        scope: "guild",
        group: "premium",
        category: "Administrator"
    },
    async execute(interaction: ChatInputCommandInteraction, client) {
        const admin = interaction.member as GuildMember;
        const options = interaction.options;
        const subcommandGroup = options.getSubcommandGroup();
        const subcommand = options.getSubcommand();
        const guild = admin.guild;

        const premiumRole = await fetchPremiumRole(client, guild);
        if (!premiumRole) {
            await interaction.reply({
                embeds: [embed_error("The premium server role is missing.")]
            });
            return;
        }

        const embed = new EmbedBuilder();

        if (subcommandGroup === "member") {
            switch (subcommand) {
                case "create-customrole": {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const user = options.getUser("member", true);
                    const member = await fetchGuildMember(guild, user.id);
                    if (member === null) {
                        await interaction.editReply({
                            embeds: [embed_error("Failed to fetch the member...")]
                        });
                        return;
                    }

                    const hasPremium = await PremiumMembersRepo.checkUserMembership(
                        guild.id,
                        member.id
                    );

                    if (!hasPremium) {
                        embed.setColor("Red")
                            .setTitle("User has no membership.")
                            .setDescription("The selected user doesn't have a premium membership.");
                        await interaction.editReply({ embeds: [embed] });
                        return;
                    }

                    const roleName = options.getString("role-name", true);
                    const hexColor = options.getNumber("hexcolor", true);
                    const imageIcon = options.getAttachment("image-icon");
                    const emojiIcon = options.getString("emoji-icon");
                    let roleIcon: string | null = null;

                    if (hexColor > 0xffffff) {
                        embed.setColor("Red").setDescription("The hex color is invalid!");
                        await interaction.editReply({ embeds: [embed] });
                        return;
                    }

                    if (imageIcon) {
                        if (!imageIcon.contentType?.includes("image")) {
                            embed.setColor("Red").setDescription("The attachment is not an image!");
                            await interaction.editReply({ embeds: [embed] });
                            return;
                        }

                        if (imageIcon.size > 262_100) {
                            embed.setColor("Red").setDescription("The image is too large! Max 256KB.");
                            await interaction.editReply({ embeds: [embed] });
                            return;
                        }

                        roleIcon = imageIcon.url;
                    } else if (emojiIcon) {
                        const emojiIdMatch = emojiIcon.match(/\d+/);
                        if (!emojiIdMatch) {
                            embed.setColor("Red").setDescription("Invalid emoji format!");
                            await interaction.editReply({ embeds: [embed] });
                            return;
                        }

                        try {
                            const emoji = await guild.emojis.fetch(emojiIdMatch[0]);
                            roleIcon = emoji.url;
                        } catch {
                            embed.setColor("Red").setDescription("Emoji not found on this server!");
                            await interaction.editReply({ embeds: [embed] });
                            return;
                        }
                    }

                    // Remove previous custom role if exists
                    const oldRoleId = await PremiumMembersRepo.getMemberCustomRole(guild.id, member.id);
                    if (oldRoleId) {
                        const oldRole = await fetchGuildRole(guild, oldRoleId);
                        if (oldRole) {
                            await oldRole.delete();
                        }
                    }

                    const newRole = await guild.roles.create({
                        name: roleName,
                        color: hexColor,
                        position: premiumRole.position,
                        icon: roleIcon,
                    });

                    await member.roles.add(newRole);
                    await PremiumMembersRepo.setMemberCustomRole(guild.id, member.id, newRole.id);

                    embed
                        .setColor(0xd214c7)
                        .setTitle("Custom role created!")
                        .addFields(
                            { name: "Member", value: `${member}`, inline: true },
                            { name: "Role", value: `${newRole}`, inline: true }
                        )
                        .setThumbnail(roleIcon);

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case "set-customrole": {
                    const user = options.getUser("member", true);
                    if (user.bot) {
                        embed.setColor("Red")
                            .setTitle("Invalid user")
                            .setDescription("Bots cannot receive premium roles.");
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                        return;
                    }

                    const member = await fetchGuildMember(guild, user.id);
                    if (member === null) {
                        await interaction.editReply({
                            embeds: [embed_error("Failed to fetch the member...")]
                        });
                        return;
                    }
                    const role = options.getRole("role", true) as Role;

                    const hasPremium = await PremiumMembersRepo.checkUserMembership(guild.id, member.id);
                    if (!hasPremium) {
                        embed.setColor("Red")
                            .setTitle("Invalid user")
                            .setDescription("User lacks premium membership.");
                        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }

                    if (
                        role.position > premiumRole.position
                        || (
                            guild.roles.premiumSubscriberRole
                            && guild.roles.premiumSubscriberRole.position > role.position
                        )
                        || role.id === guild.roles.everyone.id
                        || role.id === premiumRole.id
                        || role.id === guild.roles.premiumSubscriberRole?.id
                    ) {
                        embed.setColor("Red")
                            .setTitle("Role is not valid")
                            .setDescription("Select a role between Nitro booster and Premium role.");
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                        return;
                    }

                    await PremiumMembersRepo.setMemberCustomRole(guild.id, member.id, role.id);
                    await member.roles.add(role);

                    embed
                        .setColor(0xd214c7)
                        .setTitle("Successfully set a custom role")
                        .addFields(
                            { name: "Member", value: `${member}`, inline: true },
                            { name: "Role", value: `${role}`, inline: true }
                        );

                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    break;
                }
            }
        }
    }
}

export default premiumAdmin;