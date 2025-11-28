const {SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, PermissionFlagsBits, ComponentType, MessageFlags} = require('discord.js');
const fs = require('graceful-fs');
const {csvAppend, curated_text} = require('../../utility_modules/utility_methods');

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('label-message')
        .setDescription('Label a message for the dataset.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The message to be labeled.')
                .setMinLength(3)
                .setRequired(true)
        ),
    async execute(interaction, client) {
        const text = interaction.options.getString('text');
        const filteredText = curated_text(text);

        if(!filteredText) {
            return await interaction.reply({content: 'The input is invalid. The text must have alphabetical characters and must not be only a link.', flags: MessageFlags.Ephemeral});
        }

        const flagTags = {
            OK: 0,
            Aggro: 0,
            Violence: 0,
            Sexual: 0,
            Hateful: 0,
        }
        const tags = Object.keys(flagTags);
        const selectMenuOptions = [];
        tags.forEach((tag) => {
            selectMenuOptions.push({
                label: tag,
                description: `Flag as ${tag}`,
                value: tag
            });
        })

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select')
            .setMinValues(1)
            .setMaxValues(tags.length)
            .setPlaceholder('Pick the correct flags for the message.')
            .addOptions( selectMenuOptions )
        const selectMenuActionRow = new ActionRowBuilder()
            .addComponents(selectMenu)

        const selectMessage = await interaction.reply({components: [selectMenuActionRow], flags: MessageFlags.Ephemeral});

        const selectMessageReply = await interaction.fetchReply();

        const collector = await selectMessageReply.createMessageComponentCollector({
            ComponentType: ComponentType.StringSelect,
            time: 120_000,
        });

        collector.on('collect', async (interaction) => {
            if(interaction.values.includes('OK'))
                flagTags['OK'] = 1;
            else
                interaction.values.forEach((value) => {
                    flagTags[value] = 1;
                });
            await interaction.reply({flags: MessageFlags.Ephemeral, content: `Flags selected: ${interaction.values.join(', ')}`});
            csvAppend(filteredText, flagTags, 'flag_data.csv');
            collector.stop();
        });

        collector.on('end', async () => {
            await selectMessage.delete();
        });

    }
}