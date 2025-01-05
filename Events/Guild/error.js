module.exports ={
    name: 'error.js',

    async execute(error) {
        const {error_logger} = require('../../utility_modules/error_logger.js');
        error_logger.error(`Discord Client Error: ${error.message}`, {stack: error.stack});
        process.exit(1);
    }
}