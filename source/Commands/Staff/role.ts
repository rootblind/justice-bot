import { GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { role_builder, role_create_modal, role_input_validator } from "../../Systems/components/role_builder_menu.js";
import { handleModalCatch } from "../../utility_modules/discord_helpers.js";
import { embed_message, embed_role_details } from "../../utility_modules/embed_builders.js";
import { hexcolorParser } from "../../utility_modules/utility_methods.js";

const roleCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDescription("Manage roles.")
        .addSubcommand(subcommand =>
            subcommand.setName("create")
                .setDescription("Create a new role")
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
        }
    }
}

export default roleCommand;