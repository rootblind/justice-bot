import {
    ActionRowBuilder,
    APIEmbedField,
    ButtonBuilder,
    ButtonStyle,
    ColorResolvable,
    EmbedBuilder,
    LabelBuilder,
    ModalBuilder,
    RestOrArray,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";

// embeds, buttons and other components related to the autovoice system

type AutoVoiceButtonConfig = {
    id: string;
    emoji: string;
    label?: string;
    style: ButtonStyle;
    name: string,
    value: string
};

export const AUTOVOICE_BUTTONS: AutoVoiceButtonConfig[] = [
    { id: "name-channel-button", emoji: "🏷️", style: ButtonStyle.Success, name: "NAME", value: "Rename room" },
    { id: "limit-channel-button", emoji: "👥", style: ButtonStyle.Success, name: "LIMIT", value: "Limit room" },
    { id: "hide-channel-button", emoji: "🛡️", style: ButtonStyle.Success, name: "HIDE", value: "Hide/unhide room" },
    { id: "lock-channel-button", emoji: "🔒", style: ButtonStyle.Success, name: "LOCK", value: "Lock/unlock room" },
    { id: "region-channel-button", emoji: "🌐", style: ButtonStyle.Success, name: "REGION", value: "Change room region" },
    { id: "trust-member-button", emoji: "➕", style: ButtonStyle.Success, name: "TRUST", value: "Trust members" },
    { id: "untrust-member-button", emoji: "🚫", style: ButtonStyle.Success, name: "UNTRUST", value: "Untrust members" },
    { id: "block-member-button", emoji: "⛔", style: ButtonStyle.Success, name: "BLOCK", value: "Block members" },
    { id: "unblock-member-button", emoji: "⭕", style: ButtonStyle.Success, name: "UNBLOCK", value: "Unblock members" },
    { id: "claim-owner-button", emoji: "👑", style: ButtonStyle.Success, name: "CLAIM", value: "Claim room ownership" },
    { id: "transfer-owner-button", emoji: "🔑", style: ButtonStyle.Success, name: "TRANSFER", value: "Transfer room ownership" },
    { id: "delete-channel-button", emoji: "🗑️", style: ButtonStyle.Success, name: "DELETE", value: "Delete room" },
    { id: "send-interface-button", emoji: "📨", label: "Send Interface", style: ButtonStyle.Primary, name: "none", value: "none" }
];

export function autovoice_buttons_builder(skip_send = false): ButtonBuilder[] {
    return AUTOVOICE_BUTTONS
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
    color: ColorResolvable = "Purple"
): EmbedBuilder {
    const fields: RestOrArray<APIEmbedField> = [];
    AUTOVOICE_BUTTONS.forEach((b) => {
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

export function embed_autovoice_manager(fields: RestOrArray<APIEmbedField>, color: ColorResolvable = "Purple") {
    return new EmbedBuilder()
        .setColor(color)
        .setFields(...fields)
        .setDescription("# Autovoice manager\nUse this interface to manage your autovoice channel.\nBy default, autovoice channels are unlimited, visible and open to everyone (except blocked members).")
        .setFooter({ text: "Autovoice channels are deleted when they get empty." })
}

// modals
export const channelNameInput = new TextInputBuilder()
    .setCustomId("channel-name-input")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(64)
    .setStyle(TextInputStyle.Short);
export const channelNameLabel = new LabelBuilder()
    .setLabel("New channel name")
    .setDescription("Assign a new name to the channel.")
    .setTextInputComponent(channelNameInput);
export const channelNameModal = new ModalBuilder()
    .setCustomId("channel-name-modal")
    .setTitle("Channel Name")
    .addLabelComponents(channelNameLabel);

export const channelLimitInput = new TextInputBuilder()
    .setCustomId("channel-limit-input")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2)
    .setStyle(TextInputStyle.Short)
export const channelLimitLabel = new LabelBuilder()
    .setLabel("Channel limit")
    .setDescription("Change the room user limit (0 to remove the limit)")
    .setTextInputComponent(channelLimitInput)
export const channelLimitModal = new ModalBuilder()
    .setCustomId("channel-limit-modal")
    .setTitle("User Limit")
    .addLabelComponents(channelLimitLabel)

// select menu
const voiceRegions = [
    "Automatic", 'Brazil', 'HongKong', 'India', 'Japan', 'Rotterdam',
    'Singapore', 'South-Korea', 'SouthAfrica', 'Sydney', 'US-Central',
    'US-East', 'US-South', 'US-West'
];
const selectRegionOptions = [];
for (const region of voiceRegions) {
    selectRegionOptions.push({
        label: region,
        description: `Set room region to ${region}`,
        value: region.toLowerCase()
    });
}

export const selectRegion = new StringSelectMenuBuilder()
    .setCustomId("select-room-region")
    .setMinValues(1)
    .setMaxValues(1)
    .setPlaceholder("Select the desired region...")
    .addOptions(selectRegionOptions);
export const selectRegionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectRegion);