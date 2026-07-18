import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import BotConfigRepo from "../../Repositories/botconfig.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";

const botScope: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("bot-scope")
        .setDescription("Toggle the application scope between test and global.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName("scope")
                .setDescription("The scope of this bot.")
                .setRequired(true)
                .addChoices(
                    {
                        name: "Test",
                        value: "test"
                    },
                    {
                        name: "Global",
                        value: "global"
                    }
                )
        )
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [],
        ownerOnly: true,
        scope: "global",
        category: "Owner",
        group: "global"
    },
    async execute(interaction) {
        const scope = interaction.options.getString("scope", true);
        if (scope !== "test" && scope !== "global") {
            await interaction.reply({
                embeds: [
                    embed_error("The scope must be either `global` or `test` but something else was given.")
                ]
            });
            return;
        }
        await BotConfigRepo.setScope(scope);
        await interaction.reply({
            embeds: [
                embed_message("Green", `Application scope set to \`${scope}\`.`)
            ]
        });

    }
}

export default botScope;