import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_message, embed_unban } from "../../utility_modules/embed_builders.js";
import BanListRepo from "../../Repositories/banlist.js";
import { unban_handler } from "../../Systems/moderation/ban_system.js";
import { fetchLogsChannel } from "../../utility_modules/discord_helpers.js";

const unbanCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban the targeted user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to be unbanned.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason to be unbanned.')
                .setRequired(true)
                .setMinLength(4)
                .setMaxLength(512)
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        userPermissions: [PermissionFlagsBits.BanMembers],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "moderation",
        category: "Moderator"
    },
    async execute(interaction) {
        const moderator = interaction.member as GuildMember;
        const guild = moderator.guild;
        const options = interaction.options;

        const target = options.getUser("target", true);
        const reason = options.getString("reason", true);

        try {
            await guild.bans.fetch(target);
        } catch {
            // fetch throws if the target is not banned
            await interaction.reply({
                embeds: [embed_message("Red", `${target} is not currently banned.`)]
            });
            return;
        }

        const isPermabanned = await BanListRepo.isUserPermabanned(guild.id, target.id);
        if (isPermabanned) {
            if (!moderator.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    embeds: [
                        embed_message("Red",
                            `${target} is permanently banned. Unbanning this user requires Administrator permission.`
                        )
                    ]
                });
                return;
            }
            await interaction.reply({
                embeds: [
                    embed_message("Red",
                        `${target} is permanently banned on this server.\nUse \`/unban-perma\` instead.`
                    )
                ]
            });
            return;
        }

        if (target.bot) {
            await interaction.reply({
                embeds: [embed_message("Red", "You can not target bots with this action!.")]
            });
            return;
        }

        const modLogs = await fetchLogsChannel(guild, "moderation");
        await unban_handler(guild, target, moderator.user, modLogs, reason);
        await interaction.reply({
            embeds: [
                embed_unban(target, moderator.user, reason)
            ]
        });
    }
}

export default unbanCommand;