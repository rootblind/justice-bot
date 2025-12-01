/**
 * Once the main source finishes its execution, clientReady even source file is next.
 * Used for checks, setups and everything that either needs to be verified when the bot is active
 * or needs to run since the first seconds of the bot's execution.
 * Example: below the bot chooses a random presence to set to its profile, makes sure the client object is ready
 * makes sure the local directories it depends on are created and accessible, that all database tables are ready,
 * initializes the cron tasks and Discord collectors and executes on_ready_tasks.
 */
import type { Event } from "../../Interfaces/event.js";
import type { Client } from "discord.js";
import "colors";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { 
    directory_array_check,
    formatDate,
    formatTime,
    get_current_version,
    isFileOk
} from "../../utility_modules/utility_methods.js";
import modelsInit from "../../Models/modelsInit.js";
import { bot_presence_setup } from "../../utility_modules/discord_helpers.js";
import fs from "graceful-fs";
import { init_cron_jobs, load_cron_source } from "../../utility_modules/cronHandler.js";
import { load_onReady_tasks, on_ready_execute } from "../../utility_modules/onReadyTasksHandler.js";

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

        // cron tasks
        try {
            const cronTasks = await load_cron_source("./cron_tasks.js");
            await init_cron_jobs(cronTasks);
        } catch(error) {
            await errorLogHandle(error, "", "Fatal error");
            setTimeout(() => process.exit(1), 5_000);
        }

        // on ready tasks
        try {
            const onReadyTasks = await load_onReady_tasks("./on_ready_tasks.js");
            await on_ready_execute(onReadyTasks);
        } catch(error) {
            await errorLogHandle(error, "", "Fatal error");
            setTimeout(() => process.exit(1), 5_000);
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

        /**
         * TODO: ADD COLLECTORS
         */

        // setting a csv file for the data collection of the moderation model
        const flagDataFileExists = await isFileOk("./flag_data.csv");
        if(!flagDataFileExists)  {
            await fs.promises.writeFile("./flag_data.csv",
                'Message,OK,Aggro,Violence,Sexual,Hateful\n',
                "utf-8"
            );
        }

        //////////////////////////////////////////////////////////////////
        //These lines of code are meant to be displayed at the very end//
        const justiceVersion = await get_current_version(); // fetch the version of the bot
        const currentDate = new Date();
        console.log(
            `${client.user.username}@${justiceVersion} is functional! - ${formatDate(currentDate)} | [${formatTime(currentDate)}]`
        );

        const errorFiles = fs.readdirSync("./error_dumps")
            .map((file: string) => file)
            .filter((file: string) => file !== 'error.log');
        
        if(errorFiles.length > 0) {
            console.log(`FOUND ${errorFiles.length} ERROR FILE${errorFiles.length > 1 ? "S" : ""}.`);
        }
        //////////////////////////////////////////////////////////////////
    }
}

export default clientReady;