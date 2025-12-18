/**
 * Error logging is handled through winston object and a customly written method to handle any type of errors
 */

import winston from "winston";
import * as path from "path";
import { fileURLToPath } from "url";
import { EmbedBuilder } from "discord.js";
import { notifyOwnerDM } from "./discord_helpers.js";
import { getClient } from "../client_provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const date = new Date();

export const error_logger = winston.createLogger({
    level: 'error',
    exitOnError: false,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({timestamp, level, message, stack}) => {
                return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
            })
        ),
      }),
      new winston.transports.File({
        filename: path.join(__dirname, `../../error_dumps/error-${date.getDate()}_${date.getMonth()}_${date.getFullYear()}.log`),
        level: 'error',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({timestamp, level, message, stack}) => {
                return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
            })
        ),
        handleExceptions: true,
        handleRejections: true
      }),
    ],
});

export async function errorLogHandle(
  error: unknown,
  message?: string,
  embedTitle?: string,
  notifyOwner: boolean = true
) {
  const embedMessage: EmbedBuilder = new EmbedBuilder()
    .setColor("Red")
    .setTitle(embedTitle ?? "Error")
    .setTimestamp()

  if(error instanceof Error) {
    const errorMsg = message ? message + " " + error.message : error.message;
    error_logger.error(errorMsg, { stack: error.stack });
    embedMessage.setDescription(errorMsg);
  } else {
    error_logger.error(message ? message + String(error) : String(error));
    embedMessage.setDescription(message ?? "Unknown error occured, check the console and logs for details.");
  }

  const client = getClient();
  if(notifyOwner) await notifyOwnerDM(client, embedMessage);
}