import {
    GuildMember,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";
import { RiskAssessment, VerificationStatusType } from "../../Interfaces/server_types.js";

export function embed_verified_member(
    member: GuildMember,
    decision: VerificationStatusType,
    risk?: RiskAssessment,
    moderator?: GuildMember
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${member.user.username} verification`,
            iconURL: member.displayAvatarURL({ extension: "png" })
        })
        .setTimestamp()
        .setFooter({ text: `Member ID: ${member.id}` })
        .addFields({
            name: "Joined",
            value: `**Server**: ${member.joinedAt}
                **Discord**: ${member.user.createdAt}`
        })

    if (moderator) {
        embed.addFields({
            name: "Moderator",
            value: moderator.toString()
        });
    }
    if (risk) {
        embed.addFields(
            {
                name: "Risk assessment",
                value: `**Score**: ${risk.score}
                **Highest fingerprint score**: ${risk.strongestFingerprintScore}
                **Level**: ${risk.level}
                **Has related banned accounts**: ${risk.relatedBannedAccount}
                **Recommended action**: ${risk.recommendedAction}`
            },
            {
                name: "Evidence",
                value: risk.evidence.length ?
                    risk.evidence.map(e =>
                        `Type: ${e.type} | Points: ${e.points} | Description: ${e.description}`
                    ).join("\n")
                    : "None"
            },
            {
                name: "Related accounts",
                value: risk.relatedAccountIds.length ?
                    risk.relatedAccountIds.join("\n")
                    : "None"
            }
        );
    }

    switch (decision) {
        case "accepted": {
            embed.setColor("Aqua")
                .setTitle("Member accepted")
            break;
        }
        case "pending": {
            embed.setColor("Yellow")
                .setTitle("Member pending manual review")
            break;
        }
        case "denied": {
            embed.setColor("Red")
                .setTitle("Member denied")
            break;
        }
    }
    return embed;
}

export function embed_manual_review(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor("Purple")
        .setTitle("Manual review")
        .addFields({
            name: "Decisions",
            value: `**Allow**: Grants member permission on this server
            **Deny**: Revokes permission and bans the member from the server.`
        });
}

export function manualReviewButtons(): ButtonBuilder[] {
    return [
        new ButtonBuilder()
            .setCustomId("allow-button")
            .setLabel("Allow")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("deny-button")
            .setLabel("Deny")
            .setStyle(ButtonStyle.Danger)
    ]
}