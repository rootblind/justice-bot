
const {config} = require('dotenv');
const {Client, GatewayIntentBits, Routes, Partials, Collection} = require('discord.js');
const {REST} = require('@discordjs/rest');


config();

//loads
const {loadEvents} = require('./Handlers/eventHandler.js');
const {loadCommands} = require('./Handlers/commandHandler.js');


const client = new Client({
    intents: [...Object.values(GatewayIntentBits)],
    partials: [...Object.values(Partials)]
});



client.cooldowns = new Collection(); // collection for commands cooldowns: used in interactionCreate
//env variables
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID=process.env.CLIENT_ID;
const GUILD_ID=process.env.HOME_SERVER_ID;

const rest = new REST({ version: '10'}).setToken(TOKEN);
client.commands = new Collection();

process.on('uncaughtException', (error) => {
    const {error_logger} = require('../utility_modules/error_logger.js');
    error_logger.error(`Uncaught Exception: ${error.message}`, {stack: error.stack});
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    const {error_logger} = require('../utility_modules/error_logger.js');
    if(reason instanceof Error) {
        error_logger.error(`Unhandled Reject: ${reason.message}`, {stack: reason.stack});
        setTimeout(() => {
            process.exit(1);
        }, 5000);
    } else {
        error_logger.error(`Unhandled Reject: ${reason}`);
    }
});

async function main()
{
    const commands = [];
    try{
        console.log('Refreshing slash commands');
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        client.login(TOKEN).then(() => {
            loadEvents(client);
            loadCommands(client);
        });
    }catch(err)
    {
        console.log(err);
    }

    
    
}
main();
module.exports = {client};