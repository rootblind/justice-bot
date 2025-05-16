const {
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags
} = require("discord.js");
const {poolConnection} = require("../../utility_modules/kayle-db.js");

module.exports = {
    cooldown: 5,
    botPermissions: [
        PermissionFlagsBits.ManageChannels,
    ],
    data: new SlashCommandBuilder()
        .setName("ticket-member")
        .setDescription("Add or remove a member from the current ticket")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand.setName("add")
                .setDescription("Add a new member to this ticket.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The member to be added to the ticket.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove")
                .setDescription("Remove a member from the ticket")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to be removed from the ticket.")
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser("user");
        const cmd = interaction.options.getSubcommand();

        const {rows: ticketManagerData} = await poolConnection.query(`SELECT category FROM ticketmanager WHERE guild=$1`,
            [interaction.guild.id]
        );

        if(ticketManagerData.length == 0) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "This command requires the ticket system to be set up!"
            });
        }

        if(interaction.channel.parentId != ticketManagerData[0].category) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You can not run this command outside a ticket."
            });
        }

        let member = null;
        try{
            member = await interaction.guild.members.fetch(user);
        } catch(err) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "Invalid input, the user might not be a member of this server."
            });
        }

        const hasPermission = interaction.channel.permissionsFor(member).has(PermissionFlagsBits.SendMessages);

        switch(cmd) {
            case "add":
                if(hasPermission) {
                    return await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "The member is already in this ticket!"
                    });
                }

                await interaction.channel.permissionOverwrites.edit(member.id, {
                    SendMessages: true,
                    EmbedLinks: true,
                    AttachFiles: true,
                    ViewChannel: true
                });

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Aqua")
                            .setAuthor({
                                name: `${interaction.user.username} added a member to this ticket`,
                                iconURL: interaction.user.displayAvatarURL({extension: "png"})
                            })
                            .setDescription(`${interaction.member} added ${member} to this ticket.`)
                            .setTimestamp()
                    ],
                    content: `${member} you have been added to this ticket!`
                });
            break;
            case "remove":
                if(!hasPermission) {
                    return await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: "The member is not in this ticket."
                    });
                }

                await interaction.channel.permissionOverwrites.edit(member.id, {
                    SendMessages: false,
                    EmbedLinks: false,
                    AttachFiles: false,
                    ViewChannel: false
                });

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Aqua")
                            .setAuthor({
                                name: `${interaction.user.username} removed a member from this ticket`,
                                iconURL: interaction.user.displayAvatarURL({extension: "png"})
                            })
                            .setDescription(`${interaction.member} removed ${member} from this ticket.`)
                            .setTimestamp()
                    ]
                });

            break;
        }
    }
}