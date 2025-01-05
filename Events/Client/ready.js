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

          // making sure that on ready event, the bot has its database tables ready.
          let table_nameListed = new Array(); // list of tables created through this command
          // will be used to compare to the expected tables from ./objects/database-default-tables.json
  
          // the following lines will be about opening and reading the JSON file mentioned above
  
          // upon object modifications, the bot will need to be restarted
          const dbTablesObject = JSON.parse(fs.readFileSync('./objects/database-default-tables.json'));
          let expectedTableNames = dbTablesObject["table_names"];
          let arrayOfTables = new Array(); 
          const existingTables = new Promise((resolve, reject) => {
              poolConnection.query(`SELECT table_name 
                  FROM information_schema.tables 
                  WHERE table_schema='public' 
                  AND table_type = 'BASE TABLE'`,
                  (err, result) => {
                      if(err){
                          console.error(err);
                          reject(err);
                      }
                      else {
                          
                          arrayOfTables.push(result.rows.map(row => row.table_name));
                          resolve(result);
                      }
                      
                  });
          });
          await existingTables;
          arrayOfTables = JSON.stringify(arrayOfTables.slice().sort());
           // checking if tables already exist

            // Taking care of awaiting the query to execute through a promise
            const welcomescheme = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS welcomescheme (
                    id bigint PRIMARY KEY,
                    guild VARCHAR(32),
                    active BOOLEAN DEFAULT false NOT NULL,
                    channel VARCHAR(30),
                    message VARCHAR(255),
                    author BOOLEAN,
                    title VARCHAR(255),
                    colorcode VARCHAR(10),
                    imagelink VARCHAR(255)
                )`, (err, result) => {
                    if(err){
                        console.error(err);
                        reject(err);
                    }
                    else {

                        table_nameListed.push('welcomescheme');
                        resolve(result);
                    }
                });
            });
            await welcomescheme;

            // used for knowing what panel has what roles
            const panelscheme = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS panelscheme (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    panelname VARCHAR(32) NOT NULL,
                    roleid BIGINT NOT NULL,
                    description VARCHAR(255)

                )`, (err, result) => {
                    if(err){
                        console.error(err);
                        reject(err);
                    }
                    else {

                        table_nameListed.push('panelscheme');
                        resolve(result);
                    }
                });
            });
            await panelscheme;

            // the headers of the panels. in this table, the panelname is unique and validations on panel
            // name can be done
            const panelheaders = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS panelheaders (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    panelname VARCHAR(32) NOT NULL
                )`, (err, result) => {
                    if(err){
                        console.error(err);
                        reject(err);
                    }
                    else {

                        table_nameListed.push('panelheaders');
                        resolve(result);
                    }
                });
            });
            await panelheaders;

            // this table stores data about panels sent as select menu messages
            // the use of this data is to delete the sent panels upon panel deletion
            const panelmessages = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS panelmessages (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    channel BIGINT NOT NULL,
                    messageid BIGINT NOT NULL,
                    panelname VARCHAR(32) NOT NULL

                )`, (err, result) => {
                    if(err){
                        console.error(err);
                        reject(err);
                    }
                    else {

                        table_nameListed.push('panelmessages');
                        resolve(result);
                    }
                });
            });
            await panelmessages;

            // the table where all reaction roles are stored
            const reactionroles = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS reactionroles (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    channel BIGINT NOT NULL,
                    messageid BIGINT,
                    roleid BIGINT,
                    emoji TEXT
                )`, (err, result) => {
                    if(err){
                        console.error(err);
                        reject(err);
                    }
                    else {

                        table_nameListed.push('reactionroles');
                        resolve(result);
                    }
                });
            });
            await reactionroles;

            const serverroles = new Promise((resolve, reject) => {
                poolConnection.query(`
                    CREATE TABLE IF NOT EXISTS serverroles (
                        id SERIAL PRIMARY KEY,
                        guild BIGINT NOT NULL,
                        roletype TEXT NOT NULL,
                        role BIGINT NOT NULL
                    )
                `, (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else {
    
                        table_nameListed.push('serverroles');
                        resolve(result);
                    }
                });
            });
            await serverroles;

            const serverlogs = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS serverlogs (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    channel BIGINT NOT NULL,
                    eventtype TEXT NOT NULL
                )`, (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else {
                        table_nameListed.push('serverlogs');
                        resolve(result);
                    }
                });
            });
            await serverlogs;
            const serverlogsignore = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS serverlogsignore (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    channel BIGINT NOT NULL
                )`, (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else {
                        table_nameListed.push('serverlogsignore');
                        resolve(result);
                    }
                });
            });
            await serverlogsignore;

            const premiumKey = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS premiumkey (
                    id SERIAL PRIMARY KEY,
                    code BYTEA,
                    guild BIGINT NOT NULL,
                    generatedby BIGINT NOT NULL,
                    createdat BIGINT NOT NULL,
                    expiresat BIGINT NOT NULL,
                    usesnumber INT,
                    dedicateduser BIGINT,
                    CONSTRAINT unique_guild_dedicateduser UNIQUE (guild, dedicateduser)
                )`, (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else {
                        table_nameListed.push("premiumkey");
                        resolve(result);
                    }
                });
            });
            await premiumKey;

            const premiumMembersReg = new Promise((resolve, reject) => {
                poolConnection.query(`CREATE TABLE IF NOT EXISTS premiummembers (
                    id SERIAL PRIMARY KEY,
                    member BIGINT NOT NULL,
                    guild BIGINT NOT NULL,
                    code BYTEA,
                    customrole BIGINT,
                    from_boosting BOOLEAN DEFAULT FALSE,
                    CONSTRAINT unique_guild_member UNIQUE (guild, member)
                )`, (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else {
                        table_nameListed.push("premiummembers");
                        resolve(result);
                    }
                });
            });
            await premiumMembersReg;
        
        const botConfigTable = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS botconfig (
                id BIGINT PRIMARY KEY,
                application_scope TEXT NOT NULL DEFAULT 'global',
                backup_db_schedule TEXT
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('botconfig')
                resolve(result);
            });
        });
        await botConfigTable;

        const banList = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS banlist (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                target BIGINT NOT NULL,
                moderator BIGINT NOT NULL,
                expires BIGINT NOT NULL,
                reason TEXT,
                CONSTRAINT unique_guild_target UNIQUE (guild, target)
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('banlist')
                resolve(result);
            });
        });
        await banList;

        const punishlogs = new Promise((resolve, reject) => {
            // punishment_type is an integer representing the type of the punishment
            // for ease of reference in code, integers will be used to represent punishment types instead of strings
            // types are graded from least severe to most severe
            // 0- warn; 1- timeout; 2- tempban; 3- indefinite ban; 4- permanent ban
            poolConnection.query(`CREATE TABLE IF NOT EXISTS punishlogs (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                target BIGINT NOT NULL,
                moderator BIGINT NOT NULL,
                punishment_type INT NOT NULL,
                reason TEXT NOT NULL,
                timestamp BIGINT NOT NULL
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('punishlogs')
                resolve(result);
            });
        });
        await punishlogs;
        
        const {rows: botConfigDefaultRow} = await poolConnection.query(`SELECT * FROM botconfig`);
        if(botConfigDefaultRow.length == 0) {
            const insertBotConfig = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO botconfig(id) VALUES($1)`, [process.env.CLIENT_ID], (err, result) => {
                    if(err) reject(err);
                    resolve(result);
                });
            });
            await insertBotConfig;
        }

        for(tableName of table_nameListed){
                table.addRow(tableName, 'Ready');
        }
        console.log(table.toString(), '\nDatabase tables');

        console.log(
                `${
                    client.user.username
                } is functional! - ${botUtils.formatDate(new Date())} | [${botUtils.formatTime(new Date())}]`
            );

    
        
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
    }
};
