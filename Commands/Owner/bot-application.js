const {SlashCommandBuilder, EmbedBuilder, Client, PermissionFlagsBits} = require('discord.js'); 
const fs = require('fs');
module.exports = {
    ownerOnly: true,
    testOnly: false,
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('bot-application')
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
    async execute(interaction) {
        const choice = interaction.options.getString('toggle');
        const embed = new EmbedBuilder();
        const readFile = async (filePath, encoding) => {
            try {
                const data = fs.readFileSync(filePath, encoding);
                return JSON.parse(data);
            } catch (error) {
                console.error(error);
            }
        };

        const b_config = readFile('./objects/botapplication.json', 'utf-8');
        b_config.applicationscope = choice;

        const writeFile = async (filePath, data) => {
            try{ // Format the JSON for better readability
                const jsonString = JSON.stringify(data, null, 2);
                fs.writeFileSync(filePath, jsonString, 'utf8');
            } catch(error) {
                console.error(error);
            }
        }
        writeFile('./objects/botapplication.json', b_config);
        embed.setTitle('The application scope was commuted successfully!')
            .setDescription(`Application scope was changed to ${choice}.`)
            .setColor('Green');
        return interaction.reply({embeds: [embed]});
    }
}