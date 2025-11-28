import { Client, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { PermissionResolvable } from "discord.js";

interface ChatCommand {
    data: SlashCommandBuilder,
    execute: (interaction: ChatInputCommandInteraction, client: Client) => void,
    cooldown: number,
    botPermissions: PermissionResolvable[],
    userPermissions: PermissionResolvable[],
    ownerOnly?: boolean,
    testOnly?: boolean
}

export type { ChatCommand };