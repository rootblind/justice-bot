import { EmbedBuilder, GuildMember, MessageFlags } from "discord.js";
import { AnyDiscordInteraction, MembershipFull } from "../../Interfaces/helper_types.js";
import { fetchGuildRole } from "../../utility_modules/discord_helpers.js";
import { decryptor } from "../../utility_modules/utility_methods.js";

export async function profile_subcommand(
    interaction: AnyDiscordInteraction,
    member: GuildMember,
    membership: MembershipFull
): Promise<void> {
    if (interaction.replied || interaction.deferred) {
        throw new Error("profile_subcommand was called on an interaction that was already replied to.");
    }
    const guild = member.guild;
    const decoded = decryptor(membership.code.toString("hex"));
    const expiration = Number(membership.expiresat) === 0 ? "Permanent" : membership.expiresat;
    const customRole = membership.role ? (await fetchGuildRole(guild, membership.role)) : null;
    const embedProfile = new EmbedBuilder()
        .setAuthor({
            name: `${member.user.username} premium profile`,
            iconURL: member.displayAvatarURL({ extension: "png" })
        })
        .setColor("Purple")
        .addFields(
            {
                name: "Premium key details",
                value: `**Code**: ||${decoded}||
                                **Tier**: ${membership.tier}
                                **Expires**: ${expiration}`
            },
            {
                name: "Perks",
                value: `**Custom role**: ${customRole ? customRole.toString() : "None"}`
            }
        );

    await interaction.reply({ embeds: [embedProfile], flags: MessageFlags.Ephemeral });
}