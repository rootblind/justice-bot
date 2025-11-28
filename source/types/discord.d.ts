import { Collection } from "discord.js";

import type { ChatCommand } from "../Interfaces/command.js";

declare module "discord.js" {
    interface Client {
        commands: Collection<string, ChatCommand>,
        cooldowns: Collection<string, Collection<string, number>>
    };
}