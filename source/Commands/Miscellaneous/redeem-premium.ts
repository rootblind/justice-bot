import { GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import { embed_error, embed_message, embed_new_premium_membership } from "../../utility_modules/embed_builders.js";
import { fetchLogsChannel, fetchPremiumRole } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const redeemPremium: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("redeem-premium")
        .setDescription("Redeem a premium code to gain the premium status.")
        .addStringOption(option =>
            option.setName("code")
                .setDescription("The code you wish to redeem")
                .setMaxLength(10)
                .setMinLength(5)
                .setRequired(true)
        )
        .toJSON(),
    metadata: {
        cooldown: 30,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
        group: "premium",
        category: "Miscellaneous",
        scope: "guild"
    },
    async execute(interaction, client) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const code = interaction.options.getString("code", true);

        const premiumTier = await PremiumSystemRepo.getMembershipTier(guild.id, member.id);
        if (premiumTier !== null) {
            await interaction.reply({
                embeds: [
                    embed_message("Red", "You do already have an active premium membership on this server.\n" +
                        "Please contact an administrator if you think this is wrong."
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const premiumKey = await PremiumSystemRepo.getGuildKeyByCode(guild.id, code);
        if (!premiumKey) {
            await interaction.reply({
                embeds: [
                    embed_message("Red", "This code does not match any key.", "Invalid code")
                ],
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        if (premiumKey.usesnumber === 0) {
            await interaction.reply({
                embeds: [
                    embed_message("Red", "This premium key has no more uses left.")
                ],
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        if (premiumKey.dedicateduser && premiumKey.dedicateduser !== member.id) {
            await interaction.reply({
                embeds: [
                    embed_message("Red", "This code has a dedicated user which doesn't match your ID.")
                ],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // by this point, the member has no premium membership active and the code is valid
        // has uses and the dedicated user matches the member or the code can be used by anyone (no dedicated user)

        // interactionCreate guarantees running redeem-premium can be done only if a premium role exists
        const premiumRole = (await fetchPremiumRole(client, guild))!;

        try {
            member.roles.add(premiumRole); // assign the premium role
            await PremiumSystemRepo.newMembership(member.id, guild.id, premiumKey.id);
            // decrement the usesnumber
            premiumKey.usesnumber -= 1;
            await PremiumSystemRepo.updateKey(premiumKey);

            const responseEmbed = embed_new_premium_membership(
                member,
                premiumKey.code.toString("hex"),
                premiumKey.expiresat,
                premiumKey.usesnumber,
                premiumKey.tier
            );

            await interaction.reply({
                embeds: [
                    responseEmbed
                ],
                flags: MessageFlags.Ephemeral
            });

            const logChannel = await fetchLogsChannel(guild, "premium-activity");
            if (logChannel) {
                await logChannel.send({ embeds: [responseEmbed] });
            }
        } catch (error) {
            await errorLogHandle(error);
            await interaction.reply({
                embeds: [embed_error("Something went wrong while assigning your membership status...")],
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

export default redeemPremium;