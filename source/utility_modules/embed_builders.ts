/**
 * Implementing shorter means to build repetitive embeds in other source files
 */
import { ChannelType, EmbedBuilder } from "discord.js";
import type { Snowflake, ColorResolvable, User, GuildChannel, GuildMember, Guild } from "discord.js";
import { formatDate, formatTime } from "./utility_methods";

/**
 * Embed for errors while a response is awaited
 * @param description 
 * @param title 
 * @returns Embed
 */
export function embed_error(description: string, title?: string): EmbedBuilder {
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

): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({
            name: `[UNBAN] <@${targetId}>`
        })
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: `Target ID: ${targetId}` })
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

/**
 * 
 * @param target The user object of the target
 * @param moderator The user object of the moderator
 * @param reason The reason for the ban
 * @param color The color of the embed
 * @param expirationTimestamp When the ban will expire if it is temporary
 * @returns Emebed
 */
export function embed_ban(
    target: User,
    moderator: User,
    banType: number,
    reason: string = "No reason specified",
    color: ColorResolvable = 0xff0000,
    expirationTimestamp?: string
): EmbedBuilder {
    const banTypeDictionary: Record<number, string> = {
        2: `<t:${expirationTimestamp}:R>`,
        3: "Indefinite ban",
        4: "Permanently banned"
    }

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `[BAN] ${target.username}`,
            iconURL: target.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setFields(
            {
                name: "Target",
                value: `${target}`,
                inline: true
            },
            {
                name: "Moderator",
                value: `${moderator}`,
                inline: true
            },
            {
                name: "Reason",
                value: reason,
                inline: true
            },
            {
                name: "Expires",
                value: `${banTypeDictionary[banType]}`,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ text: `Target ID: ${target.id}` });

    return embed;
}

/**
 * 
 * @param guild The guild object
 * @param moderator The executor of the ban
 * @param banType Uses the punishmentType indexing 2- tempban 3- indefinite 4- permaban
 * @param reason The reason for the ban
 * @param color The color of the embed
 * @param expires Timestamp of the expiration if it's a temporary ban
 * @returns Embed
 */
export function embed_ban_dm(
    guild: Guild,
    moderator: User,
    banType: number,
    reason: string = "No reason specified",
    color: ColorResolvable = "Red",
    expires?: string,
): EmbedBuilder {
    const banTypeDictionary: Record<number, string> = {
        2: "Temporary ban",
        3: "Indefinite ban",
        4: "Permanently banned"
    }

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `You got banned from ${guild.name}`,
            iconURL: String(guild.iconURL({ extension: "png" }))
        })
        .setColor(color)
        .setTitle(banTypeDictionary[banType] ?? "You have been banned")
        .setFields(
            {
                name: "Moderator",
                value: `${moderator.username}`,
                inline: true
            },
            {
                name: "Reason",
                value: reason
            }
        )
        .setTimestamp()

    if(expires) {
        embed.addFields({
            name: "Expires",
            value: `<t:${expires}:R>`
        });
    }

    return embed;
}

/**
 * @param channel The channel context
 * @param user The executor of the action that triggered the event
 * @param channelEvent Whether the channel was created, deleted or updated
 * @param color The color of the embed
 * @returns Embed
 */
export function embed_channel_event(
    channel: GuildChannel,
    user: User,
    channelEvent: "created" | "deleted" | "updated",
    color: ColorResolvable
): EmbedBuilder {
    // get the channel type as a normalized string like "text"
    const channelType = ChannelType[channel.type]
        .replace("Guild", "")
        .toLocaleLowerCase();

    return new EmbedBuilder()
        .setTitle(`Channel ${channelEvent}`)
        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setDescription(`${user.username} ${channelEvent} **${channel} ${channelType}** channel.`)
        .setTimestamp()
        .setFooter({ text: `Executed by: ${user.id}` });
}

