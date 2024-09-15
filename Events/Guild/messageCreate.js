const {config} = require('dotenv');
config();
const {EmbedBuilder} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {text_classification} = require('../../utility_modules/utility_methods.js');

const axios = require('axios')

async function checkModApi(api) { // checking if there is a connection to the specified api url
    try {

        const response = await axios.get(api);
        if (response.status === 200) {
            return true; // returns true if the connection was successful
        } else {
            return false; // returns false if the connection gives errors
        }
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log('Error response from API:', error.response.status);
        } else if (error.request) {
            // The request was made but no response was received
            console.log('No response received from API');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.log('Error setting up request:', error.message);
        }
    }
}


module.exports = {
    name: 'messageCreate',

    async execute(message) {
        if(!message.guildId || !message.member || message.author.bot) return;

        
        
        let logChannel = null; // if there is no log channel set for messages, then logChannel will be null and this event will be ignored

        const fetchLogChannel = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [message.guildId, 'flagged-messages'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        logChannel = message.guild.channels.cache.get(result.rows[0].channel);
                    }
                    resolve(result);
                }
            )
        });
        await fetchLogChannel;

        if(logChannel == null) return; // if no server activity log channel is set up, then do nothing

        let isChannelIgnored = false;

        const fetchIgnoreList = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT channel FROM serverlogsignore WHERE guild=$1 AND channel=$2`, [message.channel.guildId, message.channel.id],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    }
                    else if(result.rows.length > 0) {
                        isChannelIgnored = true
                    }
                    resolve(result);
                }
            );
        });
        await fetchIgnoreList;

        if(isChannelIgnored) return; // if the channel is ignored from this type of logging, ignore the event

        const mod_api = process.env.MOD_API_URL; // for ease of coding
        if(!checkModApi(mod_api)) return; // at the moment, the event of sending a message has no other goal other than
        // evaluating the messages through the mod_api

        const response = await text_classification(mod_api, message.content);
        
        if(response && !response.includes('OK')) { // ignoring OK messages
            const embed = new EmbedBuilder()
                .setTitle('Flagged Message')
                .setAuthor({
                    name: message.author.username,
                    iconURL: message.member.displayAvatarURL({format: 'jpg'})
                })
                .setColor(0xff0005)
                .addFields(
                    {
                        name: 'Channel',
                        value: `${message.channel}`
                    },
                    {
                        name: 'Flags',
                        value: `${response.join(', ')}`
                    },
                    {
                        name: 'Link',
                        value: `[reference](${message.url})`
                    }
                )
                .setTimestamp()
                .setFooter({text:`ID: ${message.author.id}`})
            
            if(message.content.length <= 3000)
                embed.setDescription(`**Content**: ${message.content}`)
            else { // handling large messages through temp files and posting the file instead of overflowing the embed description
                const filePath = path.join(__dirname, `../../temp/${message.id}.txt`);
                fs.writeFile(filePath, message.content, (err) => {
                console.error(err);
                });
                const sendFile = await logChannel.send({files:[filePath]});
                embed.setDescription(`[[Content]](${sendFile.url})`);
                fs.unlink(filePath, (err) => {
                    if(err) throw err;
                });
            }
            await logChannel.send({embeds:[embed]});
        }

    }
};