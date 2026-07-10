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

export const CHAT_COMMAND_GROUPS = [
    "global",
    "premium",
    "autovoice",
    "block",
    "lfg",
    "moderation",
    "ticket",
] as const;

export type ChatCommandGroup = typeof CHAT_COMMAND_GROUPS[number];

export const CHAT_COMMAND_CATEGORIES = [
    "Info",
    "Administrator",
    "Owner",
    "Social",
    "Staff",
    "Moderator",
    "Miscellaneous",
] as const;

export type ChatCommandCategory =
    typeof CHAT_COMMAND_CATEGORIES[number];