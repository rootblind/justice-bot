
# JUSTICE-BOT

 
 Discord.js bot developed for [League of Legends Romania Discord](https://discord.com/invite/lolro) dedicated to moderation and cutomizable features.

![Banner](https://i.ibb.co/FWShYyQ/Ephoto360-com-16587092ed1a60.jpg)

## Features

- Moderation commands
- Multi-layered autovoice
- Customizable LFG (Looking For Group) general scoped system
- Logging events
- Keys based premium system
- Ticket support system

## Demo
This is a demo of a few of the systems above, showing how a logging channel looks like, using the autovoice system to send an LFG post and then opening and closing a ticket.
![demo](https://github.com/rootblind/justice-bot/blob/main/screenshots/demo.webp)

## Get the latest Nodejs version from here:
[Click](https://nodejs.org/en/)


    
## Environment Variables

To run this project, you will need to add the following environment variables to your .env file


`Your token: BOT_TOKEN`

`Your bot secret: CLIENT_SECRET`

`Your bot client ID: CLIENT_ID`

`Your discord ID: OWNER`

`The server where you test the bot: HOME_SERVER_ID`

`The database password: DBPASS`

`The host IP (set to localhost if you run it on your PC): DBHOST`

`Your database username: DBUSER`

`The host port: DBPORT`

`The database name: DBNAME`

`The text classification ML API: MOD_API_URL`

`Encryption key: ENCRYPT_KEY`

`Initialization vector: IV`

`Encryption algorithm: ALGORITHM`

If you want to connect the bot to an web application:

`WEB_BACK_PORT`

`WEB_FRONT_PORT`

Environment variables example: [env_vars.txt](https://github.com/rootblind/justice-bot/blob/main/env_vars.txt)

## Language Model API

The bot uses an API provided by my own language model. At the moment there is only one classification model that helps with auto moderation if you set up a `flagged-messages` logging channel.

Please visit the ML repository [here](https://github.com/rootblind/opjustice-lm).

Do note, that project is still in work as well!

## Technologies used
 - [Nodejs](https://nodejs.org/en/)
 - [TypeScript](https://www.typescriptlang.org/)
 - [Discordjs](https://discordjs.guide/#before-you-begin)
 - [PostgreSQL](https://www.postgresql.org/)

## Author

- [@rootblind](https://www.github.com/rootblind)


## License

[GPL v3](https://github.com/rootblind/justice-bot/blob/main/LICENSE)


## League of Legends Romania
Justice is a project developed with League of Legends Romania's needs in mind, you can check it out at [discord.gg/lolro](https://discord.com/invite/lolro)
