/*
    Moderators can set up a keyword or keyphrase to where the bot will reply as set up
*/

const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags} = require("discord.js")
const {poolConnection} = require("../../utility_modules/kayle-db.js");

module.exports = {
    cooldown: 5,
    botPermissions: [
        PermissionFlagsBits.SendMessages
    ],
    data: new SlashCommandBuilder()
        .setName("custom-react")
        .setDescription("Set up the bot to reply to a specific key word or phrase.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand.setName("add")
                .setDescription("Add a new custom reaction.")
                .addStringOption(
                    option =>
                        option.setName("key")
                            .setDescription("The keyword or keyphrase.")
                            .setMinLength(4)
                            .setMaxLength(20)
                            .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reply")
                        .setDescription("The reply of the bot.")
                        .setMaxLength(256)
                        .setMinLength(4)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setDescription("Remove a custom reaction")
                .addStringOption(option => 
                    option.setName("key")
                        .setDescription("The keyword or keyphrase to be removed")
                        .setMinLength(4)
                        .setMaxLength(20)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setDescription("List all custom reactions")
        ),

    async execute(interaction, client) {
        const cmd = interaction.options.getSubcommand();

        const key = interaction.options.getString("key") || null;
        const reply = interaction.options.getString("reply") || null;

        if(!key) {
            const {rows: reactBool} = await poolConnection.query(`SELECT EXISTS
                (SELECT 1 FROM customreact WHERE guild=$1 AND keyword=$2)`,
                [interaction.guild.id, key]
            );

            if(reactBool[0].exists && cmd == "add") {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "The keyword already exists, remove it before adding it again."
                });
            } else if(!reactBool[0].exists && cmd == "remove") {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "The keyword provided doesn't exist so nothing was removed."
                });
            }
        }

        switch(cmd) {
            case "add":
                await poolConnection.query(`INSERT INTO customreact(guild, keyword, reply)
                    VALUES($1, $2, $3)`,
                    [interaction.guild.id, key.toLowerCase(), reply]
                );

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Green")
                            .setTitle("Custom Reaction added successfully")
                            .addFields(
                                {
                                    name: "Keyword",
                                    value: key
                                },
                                {
                                    name: "Reply",
                                    value: reply
                                }
                            )
                    ]
                });
            break;
            case "remove":
                await poolConnection.query(`DELETE FROM customreact WHERE guild=$1 AND keyword=$2`,
                    [interaction.guild.id, key.toLowerCase()]
                );

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setTitle("Custom reaction removed")
                            .setDescription(`The keyword **${key}** is no longer a custom reaction.`)
                    ]
                });
            break;
            case "list":
                await interaction.deferReply({});
                const {rows: customReactData} = await poolConnection.query(`SELECT * FROM customreact WHERE guild=$1`, [interaction.guild.id]);

                if(customReactData.length == 0) {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setTitle("No custom reactions added.")
                                .setDescription("Set some with `/custom-react add`.")
                        ]
                    });
                }

                let listEmbed = new EmbedBuilder()
                    .setColor("Aqua")
                    .setAuthor({
                        name: `${interaction.guild.name} custom reactions`,
                        iconURL: interaction.guild.iconURL({extension: "png"})
                    });

                let counter = 0;

                for(const row of customReactData) {
                    listEmbed.addFields(
                        {
                            name: row.keyword,
                            value: row.reply
                        }
                    );

                    counter++;
                    if(counter == 25 || counter == customReactData.length) {
                        await interaction.editReply({
                            embeds: [listEmbed]
                        });

                        listEmbed = new EmbedBuilder().setColor("Aqua")
                    } else if(counter > 25 && counter % 25 == 0 || counter == customReactData.length) {
                        await interaction.followUp({
                            embeds: [listEmbed]
                        });
                        listEmbed = new EmbedBuilder().setColor("Aqua")
                    }
                }

            break;
        }
    }
}