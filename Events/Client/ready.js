// The first signs of "it works!" are provided by the ready event.
// It is also used to initialize some features from the first moments, like auto-updating the presence

const { Client, ActivityType, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { config } = require('dotenv');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const axios = require('axios');
const cron = require('node-cron');
const {exec} = require('child_process');
const { load_collector } = require("../../utility_modules/subcommands/party_maker.js");
const { lfg_collector } = require("../../utility_modules/subcommands/lfg_handler.js");
const {load_autovoice_collector} = require("../../utility_modules/subcommands/autovoice.js");
const { open_ticket_collector } = require("../../utility_modules/subcommands/ticket_handler.js");


config();
require('colors');

const dumpDir = path.join(__dirname, '../../backup-db');

const username = process.env.DBUSER;
const database = process.env.DBNAME;
process.env.PGPASSWORD = process.env.DBPASS;

function randNum(maxNumber) {
    // a basic random function depending on a max number
    return Math.floor(Math.random() * maxNumber);
}

function directoryCheck(dirPath) {
    fs.access(dirPath, fs.constants.F_OK, (err) => {
        if(err) { // in other words, if the directory doesn't exist
            fs.mkdir(dirPath, {recursive: true}, (err) => {
                if(err) {
                    console.error(err);
                }
            });
        }
    });
}

// the function that handles bot's presence
async function statusSetter (client, presence, actList) {
    let selectNum = randNum(4); // selecting a random number between 0 to 3
    let decide = actList[randNum(selectNum)]; // selecting the active presence
    // setting
  await client.user.setPresence({
        activities: [
            {
                name: presence[decide][randNum(presence[decide].length)],
                type: ActivityType[decide],
            },
        ],
        status: "online",
    });
}

async function checkAPI(api) { // checking the connection to the specified API endpoint
    try {

        const response = await axios.get(api);
        
        if (response.status === 200) {
            return true;
        } else {
            console.log(`Received unexpected status code: ${response.status}`);
            return false;
        }
    } catch (error) {
        return false;
    }
}

module.exports = {
    name: 'ready',
    once: true,
    async execute(client){
    
        // just a little greeting in our console
        const ascii = require('ascii-table');
        const table = new ascii().setHeading('Tables', 'Status');
        
        const readFile = async (filePath, encoding) => {
            try {
                const data = fs.readFileSync(filePath, encoding);
                return JSON.parse(data);
            } catch (error) {
                console.error(error);
            }
        };

        // setting up the presence functionalities
        let presenceConfig = await readFile("./objects/presence-config.json","utf-8");
        const activityTypes = ["Playing", "Listening", "Watching"];
        const presetFilePath = presenceConfig.type === 0 ? 
          './objects/default-presence-presets.json' : './objects/custom-presence-presets.json';
        const presencePresetsObject = await readFile(presetFilePath, 'utf-8');
        let autoUpdateInterval; // this variable will act as the interval ID of auto-update presence
        if(presenceConfig.status == "enable")
            if(presenceConfig.delay) {
                await statusSetter(client, presencePresetsObject, activityTypes);
                autoUpdateInterval = setInterval(async () =>{
                    
                    const presenceConfig = await readFile("./objects/presence-config.json","utf-8"); // updating the object to stop the interval
                    // if a configuration change is done to the presence status
                    if(presenceConfig.status == "disable")
                    clearInterval(autoUpdateInterval);
                    await statusSetter(client, presencePresetsObject, activityTypes);

                }, presenceConfig.delay * 1000); // delay in milliseconds x1000 is converted to seconds
            }
            else
                await statusSetter(client, presenceConfig, activityTypes);

        const {database_tables_setup} = require('../../utility_modules/set_database_tables.js');
        await database_tables_setup();
        
        // making sure that the flag_data.csv exists
        if(!(await botUtils.isFileOk('flag_data.csv'))) {
            await fs.promises.writeFile('flag_data.csv', 'Message,OK,Aggro,Violence,Sexual,Hateful\n', 'utf8');
        }
        // creating a temporary files directory
        const tempDir = path.join(__dirname, '../../temp'); // temp directory will be used for storing txt files and such that will be
                                                            // removed after usage, like large messages that trigger deleted or updated messages

        // checking if the directory exists, if it doesn't then an error is thrown and the directory is created
        directoryCheck(tempDir);

        const assetsDir = path.join(__dirname, '../../assets'); // in assets there will be the images media used for the bot presence
        directoryCheck(assetsDir);

        const avatarDir = path.join(__dirname, '../../assets/avatar');
        directoryCheck(avatarDir);

        const backupDir = path.join(__dirname, '../../backup-db');
        directoryCheck(backupDir);

        const errorDumpDir = path.join(__dirname, '../../error_dumps');
        directoryCheck(errorDumpDir);

        // This section will manage cron schedulers
        const reportAPIDowntime = cron.schedule('0 * * * *', async () => {
            if(!(await checkAPI(process.env.MOD_API_URL))) {
                console.log(`Connection to ${process.env.MOD_API_URL} was lost - ${botUtils.formatDate(new Date())} | [${botUtils.formatTime(new Date())}]`)
            }
        });

        // removing expired staff strikes
        const clearExpiredStrikes = cron.schedule("0 * * * *", async () => {
            await poolConnection.query(`DELETE FROM staffstrike WHERE expires <= $1`,
                [Math.floor(Date.now() / 1000)]
            );
        });

        const banListChecks =  cron.schedule("0 * * * *", async () => {
            // temporary bans that expired must be removed
            const {rows : banListData} = await poolConnection.query(`SELECT * FROM banlist WHERE expires > 0 AND expires <=$1`,
                [Math.floor(Date.now() / 1000)]);

            for(let banData of banListData) {
                const fetchGuild = await client.guilds.fetch(banData.guild);
                try{
                    await fetchGuild.bans.remove(banData.target, {reason: 'Temporary ban expired!'})
                } catch(error) {}
                

                let logChannel = null;
                const fetchLogChannel = new Promise((resolve, reject) => {
                    poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [fetchGuild.id, 'moderation'],
                        (err, result) => {
                            if(err) {
                                console.error(err);
                                reject(err);
                            }
                            else if(result.rows.length > 0) {
                                logChannel = fetchGuild.channels.cache.get(result.rows[0].channel);
                            }
                            resolve(result);
                        }
                    )
                });
                await fetchLogChannel;
                
                if(logChannel != null) {
                    await logChannel.send({embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: `[UNBAN] <@${banData.target}>`
                            })
                            .setColor(0x00ff01)
                            .setTimestamp()
                            .setFooter({text:`ID: ${banData.target}`})
                            .addFields(
                                {
                                    name: 'User',
                                    value: `<@${banData.target}>`,
                                    inline: true
                                },
                                {
                                    name: 'Moderator',
                                    value: `${client.user.username}`,
                                    inline: true
                                },
                                {
                                    name: 'Reason',
                                    value: `Temporary ban expired`,
                                    inline: false
                                }
                            )
                    ]});
                }

                await poolConnection.query(`DELETE FROM banlist WHERE guild=$1 AND target=$2`, [fetchGuild.id, banData.target]);
            }
        }, { scheduled: true });

        // this section will be about on ready checks on db.
        const {rows : premiumRolesData} = await poolConnection.query(`SELECT guild, role FROM serverroles WHERE roletype=$1`, ["premium"]);
        // checking if invalid boosters have premium membership (due to them losing membership during downtime)
        const {rows: premiumBoostersData} = await poolConnection.query(`SELECT * FROM premiummembers WHERE from_boosting=$1`, [true]);
        for(let booster of premiumBoostersData) {
            const fetchGuild = await client.guilds.fetch(booster.guild);
            try{
                const boosterMember = await fetchGuild.members.fetch(booster.member);
                if(!boosterMember.premiumSince) { // meaning the member is in the server and is no longer boosting
                    const premiumGuildRole = premiumRolesData.find(r => r.guild === fetchGuild.id);
                    const premiumRole = await fetchGuild.roles.fetch(premiumGuildRole.role);
                    await boosterMember.roles.remove(premiumRole);
                    if(booster.customrole) {
                        const customRole = await fetchGuild.roles.fetch(booster.customrole);
                        if(customRole.members.size - 1 <= 0)
                            await customRole.delete();
                        else if(boosterMember.roles.cache.has(customRole.id))
                            await boosterMember.roles.remove(customRole);
                    }

                    await poolConnection.query(`DELETE FROM partydraft WHERE guild=$1 AND owner=$2 AND slot > 2`,
                        [boosterMember.guild.id, boosterMember.id]
                    ); // removing the premium perks of lfg party draft
    
                    await poolConnection.query(`UPDATE partydraft SET hexcolor=0
                        WHERE guild=$1 AND owner=$2 AND slot <= 2`,
                        [boosterMember.guild.id, boosterMember.id]
                    ); // removing color from non premium slots

                }
                else continue; // skip boosters that are still boosting
            } catch(err) {
                // error will be raised by fetching a member if it doesn't exist
            }
            
            await poolConnection.query(`DELETE FROM premiummembers WHERE guild=$1 AND member=$2`, [fetchGuild.id, booster.member]);
            await poolConnection.query(`DELETE FROM premiumkey WHERE guild=$1 AND code=$2`, [fetchGuild.id, booster.code.toString()])

        }

        
        // checking every 5 minutes therefore there can be a delay between 0 and 5 minutes
        const expirationPremium_schedule = cron.schedule('*/5 * * * *', async () => { 
            try {
                
                const { rows: premiumRolesData } = await poolConnection.query(
                    `SELECT guild, role FROM serverroles WHERE roletype=$1`, 
                    ["premium"]
                );
        
                let currentTimestamp = Math.floor(Date.now() / 1000);
                
                const { rows: expiredMembers } = await poolConnection.query(
                    `SELECT pm.guild, pm.member, customrole 
                    FROM premiummembers pm
                    JOIN premiumkey pc ON pm.code = pc.code AND pm.guild = pc.guild
                    WHERE pc.expiresat <= $1 AND pc.expiresat > 0`, 
                    [currentTimestamp]
                );
                
        
                for (let user of expiredMembers) {
                    let fetchGuild;
                    try {
                        fetchGuild = await client.guilds.fetch(user.guild);
                    } catch (e) {
                        console.error(`Error fetching guild ${user.guild}:`, e);
                        continue;
                    }
        
                    let guildMember;
                    try {
                        guildMember = await fetchGuild.members.fetch(user.member);
                    } catch (e) {
                        continue;
                    }
        
                    if (!guildMember) continue;
        
                    if (guildMember.premiumSince) {
                        let code = botUtils.encryptor(botUtils.random_code_generation());
                        
                        let { rows: keyData } = await poolConnection.query(
                            `SELECT code FROM premiumkey WHERE guild=$1`, 
                            [guildMember.guild.id]
                        );
        
                        const existingCodes = keyData.map(row => row.code);
                        while (existingCodes.includes(code)) {
                            code = botUtils.encryptor(botUtils.random_code_generation());
                        }
        
                        await poolConnection.query(
                            `INSERT INTO premiumkey(code, guild, generatedby, createdat, expiresat, usesnumber, dedicateduser)
                            VALUES($1, $2, $3, $4, $5, $6, $7)`, 
                            [code, guildMember.guild.id, client.user.id, Math.floor(Date.now() / 1000), 0, 0, guildMember.id]
                        );
        
                        await poolConnection.query(
                            `UPDATE premiummembers SET code=$1, from_boosting=$2
                            WHERE member=$3 AND guild=$4`, 
                            [code, true, guildMember.id, guildMember.guild.id]
                        );

                        keyData = await poolConnection.query(
                            `SELECT code FROM premiumkey WHERE guild=$1`, 
                            [guildMember.guild.id]
                        );
        
                        continue;
                    }
        
                    const premiumRoleObj = premiumRolesData.find(role => role.guild === user.guild);
                    if (!premiumRoleObj) {
                        continue;
                    }
        
                    const premiumRole = await fetchGuild.roles.fetch(premiumRoleObj.role);
                    await guildMember.roles.remove(premiumRole);
        
                    if (user.customrole) {
                        const customRole = await fetchGuild.roles.fetch(user.customrole);
                        if(customRole.members.size - 1 <= 0)
                            await customRole.delete();
                        else if(guildMember.roles.cache.has(customRole.id))
                            await guildMember.roles.remove(customRole);
                    }

                    await poolConnection.query(`DELETE FROM partydraft WHERE guild=$1 AND owner=$2 AND slot > 2`,
                        [guildMember.guild.id, guildMember.id]
                    ); // removing the premium perks of lfg party draft
    
                    await poolConnection.query(`UPDATE partydraft SET hexcolor=0
                        WHERE guild=$1 AND owner=$2 AND slot <= 2`,
                        [guildMember.guild.id, guildMember.id]
                    ); // removing color from non premium slots
                }
                await poolConnection.query(
                    `DELETE FROM premiummembers
                    WHERE code IN (SELECT code FROM premiumkey WHERE expiresat <= $1 AND expiresat > 0)`, 
                    [currentTimestamp]
                );
        
                await poolConnection.query(
                    `DELETE FROM premiumkey WHERE expiresat <= $1 AND expiresat > 0`, 
                    [currentTimestamp]
                );

                
        
            } catch (e) {
                console.error('Error in expirationPremium_schedule:', e);
            }

        }, { scheduled: true });
        

        const{rows: botAppConfig} = await poolConnection.query(`SELECT * FROM botconfig`);
        // if a schedule was set, keep its persistency
        // this will NOT continue the previous cron task scheduler, but rather will start a new scheduler with the same expression once the bot restarts
        if(botAppConfig[0].backup_db_schedule){
            const backupSchedulerPersistence = cron.schedule(botAppConfig[0].backup_db_schedule, async () => {
                const {rows: checkUpdatedSchedule} = await poolConnection.query(`SELECT backup_db_schedule FROM botconfig`);
                if(checkUpdatedSchedule[0].backup_db_schedule != botAppConfig[0].backup_db_schedule){
                    // this means that /backup-db set was used, therefore there is no need to keep the old schedule
                    backupSchedulerPersistence.stop();
                    return;
                }
                const date = new Date(); // generate a name that contains the time of creation
                const fileName = `kayle-db-bk-${date.toISOString().replace(/:/g, '-').slice(0,-5)}.sql`
                const command = `pg_dump -U ${username} -d ${database} -f ${path.join(dumpDir, fileName)}`
                const promise = new Promise((resolve, reject) => {
                    exec(command, (err, stdout, stderr) => { // execute the bash command
                        if(err) { console.error(err); reject(err); }
                        resolve(stdout.trim());
                    });
                });
                await promise;
                
            });
        }

        // loading the collectors for the lfg system
        const {rows: partyMakerChannelData} = await poolConnection.query(`SELECT pm.guild, pm.message, slc.channel
            FROM partymaker pm
            JOIN serverlfgchannel slc ON pm.guild = slc.guild
            WHERE slc.channeltype='party-manager'`)

        for(const row of partyMakerChannelData) {
            try{
                const guild = await client.guilds.fetch(row.guild);
                const channel = await guild.channels.fetch(row.channel);
                const message = await channel.messages.fetch(row.message);

                await load_collector(message);
            } catch(err) { continue; }; // just skip bad database rows
        }

        //on ready, check the database for parties, if the voice channel exists and has at least 1 member, do nothing
        //if the channel has 0 members, delete the channel and the row

        const {rows: partyRoomData} = await poolConnection.query(`SELECT * FROM partyroom`);
        for(const row of partyRoomData) {
            try{
                const guild = await client.guilds.fetch(row.guild);
                const voicechannel = await guild.channels.fetch(row.channel);
                const owner = await guild.members.fetch(row.owner);

                const {rows: lfgChannelData} = await poolConnection.query(`SELECT channel FROM serverlfgchannel
                    WHERE guild=$1 AND channeltype='lfg-${row.region}'`,
                    [guild.id]
                );

                const lfgChannel = await guild.channels.fetch(lfgChannelData[0].channel);

                const thread = await lfgChannel.threads.cache.find(t => t.name === `${owner.user.username}-party`);

                const message = await lfgChannel.messages.fetch(row.message);

                if(!voicechannel || voicechannel?.members.size == 0) {
                    // if there are voice channel left over
                    await poolConnection.query(`DELETE FROM partyroom WHERE guild=$1 AND channel=$2`, [guild.id, voicechannel.id]);
                    await voicechannel.delete();

                    if(message)
                        await message.delete();
                    if(thread)
                        await thread.delete();
                    continue;
                }

                // if there are still people in the party, restart collector for the message
                await lfg_collector(message);
                
            } catch(err) {
                console.error("ready.js: " + err);
                continue;
            }
        }

        // loading autovoice manager
        const {rows: autovoicemanagerData} = await poolConnection.query(`SELECT * FROM autovoicemanager`);
        for(row of autovoicemanagerData) {
            try{
                const guild = await client.guilds.fetch(row.guild);
                const {rows: manageChannelData} = await poolConnection.query(`SELECT channel FROM autovoicechannel
                    WHERE guild=$1 AND type='manager'`, [guild.id]);

                const channel = await guild.channels.fetch(manageChannelData[0].channel);

                const message = await channel.messages.fetch(row.message);
                await load_autovoice_collector(message);
            } catch(err) {
                console.error("ready.js: " + err);
                continue;
            }
        }

        // loading ticket manager
        const {rows: ticketManagerData} = await poolConnection.query(`SELECT * FROM ticketmanager`);
        for(row of ticketManagerData) {
            try{
                const guild = await client.guilds.fetch(row.guild);

                const channel = await guild.channels.fetch(row.channel);

                const message = await channel.messages.fetch(row.message);

                await open_ticket_collector(message);

            } catch(err) {
                console.error("ready.js: " + err);
                continue;
            }
        }
        

        // keep it on the last line as confirmation when ready event finishes execution
        console.log(
            `${client.user.username} is functional! - ${botUtils.formatDate(new Date())} | [${botUtils.formatTime(new Date())}]`
        );

        const errorFiles = fs.readdirSync("./error_dumps").map(file => file).filter((file) => file !== 'error.log');
        if(errorFiles.length > 0) {
            console.log(`FOUND ${errorFiles.length} ERROR FILES.`);
        }
    }

};
