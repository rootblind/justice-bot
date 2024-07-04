// Handling the event of a message being deleted

// logs and managing reaction roles messages being deleted.

const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
config();

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if(!message.guildId) return;

        const reactionRolePromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT messageid FROM reactionroles
                                    WHERE guild=$1 AND
                                        channel=$2 AND
                                        messageid=$3`,
                [message.guildId, message.channelId, message.id],
                async (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        poolConnection.query(`DELETE FROM reactionroles WHERE messageid=$1`, [message.id]);
                    }
                    resolve(result);
                })
            });

        await reactionRolePromise;
        

        const panelRolePromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT messageid FROM panelmessages
                                    WHERE guild=$1 AND
                                        channel=$2 AND
                                        messageid=$3`,
                [message.guildId, message.channelId, message.id],
                async (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        poolConnection.query(`DELETE FROM panelmessages WHERE messageid=$1`, [message.id]);
                    }
                    resolve(result);
                })
            });

        await panelRolePromise;
        
    }
};