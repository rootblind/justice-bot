import { Client, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { PermissionResolvable } from "discord.js";

/**
 * The interface for slash commands
 */
interface ChatCommand {
    data: SlashCommandBuilder,
    execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<unknown>,
    cooldown: number,
    botPermissions: PermissionResolvable[],
    userPermissions: PermissionResolvable[],
    ownerOnly?: boolean,
    testOnly?: boolean
}

export type { ChatCommand };