
import { 
    APISelectMenuOption, 
    LabelBuilder, 
    ModalBuilder, 
    RestOrArray, 
    Role, 
    StringSelectMenuBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from "discord.js";
import { LfgChannelTable, LfgGamemode, LfgGamemodeTable, LfgGameTable } from "../../Interfaces/lfg_system.js";

const channelNameModal = new ModalBuilder()
    .setCustomId("channel-name-modal")
    .setTitle("Channel Name");
const channelNameInput = new TextInputBuilder()
    .setCustomId("channel-name-input")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("eune...")
    .setMinLength(1)
    .setMaxLength(25)
    .setRequired(true);
const channelInputLabel = new LabelBuilder()
    .setLabel("Channel Name")
    .setDescription("Add a new channel to the selected LFG.")
    .setTextInputComponent(channelNameInput);
channelNameModal.addLabelComponents(channelInputLabel);
export function getChannelNameModal() {
    return channelNameModal;
}
export function getChannelInputLabel(): LabelBuilder {
    return channelInputLabel;
}

const gamemodeModal = new ModalBuilder()
    .setCustomId("gamemode-modal")
    .setTitle("Gamemode");
const gamemodeInput = new TextInputBuilder()
    .setCustomId("gamemode-input")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("SOLO/DUO...")
    .setMinLength(1)
    .setMaxLength(25)
    .setRequired(true);
const gamemodeLabel = new LabelBuilder()
    .setLabel("Gamemode Name")
    .setDescription("Add a new gamemode to the selected LFG.")
    .setTextInputComponent(gamemodeInput);
gamemodeModal.addLabelComponents(gamemodeLabel);
export function getGamemodeModal() {
    return gamemodeModal;
}
export function getGamemodeInputLabel(): LabelBuilder {
    return gamemodeLabel;
} 

export function add_details_label(): LabelBuilder {
    const addDetailsInput = new TextInputBuilder()
        .setCustomId("details-input")
        .setMaxLength(256)
        .setRequired(false)
        .setPlaceholder("Add your in-game name and anything you want the other players to know.")
        .setStyle(TextInputStyle.Paragraph)
    const addDetailsLabel = new LabelBuilder()
        .setLabel("Additional info")
        .setDescription("Add details about your LFG.")
        .setTextInputComponent(addDetailsInput);

    return addDetailsLabel;
}

export function select_lfg_roles_label(roles: Role[], required: boolean = true, selectLimit: number = 1): LabelBuilder {
    const selectRoleOptions: RestOrArray<APISelectMenuOption> =
        roles.map((r) => {
            return {
                label: r.name,
                value: r.id
            }
        });
    const selectGameRoles = new StringSelectMenuBuilder()
        .setCustomId("select-lfg-role-menu")
        .setRequired(required)
        .setMaxValues(selectLimit)
        .setMinValues(1)
        .addOptions(selectRoleOptions);
    const selectRoleLabel = new LabelBuilder()
        .setLabel("Select LFG roles")
        .setStringSelectMenuComponent(selectGameRoles);

    return selectRoleLabel;
}

export function select_rank_label(ranks: Role[]): LabelBuilder {
    const selectRankOptions: RestOrArray<APISelectMenuOption> =
        ranks.map((r) => {
            return {
                label: r.name,
                value: r.id,
                description: `Add ${r.name}`
            }
        });
    const selectGameRanks = new StringSelectMenuBuilder()
        .setCustomId("select-ranks-menu")
        .setRequired(false)
        .setMaxValues(selectRankOptions.length)
        .addOptions(selectRankOptions);
    const selectRankLabel = new LabelBuilder()
        .setLabel("What ranks are you looking for?")
        .setDescription("Select the desired ranks to add to the post.")
        .setStringSelectMenuComponent(selectGameRanks);

    return selectRankLabel;
}

export function select_roles_label(roles: Role[]): LabelBuilder {
    const selectRoleOptions: RestOrArray<APISelectMenuOption> =
        roles.map((r) => {
            return {
                label: r.name,
                value: r.id,
                description: `Add ${r.name}`
            }
        });
    // if the game has in-game roles, attach a select menu
    const selectGameRoles = new StringSelectMenuBuilder()
        .setCustomId("select-roles-menu")
        .setRequired(false)
        .setMaxValues(selectRoleOptions.length)
        .addOptions(selectRoleOptions)

    const selectRolesLabel = new LabelBuilder()
        .setLabel("Ask for specific role.")
        .setDescription("Select the roles you want in your post.")
        .setStringSelectMenuComponent(selectGameRoles);

    return selectRolesLabel;
}

export function slots_label(): LabelBuilder {
    const slotsTextInput = new TextInputBuilder()
        .setCustomId("slots-input")
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true)
        .setPlaceholder("4")
        .setStyle(TextInputStyle.Short);
    const slotsLabel = new LabelBuilder()
        .setLabel("How many players are you looking for?")
        .setTextInputComponent(slotsTextInput);

    return slotsLabel;
}

