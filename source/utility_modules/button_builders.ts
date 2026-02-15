/**
 * Pre-built buttons.
 * 
 * Generic buttons can be used on different features.
 */

import { ButtonBuilder, ButtonStyle } from "discord.js";

export function confirm_button(id: string = "confirm"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success)
}

export function adjust_button(id: string = "adjust"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("Adjust")
        .setStyle(ButtonStyle.Primary)
}

export function false_positive_button(id: string = "false-positive"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("False Positive")
        .setStyle(ButtonStyle.Primary)
}

export function claim_button(id: string = "claim"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
}

export function resolve_button(id: string = "resolve"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("Resolve")
        .setStyle(ButtonStyle.Primary)
}

export function add_member_button(id: string = "add-member"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("Add Member")
        .setStyle(ButtonStyle.Secondary)
}

export function remove_member_button(id: string = "remove-member"): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel("Remove Member")
        .setStyle(ButtonStyle.Secondary)
}