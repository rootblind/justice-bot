
# JUSTICE

 
 Discord.js bot developed for [League of Legends Romania Discord](https://discord.com/invite/lolro) and multi purpose features.


![Banner](https://i.ibb.co/FWShYyQ/Ephoto360-com-16587092ed1a60.jpg)

## Key modules

You can find them [here](https://github.com/rootblind/justice-bot/tree/main/Commands).

- Moderation
- Administration
- Server Management
- Miscellaneous
- Plenty of features planned

## Demo / Tutorial
This section will be updated at a later date when the project is mature enough.

## How to Use

Clone the project

```bash
  # HTTP
  git clone https://github.com/rootblind/justice-bot.git

  # SSH
  git@github.com:rootblind/justice-bot.git
```

Go to the project directory

```bash
  cd justice-bot
```

Install dependencies

```bash
  npm install
  #make sure to be in the project folder
```

Use Nodejs to run the bot

```bash
  node -r dotenv/config ./dist/justice.js
```

## NPM scripts

```bash
# Compile the TypeScript sources into JavaScript
npm run build

# Start the bot
npm run start 

# Build and start the bot, on source change, re-build and re-start the bot using nodemon
npm run dev

# Empty the dist/ directory
npm run clean

# Scan the code using ESlint
npm run lint

# Scan the code and automatically fix ESlint errors if possible
npm run lint:fix
```

## Database

Justice-bot uses Postgresql, while the database can be replaced with not much effort, you can learn about Postgres [here](https://www.youtube.com/watch?v=SpfIwlAYaKk).

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
