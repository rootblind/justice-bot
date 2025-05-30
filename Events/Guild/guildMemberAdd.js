// The new member event being handled.
// What the code below does is reading the welcomescheme table from database and making an embed to be sent.

const {EmbedBuilder} = require("@discordjs/builders");
const { poolConnection } = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
config();

module.exports = {
    name: "guildMemberAdd", // user-activity when an user joins the server, this event is triggered
    async execute(member)
    {
        if(member.user.bot || !member || !member.user) return;

        // removing perma bans must be done through the bot
        const {rows: banData} = await poolConnection.query(`SELECT * FROM banlist WHERE guild=$1 AND target=$2 AND expires=$3`,
            [member.guild.id, member.id, 0]
        );

        if(banData.length > 0) {
            try{
                await member.guild.bans.create(member.id, {reason: 'The member is permanently banned and the ban was revoked through an illegal way.'})
            } catch (error) {
                console.error(error);
            }
            
            let logChannel = null;

            const serverLogsResult = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`,
                [member.guild.id, 'moderation']);

            if(serverLogsResult.rows.length > 0)
            {
                logChannel = await member.guild.channels.fetch(serverLogsResult.rows[0].channel);
            }

            if(logChannel != null) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: `[BAN] ${member.user.username}`,
                                iconURL: member.user.displayAvatarURL({ format: 'jpg' })
                            })
                            .setColor(0xff0000)
                            .setTimestamp()
                            .setFooter({text:`ID: ${member.id}`})
                            .addFields(
                                {
                                    name: 'User',
                                    value: `${member.user}`,
                                    inline: true
                                },
                                {
                                    name: 'Moderator',
                                    value: `<@${process.env.CLIENT_ID}>`,
                                    inline: true
                                },
                                {
                                    name: 'Reason',
                                    value: `Illegal removal of the ban.`,
                                    inline: false
                                }
                            )
                    ]
                })
            }
            return;
        }

        // if there is a logging channel for user-activity, the new member will be logged here
        const userLogs = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [member.guild.id, 'user-activity'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        const userLogsChannel = member.guild.channels.cache.get(result.rows[0].channel);
                        const userLogsEmbed = new EmbedBuilder()
                            .setAuthor(
                                {
                                    name: member.user.username,
                                    iconURL: member.displayAvatarURL({ format: 'jpg' })
                                }
                            )
                            .setTitle('User joined')
                            .setDescription(`${member.user.username} joined the server.`)
                            .setColor(0x00fb24)
                            .setTimestamp()
                            .setFooter({text:`ID: ${member.id}`})
                            .addFields(
                                {
                                    name: 'Account created',
                                    value: `${botUtils.formatDate(member.user.createdAt)} | [${botUtils.formatTime(member.user.createdAt)}]`
                                }
                            );
                        userLogsChannel.send({embeds: [userLogsEmbed]});
                    }
                    resolve(result);
                }
            )
        });
        await userLogs;

        // if a welcome message was set, when a new member joins, it will be sent on the specified channel
        const welcomeMessagePromise = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT * FROM welcomescheme WHERE id=${member.guild.id}`, (err, result) => {
                if(err){ console.error(err); reject(err); }
                    else {
                        if(result.rows.length > 0)
                            if(result.rows[0].active == true) {
                                let channel = result.rows[0].channel;
                                let theTitle = result.rows[0].title || null;
                                let Msg = result.rows[0].message;
                                let hasAuthor = result.rows[0].author || false;
                                let color = result.rows[0].colorcode || 0xc30000;
                                let imagelink = result.rows[0].imagelink || null;
                                const {user, guild} = member;
                                const welcomeChannel = member.guild.channels.cache.get(channel);
                                
                                const welcomeEmbed = new EmbedBuilder();
                                if(hasAuthor)
                                    welcomeEmbed.setAuthor({ name: user.username, 
                                        iconURL: member.displayAvatarURL({ format: 'jpg' }) });
                                
                                if(theTitle != null)
                                    welcomeEmbed.setTitle(theTitle);
                                
                                welcomeEmbed.setDescription(Msg).setThumbnail(guild.iconURL()).setColor(Number(color))
                                    .setTimestamp()
                                    .setFooter({text:`ID: ${member.id}`});
                                if(imagelink != null)
                                    welcomeEmbed.setImage(imagelink)
                                welcomeChannel.send({embeds: [welcomeEmbed]});
                            }
                        resolve(result);
                    }
                
            });
        });
        await welcomeMessagePromise;

        // if member has premium status, checks if the member has the premium role, otherwise gives it to them.
        // checking for server premium role
        let premiumRole = null;
        const fetchPremiumRole = new Promise((resolve, reject) =>{
            poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype=$2`, [member.guild.id, "premium"],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    if(result.rows.length > 0) {
                        premiumRole = result.rows[0].role;
                    }
                    resolve(result);
                }
            )
        });
        await fetchPremiumRole;

        premiumRole = await member.guild.roles.fetch(premiumRole);

        if(premiumRole != null) { // if no server premium role is set, no point in checking premium status
            const checkPremiumStatus = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT member, customrole FROM premiummembers WHERE member=$1 AND guild=$2`,
                    [member.id, member.guild.id],
                    async (err, result) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        if(result.rows.length > 0) {
                            
                            await member.roles.add(premiumRole);
                            // if the member also has a custom role, assign it
                            if(result.rows[0].customrole)
                            {
                                const customRole = await member.guild.roles.fetch(result.rows[0].customrole);
                                try{
                                    await member.roles.add(customRole);
                                } catch(err) {
                                    console.error(err);
                                    await poolConnection.query(`UPDATE premiummembers SET customrole=$1 WHERE guild=$2 AND member=$3`,
                                        [null, member.guild.id, member.id]
                                    );
                                }
                            } 
                        }
                        resolve(result);
                    }
                )
            });
            await checkPremiumStatus;

        }

    }
};