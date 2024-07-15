
const {config} = require('dotenv');
const {Client, GatewayIntentBits, Routes, Partials, Collection} = require('discord.js');
const {REST} = require('@discordjs/rest');

config();

//loads
const {loadEvents} = require('../Handlers/eventHandler');
const {loadCommands} = require('../Handlers/commandHandler');


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