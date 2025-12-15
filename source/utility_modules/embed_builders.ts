/**
 * Implementing shorter means to build repetitive embeds in other source files
 */
import { ChannelType, EmbedBuilder } from "discord.js";
import type {
    Snowflake,
    ColorResolvable,
    User,
    GuildChannel,
    GuildMember,
    Guild,
    Invite,
    Message
} from "discord.js";
import { decryptor, formatDate, formatTime } from "./utility_methods.js";
import { ClassifierResponse } from "../Interfaces/helper_types.js";

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

    if (expires) {
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
            iconURL: member.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setTitle("Member joined")
        .setDescription(`${member} joined the server.`)
        .setFields({
            name: "Account created",
            value: `${formatDate(member.user.createdAt)} | [${formatTime(member.user.createdAt)}]`
        })
        .setTimestamp()
        .setFooter({ text: `Member ID: ${member.id}` });
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
            iconURL: member.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setTitle("Member left")
        .setDescription(`${member.user.username} left the server.`)
        .setFields({
            name: "Joined the server",
            value: member.joinedAt ? `${formatDate(member.joinedAt)} | [${formatTime(member.joinedAt)}]` : "Unknown"
        })
        .setTimestamp()
        .setFooter({ text: `Member ID: ${member.id}` });
}

/**
 * Embed for name changes in guild member
 * @param oldMember GuildMember object
 * @param newMember GuildMember object
 * @param nameType Whether the change is in displayname or username
 * @param color The embed color
 * @returns Embed
 */
export function embed_member_update_name(
    oldMember: GuildMember,
    newMember: GuildMember,
    nameType: "displayname" | "username",
    color: ColorResolvable = 0x2596be
): EmbedBuilder {
    const formattedNameType = `${nameType === "displayname" ? "Display Name" : "Username"}`;
    return new EmbedBuilder()
        .setAuthor({
            name: `${oldMember.user.username}`,
            iconURL: `${oldMember.displayAvatarURL({ extension: "jpg" })}`
        })
        .setColor(color)
        .setFields(
            {
                name: `Old ${formattedNameType}`,
                value: `${nameType === "displayname" ? oldMember.displayName : oldMember.user.username}`
            },
            {
                name: `New ${formattedNameType}`,
                value: `${nameType === "displayname" ? newMember.displayName : newMember.user.username}`
            }
        )
        .setTimestamp()
        .setFooter({ text: `Member ID: ${newMember.id}` });
}

/**
 * @param member The premium member
 * @param encrypted_code The premium code redeemed in its encrypted form
 * @param duration The duration of the code. 0 if permanent or from boosting
 * @param usesnumber The number of uses left
 * @param from_boosting Whether the premium came from boosting the guild
 * @param color The embed color
 * @returns Embed
 */
