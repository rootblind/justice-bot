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
    const urlPattern = /https?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/;
    const emojiPattern = /<[^>]*>/g;
    function filter(text) {
        if(text.length < 3) return text;
        text = text.replace('+rep', '')
                    .replace('-rep', '')
                    .replace('\n', ' ')
                    .replace('\r', ' ')
                    .replace(/^\s+/, '')
                    .replace(emojiPattern, '');
        if(text.endsWith(','))
            text = text.slice(0,-1);
        return text;

    }

    const filteredText = filter(text);

    if (filteredText.length > 2 && alphabetPattern.test(filteredText) && !urlPattern.test(filteredText))
    {
        let classifier = null;
        const url = api + 'classify';
        const data = {
            'text' : filteredText
        };

        await axios.post(url, data)
            .then(response => {
                classifier = response.data['labels'];
            }) 
            .catch(err => { console.error(err); })
        
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
       Insult: flags['Insult'],
       Violence: flags['Violence'],
       Sexual: flags['Sexual'],
       Hateful: flags['Hateful'],
       Flirt: flags['Flirt'],
       Spam: flags['Spam'],
       Aggro: flags['Aggro']
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

module.exports = {
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