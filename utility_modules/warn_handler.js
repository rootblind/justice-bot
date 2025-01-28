// adding a new warn and checking if any auto punish rule is triggered

const {poolConnection} = require('./kayle-db.js');
const {EmbedBuilder} = require('discord.js');
const {convert_seconds_to_units} = require('./utility_methods.js');

async function warn_handler(guild, target, moderator, reason, logChannel) {
    await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
            VALUES($1, $2, $3, $4, $5, $6)`,
            [guild.id, target.id, moderator.id, 0, reason, Math.floor(Date.now() / 1000)]
        );

    // Fetch all rules and their corresponding warn counts
    const { rows: rulesData } = await poolConnection.query(`
        SELECT ar.*, COUNT(pl.id) AS countwarns
        FROM autopunishrule ar
        LEFT JOIN punishlogs pl
        ON ar.guild = pl.guild
        AND pl.punishment_type = 0
        AND pl.timestamp >= $1 - ar.duration
        AND pl.target=$3
        WHERE ar.guild = $2
        GROUP BY ar.id
        ORDER BY ar.warncount DESC, ar.duration ASC
    `, [Math.floor(Date.now() / 1000), guild.id, target.id]);

    if(rulesData.length == 0)
        return null;

    const isUserBanned = async (guild, userId) => {
        try {
            const banInfo = await guild.bans.fetch(userId);
            return true;
        } catch(err) { return false; }
    }

    if(await isUserBanned(guild, target.id)) // if the user is warned through a ban, rules won't be triggered
        return;
    for(const rule of rulesData) {
        const {countwarns} = rule;
        if(countwarns >= rule.warncount){
            // this means the rule was triggered and punishment must be applied
            switch(rule.punishment_type) {
                case 1: // timeout
                    if(target.communicationDisabledUntil != null) // if the rule is triggered through timeout, it will not override the current timeout
                        return;
                    try {
                        await target.timeout(rule.punishment_duration * 1000, `Too many warns | Last warn: ${reason}`);
                        try{
                            await target.user.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setAuthor({
                                            name: `You got timed out for ${convert_seconds_to_units(rule.punishment_duration)} on ${guild.name}`,
                                            iconURL: guild.iconURL({extension: 'png'})
                                        })
                                        .addFields(
                                            {
                                                name: "Reason",
                                                value: "Too many warns"
                                            },
                                            {
                                                name: "Last warn",
                                                value: `${moderator.user.username}: ${reason}`
                                            }
                                        )
                                        .setTimestamp()
                                ]
                            });
                        } catch(err) {}
                        if(logChannel) {
                            await logChannel.send({
                                embeds: [
                                    new EmbedBuilder()
                                    .setColor('Red')
                                    .setAuthor({
                                        name: `${target.user.username} got timed out for ${convert_seconds_to_units(rule.punishment_duration)}`,
                                        iconURL: target.displayAvatarURL({extension: 'png'})
                                    })
                                    .setTimestamp()
                                    .setFooter({text: `Target ID: ${target.id}`})
                                    .setFields(
                                        {
                                            name: "Target",
                                            value: `${target}`,
                                            inline: true
                                        },
                                        {
                                            name: "Moderator",
                                            value: `${guild.client.user}`,
                                            inline: true
                                        },
                                        {
                                            name: "Expires",
                                            value: `<t:${Math.floor(Date.now() / 1000 + Math.floor(rule.punishment_duration))}:R>`,
                                        },
                                        {
                                            name: "Reason",
                                            value: `Too many warns | Rule ID [${rule.id}]`
                                        }
                                    )
                                ]
                            });
                        }
                        await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                            VALUES($1, $2, $3, $4, $5, $6)`,
                            [guild.id, target.id, guild.client.user.id, 1, "Too many warns", Math.floor(Date.now() / 1000)]
                        );
                    }catch(err) { console.error(err);}
                break;
                case 2: // tempban
                    try{
                        if(logChannel) {
                            await logChannel.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setAuthor({
                                            name: `[BAN] ${target.user.username}`,
                                            iconURL: target.displayAvatarURL({ format: 'jpg' })
                                        })
                                        .setColor(0xff0000)
                                        .setTimestamp()
                                        .setFooter({text:`ID: ${target.id}`})
                                        .addFields(
                                            {
                                                name: 'User',
                                                value: `${target}`,
                                                inline: true
                                            },
                                            {
                                                name: 'Moderator',
                                                value: `${guild.client.user}`,
                                                inline: true
                                            },
                                            {
                                                name: 'Expires',
                                                value: `<t:${Math.floor(Date.now() / 1000 + Math.floor(rule.punishment_duration))}:R>`,
                                                inline: true
                                            },
                                            {
                                                name: 'Reason',
                                                value: `Too many warns | Rule ID [${rule.id}]`,
                                                inline: false
                                            }
                                        )
                                ]
                            });
                        }
                        try{
                            await target.user.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setAuthor({name: `You got banned on ${guild.name}`, iconURL: guild.iconURL({extension: 'png'})})
                                        .setTitle('You have been banned!')
                                        .setTimestamp()
                                        .addFields(
                                            {
                                                name: 'Moderator',
                                                value: `${guild.client.user.username}`
                                            },
                                            {
                                                name: 'Reason',
                                                value: "Too many warns"
                                            },
                                            {
                                                name: "Last warn",
                                                value: `${moderator.user.username}: ${reason}`
                                            },
                                            {
                                                name: 'Expires',
                                                value: `<t:${Math.floor(Date.now() / 1000) + Math.floor(rule.punishment_duration)}:R>`
                                            }
                                        )
                                ]
                            });
                        } catch(err) {};
                        await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                            VALUES($1, $2, $3, $4, $5, $6)`,
                            [guild.id, target.id, guild.client.user.id, 2, "Too many warns", Math.floor(Date.now() / 1000)]
                        );

                        await poolConnection.query(`INSERT INTO banlist(guild, target, moderator, expires, reason)
                            VALUES($1, $2, $3, $4, $5)`,
                            [guild.id, target.id, moderator.id, Math.floor(Date.now() / 1000) + Math.floor(rule.punishment_duration), "Too many warns"]
                        );

                        await guild.bans.create(target.id, {reason: `Too many warns | Last warn ${reason}`});
                    } catch(err) { console.error(err);}
                break;
                case 3: // indefinite ban
                    try{
                        if(logChannel) {
                            await logChannel.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setAuthor({
                                            name: `[BAN] ${target.user.username}`,
                                            iconURL: target.displayAvatarURL({ format: 'jpg' })
                                        })
                                        .setColor(0xff0000)
                                        .setTimestamp()
                                        .setFooter({text:`ID: ${target.id}`})
                                        .addFields(
                                            {
                                                name: 'User',
                                                value: `${target}`,
                                                inline: true
                                            },
                                            {
                                                name: 'Moderator',
                                                value: `${guild.client.user}`,
                                                inline: true
                                            },
                                            {
                                                name: 'Expires',
                                                value: `Indefinite`,
                                                inline: true
                                            },
                                            {
                                                name: 'Reason',
                                                value: `Too many warns | Rule ID [${rule.id}]`,
                                                inline: false
                                            }
                                        )
                                ]
                            });
                        }
                        try{
                            await target.user.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setAuthor({name: `You got banned on ${guild.name}`, iconURL: guild.iconURL({extension: 'png'})})
                                        .setTitle('You have been banned!')
                                        .setTimestamp()
                                        .addFields(
                                            {
                                                name: 'Moderator',
                                                value: `${guild.client.user.username}`
                                            },
                                            {
                                                name: 'Reason',
                                                value: "Too many warns"
                                            },
                                            {
                                                name: "Last warn",
                                                value: `${moderator.user.username}: ${reason}`
                                            },
                                            {
                                                name: 'Expires',
                                                value: `Indefinite`
                                            }
                                        )
                                ]
                            });
                        } catch(err) {};
                        await poolConnection.query(`INSERT INTO punishlogs(guild, target, moderator, punishment_type, reason, timestamp)
                            VALUES($1, $2, $3, $4, $5, $6)`,
                            [guild.id, target.id, guild.client.user.id, 2, "Too many warns", Math.floor(Date.now() / 1000)]
                        );

                        await guild.bans.create(target.id, {reason: `Too many warns | Last warn ${reason}`});
                    } catch(err) { console.error(err);}
                break;
            }

            break;
        }
    }

}

module.exports ={
    warn_handler
};