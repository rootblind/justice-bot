/*
    This command acts as an interface to send queries to the database and recieve results.
*/
const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Client, MessageFlags} = require('discord.js')
const { poolConnection } = require('../../utility_modules/kayle-db.js');

module.exports = {
    cooldown: 10,
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('fetch-db')
        .setDescription('Sends a query request to the database and fetch the results.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The query that will be sent.')
                .setRequired(true)
        )
    ,
    botPermissions: [PermissionFlagsBits.SendMessages],
    async execute(interaction, client) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        let clientResponse;
        const query = interaction.options.getString('query');
        const queryPromise = new Promise((resolve, reject) => {
            poolConnection.query(query,(error, result) => {
                if(error) {
                    clientResponse = 'Something went wrong, check the console for more details.';
                    console.error(error);
                    reject(error);
                }
                else if(result.rows.length <= 0) {
                    clientResponse = 'The result is empty, no rows retrieved.';
                    resolve(result);
                }
                else {
                    clientResponse = result.rows.map(row => Object.values(row).join(' | ')).join('\n');
                    resolve(result);
                }
            });
        });
        try{ 
            await queryPromise;
        } catch(error) {
            clientResponse = 'Invalid inputs! Check the console for more details.';
            console.error(error);
        }
        return interaction.editReply({content: `${clientResponse || "No response!"}`, flags: MessageFlags.Ephemeral});
    }
}