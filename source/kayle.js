
const {config} = require('dotenv');
const {Client, GatewayIntentBits, Routes, Partials, Collection} = require('discord.js');
const {REST} = require('@discordjs/rest');
config();

//loads
const {loadEvents} = require('../Handlers/eventHandler');

const client = new Client({ intents: [
    Object.keys(GatewayIntentBits),
],
partials:[
    Object.keys(Partials)
]
});
//env variables
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID=process.env.KAYLE_CLIENT_ID;
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
        });
    }catch(err)
    {
        console.log(err);
    }
}
main();
module.exports = client;