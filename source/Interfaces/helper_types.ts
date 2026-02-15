// Interfaces and types to help across the code-base wuth specific object formats

import {
  CacheType,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  ReadonlyCollection,
  Role,

} from "discord.js";


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
 * @param fatal (Optional) Whether the bot should shutdown in the event that task or runCondition throw errors
 */
interface OnReadyTaskBuilder {
  name: string,
  task: () => Promise<void>,
  runCondition: () => Promise<boolean>,
  fatal?: boolean
}

interface TriggerWordsObject {
  [key: string]: string[]
}
export type TriggerWordsKey = keyof TriggerWordsObject;

interface LabelsClassification {
  [key: string]: number
}

export type LabelKey = keyof LabelsClassification;

interface ClassifierResponse {
  text: string,
  matches: string[],
  score: number,
  labels: string[]
}

export type CollectorCollectHandler<T extends MessageComponentInteraction<CacheType>> =
  (interaction: T) => Promise<void>;
export type CollectorStopHandler<T extends MessageComponentInteraction<CacheType>> =
  (collected: ReadonlyCollection<string, T>) => Promise<void> | void;

export type CollectorFilterCustom = (interaction: MessageComponentInteraction<CacheType>) => boolean;

export type CacheEntry<T> = {
  value: T,
  expiresAt: number
}

interface AutomodResponse {
  labels: string[],
  text: string
}

export type TimeStringUnit = "m" | "h" | "d" | "w" | "y";

export interface ValidatorResponseType {
  value: boolean,
  message: string
}

export interface TicketSubjectContext {
  subject: string,
  description: string,
  member: GuildMember,
  guild: Guild,
  ticketSupportRole: Role,
  staffRole: Role
}

export type {
  PresenceConfig,
  PresencePreset,
  PresencePresetKey,
  CronString,
  CronTaskBuilder,
  OnReadyTaskBuilder,
  TriggerWordsObject,
  LabelsClassification,
  ClassifierResponse,
  AutomodResponse
};