const {EmbedBuilder} = require("@discordjs/builders");
const {GuildMember, Embed} = require('discord.js');
const { poolConnection } = require('../../utility_modules/kayle-db.js');

module.exports = {
    name: "guildMemberAdd",
    async execute(member)
    {
        
        poolConnection.query(`SELECT * FROM welcomescheme WHERE id=1`, (err, result) => {
            if(err) console.error(err);
            if(result.rows.length == 0) return;
            if(result.rows[0].active == false) return;
            let channel = result.rows[0].channel;
            let theTitle = result.rows[0].title || null;
            let Msg = result.rows[0].message;
            let hasAuthor = result.rows[0].author || false;
            let color = result.rows[0].colorcode || 0xc30000;
            let imagelink = result.rows[0].imagelink || null;
            console.log(typeof(result.rows[0].color) + " " + result.rows[0].color);
            const {user, guild} = member;
            const welcomeChannel = member.guild.channels.cache.get(channel);
            
            const welcomeEmbed = new EmbedBuilder();
            if(hasAuthor)
                welcomeEmbed.setAuthor({ name: user.username, 
                    iconURL: member.displayAvatarURL({ format: 'jpg' }) });
            
            if(theTitle != null)
                welcomeEmbed.setTitle(theTitle);
            
            welcomeEmbed.setDescription(Msg).setThumbnail(guild.iconURL()).setColor(Number(color))
                .setTimestamp()
                .setFooter({text:`ID: ${member.id}`});
            if(imagelink != null)
                welcomeEmbed.setImage(imagelink)
            welcomeChannel.send({embeds: [welcomeEmbed]});
        });

    }
};