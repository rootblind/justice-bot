import { Guild, type Client } from "discord.js";
import AsciiTable from "ascii-table";
import * as path from "path";
import { fileURLToPath } from "url";
import { ChatCommand } from "../Interfaces/command.js";
import { getFilesRecursive } from "../utility_modules/utility_methods.js";
import GuildModulesRepo from "../Repositories/guildmodules.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const table = new AsciiTable("Commands");
table.setHeading("Commands", "Status");

export async function load_commands(client: Client) {
    const commandsPath = path.join(__dirname, "../Commands");
    const files = getFilesRecursive(commandsPath);

    for(const filePath of files) {
        await load_command_file(client, filePath);
    }
}

export async function load_command_file(client: Client, filePath: string) {
    const command: ChatCommand = await import(filePath).then(m => m.default ?? m);
    if(command.disabled) {
        table.addRow(command.data.name, "Disabled");
        return;
    }
    
    if(command.scope === "global") command.group = "global";

    table.addRow(command.data.name, "Enabled");
    client.commands.set(command.data.name, command);
}

export async function registerGlobalCommands(client: Client) {
    if (!client.application) {
        throw new Error("Client application not found. Ensure the bot is logged in.");
    }

    const globalData = client.commands
        .filter(cmd => cmd.scope === "global")
        .map(cmd => cmd.data);

    try {
        await client.application.commands.set(globalData);
        console.log(table.toString(), `\nRegistered ${globalData.length} global commands.`);
    } catch (error) {
        console.error("Global commands registration failed:", error);
    }
}

export async function sync_guild_commands(client: Client, guild: Guild) {
    const disabledGroups = await GuildModulesRepo.getGuildDisabled(guild.id);
    // scope === "guild" and group is not included in disabledGroups
    const filteredCommands = client.commands.filter(
        cmd => 
            cmd.scope === "guild" && 
            !disabledGroups.includes(cmd.group || "")
    );

    await guild.commands.set(filteredCommands.map(cmd => cmd.data));
}