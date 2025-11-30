import { EmbedBuilder } from "discord.js";
import type { Snowflake, ColorResolvable } from "discord.js";

/**
 * Embed for errors while a response is awaited
 * @param description 
 * @param title 
 * @returns Embed
 */
export function embed_error(description: string, title?: string) {
    return new EmbedBuilder()
        .setColor("Red")
        .setTitle(title || "Error")
        .setDescription(description);
}

/**
 * 
 * @param targetId The snowflake id of the user that gets unbanned
 * @param moderatorUsername The username of the moderator that unbans the target
 * @param reason The reason for the unban
 * @param color Optional the color of the embed
 * @returns Embed
 */
export function embed_unban(
    targetId: Snowflake,
    moderatorUsername: string,
    reason: string,
    color: ColorResolvable = 0x00ff01

) {
    return new EmbedBuilder()
        .setAuthor({
            name: `[UNBAN] <@${targetId}>`
        })
        .setColor(color)
        .setTimestamp()
        .setFooter({text: `Target ID: ${targetId}`})
        .addFields(
            {
                name: "User",
                value: `<@${targetId}>`,
                inline: true
            },
            {
                name: "Moderator",
                value: moderatorUsername,
                inline: true
            },
            {
                name: "Reason",
                value: reason,
                inline: false
            }
        )
}