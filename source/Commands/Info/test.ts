import { EmbedBuilder, Role, RoleMention, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";

const test: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("test")
        .setDescription("test")
        .addRoleOption(option =>
            option.setName("role")
                .setDescription("role")
                .setRequired(true)
        )
        .toJSON(),
    async execute(interaction) {
        const options = interaction.options;
        const role = options.getRole("role", true) as Role;
        const normalize = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, "-");
        let roleIcon: string | null | RoleMention = null;
        if (role.unicodeEmoji) roleIcon = role.unicodeEmoji;
        const emojis = await role.guild.emojis.fetch();
        const emoji = emojis.find(e => normalize(e.name) === normalize(role.name));
        if (emoji) {
            roleIcon = emoji.toString();
        }
        if(roleIcon === null) roleIcon = role.toString();

        await interaction.reply({embeds: [ new EmbedBuilder().setFields({name: "test", value: `${roleIcon}`}) ]})

    },

    metadata: {
        botPermissions: [],
        userPermissions: [],
        cooldown: 0,
        scope: "global",
        ownerOnly: true
    }
}

export default test;
