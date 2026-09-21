import { CategoryChannel, ChannelType, GuildMember, PermissionFlagsBits, Role, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { antiAltExecuteWrapper } from "../../Systems/antialt_guard/toolkit.js";
import { embed_message } from "../../utility_modules/embed_builders.js";
import { aa_guard_setup } from "../../Systems/antialt_guard/aa_guard_setup.js";

const antiAltGuard: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("aa-guard")
        .setDescription("Anti alt guard commands.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("setup")
                .setDescription("Setup the configuration for the antialt guard system.")
                .addChannelOption(option =>
                    option.setName("category")
                        .setDescription("The category to be assigned for the antialt guard system.")
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addRoleOption(option =>
                    option.setName("role")
                        .setDescription("The role to be assigned as verified.")
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10, // TODO: increase the cooldown after dev
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.Administrator],
        scope: "guild",
        group: "moderation",
        category: "Administrator",
        testOnly: true
    },
    execute: antiAltExecuteWrapper(async (interaction) => {
        const admin = interaction.member as GuildMember;
        const guild = admin.guild;
        const botMember = await guild.members.fetchMe();
        const options = interaction.options;
        const subcommandGroup = options.getSubcommandGroup();
        const subcommand = options.getSubcommand();

        switch (subcommandGroup) {
            case null: {
                switch (subcommand) {
                    case "setup": {
                        const category = options.getChannel("category") as CategoryChannel | null;
                        const role = options.getRole("role") as Role | null;
                        if (role) {
                            if (
                                role.position >= botMember.roles.highest.position ||
                                role.position >= admin.roles.highest.position ||
                                role.managed ||
                                role.id === guild.roles.everyone.id
                            ) {
                                await interaction.reply({
                                    embeds: [
                                        embed_message(
                                            "Red",
                                            "The role is unavailable for this action. " +
                                            "Use a role below your highest role and my highest role, " +
                                            "that is not owned by a bot and is different from @everyone."
                                        )
                                    ]
                                });
                                return;
                            }
                        }

                        await aa_guard_setup(interaction, { category: category, role: role });
                        break;
                    }
                }
                break;
            }
        }
    })
}

export default antiAltGuard;