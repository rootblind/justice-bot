import { ChannelType, SlashCommandBuilder, VoiceChannel } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";

const test: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("test")
        .setDescription("test")
        .addChannelOption(option =>
            option.setName("voice")
                .setDescription("voice")
                .addChannelTypes(ChannelType.GuildVoice)
        )
        .toJSON(),
    async execute(interaction) {
        const options = interaction.options;
        const voice = options.getChannel("voice", true) as VoiceChannel;
        await interaction.reply(`${voice.userLimit}`)
    },

    metadata: {
        botPermissions: [],
        userPermissions: [],
        cooldown: 0,
        scope: "global",
        ownerOnly: true
    }
}

export default test;
