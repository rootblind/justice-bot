/*
    Set up what happens when a staff member reaches X strikes
*/

const {
    SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits,
} = require("discord.js");

const {poolConnection} = require("../../utility_modules/kayle-db.js");

module.exports = {
    cooldown: 5,
    botPermissions: [PermissionFlagsBits.Administrator],
    data: new SlashCommandBuilder()
        .setName("strike-rule")
        .setDescription("Manage strike rules.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Set a new unique rule.")
                .addNumberOption(option =>
                    option.setName("strikes")
                        .setDescription("The number of strikes that will trigger this rule.")
                        .setMaxValue(25)
                        .setMinValue(1)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("punishment")
                        .setDescription("The punishment type that this rule will trigger.")
                        .addChoices(
                            {
                                name: "Downgrade",
                                value: "downgrade"
                            },
                            {
                                name: "Kick from staff",
                                value: "kick"
                            }
                        )
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setDescription("Remove a strike rule.")
                .addNumberOption(option =>
                    option.setName("strikes")
                        .setDescription("The number of strikes that trigger the rule.")
                        .setMinValue(1)
                        .setMaxValue(25)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setDescription("List the current configuration of server strike rules.")
        ),

    async execute(interaction, client) {
        await interaction.deferReply({});

        const strikes = interaction.options.getNumber("strikes") || null;
        const punishment = interaction.options.getString("punishment") || null;
        const cmd = interaction.options.getSubcommand();

        // same permission requirements as /staff-roles
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);

        if(interaction.member.roles.highest.position <= botMember.roles.highest.position) {
            return await interaction.editReply({
                content: "You lack permission to do that!\nYour highest role must be above mine!"
            });
        }

        if(strikes) {
            const {rows: strikeRuleBool} = await poolConnection.query(`SELECT EXISTS
                (SELECT 1 FROM strikerule WHERE guild=$1 AND strikecount=$2)`,
                [interaction.guild.id, strikes]
            );

            if(strikeRuleBool[0].exists && cmd == "set") {
                return await interaction.editReply({
                    content: `A rule already exists for this number of strikes. \`${strikes}\``
                });
            } else if(!strikeRuleBool[0].exists && cmd == "remove") {
                return await interaction.editReply({
                    content: `There is no rule triggered by \`${strikes}\` strikes.`
                });
            }
        }

        switch(cmd) {
            case "set":
                await poolConnection.query(`INSERT INTO strikerule(guild, strikecount, punishment)
                    VALUES ($1, $2, $3)`,
                    [interaction.guild.id, strikes, punishment]
                );

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Green")
                            .setTitle("New strike rule added")
                            .setDescription("You successfully added a new strike rule")
                            .addFields(
                                {
                                    name: "Strikes",
                                    value: `${strikes}`,
                                    inline: true
                                },
                                {
                                    name: "Punishment",
                                    value: punishment,
                                    inline: true
                                }
                            )
                    ]
                });
            break;
            case "remove":
                await poolConnection.query(`DELETE FROM strikerule WHERE guild=$1 AND strikecount=$2`,
                    [interaction.guild.id, strikes]
                );

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setTitle("The strike rule was removed")
                            .setDescription(`Rule \`${strikes}\` was removed.`)
                    ]
                });
            break;
            case "list":
                const {rows: ruleStrikeData} = await poolConnection.query(`SELECT * FROM strikerule WHERE guild=$1
                    ORDER BY strikecount DESC`, [interaction.guild.id]);

                if(ruleStrikeData.length == 0) {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Purple")
                                .setTitle("The list is empty")
                                .setDescription("You can set up a rule using `/strike-rule set`.")
                        ]
                    });
                }

                const embedList = new EmbedBuilder()
                    .setColor("Purple")
                    .setAuthor({
                        name: `${interaction.guild.name} staff strike rules.`,
                        iconURL: interaction.guild.iconURL({extension: "png"})
                    })

                for(const row of ruleStrikeData) {
                    embedList.addFields(
                        {
                            name: `Strikes [${row.strikecount}]`,
                            value: `Action: ${row.punishment}`
                        }
                    )
                }

                await interaction.editReply({
                    embeds: [ embedList ]
                });
            break;
        }
    }
}