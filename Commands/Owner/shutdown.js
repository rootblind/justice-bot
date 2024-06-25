const {Client, SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Close application')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ,
    botPermissions: [],
    userPermissions: [],
    async execute(interaction, client) {
        await interaction.reply(`Shutting down...💤`);
        process.exit();
    }
}