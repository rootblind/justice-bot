const {executeQuery} = require('./kayle-db.js');

function hexToString(num){
    let str = '0x' + num.toString(16).padStart(6,'0');
    return str;
}

function getBotMember(client, interaction) {
    return interaction.guild.members.cache.get(client.user.id);
}

function getPermsInChannel(channel, member){
    return channel.permissionsFor(member);
}

function botPermsCheckInChannel(client, channel, permsToCheck) {
    if (!Array.isArray(permsToCheck)) {
        console.error("An array must be given when botPermsCheck is called!");
        return -1;
    }
    const permsInChannel = getPermsInChannel(channel, channel.guild.members.cache.get(client.user.id));
    if (permsInChannel.has(permsToCheck)) {
        return 1;
    } else {
        return 0;
    }
}

function memberPermsCheckInChannel(interaction, channel, permsToCheck) {
    if (!Array.isArray(permsToCheck)) {
        console.error("An array must be given when memberPermsCheck is called!");
        return -1;
    }
    const {member} = interaction;
    const permsInChannel = getPermsInChannel(channel, member);
    if (permsInChannel.has(permsToCheck)) {
        return 1;
    } else {
        return 0;
    }
}

async function doesTableExists(tableName) {
    try {
        const rows = await executeQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' AND table_type = 'BASE TABLE'
        `);

        const existingTableNames = rows.map(row => row.table_name);
        
        return existingTableNames.includes(tableName);
    } catch (error) {
        console.error("Error checking table existence:", error);
        return false;
    }
    
}



/*await poolConnection.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type = 'BASE TABLE'`, (err, result) => {
    console.log(result.rows.map(row => row.table_name));
});*/

module.exports = {
    getBotMember,
    getPermsInChannel,
    botPermsCheckInChannel,
    memberPermsCheckInChannel,
    doesTableExists,
    hexToString,
};