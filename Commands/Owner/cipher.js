const {config} = require('dotenv');

const {encryptor, decryptor} = require('../../utility_modules/utility_methods.js')

config();

const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('cipher')
        .setDescription('Encrypt and decrypt input using the keys.')
        .addSubcommand(subcommand =>
            subcommand.setName('encrypt')
                .setDescription('Encrypt data')
                .addStringOption(option =>
                    option.setName('data')
                        .setDescription('The data to be encrypted')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('decrypt')
                .setDescription('Decrypt data')
                .addStringOption(option =>
                    option.setName('data')
                        .setDescription('The data to be decrypted')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const data = interaction.options.getString('data');
        const command = interaction.options.getSubcommand();
        if(command == 'encrypt') {
            return await interaction.reply(encryptor(data));
        }

        // if the command is decrypt, then this will execute

        try{
            await interaction.reply(decryptor(data.toString()));
        } catch(err) {
            console.error(err);
            await interaction.reply("Something went wrong.");
        }
    }
}