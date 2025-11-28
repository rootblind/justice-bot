const {SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags} = require("discord.js");
const { poolConnection } = require("../../utility_modules/kayle-db.js");

module.exports = {
    cooldown: 5,
    botPermissions: [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageRoles],
    data: new SlashCommandBuilder()
        .setName("staff-roles")
        .setDescription("Declare the server's staff roles.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("set")
                .setDescription("Define a role as a staff role.")
                .addRoleOption(option =>
                    option.setName("role")
                        .setDescription("The role to be set.")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("role-type")
                        .setDescription("The type of the staff role. Ex: moderator")
                        .setRequired(true)
                        .setMinLength(3)
                        .setMaxLength(100)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove-role")
                .setDescription("Remove a role defined as staff.")
                .addRoleOption(option =>
                    option.setName("role")
                        .setDescription("The target staff role.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("remove-type")
                .setDescription("Remove all roles from the specified type")
                .addStringOption(option =>
                    option.setName("role-type")
                        .setDescription("The targeted role type.")
                        .setRequired(true)
                        .setMinLength(3)
                        .setMaxLength(100)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName("list")
                .setDescription("List the current staff role types and their assigned roles.")
        )

    ,
    async execute(interaction, client) {
        const role = interaction.options.getRole("role") || null;
        let roletype = interaction.options.getString("role-type") || null;
        const cmd = interaction.options.getSubcommand();
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);

        const {rows: staffRoleBool} = await poolConnection.query(`SELECT EXISTS
            (SELECT 1 FROM serverroles 
            WHERE roletype='staff' AND guild=$1)`,
            [interaction.guild.id]
        );

        if(!staffRoleBool[0].exists) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You can not run such commands before defining the general staff role using `/server-role`"
            });
        }

        if(interaction.member.roles.highest.position <= botMember.roles.highest.position) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: "You lack permission to do that!\nYour highest role must be above mine!"
            });
        }

        if(role) {
            if(interaction.member.roles.highest.position <= role.position) {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "You lack the permission to touch that role!!"
                });
            }

            if(role.id === interaction.guild.roles.everyone.id) {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "You can not assign everyone for that!"
                });
            }

            if(botMember.roles.highest.position <= role.position) {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "My highest role is below the one specified, therefore I lack permission!"
                });
            }

            // check if the role already exists
            const {rows: roleBool} = await poolConnection.query(`SELECT EXISTS
                (SELECT 1 FROM staffroles WHERE guild=$1 AND role=$2)`,
                [interaction.guild.id, role.id]
            );

            if(roleBool[0].exists && cmd == "set") {
                return await interaction.editReply({
                    flags: MessageFlags.Ephemeral,
                    content: "The role specified is already defined, you must remove it to re-define the same role!"
                });
            } else if(!roleBool[0].exists && cmd == "remove-role") {
                return await interaction.editReply({
                    flags: MessageFlags.Ephemeral,
                    content: "You can not remove roles that are not specified yet!"
                });
            }
        }

        if(roletype) {
            roletype = roletype.toLowerCase();

            const {rows: roleTypeBool} = await poolConnection.query(`SELECT EXISTS
                (SELECT 1 FROM staffroles WHERE guild=$1 AND roletype=$2)`,
                [interaction.guild.id, roletype]
            );

            if(cmd == "remove-type" && !roleTypeBool[0].exists) {
                return await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: "The staff role type does not exist!"
                });
            }
        }


        await interaction.deferReply();

        switch(cmd) {
            case "set":
                await poolConnection.query(`INSERT INTO staffroles(guild, role, roletype, position)
                    VALUES($1, $2, $3, $4)`,
                    [interaction.guild.id, role.id, roletype, role.position]
                );

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Green")
                            .setTitle("Staff role defined")
                            .setDescription(`${role}(${roletype}) is now defined as staff role.`)
                    ]
                });
            break;
            case "remove-role":
                await poolConnection.query(`DELETE FROM staffroles WHERE guild=$1 AND role=$2`,
                    [interaction.guild.id, role.id]
                );

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setTitle("Staff role removed")
                            .setDescription(`${role} is no longer defined as a staff role.`)
                    ]
                });
            break;
            case "remove-type":
                await poolConnection.query(`DELETE FROM staffroles WHERE guild=$1 AND roletype=$2`,
                    [interaction.guild.id, roletype]
                );

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setTitle("Staff role type removed")
                            .setDescription(`All roles defined as **${roletype}** are no longer defined as staff roles.`)
                    ]
                });
            break;
            case "list":
                const {rows: staffRolesData} = await poolConnection.query(`SELECT * FROM staffroles WHERE guild=$1
                    ORDER BY position DESC`, [interaction.guild.id]);

                if(staffRolesData.length == 0) {
                    return await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Aqua")
                                .setTitle("Empty list")
                                .setDescription("No specific staff roles defined.")
                        ]
                    });
                } 

                const listEmbed = new EmbedBuilder()
                    .setColor("Aqua")
                    .setAuthor({
                        name: `${interaction.guild.name}'s staff members`,
                        iconURL: interaction.guild.iconURL({extension: "png"})
                    });

                const staffDict = {};

                for(const row of staffRolesData) { // organizing the roles in an object manner
                    try {
                        const role = await interaction.guild.roles.fetch(row.role);

                        if(!(row.roletype in staffDict)) {
                            staffDict[row.roletype] = [];
                        }

                        staffDict[row.roletype].push(role)
                        
                    } catch(err) {
                        console.error(`${row}\n` + err);
                        continue;
                    }
                }

                for(const type in staffDict) {
                    let fieldString = "";
                    for(const role of staffDict[type]) {
                        const members = await role.members.map(m => m).join("\n");

                        fieldString += `${role}:\n\n`;
                        if(fieldString)
                            fieldString += `${members}`;
                        else
                            fieldString += "Empty role."

                        
                    }

                    listEmbed.addFields({
                        name: `${type.toUpperCase()}`,
                        value: fieldString,
                        inline: true
                    });

                }

                await interaction.editReply({
                    embeds: [
                        listEmbed
                    ]
                });

            break;
        }
    }

}