import { Client, ChatInputCommandInteraction } from "discord.js";
import type { PermissionResolvable, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

/**
 * The interface for slash commands
 */
export interface ChatCommand {
    data: RESTPostAPIChatInputApplicationCommandsJSONBody,
    metadata: ChatCommandMetadata,
    execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<unknown>,
}

export interface ChatCommandMetadata {
    botPermissions: PermissionResolvable[],
    userPermissions: PermissionResolvable[],
    cooldown: number,
    scope: "global" | "guild",
    group?: ChatCommandGroup,
    category?: ChatCommandCategory,
    ownerOnly?: boolean,
    testOnly?: boolean,
    premiumPlanOnly?: boolean
    disabled?: boolean
}

export type ChatCommandGroup =
    | "global"
    | "premium"
    | "autovoice"

export type ChatCommandCategory = 
    | "Info"
    | "Administrator"
    | "Owner"