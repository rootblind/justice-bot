/* The above code is a JavaScript module that defines a slash command for a Discord bot related to
managing server roles. Here is a breakdown of the key functionalities: */

const { SlashCommandBuilder, Client, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { poolConnection } = require('../../utility_modules/kayle-db.js');

module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('server-role')
        .setDescription('Let the bot know which roles is your staff, your premium membership and other.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Set a new role type or change an existing one.')
                .addStringOption(option =>
                    option.setName('role-type')
                        .setDescription('The type of the server role to be specified')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'Staff',
                                value: 'staff'
                            },
                            {
                                name: 'Premium',
                                value: 'premium'
                            },
                            {
                                name: 'Probation Member',
                                value: 'probation' // this is the kind of user that was banned for good reason and got a second chance
                            },
                            {
                                name: 'Bot',
                                value: 'bot'
                            },
                            {
                                name: "LFG EUNE",
                                value: "lfg-eune"
                            },
                            {
                                name: "LFG EUW",
                                value: "lfg-euw"
                            },
                            {
                                name: "Ticket Support",
                                value: "ticket-support"
                            }
                            // more to be added as this bot evolves
                        )
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The desired role for the chosen function.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a role type.')
                .addStringOption(option =>
                    option.setName('role-type')
                        .setDescription('The type of the server role to be specified')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'Staff',
                                value: 'staff'
                            },
                            {
                                name: 'Premium',
                                value: 'premium'
                            },
                            {
                                name: 'Probation Member',
                                value: 'probation' // this is the kind of user that was banned for good reason and got a second chance
                            },
                            {
                                name: 'Bot',
                                value: 'bot'
                            },
                            {
                                name: "LFG EUNE",
                                value: "lfg-eune"
                            },
                            {
                                name: "LFG EUW",
                                value: "lfg-euw"
                            },
                            {
                                name: "Ticket Support",
                                value: "ticket-support"
                            }
                            // more to be added as this bot evolves
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('info')
                .setDescription('Show the current role types and the associated server roles.')
        ),
    botPermissions: [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageRoles],

    async execute(interaction, client)
    {

        const embed = new EmbedBuilder();
        const subcommand = interaction.options.getSubcommand();
        const roleType = interaction.options.getString('role-type');
        const role = interaction.options.getRole('role');

        if(subcommand == 'set') {
            // the set subcommand associates a role with a role type for the bot.
            // the role id is stored in database and will be used as future references in other commands that depend on role types
            // being defined
            const setRolePromise = new Promise((resolve, reject) => {
                // Here if in a server there is no role defined for the specified role type, it will be inserted
                // otherwise, the role of the role type is updated
                poolConnection.query(`SELECT 1 FROM serverroles WHERE guild=$1 AND roletype=$2`,
                [interaction.guildId, roleType],
                (err, result) =>
                {

                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length == 0) {
                        poolConnection.query(`INSERT INTO serverroles (guild, roletype, role)
                            VALUES ($1, $2, $3)`, [interaction.guildId, roleType, role.id],
                            (err, result) => {
                                if(err) { console.error(err); reject(err); }
                            }
                        );
                    }
                    else if(result.rows.length > 0)
                        {
                            poolConnection.query(`UPDATE serverroles SET role=$1 WHERE guild=$2 AND roletype=$3`,
                                [role.id, interaction.guildId, roleType],
                                (err, result) => {
                                    if(err){ console.error(err); reject(err); }
                                }
                            );
                        }
                    resolve(result);
                });
            });

            await setRolePromise;
            embed.setTitle('Server role set')
                .setColor('Green')
                .setDescription(`Role type ${roleType} has been set to ${role}.`);
            
        }
        else if (subcommand == 'remove')
            {
                // the remove subcommand simply deletes a row from the database as specified in its parameters
                // an improvement for user interaction would be to check if a row exists, if not, notify the user
                const removeRolePromise = new Promise((resolve, reject) =>{
                    poolConnection.query(`DELETE FROM serverroles WHERE guild=$1 AND roletype=$2`, [interaction.guildId, roleType],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            resolve(result);
                        }
                    )
                });
                await removeRolePromise;
                embed.setTitle('Server role cleared')
                    .setColor("Green")
                    .setDescription(`Role type ${roleType} is now empty.`);
            }
        else if(subcommand == 'info')
            {
                // the info subcommand informs the user about what types are linked to what roles
                embed.setTitle('Server roles')
                    .setColor('Purple');
                const serverRolesTable = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT * FROM serverroles WHERE guild=${interaction.guildId}`, (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        else if(result.rows.length == 0) {
                            embed.setDescription('There are no server roles set yet!\nUse /server-role set')
                                .setColor('Blue');
                        }
                        else if(result.rows.length > 0) {
                            const rows = result.rows;
                            rows.forEach(row => {
                                const currentRole = interaction.guild.roles.cache.get(row.role);
                                embed.addFields(
                                    {
                                        name: `${row.roletype}`,
                                        value: `${currentRole}`,
                                        inline: true
                                    }
                                );
                            });
                        }
                        resolve(result);
                    });
                });
                await serverRolesTable;
            }
        return interaction.reply({embeds: [embed]});
    }
}