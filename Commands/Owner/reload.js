const {Client, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {loadCommands} = require('../../Handlers/commandHandler');
const {loadEvents} = require('../../Handlers/eventHandler');
const botUtils = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload the commands or events files')
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
    
    async execute(interaction, client){
        if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == 0)
            {
                console.error(`I am missing SendMessages permission in ${interaction.channel} channel.`);
            }
            else if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == -1){
                const embed = EmbedBuilder()
                    .setTitle('An error occurred while running this command!')
                    .setColor('Red');
                return interaction.reply({embeds:[embed], ephemeral:true});
                
            }
        if(interaction.user.id != process.env.OWNER)
        {
            return interaction.reply({content: `You are not my master!`, ephemeral: true});
        }

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