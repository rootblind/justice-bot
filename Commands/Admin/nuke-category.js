const {
    SlashCommandBuilder, PermissionFlagsBits, ChannelSelectMenuBuilder,
    ChannelType, EmbedBuilder, ActionRowBuilder,
    ActionRow,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

module.exports = {
    cooldown: 60,
    data: new SlashCommandBuilder()
        .setName("nuke-category")
        .setDescription("Delete a category and all channels inside it.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        if(interaction.user.id != interaction.guild.ownerId) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "This command can be executed only by the server owner!"
            });
        }

        let categoryCount = await interaction.guild.channels.cache.filter(channel => channel.type == ChannelType.GuildCategory).size;
        if(!categoryCount) categoryCount = 1; // default to 1

        const select = new ChannelSelectMenuBuilder()
            .setChannelTypes(ChannelType.GuildCategory)
            .setCustomId("select-category")
            .setMinValues(1)
            .setMaxValues(categoryCount)
            .setPlaceholder("Select the categories to be nuked...")

        const selectActionRow = new ActionRowBuilder().addComponents(select);

        const nukeButton = new ButtonBuilder()
            .setCustomId("nuke-button")
            .setLabel("NUKE")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🚀")

        const buttonActionRow = new ActionRowBuilder().addComponents(nukeButton);

        const reply = await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
                new EmbedBuilder()
                    .setColor("Red")
                    .setTitle("Select the categories to be nuked")
                    .setDescription("Nuking a category permanently deletes it and its channels!")
            ],
            components: [selectActionRow]
        });

        const fetchedReply = await interaction.fetchReply();
        const categoriesSelected = [];

        const selectCollector = fetchedReply.createMessageComponentCollector({
            ComponentType: ComponentType.ChannelSelect,
            filter: (i) => i.user.id === interaction.user.id,
            time: 300_000
        });

        const buttonCollector = fetchedReply.createMessageComponentCollector({
            ComponentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 300_000
        });

        selectCollector.on("collect", async (selectInteraction) => {
            if(!selectInteraction.isChannelSelectMenu()) return;
            for(const id of selectInteraction.values) {
                const category = await interaction.guild.channels.fetch(id);
                categoriesSelected.push(category);
            }

            await selectInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: `${categoriesSelected.join(", ")}\n${categoriesSelected.length > 1 ? "Are" : "Is"} selected to be nuked!`
            });

            await reply.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("Confirm nuking the channels")
                        .setDescription(`Proceed nuking the categories and their channels by pressing the button.\nCategories to be nuked: ${categoriesSelected.join(", ")}`)
                ],
                components: [buttonActionRow]
            });
            
        });

        buttonCollector.on("collect", async (buttonInteraction) => {
            if(!buttonInteraction.isButton()) return;
            await buttonInteraction.deferReply({
                flags: MessageFlags.Ephemeral,
                content: "Nuking channels..."
            });
            for(category of categoriesSelected) {
                for(const channelId of category.children.cache.values()) {
                    try{
                        const channel = await interaction.guild.channels.fetch(channelId.id);
                        await channel.delete();
                    } catch(err) {
                        console.error(err);
                        continue;
                    }
                }

                try{
                    await category.delete();
                } catch(err) {
                    console.error(err);
                    continue;
                }
            }

            await buttonInteraction.editReply({
                content: "Nuking executed!"
            });
            selectCollector.stop();
        })

        selectCollector.on("end", async () => {
            try{
                await reply.delete();
                buttonCollector.stop();
            } catch(err) {};
        });
    }
}