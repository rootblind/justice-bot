const {poolConnection} = require('../../utility_modules/kayle-db.js');

const {EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits} = require('discord.js')

const durationRegex = /^(\d+)([s,m,h,d,w,y])$/;
/*
    Administrative commands for premium membership such as generating, editing and deleting premium keys.
    Also managing the members themselves like claiming premium keys for them, removing them from premium membership and any aspect.

    Do note that the duration of premium membership is the same as the duration of the claimed key. The countdown starts when a key
    is created not when it's claimed.
*/


// takes durationString as input something like 3d, matches the value and the time unit, converts the time unit to seconds and then returns
// the timestamp of when the key will expire.
// Example: 3d will be converted to the current timestamp + 3 * 864000.
function duration_timestamp(durationString) {
    const match = durationString.match(durationRegex);
    if(match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const Unit = {
            "s": 1,
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
    data: new SlashCommandBuilder()
        .setName('premium-admin')
        .setDescription('Administrative commands for premium membership.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName('key')
                .setDescription('Commands to administrate premium keys.')
                .addSubcommand(subcommand => 
                    subcommand.setName('generate')
                        .setDescription('Generate a new premium key.')
                        .addStringOption(option => 
                            option.setName('duration')
                                .setDescription('The duration of the premium code. Ex: 3d')
                                .setMaxLength(3)
                                .setMinLength(2)
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName('code')
                                .setDescription('Set a custom key code.')
                                .setMinLength(5)
                                .setMaxLength(10)
                        )
                        .addUserOption(option =>
                            option.setName('dedicated-user')
                                .setDescription('Set the key to be claimable only for a dedicated user.')
                        )
                )
        )
    ,
    cooldown: 5,
    async execute(interaction, client) {
        const subcmd = interaction.options.getSubcommand();
        // fetching and checking if premium system is set up.
        let premiumRoleId = null;
        const fetchRoles = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND (roletype=$2)`,
                [interaction.guildId, 'premium'],
                (err, result) => {
                    if(err) {
                        console.error(err);
                        reject(err);
                    } else if(result.rows.length > 0) {
                        premiumRoleId = result.rows[0].role;
                    }
                    resolve(result);
                }
            )
        });
        await fetchRoles;

        if(!premiumRoleId)
        {
            embed.setTitle('No premium status role was set on this server.')
                .setDescription('No server roles were set up for such commands.')
                .setColor(0xff0004);
            return interaction.reply({embeds: [embed], ephemeral: true});
        }

        const premiumRole = interaction.guild.roles.cache.get(premiumRoleId);

        switch(subcmd) {
            case 'generate':
                const duration = interaction.options.getString('duration');
                const code = interaction.options.getString('code') || null;
                const dedicatedUser = interaction.options.getUser('dedicated-user') || null;
                await interaction.reply(`<t:${duration_timestamp(duration)}:R>`);
            break;
        }
    }
}