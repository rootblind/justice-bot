const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require('discord.js')

module.exports = {
    name: 'guildMemberUpdate',

    async execute(oldMember, newMember) {

        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [oldMember.guild.id, 'user-activity'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = oldMember.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        // Upon member update event, there can be multiple types of changes, therefore will be handled independently
        if(oldMember.premiumSince !== newMember.premiumSince) {
            // checking for nitro boosting ; permiumSince is the date of the last nitro boost, upon boosting, newMember
            // will have a different one

            let premiumRole = null;
            
            const fetchPremiumRole = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype=$2`,
                    [oldMember.guild.id, 'premium'],
                    (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        } else if(result.rows.length > 0) {
                            premiumRole = oldMember.guild.roles.cache.get(result.rows[0].role);
                        }
                        resolve(result);
                    }
                )
            });
            await fetchPremiumRole;

            if(premiumRole != null) {
                // only executing if premium role is not null, meaning there is a server premium role role set up with /server-roles

                const embedPremiumLog = new EmbedBuilder()
                    .setTitle('Server boost')
                    .setAuthor({
                        name: `${oldMember.user.username} is now boosting`,
                        iconURL: oldMember.displayAvatarURL({ format: 'jpg' })
                    })
                    .setTimestamp()
                    .setFooter({text: `ID: ${oldMember.user.id}`})
                    .setColor(0xd214c7)
                    .setDescription(`${oldMember} has been given the premium role ${premiumRole} for boosting the server.`)
                
                const embedThanks = new EmbedBuilder()
                    .setTitle('Server boost')
                    .setAuthor({
                        name: `Server boosting ${oldMember.guild.name}`,
                        iconURL: oldMember.guild.iconURL({ extension: 'jpg' })
                    })
                    .setColor(0xd214c7)
                    .setImage(oldMember.guild.bannerURL({size: 1024}))
                    .setDescription(`Thank you, ${oldMember.user.username} for boosting the server!
                        You recieved the premium role ${premiumRole.name}!
                        Contact oppolymorph or any staff if there is something wrong with this message.`);
                
                await logChannel.send({embeds: [embedPremiumLog]}); // sending in logs
                await oldMember.user.send({embeds: [embedThanks]}); // dm'ing the booster
                await oldMember.roles.add(premiumRole); // giving the role

            }

        }

        return; // unhandled events will be ignored
    }
}