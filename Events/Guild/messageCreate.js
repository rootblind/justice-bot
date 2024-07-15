const {config} = require('dotenv');

config();

module.exports = {
    name: 'messageCreate',

    async execute(message) {
        if(!message.guildId || message.author.bot) return;
        
        return;
    }
};