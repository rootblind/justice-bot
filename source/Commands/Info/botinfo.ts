import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import cpuStats from "cpu-stat";
import { formatBytes, get_current_version } from "../../utility_modules/utility_methods.js";
import { embed_error } from "../../utility_modules/embed_builders.js";

const botInfo: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Details about the bot.")
        .toJSON(),

    async execute(interaction, client) {
        if(!client || !client.user) {
            await interaction.reply({
                embeds: [ embed_error("The bot can't fetch the client user...", "Fatal error") ]
            });
            return;
        }
        
        // calculating uptime
        const uptime = client.uptime ?? 0;
        const days = Math.floor(uptime / 86400000);
        const hours = Math.floor(uptime / 3600000) % 24;
        const minutes = Math.floor(uptime / 60000) % 60;
        const seconds = Math.floor(uptime / 1000) % 60;

        await interaction.deferReply();
        
        const botUser = client.user;
        const version = await get_current_version();

        cpuStats.usagePercent(function (error: unknown, percent: number) {
            if (error) return interaction.reply({ content: `${error}` });

            const memoryUsage = formatBytes(process.memoryUsage().heapUsed);
            const node = process.version;
            const cpu = percent.toFixed(2);

            const embed = new EmbedBuilder()
                .setTitle('Bot Info & Stats')
                .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
                .setColor('Aqua')
                .setAuthor({ name: 'Check on github', iconURL: 'https://pngimg.com/uploads/github/github_PNG67.png', url: 'https://github.com/rootblind/justice-bot' })
                .addFields(
                    { name: "Dev", value: "rootblind", inline: true },
                    { name: "Username:", value: `${botUser.username}`, inline: true },
                    { name: "Version:", value: `${version}`, inline: true },
                    { name: "Release date", value: "12/25/2023" },
                    { name: "Help command", value: "/man" },
                    { name: "Ping", value: `${client.ws.ping}ms` },
                    { name: "Uptime", value: `\`${days}\` days, \`${hours}\` hours, \`${minutes}\` minutes and \`${seconds}\` seconds.` },
                    { name: "Node version", value: `${node}` },
                    { name: "CPU usage", value: `${cpu}%` },
                    { name: "Memory usage", value: `${memoryUsage}` }
                );

            interaction.editReply({ embeds: [embed] });
        });

    },
    metadata: {
        botPermissions: [PermissionFlagsBits.SendMessages],
        userPermissions: [],
        cooldown: 3,
        scope: "global",
        category: "Info",
        group: "global"
    }
}

export default botInfo;