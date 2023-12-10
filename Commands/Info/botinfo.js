const {SlashCommandBuilder, EmbedBuilder, CommandInteraction, PermissionFlagsBits} = require('discord.js');
const cpuStats = require('cpu-stat');
const { config } = require('dotenv');
const botUtils = require('../../utility_modules/utility_methods.js');

config();

module.exports = {
    data : new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Check details about my system.'),

        execute(interaction, client){
            if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == 0)
            {
                console.error(`I am missing SendMessages permission in ${interaction.channel} channel.`);
            }
            else if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == -1){
                const embed = EmbedBuilder()
                    .setTitle('An error occurred while running this command!')
                    .setColor('Red');
                return interaction.reply({embeds:[embed], ephemeral:true});
                
            }
            //getting time numbers for the following embedded messages
            const days = Math.floor(client.uptime / 86400000);
            const hours = Math.floor(client.uptime / 3600000) % 24;
            const minutes = Math.floor(client.uptime / 60000) % 60;
            const seconds = Math.floor(client.uptime / 1000) % 60;

            cpuStats.usagePercent(function (error, percent) {
                if(error) return interaction.reply({content: `${error}`});

                const memoryUsage = formatBytes(process.memoryUsage().heapUsed);
                const node = process.version;
                const cpu = percent.toFixed(2);

                const embed = new EmbedBuilder()
                    .setTitle('Bot Info & Stats')
                    .setColor('Aqua')
                    .setAuthor({ name: 'Check on github', iconURL: 'https://pngimg.com/uploads/github/github_PNG67.png', url: 'https://github.com/rootblind/kayle-bot'})
                    .addFields(
                        { name: "Dev", value: "rootblind", inline: true },
                        { name: "Username:", value: `${client.user.username}`, inline: true },
                        { name: "Version:", value: `${process.env.VERSION}`, inline: true},
                        { name: "Release date", value: "TO BE FILLED WITH FIRST RELEASE"},
                        { name: "Help command", value: "/help"},
                        { name: "Ping", value: `${client.ws.ping}ms`},
                        { name: "Uptime", value: `\`${days}\` days, \`${hours}\` hours, \`${minutes}\` minutes and \`${seconds}\` seconds.`},
                        { name: "Node version", value: `${node}`},
                        { name: "CPU usage", value: `${cpu}%`},
                        { name: "Memory usage", value: `${memoryUsage}`}
                    );

                    interaction.reply({embeds: [embed]});
            });

            function formatBytes(a, b) {
                let c = 1024; // Bytes per kilobyte
                let d = b || 2; // Number of decimal places (default is 2)
                let e = ["B", "KB", "MB", "GB", "TB"];
                // Calculate the appropriate size unit based on the size
                f = Math.floor(Math.log(a) / Math.log(c));

                return parseFloat((a / Math.pow(c, f)).toFixed(d)) + `` + e[f];
                // Returns: A formatted string representing the size in a human-readable format 
            }
        }
        
};