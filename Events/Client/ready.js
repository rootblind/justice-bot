// The first signs of "it works!" are provided by the ready event.
// It is also used to initialize some features from the first moments, like auto-updating the presence

const { Client, ActivityType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { config } = require('dotenv');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const axios = require('axios');
const cron = require('node-cron');

config();
require('colors');

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
                    dedicateduser BIGINT
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
                    from_boosting BOOLEAN DEFAULT FALSE
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

            for(tableName of table_nameListed){
                table.addRow(tableName, 'Ready');
            }
            console.log(table.toString(), '\nDatabase tables');

            console.log(
                `${
                    client.user.username
                } is functional! - ${botUtils.formatDate(new Date())} | [${botUtils.formatTime(new Date())}]`
            );
    
        // creating a temporary files directory
        const tempDir = path.join(__dirname, '../../temp'); // temp directory will be used for storing txt files and such that will be
                                                            // removed after usage, like large messages that trigger deleted or updated messages

        // checking if the directory exists, if it doesn't then an error is thrown and the directory is created
        directoryCheck(tempDir);

        const assetsDir = path.join(__dirname, '../../assets'); // in assets there will be the images media used for the bot presence
        directoryCheck(assetsDir);

        const avatarDir = path.join(__dirname, '../../assets/avatar');
        directoryCheck(avatarDir);

        // checking connection status to the MOD API
        if(await checkAPI(process.env.MOD_API_URL)) {
            console.log('Successfully connected to the Moderation API: ', process.env.MOD_API_URL);
        }

        // This section will manage cron schedulers

        const reportAPIDowntime = cron.schedule('0 * * * *', async () => {
            if(!(await checkAPI(process.env.MOD_API_URL))) {
                console.log(`Connection to ${process.env.MOD_API_URL} was lost - ${botUtils.formatDate(new Date())} | [${botUtils.formatTime(new Date())}]`)
            }
        })
        
        // checking every 5 minutes therefore there can be a delay between 0 and 5 minutes
        const expirationPremium_schedule = cron.schedule('*/5 * * * *', async () => { 
            // managing expiration of premium key codes

            // fetching premium roles from db
            const {rows : premiumRolesData} = await poolConnection.query(`SELECT guild, role FROM serverroles WHERE roletype=$1`, ["premium"]);

            // firstly, checking the database and making the neccesary changes on the discord server before
            // updating the db
            let currentTimestamp = parseInt(Date.now() / 1000); // fetching current timestamp in seconds
            const {rows : expiredMembers} = await poolConnection.query(`SELECT pm.guild, pm.member, customrole FROM premiummembers pm
                JOIN premiumkey pc ON pm.code = pc.code AND pm.guild = pc. guild
                WHERE pc.expiresat <=$1 AND pc.expiresat > 0`, [currentTimestamp]);
            
            // removing premium and custom roles from expired memberships
            for(let user of expiredMembers) {
                const fetchGuild = await client.guilds.fetch(user.guild); // fetching the guild
                let guildMember;
                try{
                    guildMember = await fetchGuild.members.fetch(user.member); // fetching the member
                }catch(e) { continue; }
                
                if(!guildMember) continue; // if the user is no longer a member of the guild, skip the rest of the steps
                // fetch the premium role of the guild
                const premiumRoleObj = premiumRolesData.find(role => role.guild === user.guild) // the db object
                const premiumRole = await fetchGuild.roles.fetch(premiumRoleObj.role); // the discord api object
                guildMember.roles.remove(premiumRole); // removing the premium role from the user.
                // removing the custom role if it exists
                if(user.customrole)
                {
                    let customRole = await fetchGuild.roles.fetch(user.customrole);
                    customRole.delete();
                }
            }

            // clearing the rows
            await poolConnection.query(`DELETE FROM premiummembers
                WHERE code IN (SELECT code FROM premiumkey WHERE expiresat <= $1 AND expiresat > 0)`, [currentTimestamp]);
            await poolConnection.query(`DELETE FROM premiumkey WHERE expiresat <= $1`, [currentTimestamp]);
            
        });

    }

    


};
