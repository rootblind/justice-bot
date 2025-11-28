// testing and experimenting code

const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js')

const {party_maker} = require("../../utility_modules/subcommands/party_maker.js")

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Testing stuff...')
        .addUserOption(
            option => option.setName("role")
                .setDescription("role")
        )
        ,
    async execute(interaction, client) {
        const role = interaction.options.getUser("role");
        return await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setFields({
                        name: "owner",
                        value: `${role}`
                    })
            ]
        })
    }
}