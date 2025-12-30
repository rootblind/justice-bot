import { Client, ChatInputCommandInteraction } from "discord.js";
import type { PermissionResolvable, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

/**
 * The interface for slash commands
 */
export interface ChatCommand {
    data: RESTPostAPIChatInputApplicationCommandsJSONBody,
    execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<unknown>,
    scope: "global" | "guild",
    cooldown: number,
    botPermissions: PermissionResolvable[],
    userPermissions: PermissionResolvable[],
    ownerOnly?: boolean,
    testOnly?: boolean,
    disabled?: boolean,
    group?: ChatCommandGroup
}

export type ChatCommandGroup = 
    | "global"
    | "premium"