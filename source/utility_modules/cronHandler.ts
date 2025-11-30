import type { CronTaskBuilder } from "../Interfaces/helper_types.js";
import AsciiTable from "ascii-table";
import cron, { ScheduledTask } from "node-cron";
import { errorLogHandle } from "./error_logger.js";

/**
 * 
 * @param sourceFile String to the file path of the module containing CronTaskBuilders
 * @returns  Array of CronTaskBuilders
 * 
 * Throws an error if the array is empty
 */
export async function load_cron_source(sourceFile: string) {
    const module = await import(sourceFile);

    if(!module) throw new Error("Load cron source failed to load the source module.");

    const tasks: CronTaskBuilder[] = Object.values(module).filter(
        (exported): exported is CronTaskBuilder =>
            exported !== null &&
            typeof exported === "object" &&
            "schedule" in exported &&
            "job" in exported &&
            "runCondition" in exported
    );

    return tasks;
}

/**
 * 
 * @param taskBulder 
 * @returns NodeCron.ScheduledTask object
 * 
 * Create a new cron task.
 */
export function build_cron(taskBulder: CronTaskBuilder) {
    return cron.createTask(taskBulder.schedule, async () => {
        try {
            const runCondition: boolean = await taskBulder.runCondition() ?? false;
            if(runCondition) {
                await taskBulder.job();
            }

        } catch(error) {
            await errorLogHandle(error, `${taskBulder.name} cron task failed:`);
            throw error;
        }
    }, {
        noOverlap: true,
        name: taskBulder.name
    });
}

/**
 * 
 * @param taskBuilders Array of CronTaskBuilders to be built into cron tasks
 * @returns Array of cron tasks
 * 
 * Throws an error if the array is empty or any of the CronTaskBuilders has an invalid schedule
 */
export function build_cron_jobs(taskBuilders: CronTaskBuilder[]) {
    if(taskBuilders.length === 0) throw new Error("build_cron_jobs was called on an empty array.");

    const cronTasks: ScheduledTask[] = [];
    for(const task of taskBuilders) {
        if(!cron.validate(task.schedule)) {
            throw new Error(`Task ${task.name} failed to be built inside build_cron_jobs because it has invalid schedule string ${task.schedule}.`);
        }
        if(cronTasks.find((t) => t.name === task.name)) {
           continue; // skip duplicates
        }

        const cronTask = build_cron(task);

        cronTask.on("execution:failed", () => {
            const idx = cronTasks.indexOf(cronTask);
            if(idx !== -1) cronTasks.splice(idx, 1);

            cronTask.destroy();
        });

        cronTasks.push( cronTask );
    }

    return cronTasks;
}


export async function init_cron_jobs(cronTaskBuilders: CronTaskBuilder[]){
    if(cronTaskBuilders.length === 0) {
        console.log(
            "The cron task initializer was called on an empty array, the execution is interrupted."
        );
    }

    const table = new AsciiTable().setHeading("Cron Jobs", "Status");

    try {
        const cronTasks = build_cron_jobs(cronTaskBuilders);

        for(const task of cronTasks) {
            task.start();
            table.addRow(task.name, task.getStatus());
        }

        console.log(table.toString(), "\nCron jobs initialized");
    } catch(error) {
        await errorLogHandle(error);
    }
}