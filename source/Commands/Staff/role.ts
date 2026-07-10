import { GuildMember, MessageFlags, PermissionFlagsBits, Role, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import {
    HEXCOLOR_PATTERN,
    role_builder,
    role_create_modal,
    role_editor_safe,
    role_icon_validator,
    role_input_validator,
    role_name_validator,
    RoleModificationOptions
} from "../../Systems/components/role_builder_menu.js";
import { handleModalCatch } from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message, embed_role_details } from "../../utility_modules/embed_builders.js";
import { hexcolorParser } from "../../utility_modules/utility_methods.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { HexcolorRole } from "../../Interfaces/helper_types.js";

const roleCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDescription("Manage roles.")
        .addSubcommand(subcommand =>
            subcommand.setName("create")
                .setDescription("Create a new role")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("edit")
                .setDescription("Edit the selected role.")
                .addRoleOption(option =>
                    option.setName("role")
                        .setDescription("The role to be edited.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("delete")
                .setDescription("Delete the selected role.")
                .addRoleOption(option =>
                    option.setName("role")
                        .setDescription("The role to be deleted.")
                        .setRequired(true)
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [
            PermissionFlagsBits.ManageRoles
        ],
        botPermissions: [
            PermissionFlagsBits.ManageRoles
        ],
        scope: "global",
        category: "Staff",
        group: "global"
    },
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        const role = options.getRole("role") as Role | null;
        const botMember = await guild.members.fetchMe();

        // validate role
        // if the subcommand is edit or delete, then a role is required.
        if (
            (subcommand === "edit" || subcommand === "delete") &&
            role &&
            (botMember.roles.highest.position <= role.position ||
                member.roles.highest.position <= role.position ||
                role.managed)
        ) {
            await interaction.reply({
                embeds: [
                    embed_message(
                        "Red",
                        "The role is of higher permission than mine or yours or is managed by a bot.",
                        "The role can not be deleted or modified"
                    )],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        switch (subcommand) {
            case "create": {
                await interaction.showModal(role_create_modal())
                try {
                    const submit = await interaction.awaitModalSubmit({
                        time: 300_000,
                        filter: (i) => i.user.id === member.id
                    });

                    const roleName = submit.fields.getTextInputValue("role-name-input");
                    const hexColor = submit.fields.getTextInputValue("hexcolor-input");
                    const iconFile = submit.fields.getUploadedFiles("icon-file-input", false);

                    const validatorResponse = await role_input_validator(
                        guild,
                        roleName,
                        hexColor,
                        iconFile?.first()
                    );

                    if (!validatorResponse.valid) {
                        await submit.reply({
                            embeds: [
                                embed_message("Red", validatorResponse.message ?? "Unknown error.")
                            ],
                            flags: MessageFlags.Ephemeral
                        });

                        return;
                    }

                    const hexcolors = hexcolorParser(hexColor)!; // validator assures reaching this line has a valid hexcolor

                    const newRole = await role_builder(
                        guild,
                        roleName,
                        hexcolors,
                        iconFile?.first()
                    );

                    await submit.reply({
                        embeds: [
                            embed_role_details(
                                newRole,
                                `${newRole} has been created.`,
                                "Role Created"
                            )
                        ]
                    });

                } catch (error) {
                    await handleModalCatch(error);
                }
                break;
            }
            case "edit": {
                await interaction.showModal(role_create_modal(true)); // edit_mode = true
                try {
                    const submit = await interaction.awaitModalSubmit({
                        time: 300_000,
                        filter: (i) => i.user.id === member.id
                    });

                    const roleName = submit.fields.getTextInputValue("role-name-input");
                    const hexColor = submit.fields.getTextInputValue("hexcolor-input");
                    const iconFile = submit.fields.getUploadedFiles("icon-file-input", false);
                    const modifications: RoleModificationOptions = {}
                    if (roleName.trim()) {
                        const validName = await role_name_validator(roleName, guild);
                        if (!validName) {
                            await submit.reply({
                                embeds: [
                                    embed_message("Red", "The name is not valid.")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        modifications.name = roleName;
                    }
                    if (hexColor.trim()) {
                        const hexcolorRole: HexcolorRole | null = hexcolorParser(hexColor, HEXCOLOR_PATTERN);
                        if (!hexcolorRole) {
                            await submit.reply({
                                embeds: [
                                    embed_message("Red", "The hexcolor is not valid.")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        modifications.colors = hexcolorRole;
                    }

                    if (iconFile && iconFile.first()) {
                        const iconAttachment = iconFile.first()!;
                        const validateIcon = role_icon_validator(iconAttachment);
                        if (!validateIcon) {
                            await submit.reply({
                                embeds: [
                                    embed_message("Red", "Invalid file format or the image is larger than 256KB!")
                                ],
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        modifications.icon = iconAttachment;
                    }

                    const modifiedRole = await role_editor_safe(role!, modifications);
                    await submit.reply({
                        embeds: [
                            embed_role_details(
                                modifiedRole,
                                `${modifiedRole} has been modified.`,
                                "Role Edited"
                            )
                        ]
                    });

                } catch (error) {
                    await handleModalCatch(error);
                }
                break;
            }
            case "delete": {
                try {
                    // role is guaranteed by being under the delete case
                    await role!.delete(`Requested by ${member.user.username}.`);
                    await interaction.reply({
                        embeds: [embed_message("Green", `The role **${role!.name}** was deleted.`)],
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    await errorLogHandle(error);
                    await interaction.reply({
                        embeds: [embed_error("Something went wrong while trying to delete the role...")],
                        flags: MessageFlags.Ephemeral
                    });
                }
                break;
            }
        }
    }
}

export default roleCommand;