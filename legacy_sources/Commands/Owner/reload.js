/*
    Reload modules live. Not sure what might happen with non-persistent variables after reloading.
*/

const {Client, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const {loadCommands} = require('../../Handlers/commandHandler');
const {loadEvents} = require('../../Handlers/eventHandler');

module.exports = {
    cooldown: 10,
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload the commands or events files')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
                subcommand.setName('commands')
                    .setDescription('Reload the commands files only')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('events')
                .setDescription('Reload the events files only')
        )
        .addSubcommand(subcommand => 
            subcommand.setName('all')
                .setDescription('Reload all files')
        ),
    botPermissions: [PermissionFlagsBits.SendMessages],
    async execute(interaction, client){
        const subcommand = interaction.options.getSubcommand();
        const embed = new EmbedBuilder()
            .setTitle('💻 Master')
            .setColor('Blue');
        switch(subcommand){
            case 'commands': {
                loadCommands(client);
                interaction.reply({embeds: [embed.setDescription('✅ Commands have been reloaded!')]});
                console.log(`${interaction.user.id} - reloaded the commands.`);
            }
            break;
            case 'events': {
                loadEvents(client);
                interaction.reply({embeds: [embed.setDescription('✅ Events have been reloaded!')]});
                console.log(`${interaction.user.id} - reloaded the events.`);
            }
            break;
            case 'all': {
                loadCommands(client);
                loadEvents(client);
                interaction.reply({embeds: [embed.setDescription('✅ All files have been reloaded!')]});
                console.log(`${interaction.user.id} - reloaded all files.`);
            }

        }
    }
};