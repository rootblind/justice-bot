/* 
    Server roles represent what the bot actually recognizes as the defined roles for functions like:
    staff member, premium user, unbanned (on probational) user, etc.

*/

const { SlashCommandBuilder, Client, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { poolConnection } = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const { botPermissions } = require('./welcome.js');

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
                            }
                            // more to be added as this bot evolves
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('info')
                .setDescription('Show the current role types and the associated server roles.')
        ),
    botPermissions: [],

    async execute(interaction, client)
    {
        const embed = new EmbedBuilder();
        const subcommand = interaction.options.getSubcommand();
        const roleType = interaction.options.getString('role-type');
        const role = interaction.options.getRole('role');

        if(subcommand == 'set') {
            const setRolePromise = new Promise((resolve, reject) => {
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