const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require("discord.js");

// emits when a role is deleted


async function clearDB(roleId, guildId, parameter, table) {
    const checkPromise = new Promise((resolve, reject) => {
        poolConnection.query(`SELECT * FROM ${table} WHERE guild=$1 AND ${parameter}=$2`, [guildId, roleId],
            (err, result) => {
                if(err) {
                    console.error(err);
                    reject(err);
                }
                if(result.rows.length > 0) {
                    poolConnection.query(`DELETE FROM ${table} WHERE guild=$1 AND  ${parameter}=$2`, [guildId, roleId]);
                }
                resolve(result);
            }
        );
    });
    await checkPromise;
}

module.exports = {
    name: 'roleDelete',

    async execute(role) {
        // updating the database when a role used in any of the tabels is deleted
        await clearDB(role.id, role.guild.id, 'roleid', 'panelscheme');
        await clearDB(role.id, role.guild.id, 'roleid', 'reactionroles');
        await clearDB(role.id, role.guild.id, 'role', 'serverroles');
        await clearDB(role.id, role.guild.id, "role", "rankrole");
        
        // if a premium custom role is deleted, database must be updated by setting the specific cell to NULL
        const checkCustomRole = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT customrole FROM premiummembers WHERE guild=$1 AND customrole=$2`, [role.guild.id, role.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    if(result.rows.length > 0) {
                        poolConnection.query(`UPDATE premiummembers SET customrole=NULL WHERE guild=$1 AND customrole=$2`, 
                            [role.guild.id, role.id],
                            (err, result) => {
                                if(err) {
                                    console.error(err);
                                    reject(err);
                                }

                            }
                        )
                    }
                    resolve(result);
                }
            )
        });
        await checkCustomRole;

        
    }
}