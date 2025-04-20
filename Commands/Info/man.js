/*
    User documentation
*/

const {SlashCommandBuilder, ComponentType, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {command_manual, commandsCategories, categoriesFields, categoriesMenu} = require("../../utility_modules/manual.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("man")
        .setDescription("Open the manual.")
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Open the manual at the specified command page.")
                .setAutocomplete(true)
        ),
    async execute(interaction, client) {
            const commandOption = interaction.options.getString("command") || null;
            if(commandOption) {
                let found = false;
                for(const c in commandsCategories)
                    if(commandsCategories[c].includes(commandOption)) {
                        found = true;
                        break;
                    }
                if(!found) {
                    return await interaction.reply({
                    embeds: [
                        new EmbedBuilder().setColor("Red")
                            .setTitle("Invalid command")
                            .setDescription("No manual was found for the specified command or it doesn\'t exist.")
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }
                const commandEmbed = new EmbedBuilder()
                    .setColor("Purple")
                    .setTitle(`${commandOption} command manual`)
                    .setFields(command_manual(commandOption))
                    
                return await interaction.reply({embeds: [commandEmbed]})
            }

            const embedManual = new EmbedBuilder()
                .setColor("Purple")
                .setTitle("Commands Manual")
                .setFields(categoriesFields)

            const selectCommands = new StringSelectMenuBuilder()
                .setCustomId("select-command")
                .setPlaceholder("Select category")
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(categoriesMenu)
                
            const commandsActionRow = new ActionRowBuilder()
                .addComponents(selectCommands)

            const message = await interaction.reply({embeds: [embedManual], components: [commandsActionRow]});
            const messageFetch = await interaction.fetchReply();

            const commandsCollector = messageFetch.createMessageComponentCollector({
                ComponentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id
            });

            commandsCollector.on("collect", async (selectInteraction) => {
                const option = selectInteraction.values[0];
                embedManual
                    .setColor("Purple")
                    .setTitle(`${option} commands manual`)
                let fieldvalue = "";
                commandsCategories[option].forEach(command => {
                    fieldvalue += `/${command}\n`
                })

                embedManual.setFields(
                    {
                        name: "Commands",
                        value: fieldvalue
                    }
                )
                await selectInteraction.reply({flags: MessageFlags.Ephemeral, content: `Page: ${option} commands`});
                await message.edit({embeds: [embedManual]});
            });
    }
}