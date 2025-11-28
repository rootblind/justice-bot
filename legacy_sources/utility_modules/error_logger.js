const winston = require('winston');
const path = require('path');
const error_logger = winston.createLogger({
    level: 'error',
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
        filename: path.join(__dirname, `../error_dumps/error-${parseInt(Date.now() / 1000)}.log`),
        level: 'error',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({timestamp, level, message, stack}) => {
                return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
            })
        ),
        handleExceptions: true,
      }),
    ],
});

module.exports = {
    error_logger
}