import type { Event } from "../../Interfaces/event.js";
import type { Client } from "discord.js";
import "colors";
import { error_logger } from "../../utility_modules/error_logger.js";
import { directory_array_check, formatDate, formatTime, get_current_version } from "../../utility_modules/utility_methods.js";
import modelsInit from "../../Models/modelsInit.js";
import { bot_presence_setup } from "../../utility_modules/discord_helpers.js";

const clientReady: Event = {
    name: "clientReady",
    once: true,
    async execute(client: Client) {
        if(!client.user) {
            const error = new Error("The bot failed to load the Client object, missing client.user or the entire client!");
            error_logger.error(error);
            throw error;
        }

        // initializing database tables
        try{
            await modelsInit();
        } catch(error) {
            error_logger.error(error);
            setTimeout(() => process.exit(1), 5_000);
        }

        // initializing the needed directories to exist
        try {
            directory_array_check(["error_dumps", "temp", "backup-db"]);
        } catch(error) {
            error_logger.error(error);
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
            error_logger.error(error);
        }
        
        
        const justiceVersion = await get_current_version();
        console.log(
            `${client.user.username}@${justiceVersion} is functional! - ${formatDate(new Date())} | [${formatTime(new Date())}]`
        );
    }
}

export default clientReady;