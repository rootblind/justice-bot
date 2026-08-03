import { EmbedBuilder, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { fetchGuildMember, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { ValidatorResponseType } from "../../Interfaces/helper_types.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const kickCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDescription("Kick a member from the server.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The targeted user to kick.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("The reason for the kick.")
                .setMinLength(4)
                .setMaxLength(512)
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName("delete-recent")
                .setDescription("Delete recent messages")
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        userPermissions: [PermissionFlagsBits.KickMembers],
        botPermissions: [PermissionFlagsBits.KickMembers],
        group: "moderation",
        scope: "guild",
        category: "Moderator"
    },
    async execute(interaction) {
        const moderator = interaction.member as GuildMember;
        const guild = moderator.guild;
        const options = interaction.options;
        const user = options.getUser("user", true);
        const reason = options.getString("reason", true);
        const deleteRecent = options.getBoolean("delete-recent");

        const botMember = await guild.members.fetchMe();
        const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id) as string; // guaranteed by interactionCreate
        const modLogs = await fetchLogsChannel(guild, "moderation");

        async function validateTarget(
            user: User,
            moderator: GuildMember,
            botMember: GuildMember
        ): Promise<ValidatorResponseType> {
            if (user.bot) {
                return { value: false, message: "You can not target bots with that action!" }
            }
            const targetMember = await fetchGuildMember(guild, user.id);
            if (targetMember) {
                if (targetMember.roles.highest.position >= moderator.roles.highest.position) {
                    return { value: false, message: "You lack permission to ban someone above your highest role." }
                }
                if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
                    return { value: false, message: "I lack the permission to ban someone above my highest role." }
                }
                if (targetMember.roles.cache.has(staffRoleId)) {
                    return { value: false, message: "You can not target a STAFF member with that action!" }
                }
                if (targetMember.permissions.has(PermissionFlagsBits.KickMembers)) {
                    return { value: false, message: "This member has moderation permissions!" }
                }
            }

            return { value: true, message: "ok" };
        }

        const member = await fetchGuildMember(guild, user.id);
        if (!member) {
            await interaction.reply({
                embeds: [embed_message("Red", "The user provided is not a member of this server.")],
                flags: MessageFlags.Ephemeral
            });
            return
        }

        const validate = await validateTarget(user, moderator, botMember);
        if (!validate.value) {
            await interaction.reply({
                embeds: [embed_message("Red", validate.message)],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply();
        const kickEmbed = new EmbedBuilder()
            .setColor("Red")
            .setAuthor({ name: `${member.user.username} got kicked`, iconURL: member.user.displayAvatarURL({ extension: "png" }) })
            .setFields(
                {
                    name: "Moderator",
                    value: moderator.toString(),
                    inline: true
                },
                {
                    name: "Target",
                    value: `<@${user.id}>`,
                    inline: true
                },
                {
                    name: "Reason",
                    value: reason
                }
            )
            .setTimestamp()
            .setFooter({ text: `Target ID: ${user.id}` })
        if (deleteRecent) {
            // fetch the last 100 messages from all channels and delete the target's messages
            let counter = 0;
            for (const channel of guild.channels.cache.values()) {
                if (!channel.isTextBased() || channel.isDMBased()) continue;
                const messages = await channel.messages.fetch({ limit: 100 });

                for (const message of messages.values()) {
                    if (message.author.id === member.id) {
                        counter += 1;
                        await message.delete().catch(() => { });
                    }
                }
            }
            kickEmbed.addFields({
                name: "Messages deleted",
                value: `${counter}`
            });
        }

        try {
            await member.kick(reason);
        } catch (error) {
            await errorLogHandle(error);
            await interaction.editReply({
                embeds: [embed_error("Something went wrong while trying to kick the member.")]
            });
            return;
        }
        if (modLogs) {
            await modLogs.send({ embeds: [kickEmbed] });
        }

        await interaction.editReply({ embeds: [kickEmbed] });

    }
}

export default kickCommand;