/**
 * This source handles on_ready_tasks, loads the tasks, handles run conditions, executing tasks and uncaught conditions
 * 
 */

import type { OnReadyTaskBuilder } from "../Interfaces/helper_types.js"
import AsciiTable from "ascii-table";
import { errorLogHandle } from "./error_logger.js";

/**
 * 
 * @param sourceFile Path to the source file
 * @returns Array of all OnReadyTaskBuilders from sourceFile
 * 
 * Throws an error if sourceFile is invalid
 */
export async function load_onReady_tasks(sourceFile: string): Promise<OnReadyTaskBuilder[] | null> {
    const module = await import(sourceFile);

    if (!module) {
        console.log(`No on ready task was imported from ${sourceFile}. No module found.`);
        return null;
    }

    const tasks: OnReadyTaskBuilder[] = Object.values(module).filter(
        (exported): exported is OnReadyTaskBuilder =>
            exported !== null &&
            typeof exported === "object" &&
            "name" in exported &&
            "task" in exported &&
            "runCondition" in exported
    );

    return tasks;
}

/**
 * Handles the execution of the tasks
 * @param tasks OnReadyTaskBuilder Array
 */
export async function on_ready_execute(tasks: OnReadyTaskBuilder[]) {
    if (tasks.length === 0) {
        console.log(
            "on_ready_execute was called on an empty array, execution interrupted."
        );
        return;
    }

    const table = new AsciiTable().setHeading("On ready tasks", "Status");

    for (const task of tasks) {
        try {
            const runCondition = await task.runCondition();
            if (runCondition) {
                try {
                    await task.task();
                    table.addRow(task.name, "Executed");
                } catch (error) {
                    await errorLogHandle(
                        error,
                        `On ready task ${task.name} failed to execute task(); fatal: ${task.fatal ? "True" : "False"}`
                    );

                    if (task.fatal) { // process is killed if the on ready task is flagged as fatal
                        setTimeout(() => process.exit(1), 5_000);
                    } else {
                        table.addRow(task.name, "Failed");
                    }
                }

            } else {
                table.addRow(task.name, "Skipped");
            }
        } catch (error) {
            await errorLogHandle(
                error,
                `On ready task ${task.name} failed to execute runCondition(); fatal: ${task.fatal ? "True" : "False"}`
            );

            if (task.fatal) { // process is killed if the on ready task is flagged as fatal
                setTimeout(() => process.exit(1), 5_000);
            } else {
                table.addRow(task.name, "Failed");
            }
        }
    }
}