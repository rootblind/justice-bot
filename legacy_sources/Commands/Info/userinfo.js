/*
    Fetch discordAPI about server members.
*/

const {SlashCommandBuilder, EmbedBuilder, CommandInteraction, PermissionFlagsBits, MessageFlags} = require('discord.js');
const botUtils = require('../../utility_modules/utility_methods.js');

module.exports = {
    cooldown: 3,
    botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Information about the targeted user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The desired server member.')   
        ),
    async execute(interaction, client) {
        if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == 0)
            {
                console.error(`I am missing SendMessages permission in ${interaction.channel} channel.`);
            }
            else if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == -1){
                const embed = EmbedBuilder()
                    .setTitle('An error occurred while running this command!')
                    .setColor('Red');
                return interaction.reply({embeds:[embed], flags: MessageFlags.Ephemeral});
                
            }
        const user = interaction.options.getUser('user') || interaction.user; // if no user is provided, the command is self targeted
        if(user)// making sure user is a member of the guild
        {
            if(!(await interaction.guild.members.cache.get(user.id)))
                return await interaction.reply({flags: MessageFlags.Ephemeral, embeds: [
                    new EmbedBuilder()
                        .setTitle('Invalid user')
                        .setColor('Red')
                        .setDescription('The user provided is not of this guild!')
                ]});
        }
        const member = await interaction.guild.members.cache.get(user.id); // fetching the guild member
        let highestRole;
        const boostingSince = member.premiumSinceTimestamp || 'Not boosing';
        if(user.id === interaction.guild.ownerId) {
            highestRole = 'Owner';
        }
        else
            highestRole = member.roles.highest.name;
        const embed = new EmbedBuilder()
            .setColor('Purple')
            .setAuthor({
                name: user.tag, iconURL: user.displayAvatarURL({format: 'jpg'})
            }).addFields(
                {
                    name: 'Name', value: `${user}`, inline: false
                },
                {
                    name: 'Highest rank', value: `${highestRole}`, inline: true
                },
                {
                    name: 'Joined server', value: `<t:${parseInt(member.joinedAt / 1000)}:R>`, inline: true
                },
                {
                    name: 'Joined discord', value: `<t:${parseInt(member.user.createdAt / 1000)}:R>`, inline: true
                },
                {
                    name: 'Boosting since', value: `${boostingSince}`, inline: true
                }

            )
            .setFooter({text: `User ID: ${user.id}`})
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp();
        
        return interaction.reply({embeds: [embed]});

    }
};