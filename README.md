
# JUSTICE

 
 Discord.js bot developed for [League of Legends Romania Discord](https://discord.com/invite/lolro) and multi purpose features.
 
 This project is ON GOING, you can raise **issues** if you wish for features or to contribute!


![Banner](https://i.ibb.co/FWShYyQ/Ephoto360-com-16587092ed1a60.jpg)

## Key modules

You can find them [here](https://github.com/rootblind/justice-bot/tree/main/Commands).

- Moderation
- Administration
- Server Management
- Miscellaneous
- Plenty of features planned
- And many more!

## Demo / Tutorial
This section will be updated at a later date when the project is mature enough.

## How to Use

Clone the project

```bash
  git clone https://github.com/rootblind/justice-bot.git
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
  node ./source/justice.js
```

Also you can run the bot using nodemon

This is how I defined it in package.json
```json
"dev": "nodemon ./source/justice.js"
```
And this is the command
```bash
npm run dev
```

Pleanty of the bot's features require a database connection, my code is using a Postgre SQL database, you can get started [here](https://www.youtube.com/watch?v=SpfIwlAYaKk).

Then you have to fill in the corresponding environment variables for the database connection.

Continue reading for the environment variables section.

## Get the latest Nodejs version from here:
[Click](https://nodejs.org/en/)


    
## Environment Variables

To run this project, you will need to add the following environment variables to your .env file



`Your token: BOT_TOKEN`

`Your bot secret: CLIENT_SECRET`

`Your bot client ID: CLIENT_ID`

`Your discord ID: OWNER`

`The server where you test the bot: HOME_SERVER_ID`

`The version of the bot: VERSION`

`The database password: DBPASS`

`The host IP (set to localhost if you run it on your PC): DBHOST`

`Your database username: DBUSER`

`The host port: DBPORT`

`The database name: DBNAME`

`The text classification LM API: MOD_API_URL`

`Encryption key: ENCRYPT_KEY`

`Initialization vector: IV`

`Encryption algorithm: ALGORITHM`

The environment file should look like this example: [env_vars](https://github.com/rootblind/justice-bot/blob/main/env_vars.txt)

You can change the name of the variables, but make sure to make the changes in the code as well!

## Language Model API

The bot uses an API provided by my own language model. At the moment there is only one classification model that helps with auto moderation if you set up a `flagged-messages` logging channel.

Please visit the LM repository [here](https://github.com/rootblind/opjustice-lm).

Do note, that project is still in work as well!

## Technologies used
 - [Nodejs](https://nodejs.org/en/)
 - [Discordjs](https://discordjs.guide/#before-you-begin)
 - [PostgreSQL](https://www.postgresql.org/)
## Credits
- [The North Solution YouTube channel](https://www.youtube.com/@thenorthsolution) - Tutorials


## Author

- [@rootblind](https://www.github.com/rootblind)


## License

[GPL v3](https://github.com/rootblind/justice-bot/blob/main/LICENSE)


## League of Legends Romania
Justice is a project developed with League of Legends Romania's needs in mind, you can check it out at [discord.gg/lolro](https://discord.com/invite/lolro)