/**
 * Embed for messages deleted by a moderator, not the message author
 * @param moderator The user object of the executor
 * @param target The user object of the author of the message
 * @param channel The channel of the message
 * @param color Embed color
 * @returns Embed
 */
export function embed_message_moderated(
    moderator: User,
    target: User,
    channel: GuildChannel,
    color: ColorResolvable = 0xff0005
): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({
            name: `${moderator.username} deleted a message`,
            iconURL: moderator.displayAvatarURL({ extension: "jpg" })
        })
        .setDescription("For details, check the messages logs channel.")
        .setColor(color)
        .addFields(
            {
                name: "Moderator",
                value: `${moderator}`,
                inline: true
            },
            {
                name: "Target",
                value: `${target}`,
                inline: true
            },
            {
                name: "In channel",
                value: `${channel}`
            }
        )
        .setTimestamp()
        .setFooter({ text: `Author ID: ${target.id}` })
}

/**
 * 
 * @param moderator User object of the executor
 * @param targetMember GuildMember object of the target
 * @param reason The reason for timeout
 * @param color The color of the embed
 * @returns Embed
 */
export function embed_member_timeout(
    moderator: User,
    targetMember: GuildMember,
    reason: string = "No reason specified",
    color: ColorResolvable = 0xff0005
): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle("Member timed out")
        .setAuthor({
            name: `${targetMember.user.username}`,
            iconURL: targetMember.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .addFields(
            {
                name: "Moderator",
                value: `${moderator}`,
                inline: true
            },
            {
                name: "Target",
                value: `${targetMember}`,
                inline: true
            },
            {
                name: "Expiration",
                value: `<t:${targetMember.communicationDisabledUntilTimestamp}:R>`
            },
            {
                name: "Reason",
                value: reason
            }
        )
        .setTimestamp()
        .setFooter({ text: `Target ID: ${targetMember.id}` });
}

/**
 * @param target The user object of the target
 * @param moderator The user object of the executor
 * @param reason The reason for the removal of the timeout
 * @param color The color of the embed
 * @returns Embed
 */
export function embed_timeout_removed(
    target: User,
    moderator: User,
    reason: string = "No reason specified",
    color: ColorResolvable = 0x2596be
): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle("Timeout removed")
        .setAuthor({
            name: `${target.username}`,
            iconURL: target.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setFields(
            {
                name: "Target",
                value: `${target}`,
                inline: true
            },
            {
                name: "Moderator",
                value: `${moderator}`,
                inline: true
            },
            {
                name: "Reason",
                value: reason
            }
        )
        .setTimestamp()
        .setFooter({ text: `Target ID: ${target.id}` })
}

/**
 * Member joined embed
 * @param member GuildMember object
 * @param color The color of the embed
 * @returns Embed
 */
export function embed_member_joined(
    member: GuildMember,
    color: ColorResolvable = 0x00fb24
): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({
            name: member.user.username,
            iconURL: member.displayAvatarURL({extension: "jpg"})
        })
        .setColor(color)
        .setTitle("Member joined")
        .setDescription(`${member} joined the server.`)
        .setFields({
            name: "Account created",
            value: `${formatDate(member.user.createdAt)} | [${formatTime(member.user.createdAt)}]`
        })
        .setTimestamp()
        .setFooter({text: `Member ID: ${member.id}`});
}

/**
 * 
 * @param member GuildMember object
 * @param color The color of the embed
 * @returns Embed
 */
export function embed_member_left(
    member: GuildMember,
    color: ColorResolvable = 0xfb0003
): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({
            name: member.user.username,
            iconURL: member.displayAvatarURL({extension: "jpg"})
        })
        .setColor(color)
        .setTitle("Member left")
        .setDescription(`${member.user.username} left the server.`)
        .setFields({
            name: "Joined the server",
            value: member.joinedAt ? `${formatDate(member.joinedAt)} | [${formatTime(member.joinedAt)}]` : "Unknown"
        })
        .setTimestamp()
        .setFooter({text: `Member ID: ${member.id}`});
}