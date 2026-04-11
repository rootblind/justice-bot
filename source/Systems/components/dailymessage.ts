import { DiscordAPIError, Guild } from "discord.js";
import { DailyMessageObject } from "../../Interfaces/database_types.js";
import { CronString, CronTaskBuilder } from "../../Interfaces/helper_types.js";
import DailyMessageRepo from "../../Repositories/dailymessage.js";
import { fetchGuildChannel, fetchMessage } from "../../utility_modules/discord_helpers.js";
import cron from "node-cron";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

async function run_condition(guildId: string, messageId: string): Promise<boolean> {
    const getMessage = await DailyMessageRepo.getDailyMessage(guildId, messageId);
    return getMessage !== null;
}

export async function init_daily_message_task(guild: Guild, dailyMessageObj: DailyMessageObject) {
    const dailyMessageCron: CronTaskBuilder = {
        name: `Daily message ${dailyMessageObj.messageid}`,
        schedule: dailyMessageObj.schedule as CronString,
        job: async () => {
            try {
                const channel = await fetchGuildChannel(guild, dailyMessageObj.channel);
                if (!channel?.isTextBased()) throw new Error("Daily message channel failed to fetch " + dailyMessageObj.channel);
                const oldMessage = await fetchMessage(channel, dailyMessageObj.messageid);
                const newMessage = await channel.send(dailyMessageObj.message);
                await DailyMessageRepo.update(guild.id, dailyMessageObj.messageid, newMessage.id);
                dailyMessageObj.messageid = newMessage.id;
                if (oldMessage) await oldMessage.delete();
            } catch (error) {
                console.error(error);
                if (error instanceof DiscordAPIError && error.code === 10004) {
                    DailyMessageRepo.delete(dailyMessageObj.guild, dailyMessageObj.messageid);
                }
            }
        },
        runCondition: async () => await run_condition(dailyMessageObj.guild, dailyMessageObj.messageid)
    }

    return dailyMessageCron;
}

export async function build_cron_daily_message(dailyMessageCron: CronTaskBuilder) {
    const task = cron.createTask(dailyMessageCron.schedule, async () => {
        try {
            const runCondition: boolean = await dailyMessageCron.runCondition() ?? false;
            if (runCondition) {
                await dailyMessageCron.job();
            } else {
                await task.destroy();
            }

        } catch (error) {
            await errorLogHandle(error, `${dailyMessageCron.name} cron task failed:`);
            throw error;
        }
    }, {
        noOverlap: true,
        name: dailyMessageCron.name
    });

    await task.start();
}