// Handling the event of someone adding a reaction.
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
config();

module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        if(!reaction.message.guildId) return; // ignore DMs
        if(user.bot) return; // ignore bots
        
        let emoji = reaction.emoji.id ? 
            `<:${reaction.emoji.name}:${reaction.emoji.id}>` : 
            reaction.emoji.name;
        
        const guild = reaction.message.guild;
        const member = await guild.members.cache.get(user.id);
        let reactionRoleId = null;
        // check if the reaction role table exists
        const reactionRolePromise = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT roleid FROM reactionroles
                                    WHERE guild=$1 AND
                                        channel=$2 AND
                                        messageid=$3 AND
                                        emoji=$4`,
                [reaction.message.guildId, reaction.message.channelId, reaction.message.id, emoji],
                async (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        // if there is a row like that, then the member recieves the role if they don't have it
                        reactionRoleId = result.rows[0].roleid;
                    }
                    resolve(result);
                })
            });

            await reactionRolePromise;
        
        
        if(reactionRoleId && guild.roles.cache.has(reactionRoleId)) {
            if(member.roles.cache.has(reactionRoleId)) {
                try{
                    await member.roles.remove(reactionRoleId);
                } catch(err){
                    console.error(err);
                }
            }
        }
        
        
    }
}