export function select_gamemode_label(
    gamemodes: LfgGamemode[], 
    required: boolean = true, 
    selectLimit: number = 1
): LabelBuilder {
    const selectGamemodeOptions: RestOrArray<APISelectMenuOption> =
        gamemodes.map((g) => {
            return {
                label: g.name,
                value: g.name,
                description: `Looking for ${g.name}`
            }
        });
    const selectGamemodeMenu = new StringSelectMenuBuilder()
        .setCustomId("select-gamemode-menu")
        .setPlaceholder("Gamemode...")
        .setRequired(required)
        .setMaxValues(selectLimit)
        .setMinValues(1)
        .addOptions(selectGamemodeOptions);

    const selectGamemodeLabel = new LabelBuilder()
        .setLabel("Select the gamemode you're planning to play.")
        .setStringSelectMenuComponent(selectGamemodeMenu);

    return selectGamemodeLabel;
}

/**
 * Select gamemode by id
 */
export function select_gamemode_id_label(
    gamemodes: LfgGamemodeTable[], 
    required: boolean = true, 
    selectLimit: number = 1
): LabelBuilder {
    const selectGamemodeOptions: RestOrArray<APISelectMenuOption> =
        gamemodes.map((g) => {
            return {
                label: g.name,
                value: `${g.id}`
            }
        });
    const selectGamemodeMenu = new StringSelectMenuBuilder()
        .setCustomId("select-gamemode-menu")
        .setPlaceholder("Gamemode...")
        .setRequired(required)
        .setMaxValues(selectLimit)
        .setMinValues(1)
        .addOptions(selectGamemodeOptions);

    const selectGamemodeLabel = new LabelBuilder()
        .setLabel("Select the gamemode.")
        .setStringSelectMenuComponent(selectGamemodeMenu);

    return selectGamemodeLabel;
}

/**
 * The value is game id
 */
export function select_game_label(games: LfgGameTable[]) {
    const selectGameOptions: RestOrArray<APISelectMenuOption> =
        games.map(g => {
            return {
                label: g.game_name,
                value: `${g.id}`,
                description: `Select ${g.game_name}`
            }
        });
    const selectGameMenu = new StringSelectMenuBuilder()
        .setCustomId("select-game-menu")
        .setPlaceholder("Game...")
        .setRequired(true)
        .setMaxValues(1)
        .setMinValues(1)
        .addOptions(...selectGameOptions);
    const selectGameLabel = new LabelBuilder()
        .setLabel("Select the game")
        .setStringSelectMenuComponent(selectGameMenu)

    return selectGameLabel;
}


/**
 * The value is the game id
 */
export function select_game_id_builder(games: LfgGameTable[], selectLimit: number = 1) {
    const selectGameOptions: RestOrArray<APISelectMenuOption> =
        games.map(g => {
            return {
                label: g.game_name,
                value: `${g.id}`,
                description: `Select ${g.game_name}`
            }
        });
    const selectGameMenu = new StringSelectMenuBuilder()
        .setCustomId("select-game-menu")
        .setPlaceholder("Game...")
        .setMaxValues(selectLimit)
        .setMinValues(1)
        .addOptions(...selectGameOptions);

    return selectGameMenu;
}

export function select_lfg_channel_label(
    channels: LfgChannelTable[], 
    required: boolean = true, 
    selectLimit: number = 1
): LabelBuilder {
    const selectChannelOptions: RestOrArray<APISelectMenuOption> =
        channels.map(c => {
            return {
                label: `#${c.name}`,
                value: `${c.id}`
            }
        });

    const selectChannelMenu = new StringSelectMenuBuilder()
        .setCustomId("select-channel-menu")
        .setPlaceholder("Channel...")
        .setRequired(required)
        .setMinValues(1)
        .setMaxValues(selectLimit)
        .addOptions(...selectChannelOptions);

    const selectChannelLabel = new LabelBuilder()
        .setLabel("Select channel")
        .setStringSelectMenuComponent(selectChannelMenu);

    return selectChannelLabel;
}