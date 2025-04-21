const {SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits} = require('discord.js')

const Colors = [
    0xf62e36,
    0xff7f50,
    0xebd406,
    0x019a66,
    0x0079c2,
    0xff80ed,
    0x9a00ff,
    0x000001,
    0xffffff,
    0xd214c7,
];

module.exports = {

    cooldown: 5,
    botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Take a look at someone\'s avatar!')
        .addUserOption(option => 
            option.setName('member')
                .setDescription('The member you want to take a look at.')
        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser('member') || null;
        let member = null;
        try{
            member = user ? await interaction.guild.members.fetch(user.id) : interaction.member;
        } catch(err) {
            return await interaction.reply({flags: MessageFlags.Ephemeral, embeds: [
                new EmbedBuilder()
                    .setColor("Red")
                    .setTitle("Invalid input")
                    .setDescription("The user provided is not a member of this server.")
            ]});
        }


        return await interaction.reply({embeds: [
            new EmbedBuilder()
                .setColor(Colors[Math.floor(Math.random() * Colors.length)])
                .setAuthor({name: `${member.displayName}'s avatar`, iconURL: member.displayAvatarURL({extension: 'png'})})
                .setImage(member.displayAvatarURL({extension: 'png', size: 1024}))
                .setFooter({text: `Requested by ${interaction.user.username}.`})
        ]});
    }
}