export function embed_new_premium_membership(
    member: GuildMember,
    encrypted_code: string,
    duration: number | string,
    usesnumber: number,
    from_boosting: boolean = false,
    color: ColorResolvable = 0xd214c7
): EmbedBuilder {
    const code = decryptor(encrypted_code);
    const expires = duration === 0 ? "Permanent" : `<t:${duration}:R>`;

    return new EmbedBuilder()
        .setAuthor({
            name: `${member.user.username} is now a premium member`,
            iconURL: member.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setFields(
            {
                name: "Member",
                value: `${member}`,
                inline: true
            },
            {
                name: "Code",
                value: `||${code}||`,
                inline: true
            },
            {
                name: "Expires",
                value: expires,
                inline: true
            },
            {
                name: "Uses left",
                value: `${usesnumber}`,
            },
            {
                name: "From boosting",
                value: `${String(from_boosting)}`
            }
        )
        .setTimestamp()
        .setFooter({ text: `Member ID: ${member.id}` });
}

/**
 * 
 * @param guild The guild object
 * @param member The premium member
 * @param encrypted_code The premium key code in encrypted form
 * @param duration The duration of membership. 0 = permanent
 * @param from_boosting Whether the membership comes from boosting or not
 * @param color The embed color
 * @returns Embed
 */
export function embed_premium_member_notification(
    guild: Guild,
    member: GuildMember,
    encrypted_code: string,
    duration: string | number,
    from_boosting: boolean = false,
    color: ColorResolvable = 0xd214c7
): EmbedBuilder {
    const code = decryptor(encrypted_code);
    const booster_description =
        `Thank you **${member.user.username}** for boosting the server!
        Your premium membership will last as long as you are boosting the server.\n`;
    const description = "You can access your premium perks using `/premium dashboard` on the server.";
    const expiresAt = duration === 0 ? "Permanent" : `<t:${duration}:R>`;

    return new EmbedBuilder()
        .setTitle("You are now a premium member")
        .setAuthor({
            name: `${guild.name} premium member`,
            iconURL: String(guild.iconURL({ extension: "png" }))
        })
        .setColor(color)
        .setImage(guild.bannerURL({ size: 1024 }))
        .setThumbnail(guild.iconURL({ extension: "png" }))
        .setDescription(from_boosting ? booster_description + description : description)
        .setFields(
            {
                name: "Code",
                value: `${code}`
            },
            {
                name: "Expires",
                value: expiresAt
            },
            {
                name: "From boosting",
                value: String(from_boosting)
            }
        )
}

/**
 * @param inviter The user that generated the invite
 * @param invite Invite object
 * @param color The color of the embed
 * @returns Embed
 */
export function embed_invite_create(
    inviter: User,
    invite: Invite,
    color: ColorResolvable = 0xfdf32f
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${inviter.username} created an invite`,
            iconURL: inviter.displayAvatarURL({ extension: "jpg" })
        })
        .setTitle(`Invite code: ${invite.code}`)
        .setColor(color)
        .setDescription(`Invite url: ${invite.url}`)
        .setFields(
            {
                name: "Channel",
                value: `${invite.channel}`
            },
            {
                name: "Expires at",
                value: invite.maxAge ? `<t:${invite.expiresTimestamp}:R>` : "Permanent"
            },
            {
                name: "Max uses",
                value: invite.maxUses ? `${invite.maxUses}` : "Unlimited"
            }
        )
        .setTimestamp()
        .setFooter({ text: `Inviter ID: ${inviter.id}` });

    if (invite.targetUser) {
        embed.addFields(
            {
                name: "Target user",
                value: `${invite.targetUser.username}`
            },
            {
                name: "Target ID",
                value: `${invite.targetUser.id}`
            }
        )
    }

    return embed;
}

export function embed_flagged_message(
    message: Message,
    response: ClassifierResponse,
    color: ColorResolvable = 0xff0005
): EmbedBuilder {
    // if there are regex matches, it will show the first five, otherwise defaults to "No patterns"
    // if there are more than 5 matches, also add the number of the remaining matches
    // ex: word1, word2, word3, word4, word5... and 9 more
    const matchingKeywords =
        `${response.matches.length ?
            response.matches.slice(0, 5).join(", ") :
            "No patterns"
        }${response.matches.length > 5 ?
            `... and ${response.matches.length - 5} more` :
            ""}`;

    const author = message.author;
    const channel = message.channel;
    const embed = new EmbedBuilder()
        .setTitle("Flagged Message")
        .setAuthor({
            name: author.username,
            iconURL: author.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .setFields(
            {
                name: "Channel",
                value: `${channel}`
            },
            {
                name: "Score",
                value: `**${response.score}**`
            },
            {
                name: "Flags",
                value: `${response.labels.join(", ")}`
            },
            {
                name: "Matching keywords",
                value: matchingKeywords
            },
            {
                name: "Context",
                value: `[reference](${message.url})`
            }
        )
        .setTimestamp()
        .setFooter({ text: `Author ID: ${author.id}` });

    return embed;
}

/**
 * 
 * @param message Message object of the flagged message
 * @param user The user that took action
 * @param labels The labels of the flagged message
 * @param action What action the user took
 * @param color The embed color
 * @returns Embed
 */
export function embed_justicelogs_flagged_message(
    message: Message,
    user: User,
    labels: string[],
    action: "confirm" | "adjust" | "false-positive",
    color: ColorResolvable = "Green"
): EmbedBuilder {
    let text: string;
    switch (action) {
        case "confirm":
            text = "confirmed the flags of a message";
            break;
        case "adjust":
            text = "adjusted the flags of a message"
            break;
        case "false-positive":
            text = "marked the flags as false positive."
            break;
    }

    return new EmbedBuilder()
        .setAuthor({
            name: `${user.username} ${text}`,
            iconURL: user.displayAvatarURL({ extension: "jpg" })
        })
        .setColor(color)
        .addFields(
            {
                name: "Flags",
                value: labels.join(", "),
                inline: true
            },
            {
                name: "Message",
                value: `[context](${message.url})`,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ text: `User ID: ${user.id}` });
}

export function embed_adjust_flags() {
    return new EmbedBuilder()
        .setDescription('Please select all the appropiate flags for the message.')
        .addFields(
            {
                name: 'Aggro',
                value: 'Provoking someone else into an argument.'
            },
            {
                name: 'Violence',
                value: 'Threats or encouraging violence against another person.'
            },
            {
                name: 'Sexual',
                value: 'Usage of sexual words to insult or to describe a sexual activity.'
            },
            {
                name: 'Hateful',
                value: 'Hateful messages and slurs against minorities and other people.'
            }
        )
}