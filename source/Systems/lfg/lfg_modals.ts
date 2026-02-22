
import {
    APISelectMenuOption,
    LabelBuilder,
    Locale,
    ModalBuilder,
    RestOrArray,
    Role,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { LfgChannelTable, LfgGamemode, LfgGamemodeTable, LfgGameTable } from "../../Interfaces/lfg_system.js";
import { t } from "../../Config/i18n.js";

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

export function add_details_label(locale: Locale = Locale.EnglishUS): LabelBuilder {
    const addDetailsInput = new TextInputBuilder()
        .setCustomId("details-input")
        .setMaxLength(256)
        .setRequired(false)
        .setPlaceholder(t(locale, "systems.lfg.modals.details.placeholder"))
        .setStyle(TextInputStyle.Paragraph)
    const addDetailsLabel = new LabelBuilder()
        .setLabel(t(locale, "systems.lfg.modals.details.label"))
        .setDescription(t(locale, "systems.lfg.modals.details.description"))
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

export function select_rank_label(ranks: Role[], locale: Locale = Locale.EnglishUS): LabelBuilder {
    const selectRankOptions: RestOrArray<APISelectMenuOption> =
        ranks.map((r) => {
            return {
                label: r.name,
                value: r.id,
                description: t(locale, "systems.lfg.modals.select_ranks.option_description", { string: r.name })
            }
        });
    const selectGameRanks = new StringSelectMenuBuilder()
        .setCustomId("select-ranks-menu")
        .setRequired(false)
        .setMaxValues(selectRankOptions.length)
        .addOptions(selectRankOptions);
    const selectRankLabel = new LabelBuilder()
        .setLabel(t(locale, "systems.lfg.modals.select_ranks.label"))
        .setDescription(t(locale, "systems.lfg.modals.select_ranks.description"))
        .setStringSelectMenuComponent(selectGameRanks);

    return selectRankLabel;
}

export function select_roles_label(roles: Role[], locale: Locale = Locale.EnglishUS): LabelBuilder {
    const selectRoleOptions: RestOrArray<APISelectMenuOption> =
        roles.map((r) => {
            return {
                label: r.name,
                value: r.id,
                description: t(locale, "systems.lfg.modals.select_roles.option_description", { string: r.name })
            }
        });
    // if the game has in-game roles, attach a select menu
    const selectGameRoles = new StringSelectMenuBuilder()
        .setCustomId("select-roles-menu")
        .setRequired(false)
        .setMaxValues(selectRoleOptions.length)
        .addOptions(selectRoleOptions)

    const selectRolesLabel = new LabelBuilder()
        .setLabel(t(locale, "systems.lfg.modals.select_roles.label"))
        .setDescription(t(locale, "systems.lfg.modals.select_roles.description"))
        .setStringSelectMenuComponent(selectGameRoles);

    return selectRolesLabel;
}

export function slots_label(locale: Locale = Locale.EnglishUS): LabelBuilder {
    const slotsTextInput = new TextInputBuilder()
        .setCustomId("slots-input")
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true)
        .setPlaceholder("4")
        .setStyle(TextInputStyle.Short);
    const slotsLabel = new LabelBuilder()
        .setLabel(t(locale, "systems.lfg.modals.slots_label"))
        .setTextInputComponent(slotsTextInput);

    return slotsLabel;
}

export function select_gamemode_label(
    gamemodes: LfgGamemode[],
    locale: Locale = Locale.EnglishUS,
    required: boolean = true,
    selectLimit: number = 1
): LabelBuilder {
    const selectGamemodeOptions: RestOrArray<APISelectMenuOption> =
        gamemodes.map((g) => {
            return {
                label: g.name,
                value: g.name,
                description: t(locale, "systems.lfg.modals.looking_for", { string: g.name })
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
        .setLabel(t(locale, "systems.lfg.modals.select_gamemode_label"))
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