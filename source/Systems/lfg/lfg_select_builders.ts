import { RestOrArray, RoleSelectMenuBuilder, StringSelectMenuBuilder } from "@discordjs/builders";
import { LfgChannel, LfgGameTable } from "../../Interfaces/lfg_system.js";
import { APISelectMenuOption } from "discord.js";

export function select_game_builder(games: LfgGameTable[], selectLimit: number = 1): StringSelectMenuBuilder {
    if(selectLimit > games.length) selectLimit = games.length;

    const selectGameOptions: RestOrArray<APISelectMenuOption> = 
        games.map((row) => {
            return {
                label: row.game_name,
                value: row.game_name,
                description: `Select ${row.game_name}`
            }
        });

    const selectGameMenu = new StringSelectMenuBuilder()
        .setCustomId("select-game-menu")
        .setPlaceholder("Make a selection...")
        .setMinValues(1)
        .setMaxValues(selectLimit)
        .addOptions(selectGameOptions)

    return selectGameMenu;
}

export function select_roles_builder(selectLimit: number = 25, customId: string = "select-role-menu"): RoleSelectMenuBuilder {
    return new RoleSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder("Select the roles to be assigned")
        .setMinValues(1)
        .setMaxValues(selectLimit)
}

export function select_lfg_channels_builder(channels: LfgChannel[]) {
    if(channels.length === 0) throw new Error("select_lfg_channels_builder was provided with an empty array, expected at least one LfgChannel")
    const selectOptions: RestOrArray<APISelectMenuOption> = 
        channels.filter((row) => row.discord_channel_id !== null)
            .map((row) => {
                return {
                    label: row.name,
                    description: `Post your LFG in #${row.name}`,
                    value: row.discord_channel_id!
                }
            });
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select-channels-menu")
        .setPlaceholder("Select the channel to send your post...")
        .setMaxValues(1)
        .setMaxValues(1)
        .addOptions(selectOptions);

    return selectMenu;
}