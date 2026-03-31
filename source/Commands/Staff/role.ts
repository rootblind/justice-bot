import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { role_create_modal } from "../../Systems/components/role_builder_menu.js";

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

                    console.log(iconFile);
                } catch (error) {
                    console.error(error);
                }
                break;
            }
        }
    }
}

export default roleCommand;