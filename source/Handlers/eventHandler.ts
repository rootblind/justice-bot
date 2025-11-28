import { Client } from "discord.js";
import AsciiTable from "ascii-table";
import fs from "graceful-fs";
import * as path from "path";
import { fileURLToPath } from "url";

import type { Event } from "../Interfaces/event.js";

export async function load_events(client: Client) {
    const table = new AsciiTable("Events")
        .setHeading("Events", "Status");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const eventsPath = path.join(__dirname, "../Events");

    const folders = fs.readdirSync(eventsPath);

    for(const folder of folders) {
        const folderPath = path.join(eventsPath, folder);
        const files = fs.readdirSync(folderPath)
            .filter((file: string) => file.endsWith(".js"));

        for(const file of files) {
            const filePath = path.join(folderPath, file);
            const event: Event = await import(filePath).then(m => m.default ?? m);
            // checking if the event is restful
            if(event.rest) {
                if(event.once) {
                    // if the event is one-time, register it as once
                    client.rest.once(event.name, (...args) =>
                        event.execute(...args, client)
                    );
                } else {
                    client.rest.on(event.name, (...args) =>
                        event.execute(...args, client)
                    );
                }
            } else {
                // events that are not restful
                if(event.once) {
                    client.once(event.name, (...args) =>
                        event.execute(...args, client)
                    );
                } else {
                    client.on(event.name, (...args) =>
                        event.execute(...args, client)
                    );
                }
            }

            table.addRow(file, "Loaded");
        }
    }

    console.log(table.toString(), "\nLoaded events");
}