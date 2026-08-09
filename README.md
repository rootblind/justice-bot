
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

## Technologies used
 - [Nodejs](https://nodejs.org/en/)
 - [TypeScript](https://www.typescriptlang.org/)
 - [Discordjs](https://discordjs.guide/#before-you-begin)
 - [PostgreSQL](https://www.postgresql.org/)
## Design decisions
- Typescript is a robust superset of Javascript which prevents bugs at compile time and makes the code easier to read than vanilla JS
- PostgreSQL is important for relational consistency within the data stored by the bot
- Discordjs is the most used and feature rich framework for building discord bots. Also Discord is built on Electron, which makes its APIs closer to Javascript than any other language
## Architecture

The bot is split down into the following main parts:
- Commands: The active frame through which users call the bot to perform tasks
- Events: Callback functions for each message sent by Discord over the WebSocket connection to make the bot reactive to changes involving the users and the server. Mainly used for logging actions.
- Systems: Frameworks for building complex and specific features
- Models and Repositories: Compose the layer that provides communication between the bot and the database
- utility_modules: Repeatable patterns or standardized solutions to specific tasks are under this directory

 **Architecture diagram**
The diagram below shows a basic flow of how the Client (the user-end) triggers the Discord APIs by taking actions which includes executing commands, which triggers the event callbacks that, in case of the command, calls the corresponding command to execute which may use systems and repositories. While the events execute directly and may as well use repositories. 

```mermaid
flowchart TD
    Discord["Discord API"]

    Client -. Triggers Event / Command .-> Discord
    
    Discord --> Events
	
    Commands --> Systems
    Commands --> Repositories
    Commands -. Respond .-> Client
    
    Events --> Repositories
    Events -. interactionCreate event .-> Commands
    Events -. Respond .-> Client 
    
    Repositories --> Database[(Database)]
```
## Docs

For more details, please visit the project documentation.

- [Contributor](https://github.com/rootblind/justice-bot/blob/main/CONTRIBUTOR.md) a short guide on how to contribute
- [Architecture](https://github.com/rootblind/justice-bot/blob/main/docs/architecture.md) defines the software and its components
- [Conventions](https://github.com/rootblind/justice-bot/blob/main/docs/conventions.md) rules, guidelines, conventions and recommendations for writing code for this project
- [Notes](https://github.com/rootblind/justice-bot/blob/main/NOTES.md) changes, decisions and overall notes during development.
## How to Use / Install

Running the bot requires Nodejs and PostgreSQL to be installed and set up.

If you want to run the bot directly on your system, read the server setup guide [here](https://github.com/rootblind/justice-bot/blob/main/docs/server_setup_guide.md).

### Running the bot using Docker

Make sure Docker is installed

```bash
docker --version && docker compose version
```

If you don't see two lines printing the versions of Docker and Docker Compose, than Docker is not installed on your machine.

Please follow [official installation guides](https://docs.docker.com/engine/install/debian/) or youtube tutorials to set up Docker on your machine before proceeding with the steps.

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

Create the .env file using the template

```bash
cp env_vars.txt .env
```

Use your text editor of choice to open .env and complete the variables needed.

Attention, DBHOST must be set to "postgres" as this is what the postgres container will set it up to be on its end so the bot needs to use the correct hostname.

```bash
nano .env
```

Make sure you're inside `justice-bot/` and run

```bash
docker compose up -d --build
```

Check whether it worked

```bash
docker compose ps
```

You should see something that looks like this

```bash
NAME                 STATUS
justice-bot-bot      Up
justice-bot-postgres Up (healthy)
```

Steps to update the bot

```bash
cd justice-bot
git pull
docker compose up -d --build
```

Useful Docker commands for the bot

```bash
docker compose logs -f bot # show bot's output

docker compose down # stop the bot

docker compose restart bot # restart the bot
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


## Additional scripts

Inside `scripts/` are tool to help with development.

- locale_keys_sync: syncs the keys of two locale.json files between a source and a target

At the root directory, there are setup scripts.

- pm2_start and pm2_autostart: Bash scripts to start a pm2 session with specific parameters and save the session and enable it to auto-start on system boot.

## Database

Justice-bot uses PostgreSQL, while the database can be replaced with not much effort, you can learn about Postgres [here](https://www.youtube.com/watch?v=SpfIwlAYaKk).

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
## Author

- [@rootblind](https://www.github.com/rootblind)
## License

- [GPL v3](https://github.com/rootblind/justice-bot/blob/main/LICENSE)
## League of Legends Romania
Justice is a project developed with League of Legends Romania's needs in mind, you can check it out at [discord.gg/lolro](https://discord.com/invite/lolro)
