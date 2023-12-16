/*
    This command acts as an interface to send queries to the database and recieve results.
*/
const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Client} = require('discord.js')
const { poolConnection } = require('../../utility_modules/kayle-db.js');

module.exports = {
    cooldown: 10,
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('fetch-db')
        .setDescription('Sends a query request to the database and fetch the results.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('items')
                .setDescription('The query that will be sent.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('table-name')
                .setDescription('The name of the table to recieve the items from.')
                .setRequired(true)    
        )
    ,
    botPermissions: [PermissionFlagsBits.SendMessages],
    async execute(interaction, client) {
        let clientResponse;
        const queryItems = interaction.options.getString('items');
        const queryTable = interaction.options.getString('table-name');
        const query = `SELECT ${queryItems} FROM ${queryTable}`;
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
        return interaction.reply({content: clientResponse, ephemeral: true});
    }
}