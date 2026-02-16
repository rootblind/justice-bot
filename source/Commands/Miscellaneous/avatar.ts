import { PermissionFlagsBits, SlashCommandBuilder, MessageFlags, EmbedBuilder, Guild, GuildMember } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { fetchGuildMember } from "../../utility_modules/discord_helpers.js";

const avatarCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Take a look at someone\'s avatar!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to take a look at.')
        )
        .toJSON(),
    metadata: {
        cooldown: 5,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
        scope: "global",
        category: "Miscellaneous"
    },
    async execute(interaction) {
        const guild = interaction.guild as Guild;
        const interactionUser = interaction.user;
        const user = interaction.options.getUser('member') ?? interactionUser;
        const member: GuildMember | null = await fetchGuildMember(guild, user.id);
        if (member === null) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral, embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("Invalid input")
                        .setDescription("The user provided is not a member of this server.")
                ]
            });
            return;
        }


        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Random")
                    .setAuthor({ name: `${member.displayName}'s avatar`, iconURL: member.displayAvatarURL({ extension: 'png' }) })
                    .setImage(member.displayAvatarURL({ extension: 'png', size: 1024 }))
                    .setFooter({ text: `Requested by ${interaction.user.username}.` })
            ]
        });
    }
}

export default avatarCommand;