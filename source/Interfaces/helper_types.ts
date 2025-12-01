// Interfaces and types to help across the code-base wuth specific object formats

interface PresenceConfig {
    status: string,
    delay: number, // in seconds
    type: number
}

interface PresencePreset {
    Playing: string[],
    Listening: string[],
    Watching: string[]
}

type PresencePresetKey = keyof PresencePreset

type CronChar = "*" | "/" | "-" | "," | `${number}`;
type CronField = `${CronChar}${string}` | CronChar;

type CronString =
  `${CronField} ${CronField} ${CronField} ${CronField} ${CronField}`;

/**
 * @param name The name of the task
 * @param schedule CronString for scheduling the cron task
 * @param job Async function to execute as the cron's task job
 * @param runCondition Async function to start the cron task if true or to pause it if it returns false
 * 
 * Interface for objects to be used in the cron_task_loader
 */
interface CronTaskBuilder {
  name: string,
  schedule: CronString;
  job: () => Promise<void>;
  runCondition: () => Promise<boolean>
  
}

/**
 * @param name The name of the task
 * @param task The function that will be executed
 * @param runCondition The condition for the task() method to be executed
 * @param fatal (Optional) Whether the bot should shutdown in the event that task runCondition throw errors
 */
interface OnReadyTaskBuilder {
  name: string,
  task: () => Promise<void>,
  runCondition: () => Promise<boolean>,
  fatal?: boolean

}

export type {
    PresenceConfig,
    PresencePreset,
    PresencePresetKey,
    CronString,
    CronTaskBuilder,
    OnReadyTaskBuilder
};