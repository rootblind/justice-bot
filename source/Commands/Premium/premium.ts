import {
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PremiumSystemRepo, { } from "../../Repositories/premiumsystem.js";
import { embed_error } from "../../utility_modules/embed_builders.js";
import { profile_subcommand } from "../../Systems/premium/profile_subcommand.js";
import { role_subcommand_group } from "../../Systems/premium/role_subcommand_group.js";

const premiumCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("premium")
        .setDescription("Manage and see your premium status and perks.")
        .addSubcommand(subcommand =>
            subcommand.setName("profile")
                .setDescription("Show your premium profile page.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("role")
                .setDescription("Custom role related commands")
                .addSubcommand(subcommand =>
                    subcommand.setName("panel")
                        .setDescription("Open the panel to manage your custom role.")
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("invite")
                        .setDescription("Invite another member to share your custom role with.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The user to be invited.")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("revoke")
                        .setDescription("Revoke your custom role from another member.")
                        .addUserOption(option =>
                            option.setName("user")
                                .setDescription("The user to remove your role from.")
                                .setRequired(true)
                        )
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
        group: "premium",
        category: "Premium",
        scope: "guild"
    },

    async execute(interaction, client) {
        if (!client) return;
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const subcommandGroup = options.getSubcommandGroup();
        const membership = await PremiumSystemRepo.getGuildFullMembership(guild.id, member.id);
        if (!membership) {
            // interactionCreate should guarantee that execution if this command is reached only by premium members
            // this if is just another safeguard
            await interaction.reply({
                embeds: [
                    embed_error("Your membership couldn't be fetched. Contact an administrator if you think this is a mistake.")
                ],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        switch (subcommandGroup) {
            case null: {
                switch (subcommand) {
                    case "profile": {
                        await profile_subcommand(interaction, member, membership);
                        break;
                    }
                }
                break;
            }
            case "role": {
                await role_subcommand_group(interaction, options, member, membership, subcommand);
                break;
            }
        }
    }
}

export default premiumCommand;