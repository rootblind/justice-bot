/**
 * Loaders, builders and handlers to put cron_tasks into activity.
 * This source has the tools to load cron_tasks.js and safely handle each cron task
 */
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
export async function load_cron_source(sourceFile: string): Promise<CronTaskBuilder[] | null> {
    const module = await import(sourceFile);

    if(!module) {
        console.log(`No cron task was imported from ${sourceFile}. No module found.`)
    }

    const tasks: CronTaskBuilder[] = Object.values(module).filter(
        (exported): exported is CronTaskBuilder =>
            exported !== null &&
            typeof exported === "object" &&
            "name" in exported &&
            "schedule" in exported &&
            "job" in exported &&
            "runCondition" in exported
    );

    return tasks;
}

/**
 * 
 * @param taskBuilder 
 * @returns NodeCron.ScheduledTask object
 * 
 * Create a new cron task.
 */
export function build_cron(taskBuilder: CronTaskBuilder) {
    return cron.createTask(taskBuilder.schedule, async () => {
        try {
            const runCondition: boolean = await taskBuilder.runCondition() ?? false;
            if(runCondition) {
                await taskBuilder.job();
            }

        } catch(error) {
            await errorLogHandle(error, `${taskBuilder.name} cron task failed:`);
            throw error;
        }
    }, {
        noOverlap: true,
        name: taskBuilder.name
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
        return;
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