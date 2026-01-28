import {
    APIApplicationCommandOptionChoice,
    APIEmbedField,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    RestOrArray,
    Role,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { GUILD_ROLE_TYPE, GuildRoleTypeString } from "../../Interfaces/database_types.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { fetchGuildRole } from "../../utility_modules/discord_helpers.js";

const roles_optios: RestOrArray<APIApplicationCommandOptionChoice<string>> = [
    ...GUILD_ROLE_TYPE.map(type => {
        return {
            name: type.replace("-", " ").toUpperCase(),
            value: type
        }
    })
];

const server_roles: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("server-roles")
        .setDescription("Role types are used by different systems. Assign or remove roles with these functions.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Assign a role to a server-role type.")
                .addStringOption(option =>
                    option.setName("type")
                        .setDescription("The type of the server-role to be assigned.")
                        .setRequired(true)
                        .addChoices(...roles_optios)
                )
                .addRoleOption(option =>
                    option.setName("role")
                        .setDescription("The role to be assigned.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setDescription("Revoke the role assign to the server-role type")
                .addStringOption(option =>
                    option.setName("type")
                        .setDescription("The type of the server-role to be revoked.")
                        .setRequired(true)
                        .addChoices(...roles_optios)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("info")
                .setDescription("The current server-role configuration.")
        )
        .toJSON(),

    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case "set": {
                const role: Role = options.getRole("role", true) as Role;
                const type: GuildRoleTypeString = options.getString("type", true) as GuildRoleTypeString;
                const me: GuildMember = await guild.members.fetchMe();

                if (role.managed) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("You can not use managed/bot owned roles for that!")]
                    });
                    return;
                }
                if (role.position >= me.roles.highest.position) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("The role targeted is too high for me!")]
                    });
                    return;
                }
                if (role.position >= member.roles.highest.position) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("The role targeted is above your highest role.\nYou lack permission!")]
                    });
                    return;
                }
                if (role.id === guild.roles.everyone.id) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("You can not assign that role!")]
                    });
                    return;
                }

                // insert in database
                await ServerRolesRepo.put(guild.id, type, role.id);
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [
                        embed_message("Green", `${role} has been assigned as server-role type **${type}**.`, "Server role set")
                    ]
                });
                break;
            }
            case "remove": {
                const type = options.getString("type", true) as GuildRoleTypeString;
                await ServerRolesRepo.deleteGuildRole(guild.id, type);
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [embed_message("Green", `**${type}** is now revoked.\nSome of the bot's features will be disabled.`, "Server role removed")]
                });
                break;
            }
            case "info": {
                const serverRolesData = await ServerRolesRepo.getServerRoles(guild.id);
                const fields: RestOrArray<APIEmbedField> = [];
                for (const row of serverRolesData) {
                    const roleObj = await fetchGuildRole(guild, row.role);
                    if(!roleObj) {
                        await ServerRolesRepo.deleteGuildRole(guild.id, row.roletype as GuildRoleTypeString);
                        continue;
                    }
                    fields.push({
                        name: row.roletype,
                        value: `${roleObj}`,
                        inline: true
                    });
                }
                if (serverRolesData.length === 0) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_message("Aqua", "No roles were assigned.\nUser `/server-roles set` to assign some.", "Server roles")]
                    });
                } else {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            embed_message("Aqua", "The roles currently assigned and their types.", "Server roles")
                                .setFields(...fields)
                        ]
                    });
                }
                break;
            }
        }
    },
    metadata: {
        cooldown: 10,
        botPermissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles
        ],
        userPermissions: [PermissionFlagsBits.Administrator],
        scope: "global",
        category: "Administrator",
        group: "global"
    }
}

export default server_roles;