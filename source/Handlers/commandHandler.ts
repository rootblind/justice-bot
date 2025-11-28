import type { Client, Collection } from "discord.js";
import AsciiTable from "ascii-table";
import fs from "graceful-fs";
import * as path from "path";
import { fileURLToPath } from "url";

import type { CommandFile } from "../Interfaces/commandFile.ts";

export async function load_commands(client: Client & {commands: Collection<string, CommandFile>}) {
    const table = new AsciiTable("Commands");
    table.setHeading("Commands", "Status");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const commandsPath = path.join(__dirname, "../Commands");

    const folders = fs.readdirSync(commandsPath);

    const commandsArray = [];

    for(const folder of folders) {
        const folderPath = path.join(commandsPath, folder);
        const files = fs.readdirSync(folderPath)
            .filter((file: string) => file.endsWith(".js"));

        for(const file of files) {
            const filePath = path.join(folderPath, file);
            const commandFile: CommandFile = await import(filePath).then(m => m.default ?? m);

            const proprieties = { folder, ...commandFile };
            client.commands.set(commandFile.data.name, proprieties);
            commandsArray.push(commandFile.data.toJSON());
            table.addRow(file, "Loaded");
        }

    }

    if(client.application) {
        await client.application.commands.set(commandsArray);
    }

    console.log(table.toString(), "\nLoaded commands");
}
