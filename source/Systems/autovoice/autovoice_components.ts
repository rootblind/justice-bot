import {
    ActionRowBuilder,
    APIEmbedField,
    ButtonBuilder,
    ButtonStyle,
    ColorResolvable,
    EmbedBuilder,
    LabelBuilder,
    Locale,
    ModalBuilder,
    RestOrArray,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";

import { t } from "../../Config/i18n.js";

// embeds, buttons and other components related to the autovoice system

type AutoVoiceButtonConfig = {
    id: string;
    emoji: string;
    label?: string;
    style: ButtonStyle;
    name: string,
    value: string
};

export const AUTOVOICE_BUTTONS = (locale: Locale = Locale.EnglishUS): AutoVoiceButtonConfig[] => {
    return [
        { id: "name-channel-button", emoji: "🏷️", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.name.name"), value: t(locale, "systems.autovoice.buttons.name.value") },
        { id: "limit-channel-button", emoji: "👥", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.limit.name"), value: t(locale, "systems.autovoice.buttons.limit.value") },
        { id: "hide-channel-button", emoji: "🛡️", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.hide.name"), value: t(locale, "systems.autovoice.buttons.hide.value") },
        { id: "lock-channel-button", emoji: "🔒", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.lock.name"), value: t(locale, "systems.autovoice.buttons.lock.value") },
        { id: "region-channel-button", emoji: "🌐", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.region.name"), value: t(locale, "systems.autovoice.buttons.region.value") },
        { id: "trust-member-button", emoji: "➕", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.trust.name"), value: t(locale, "systems.autovoice.buttons.trust.value") },
        { id: "untrust-member-button", emoji: "🚫", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.untrust.name"), value: t(locale, "systems.autovoice.buttons.untrust.value") },
        { id: "block-member-button", emoji: "⛔", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.block.name"), value: t(locale, "systems.autovoice.buttons.block.value") },
        { id: "unblock-member-button", emoji: "⭕", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.unblock.name"), value: t(locale, "systems.autovoice.buttons.unblock.value") },
        { id: "claim-owner-button", emoji: "👑", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.claim.name"), value: t(locale, "systems.autovoice.buttons.claim.value") },
        { id: "transfer-owner-button", emoji: "🔑", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.transfer.name"), value: t(locale, "systems.autovoice.buttons.transfer.value") },
        { id: "delete-channel-button", emoji: "🗑️", style: ButtonStyle.Success, name: t(locale, "systems.autovoice.buttons.delete.name"), value: t(locale, "systems.autovoice.buttons.delete.value") },
        { id: "send-interface-button", emoji: "📨", label: t(locale, "systems.autovoice.buttons.send_interface"), style: ButtonStyle.Primary, name: "none", value: "none" }
    ];
}

export function autovoice_buttons_builder(locale: Locale = Locale.EnglishUS, skip_send = false): ButtonBuilder[] {
    return AUTOVOICE_BUTTONS(locale)
        .filter(cfg => !skip_send || cfg.id !== "send-interface-button")
        .map(cfg => {
            const button = new ButtonBuilder()
                .setCustomId(cfg.id)
                .setStyle(cfg.style);

            if (cfg.emoji) button.setEmoji(cfg.emoji);
            if (cfg.label) button.setLabel(cfg.label);

            return button;
        });
}


export function autovoice_actionrow_button_builder(): ActionRowBuilder<ButtonBuilder>[] {
    const buttons = autovoice_buttons_builder();

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let row = new ActionRowBuilder<ButtonBuilder>();

    for (const button of buttons) {
        if (row.components.length === 5) {
            rows.push(row);
            row = new ActionRowBuilder<ButtonBuilder>();
        }
        row.addComponents(button);
    }

    if (row.components.length > 0) {
        rows.push(row);
    }

    return rows;
}


export function embed_autovoice_manager_builder(
    locale: Locale = Locale.EnglishUS,
    color: ColorResolvable = "Purple"
): EmbedBuilder {
    const fields: RestOrArray<APIEmbedField> = [];
    AUTOVOICE_BUTTONS(locale).forEach((b) => {
        if (b.id !== "send-interface-button") {
            fields.push({
                name: `${b.emoji} ${b.name}`,
                value: `${b.value}`
            });
        }
    })
    return new EmbedBuilder()
        .setColor(color)
        .setDescription("# Autovoice manager builder\nGreen buttons will be used in the autovoice manager. Clicking buttons will turn them red and as a result, they will be excluded from the interface.")
        .addFields(
            ...fields
        )
        .setFooter({ text: "Use Send Interface when you're done." })
}

export function embed_autovoice_manager(
    fields: RestOrArray<APIEmbedField>,
    locale: Locale = Locale.EnglishUS,
    color: ColorResolvable = "Purple"
) {
    return new EmbedBuilder()
        .setColor(color)
        .setFields(...fields)
        .setDescription(t(locale, "systems.autovoice.interface.manager.description"))
        .setFooter({ text: t(locale, "systems.autovoice.interface.manager.footer") })
}

// modals
export function channelNameModal(locale: Locale = Locale.EnglishUS): ModalBuilder {
    const channelNameInput = new TextInputBuilder()
        .setCustomId("channel-name-input")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(64)
        .setStyle(TextInputStyle.Short);
    const channelNameLabel = new LabelBuilder()
        .setLabel(t(locale, "systems.autovoice.interface.modals.name.label"))
        .setDescription(t(locale, "systems.autovoice.interface.modals.name.description"))
        .setTextInputComponent(channelNameInput);
    const channelNameModal = new ModalBuilder()
        .setCustomId("channel-name-modal")
        .setTitle(t(locale, "systems.autovoice.interface.modals.name.title"))
        .addLabelComponents(channelNameLabel);
    return channelNameModal;
}

export function channelLimitModal(locale: Locale = Locale.EnglishUS): ModalBuilder {
    const channelLimitInput = new TextInputBuilder()
        .setCustomId("channel-limit-input")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2)
        .setStyle(TextInputStyle.Short)
    const channelLimitLabel = new LabelBuilder()
        .setLabel(t(locale, "systems.autovoice.interface.modals.limit.label"))
        .setDescription(t(locale, "systems.autovoice.interface.modals.limit.description"))
        .setTextInputComponent(channelLimitInput)
    const channelLimitModal = new ModalBuilder()
        .setCustomId("channel-limit-modal")
        .setTitle(t(locale, "systems.autovoice.interface.modals.limit.title"))
        .addLabelComponents(channelLimitLabel)
    return channelLimitModal;
}


// select menu
export function select_region_row(locale: Locale = Locale.EnglishUS): ActionRowBuilder<StringSelectMenuBuilder> {
    const voiceRegions = [
        "Automatic", 'Brazil', 'HongKong', 'India', 'Japan', 'Rotterdam',
        'Singapore', 'South-Korea', 'SouthAfrica', 'Sydney', 'US-Central',
        'US-East', 'US-South', 'US-West'
    ];
    const selectRegionOptions = [];
    for (const region of voiceRegions) {
        selectRegionOptions.push({
            label: region,
            description: t(locale, "systems.autovoice.interface.select.region.option_description", { string: region }),
            value: region.toLowerCase()
        });
    }

    const selectRegion = new StringSelectMenuBuilder()
        .setCustomId("select-room-region")
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder(t(locale, "systems.autovoice.interface.select.region.placeholder"))
        .addOptions(selectRegionOptions);
    const selectRegionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectRegion);

    return selectRegionRow;
}
