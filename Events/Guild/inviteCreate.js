const {EmbedBuilder} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');

module.exports ={
    name: 'inviteCreate',
    async execute(invite) {

        if(!invite) return;
        if(!invite.inviter) return;
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [invite.guild.id, 'server-activity'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = invite.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${invite.inviter.username} created an invite.`,
                iconURL: invite.inviter.displayAvatarURL({extension: 'jpg'})
            })
            .setTitle(`Invite code: ${invite.code}`)
            .setColor(0xfdf32f)
            .setTimestamp()
            .setFooter({text:`Inviter ID: ${invite.inviter.id}`})
            .setDescription(`${invite.inviter} created a server invite to ${invite.channel}.\n${invite.url}`)

        if(invite.expiresTimestamp) {
            embed.addFields({name: 'Expires', value: `<t:${invite.expiresTimestamp / 1000}:R>`});
        }
        if(invite.maxUses) {
            embed.addFields({name: 'Max uses', value: `${invite.maxUses}`})
        }

        await logChannel.send({embeds: [embed]});

    }
};