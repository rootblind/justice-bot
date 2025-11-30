import type { Event } from "../../Interfaces/event.js";
import type { Client } from "discord.js";
import "colors";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { directory_array_check, formatDate, formatTime, get_current_version, isFileOk } from "../../utility_modules/utility_methods.js";
import modelsInit from "../../Models/modelsInit.js";
import { bot_presence_setup } from "../../utility_modules/discord_helpers.js";
import fs from "graceful-fs";
import { init_cron_jobs, load_cron_source } from "../../utility_modules/cronHandler.js";

const clientReady: Event = {
    name: "clientReady",
    once: true,
    async execute(client: Client) {
        if(!client.user) {
            const error = new Error("The bot failed to load the Client object, missing client.user or the entire client!");
            await errorLogHandle(error, "", "Fatal error");
            setTimeout(() => process.exit(1), 5_000);
            throw error;
        }

        // initializing database tables
        try{
            await modelsInit();
        } catch(error) {
            await errorLogHandle(error);
            setTimeout(() => process.exit(1), 5_000);
        }

        // initializing the needed directories to exist
        try {
            directory_array_check(["error_dumps", "temp", "backup-db", "assets", "assets/avatar"]);
        } catch(error) {
            await errorLogHandle(error, "", "Fatal error");
            setTimeout(() => process.exit(1), 5_000);
        }

        try {
            const cronTasks = await load_cron_source("./cron_tasks.js");
            await init_cron_jobs(cronTasks);
        } catch(error) {
            await errorLogHandle(error, "", "Fatal error");
        }

        // setting the bot's status presence
        try {
            await bot_presence_setup(
                client,
                "./source/objects/presence-config.json", 
                "./source/objects/default-presence-presets.json",
                "./source/objects/custom-presence-presets.json"
            );
        } catch(error) {
            await errorLogHandle(error);
        }

        // setting a csv file for the data collection of the moderation model
        const flagDataFileExists = await isFileOk("./flag_data.csv");
        if(!flagDataFileExists)  {
            await fs.promises.writeFile("./flag_data.csv",
                'Message,OK,Aggro,Violence,Sexual,Hateful\n',
                "utf-8"
            );
        }

        const justiceVersion = await get_current_version(); // fetch the version of the bot

        const currentDate = new Date();
        console.log(
            `${client.user.username}@${justiceVersion} is functional! - ${formatDate(currentDate)} | [${formatTime(currentDate)}]`
        );
    }
}

export default clientReady;