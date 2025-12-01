/**
 * The tasks that must be ran once when the Bot is online and ready
 * 
 * Any unhandled errors will be handled by onReadyTasksHandler. If the task has fatal = true, the bot will shutdown.
 */

import type { CronTaskBuilder, OnReadyTaskBuilder } from "../Interfaces/helper_types.js";
import { fetchGuildMember, fetchGuild, remove_premium_from_member } from "./discord_helpers.js";
import PremiumMembersRepo from "../Repositories/premiummembers.js";
import { getClient } from "../client_provider.js";
import BotConfigRepo from "../Repositories/botconfig.js";
import { build_cron } from "./cronHandler.js";
import { get_env_var } from "./utility_methods.js";
import path from "path";
import { exec } from "child_process";
import { errorLogHandle } from "./error_logger.js";
import cron from "node-cron";

/**
 * This task checks all the premium members in the database that aquired premium through boosting
 * and validates them.
 * 
 * Boosting status can run out for members while the bot has a downtime.
 */
export const checkExpiredBoosters: OnReadyTaskBuilder = {
    name: "Handle Expired Boosters on Downtime",
    task: async () => {
        const allBoosters = await PremiumMembersRepo.getAllPremiumBoosters();

        if (!allBoosters) return; // if there are no premium roles or no boosters, there is nothing to be done

        const client = getClient();

        for (const booster of allBoosters) {
            const guild = await fetchGuild(client, String(booster.guild));
            if (!guild) continue; // skip invalid guilds

            const member = await fetchGuildMember(guild, String(booster.member));

            if (!member || !member.premiumSince) {
                // remove premium if the booster is no longer in the guild
                // or if premiumSincer is null (stopped boosting but still in the guild)
                await remove_premium_from_member(client, String(booster.member), guild);
            }

        }

    },
    runCondition: async () => true
}

/**
 * If there is a configuration for database backups, this on ready task manages a cron scheduler for that
 */
export const backupDatabaseScheduler: OnReadyTaskBuilder = {
    name: "Backup Database Scheduler",
    task: async () => {
        const backupSchedule = await BotConfigRepo.getBackupSchedule();

        console.log(`Backup dir ${process.cwd()}`)
        if (backupSchedule) {
            const username = get_env_var("DBUSER");
            const database = get_env_var("DBNAME");

            const cronTaskBuilder: CronTaskBuilder = {
                name: "backup db",
                schedule: backupSchedule,
                job: async () => {
                    const refreshSchedule = await BotConfigRepo.getBackupSchedule();
                    if(backupSchedule !== refreshSchedule) {
                        // if by any means, the backup scheduler was modified, such as the usage of /backup-db
                        // stop the old schedule
                        stop();
                        return;

                    }

                    // formatting the file name
                    const date = new Date();
                    const fileName = `kayle_db_bk_${date.toISOString().replace(/:/g, "_").slice(0, -5)}.sql`;

                    const backup_command = 
                        `pg_dump -U ${username} -d ${database} -f ${path.join("./backup-db", fileName)}`;

                    const backupPromise = new Promise((resolve, reject) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        exec(backup_command, (err, stdout, _stderr) => {
                            if(err) {
                                errorLogHandle(err);
                                reject(err);
                            }
                            resolve(stdout.trim());
                        });
                    });

                    await backupPromise;
                },
                runCondition: async () => true
            }

            const cronTask = build_cron(cronTaskBuilder);
            cronTask.start();

            function stop() { cronTask.stop() };
        }

    },
    runCondition: async () => {
        const schedule = await BotConfigRepo.getBackupSchedule();
        return schedule !== null && cron.validate(schedule as string);
    }
}