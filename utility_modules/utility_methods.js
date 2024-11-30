/*
    Just methods to help me write less or prettier code.
*/

const {executeQuery} = require('./kayle-db.js');

// This function takes a hexadecimal number and converts it to a string to the corresponding format
// Might be bad practice, but it's used to translate color hexcodes between embeds and database
// since colore codes in database are declared as strings (varchar) and in this code as numbers.
function hexToString(num){
    let str = '0x' + num.toString(16).padStart(6,'0');
    return str;
}

// Rather than chaining all of these methods, I chose to use one that returns the result
function getBotMember(client, interaction) {
    return interaction.guild.members.cache.get(client.user.id);
}

// I thought of it as being easier to understand when checking for permissions
function getPermsInChannel(channel, member){
    return channel.permissionsFor(member);
}

// The method above checks the perms in the same channel as where the interaction was sent, 
// the method below can check perms in any channel, useful when you send the command in one channel and it requires
// the bot to do something in another channel.
function botPermsCheckInChannel(client, channel, permsToCheck) {
    if (!Array.isArray(permsToCheck)) {
        console.error("An array must be given when botPermsCheck is called!");
        return -1;
    }
    const permsInChannel = getPermsInChannel(channel, channel.guild.members.cache.get(client.user.id));
    if (permsInChannel.has(permsToCheck)) {
        return 1;
    } else {
        return 0;
    }
}

function memberPermsCheckInChannel(interaction, channel, permsToCheck) {
    if (!Array.isArray(permsToCheck)) {
        console.error("An array must be given when memberPermsCheck is called!");
        return -1;
    }
    const {member} = interaction;
    const permsInChannel = getPermsInChannel(channel, member);
    if (permsInChannel.has(permsToCheck)) {
        return 1;
    } else {
        return 0;
    }
}

// Some commands require specific tables to exist in the database, the method below is used to check for that.
async function doesTableExists(tableName) {
    try {
        const rows = await executeQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' AND table_type = 'BASE TABLE'
        `);

        const existingTableNames = rows.map(row => row.table_name);
        
        return existingTableNames.includes(tableName);
    } catch (error) {
        console.error("Error checking table existence:", error);
        return false;
    }
    
}

// Fetches the json data. Used for attachment options.
async function handleFetchFile(attachment) {
    const response = await fetch(attachment.url);
    const data = await response.json();
    return data;
}

function isAlphanumeric(str) { // check if a string is alphanumeric
    const regex = /^[a-zA-Z0-9]+$/;
    return regex.test(str);
}

function formatDate(date) {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatTime(date) {
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}


/*await poolConnection.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type = 'BASE TABLE'`, (err, result) => {
    console.log(result.rows.map(row => row.table_name));
});*/

const axios = require('axios');
async function text_classification(api, text) {
    // preparing the text for the classification
    const alphabetPattern = /^[a-zA-Z]/;
    const allowedPattern = /[^a-zA-Z0-9 !.-?]/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

    function filter(message) {
        if (message.length < 3) {
            return message;
        }

        message = message.replace('+rep', '');
        message = message.replace('-rep', '');
        message = message.replace(/\n/g, ' ').replace(/\r/g, ' ');
        message = message.replace(urlPattern, '');
        message = message.replace(allowedPattern, '');
        message = message.trim();

        return message;
    }

    const filteredText = filter(text);

    if (filteredText.length > 2 && alphabetPattern.test(filteredText))
    {
        let classifier = null;
        const url = api + 'classify';
        const data = {
            'text' : filteredText
        };

        try{
            await axios.post(url, data)
                .then(response => {
                    classifier = response.data['labels'];
                }) 
                .catch(err => { console.error(err); })
        } catch(err) {
            console.error(err);
        }
        return {labels: classifier, text: filteredText}; // returning the model's labels and the filtered text that was analyzed by the model
    }
    else return false;

}

// for the encryption methods, there is a need to load environment variables.
const crypto = require('crypto');
const {config} = require('dotenv');
config();

const key = Buffer.from(process.env.ENCRYPT_KEY, 'hex'); // encryption key
const iv = Buffer.from(process.env.IV, 'hex'); // initializator vector
const algorithm = process.env.ALGORITHM; // the algorithm used to encrypt

function encryptor(data) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptor(data) {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const csvWriter = require('csv-write-stream');
const fs = require('graceful-fs');
const csvParse = require('csv-parser');


function csvRead(path) {
    return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(path)
            .pipe(csvParse({delimiter: ',', from_line: 2}))
            .on('data', (row) => {
                data.push(row);
            })
            .on('error', (err) => {
                console.error(err);
                reject(err);
            })
            .on('end', () => {
                resolve(data);
            });
    });
}

function csvAppend(data, flags, path) {
    const writer = csvWriter({sendHeaders: false});
    const stream = fs.createWriteStream(path, {flags: 'a'});
    writer.pipe(stream);
    writer.write({
       Message: data,
       OK: flags['OK'],
       Aggro: flags['Aggro'],
       Violence: flags['Violence'],
       Sexual: flags['Sexual'],
       Hateful: flags['Hateful']
    });
    writer.end();
}

//returns if the file exists or not
async function isFileOk(path) {
    let fileExists = true;

    try{
        await fs.promises.access(path, fs.constants.R_OK);
    } catch(err) {
        fileExists = false;

    }

    return fileExists
}

function curated_text(text) {
    // preparing the text for the classification
    const alphabetPattern = /^[a-zA-Z]/;
    const allowedPattern = /[^a-zA-Z0-9 -!?.]/g;
    const urlPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

    function filter(message) {
        if (message.length < 3) {
            return message;
        }

        message = message.replace('+rep', '');
        message = message.replace('-rep', '');
        message = message.replace(/\n/g, ' ').replace(/\r/g, ' ');
        message = message.replace(urlPattern, '');
        message = message.replace(allowedPattern, '');
        message = message.trim();

        return message;
    }

    const filteredText = filter(text);

    if (filteredText.length > 2 && alphabetPattern.test(filteredText))
    {
        return filteredText;
    }
    else return false;
}

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


// takes durationString as input something like 3d, matches the value and the time unit, converts the time unit to seconds and then returns
// the timestamp of when the key will expire.
// Example: 3d will be converted to the current timestamp + 3 * 864000.
const durationRegex = /^(\d+)([m,h,d,w,y])$/;
function duration_timestamp(durationString) {
    const match = durationString.match(durationRegex);
    if(match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const Unit = {
            "m": 60,
            "h": 3600,
            "d": 86400,
            "w": 604800,
            "y": 31556926
        }
        return parseInt(Date.now() / 1000) + value * Unit[unit]; // for some reason, timestamps are in milliseconds, but discord interprets as seconds
        // hence why Date.now() is divided by 1000
    } else {
        return null;
    }
}

module.exports = {
    duration_timestamp,
    random_code_generation,
    curated_text,
    isFileOk,
    csvRead,
    csvAppend,
    decryptor,
    encryptor,
    text_classification,
    getBotMember,
    getPermsInChannel,
    botPermsCheckInChannel,
    memberPermsCheckInChannel,
    doesTableExists,
    hexToString,
    handleFetchFile,
    isAlphanumeric,
    formatDate,
    formatTime
};