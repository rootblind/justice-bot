import { CronTaskBuilder } from "../Interfaces/helper_types.js";
import { check_api_status, formatDate, formatTime, get_env_var } from "./utility_methods.js";
import StaffStrikeRepo from "../Repositories/staffstrike.js";
import BanListRepo from "../Repositories/banlist.js";
import { getClient } from "../client_provider.js";
import { errorLogHandle } from "./error_logger.js";
import type { Guild } from "discord.js";
import { fetchLogsChannel } from "./discord_helpers.js";
import { embed_unban } from "./embed_builders.js";

// checking if the mod model api is responsive
export const report_modapi_downtime: CronTaskBuilder = {
    name: "Report MOD API Downtime",
    schedule: "0 * * * *",
    job: async () => {
        const isOnline = await check_api_status(get_env_var("MOD_API_URL"));
        if(!isOnline) {
            const now = new Date();
            console.log(
                `Connection to ${get_env_var("MOD_API_URL")} was lost - ${formatDate(now)} | [${formatTime(now)}]`
            );
        }
    },
    runCondition: async () => true
}

// clear expired staffstrikes from the database
export const clear_expired_staff_strikes: CronTaskBuilder = {
    name: "Clear Staff Strikes",
    schedule: "0 0 * * *",
    job: async () => {
        await StaffStrikeRepo.deleteExpiredEntries();
    },
    runCondition: async () => true
}

// temporary bans that expired must be removed
export const tempban_expired_clear = {
    name: "Tempban Expired Clear",
    schedule: "0 * * * *",
    job: async () => {
        const banListData = await BanListRepo.getExpiredTempBans();
        if(!banListData) return; // if there is no tempban to clear, do nothing

        const client = getClient();
        for(const banData of banListData) {
            let guild: Guild | null = null;

            try {
                guild = await client.guilds.fetch(banData.guild);

                try { // unbanning the users whom their ban expired
                    await guild.bans.remove(banData.target, "Temporary ban expired.");
                } catch(error) {
                    await errorLogHandle(error, `Failed to unban user[${banData.target}] from ${guild.name}[${banData.guild}]`);
                }
            } catch(error) {
                await errorLogHandle(error, `Failed to fetch guild id ${banData.guild}`);
            }

            if(!guild) continue; // skip invalid guilds

            const channel = await fetchLogsChannel(guild, "moderation");
            if(channel) {
                // if everything succeeded, log the event
                await channel.send({
                    embeds: [
                        embed_unban(banData.target, client.user!.username, "Temporary ban expired")
                    ]
                });
            }
        }

        // after all the expired raws have been handled
        await BanListRepo.deleteExpiredTempBans();
    }
}

