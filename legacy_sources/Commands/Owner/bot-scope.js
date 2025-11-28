const {SlashCommandBuilder, EmbedBuilder, Client, PermissionFlagsBits} = require('discord.js'); 
const {poolConnection} = require('../../utility_modules/kayle-db.js');
module.exports = {
    ownerOnly: true,
    testOnly: false,
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('bot-scope')
        .setDescription('Change the application scope between test and global.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('toggle')
                .setDescription('The toggle')
                .setRequired(true)
                .addChoices(
                    {
                        name: 'Test', value: 'test'
                    },
                    {
                        name: 'Global', value: 'global'
                    }
                )    
        )
    ,botPermissions: [PermissionFlagsBits.SendMessages],
    async execute(interaction, client) {
        const choice = interaction.options.getString('toggle');
        const embed = new EmbedBuilder();

        await poolConnection.query(`UPDATE botconfig SET application_scope=$1 `, [choice]);

        embed.setTitle('The application scope was commuted successfully!')
            .setDescription(`Application scope was changed to ${choice}.`)
            .setColor('Green');
        return interaction.reply({embeds: [embed]});
    }
}