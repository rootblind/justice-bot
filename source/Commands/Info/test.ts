import { SlashCommandBuilder } from "discord.js";
import { ChatInputCommandInteraction } from "discord.js";
import type { ChatCommand } from "../../Interfaces/command.ts";

const test: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("test")
        .setDescription("Desc"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        return await interaction.reply("da");
    },

    cooldown: 1,
    userPermissions: [],
    botPermissions: []
}

export default test;