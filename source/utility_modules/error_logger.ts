import winston from "winston";
import * as path from "path";
import { fileURLToPath } from "url";

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
        filename: path.join(__dirname, `../../error_dumps/error-${date.getDay()}_${date.getMonth()}_${date.getFullYear()}.log`),
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