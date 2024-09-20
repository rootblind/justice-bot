const {poolConnection} = require('../../utility_modules/kayle-db.js');
const fs = require('fs');

module.exports = {
    name: 'guildDelete', // executes when a server is deleted or the bot is removed from it.
    async execute(guild) {
        // remove all guild related data from the database
        const dbTablesObject = JSON.parse(fs.readFileSync('./objects/database-default-tables.json'));
        let tableNames = dbTablesObject["table_names"];
        tableNames.forEach(async (table) => {
            await poolConnection.query(`DELETE FROM ${table} WHERE guild=$1`, [guild.id]);
        });
    }
}