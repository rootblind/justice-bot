const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {EmbedBuilder} = require('discord.js');
const {encryptor, decryptor} = require('../../utility_modules/utility_methods.js');
const {config} = require('dotenv');
config();

const botId = process.env.CLIENT_ID;

function random_code_generation() { // generates a random key code, meaning a string with a random length between 5 and 10 that has random characters
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-?';
    const length = Math.floor(Math.random() * 6) + 5; // Random length between 5 and 10

    let randomString = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters[randomIndex];
    }

    return randomString;
}

module.exports = {
    name: 'guildMemberUpdate',

    async execute(oldMember, newMember) {

        if(!oldMember) return;
        if(oldMember.user.bot) return; // ignore bots

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
        
        /*  In case there is ever a need to log moderation activities since timeouts are logged using guildauditlogentrycreate event
        const modLogChannel = null
        const fetchModLog = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [oldMember.guild.id, 'moderation'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        modLogChannel = oldMember.guild.channels.fetch(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchModLog;
        */

        if(logChannel) {
            if(oldMember.displayName != newMember.displayName) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({name: `${oldMember.user.username}`, iconURL: oldMember.displayAvatarURL({extension: 'png'})})
                            .setColor(0x2596be)
                            .addFields(
                                {
                                    name: 'Old display name',
                                    value: `${oldMember.displayName}`
                                },
                                {
                                    name: 'New display name',
                                    value: `${newMember.displayName}`
                                }
                            )
                            .setTimestamp()
                            .setFooter({text: `ID: ${oldMember.id}`})
                    ]
                });
            } else if(oldMember.user.username != newMember.user.username) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                        .setAuthor({name: `${newMember.user.username}`, iconURL: newMember.displayAvatarURL({extension: 'png'})})
                        .setColor(0x2596be)
                        .addFields(
                            {
                                name: 'Old username',
                                value: `${oldMember.user.username}`
                            },
                            {
                                name: 'New username',
                                value: `${newMember.user.username}`
                            }
                        )
                        .setTimestamp()
                        .setFooter({text: `ID: ${newMember.id}`})
                            
                    ]
                })
            }
        }
        


        //fetching the premium role, if it doesn't exist, no premium membership is assigned
        const {rows : premiumRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype=$2`, [newMember.guild.id, 'premium']);
        
        if(premiumRoleData.length > 0){
            const premiumRole = await newMember.guild.roles.fetch(premiumRoleData[0].role);
            let premiumLogChannel = null // if defined, logging the premium activity
            const fetchLogChannel = new Promise((resolve, reject) => {
                poolConnection.query(`SELECT channel FROM serverlogs WHERE eventtype=$1 AND guild=$2`, ['premium-activity', newMember.guild.id],
                    (err, results) => {
                        if(err) {
                            console.error(err);
                            reject(err);
                        }
                        if(results.rows.length > 0) {
                            premiumLogChannel = newMember.guild.channels.cache.get(results.rows[0].channel);
                        }
                        resolve(results);
                    }
                )
            });
            await fetchLogChannel;
            // premium membership must be removed from boosters that are no longer boosting
            // checking if 1- member has premium membership and from boosting 2- checking if member still has nitro booster role
            // fetching the membership from db
            let {rows : premiumMemberData} = await poolConnection.query(`SELECT * FROM premiummembers 
                WHERE guild=$1 AND member=$2 AND from_boosting=$3`,
                [newMember.guild.id, newMember.id, true]
            );

            // if someone is already a premium user, the current code will take priority
            let {rows: checkPremiumMemberStatus} = await poolConnection
                .query(`SELECT member FROM premiummembers WHERE guild=$1 AND member=$2`,
                    [newMember.guild.id, newMember.id]
            );
            if(!oldMember.premiumSince && newMember.premiumSince && checkPremiumMemberStatus.length == 0) { // when a  member is boosting
                // assign user with premium role
                await newMember.roles.add(premiumRole);
                // if old member didn't have nitro booster and the new one has, it means the member just boosted the server
                // and is eligible for premium membership from boosting
                let code = encryptor(random_code_generation());
                const keyData = await poolConnection.query(`SELECT code FROM premiumkey WHERE guild=$1`, [oldMember.guild.id]); // already encrypted
                if(keyData.length > 0) { // while code already exists, keep generating
                    const keys = keyData.map(row => row.code);
                    while(keys.includes(code))
                        code = encryptor(random_code_generation());
                }

                // register the key and the membership
                await poolConnection.query(`INSERT INTO premiumkey(code, guild, generatedby, createdat, expiresat, usesnumber, dedicateduser)
                    VALUES($1, $2, $3, $4, $5, $6, $7)`,
                    [code, newMember.guild.id, botId, parseInt(Date.now() / 1000), 0, 0, newMember.id]
                );
                await poolConnection.query(`INSERT INTO premiummembers(member, guild, code, customrole, from_boosting)
                    VALUES($1, $2, $3, $4, $5)`, [newMember.id, newMember.guild.id, code, null, true]);
                
                const updateMemberData = async () => {
                    const { rows } = await poolConnection
                    .query(`SELECT member FROM premiummembers WHERE guild=$1 AND member=$2`,
                        [newMember.guild.id, newMember.id]
                    );
                    checkPremiumMemberStatus = rows;
                }
                await updateMemberData();
                
                const embedPremiumLog = new EmbedBuilder()
                    .setTitle('Server boost')
                    .setAuthor({
                        name: `${oldMember.user.username} is now boosting`,
                        iconURL: oldMember.displayAvatarURL({ format: 'jpg' })
                    })
                    .setTimestamp()
                    .setFooter({text: `ID: ${oldMember.user.id}`})
                    .setColor(0xd214c7)
                    .setDescription(`${oldMember} recieved premium membership through boosting the server!`)
                    .addFields({
                        name: 'Code',
                        value: `||${decryptor(code.toString())}||`
                    })
                
                const embedThanks = new EmbedBuilder()
                    .setTitle('Server boost')
                    .setAuthor({
                        name: `Server boosting ${oldMember.guild.name}`,
                        iconURL: oldMember.guild.iconURL({ extension: 'png' })
                    })
                    .setColor(0xd214c7)
                    .setImage(oldMember.guild.bannerURL({size: 1024}))
                    .setDescription(`Thank you, ${oldMember.user.username} for boosting the server!
                        You recieved a premium membership on the server that lasts for as long as you're boosting!
                        Please go on the server and access your premium perks through \`/premium dashboard\` and other premium commands!`)
                    .addFields(
                        {
                            name: 'Code',
                            value: `${decryptor(code.toString())}`,
                            inline: true
                        },
                        {
                            name: 'From boosting',
                            value: 'True',
                            inline: true
                        },
                    )

                //logging
                if(premiumLogChannel)
                    await premiumLogChannel.send({embeds: [embedPremiumLog]});
                try{ await newMember.user.send({embeds: [embedThanks]}); } catch(err) {};

            }
            else if(premiumMemberData.length > 0 && !newMember.premiumSince){
                // when a member stops boosting premiumSince is null;
                // with from_boosting parameter as true

                // fetching custom role to remove from member
                let customRole = null;
                if(premiumMemberData[0].customrole) {
                    customRole = await newMember.guild.roles.fetch(premiumMemberData[0].customrole);
                    if(customRole)
                        if(customRole.members.size - 1 > 0)
                            await newMember.roles.remove(customRole.id);
                        else
                            try{
                                await customRole.delete();
                            } catch(e) { console.error(e); console.log(customRole)}
                }
                // removing premium role
                await newMember.roles.remove(premiumRole);

                // removing the membership row of the member and the special code
                await poolConnection.query(`DELETE FROM premiummembers WHERE guild=$1 AND member=$2`, [newMember.guild.id, newMember.id]);
                await poolConnection.query(`DELETE FROM premiumkey WHERE guild=$1 AND code=$2`, [newMember.guild.id, premiumMemberData[0].code]);

                await poolConnection.query(`DELETE FROM partydraft WHERE guild=$1 AND owner=$2 AND slot > 2`,
                    [newMember.guild.id, newMember.id]
                ); // removing the premium perks of lfg party draft

                await poolConnection.query(`UPDATE partydraft SET hexcolor=0
                    WHERE guild=$1 AND owner=$2 AND slot <= 2`,
                    [newMember.guild.id, newMember.id]
                ); // removing color from non premium slots
                
                
                // logging
                if(premiumLogChannel) {
                    await premiumLogChannel.send({embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0004)
                            .setAuthor({
                                name: `${newMember.user.username} is no longer boosting`,
                                iconURL: newMember.user.displayAvatarURL({extension: 'png'})
                            })
                            .setDescription(`${newMember} lost membership due to lack of nitro boosting!`)
                            .addFields({
                                name: 'Removed code',
                                value: `||${decryptor(premiumMemberData[0].code.toString())}||`
                            })
                            .setTimestamp()
                            .setFooter({text: `ID: ${newMember.id}`})
                    ]});
                }

                // announcing the member
                try{
                    await newMember.user.send({embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0004)
                            .setTitle('You lost premium membership!')
                            .setThumbnail(newMember.user.displayAvatarURL({extension: 'png'}))
                            .setDescription(`Your membership was gained through nitro boosting. Since your boost ended, you lost premium membership on **${newMember.guild.name}**!\nYou can boost again or get a premium key code through other means.\n\n_If you think this message is a mistake, contact a staff member!_`)
                    ]});
                } catch(err) {};

                const refreshPremiumMemberData = async () => {
                    const { rows } = await poolConnection.query(`SELECT * FROM premiummembers WHERE guild=$1 AND member=$2 AND from_boosting=$3`,
                        [newMember.guild.id, newMember.id, true]
                    );

                    premiumMemberData = rows;
                }
                await refreshPremiumMemberData();
                
            }
        }

        return; // unhandled events will be ignored
    }
}