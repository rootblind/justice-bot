/**
 * In this source file will be implemented cron tasks.
 * Cron tasks are recurring executions of blocks of code at the designated schedule.
 * Useful when the program needs to perform periodics checks and take actions accordingly
 * 
 * ATTENTION: Do not cluster too many cron tasks on the same scheduler, or some tasks might execute late
 */

import { CronTaskBuilder } from "../Interfaces/helper_types.js";
import { formatDate, formatTime, generate_unique_code, get_env_var } from "./utility_methods.js";
import StaffStrikeRepo from "../Repositories/staffstrike.js";
import BanListRepo from "../Repositories/banlist.js";
import { errorLogHandle } from "./error_logger.js";
import type { Guild } from "discord.js";
import { fetchGuild, fetchGuildMember, fetchLogsChannel } from "./discord_helpers.js";
import { embed_unban } from "./embed_builders.js";
import { getClient } from "../client_provider.js";
import PremiumMembersRepo from "../Repositories/premiummembers.js";
import PremiumKeyRepo from "../Repositories/premiumkey.js";
import { remove_premium_from_member } from "../Systems/premium/premium_system.js";
import { check_api_status } from "../Systems/automoderation/automod_model_methods.js";

// checking if the mod model api is responsive
export const report_modapi_downtime: CronTaskBuilder = {
    name: "Report MOD API Downtime",
    schedule: "0 * * * *",
    job: async () => {
        const isOnline = await check_api_status(get_env_var("MOD_API_URL"));
        if (!isOnline) {
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
export const tempban_expired_clear: CronTaskBuilder = {
    name: "Tempban Expired Clear",
    schedule: "0 * * * *",
    job: async () => {
        const banListData = await BanListRepo.getExpiredTempBans();
        if (!banListData) return; // if there is no tempban to clear, do nothing
        const client = getClient();
        for (const banData of banListData) {
            let guild: Guild | null = null;

            try {
                guild = await client.guilds.fetch(String(banData.guild));

                try { // unbanning the users whom their ban expired
                    await guild.bans.remove(String(banData.target), "Temporary ban expired.");
                } catch (error) {
                    await errorLogHandle(error, `Failed to unban user[${banData.target}] from ${guild.name}[${banData.guild}]`);
                }
            } catch (error) {
                await errorLogHandle(error, `Failed to fetch guild id ${banData.guild}`);
            }

            if (!guild) continue; // skip invalid guilds

            const channel = await fetchLogsChannel(guild, "moderation");
            if (channel) {
                try {
                    // if everything succeeded, log the event
                    const target = await client.users.fetch(banData.target);
                    await channel.send({
                        embeds: [
                            embed_unban(target, client.user!, "Temporary ban expired")
                        ]
                    });
                } catch (error) {
                    await errorLogHandle(error);
                }
            }
        }

        // after all the expired raws have been handled
        await BanListRepo.deleteExpiredTempBans();
    },
    runCondition: async () => true
}

// Handling premium membership expiration
export const expiredPremium: CronTaskBuilder = {
    name: "Expired premium handle",
    schedule: "1 * * * *",
    job: async () => {
        const expiredMembers = await PremiumMembersRepo.getExpiredGuildMemberCustomRole();
        if (!expiredMembers) return; // if no membership is expired, there is nothing to execute

        const client = getClient();
        for (const expiredUser of expiredMembers) { // handling members whom codes expired
            const guild = await fetchGuild(client, expiredUser.guild);
            if (!guild) continue; // invalid guild

            const member = await fetchGuildMember(guild, expiredUser.member);
            if (member && member.premiumSince) {
                // if the member is boosting the server while premium expired
                // replace its code with a from_boosting one

                const code = await generate_unique_code(guild.id);

                try { // register the new key
                    await PremiumKeyRepo.newKey(code, guild.id, client.user!.id, 0, 0, member.id);
                    await PremiumMembersRepo.updateMemberCode(guild.id, member.id, code, true);
                    continue;
                } catch (error) {
                    await errorLogHandle(error, "There was a problem while trying to insert a new premium key");
                }
            }

            // remove membership from expired memberships
            await remove_premium_from_member(client, expiredUser.member, guild);
        }

        // clear the rest of the codes
        await PremiumKeyRepo.clearExpiredKeys();
    },
    runCondition: async () => true
}