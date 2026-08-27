import { GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import { embed_message } from "../../utility_modules/embed_builders.js";

const deassignSharedRole: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("deassign-shared-role")
        .setDescription("Remove the custom role you accepted to be shared with you.")
        .toJSON(),
    metadata: {
        cooldown: 10,
        userPermissions: [],
        botPermissions: [PermissionFlagsBits.ManageRoles],
        group: "premium",
        category: "Miscellaneous",
        scope: "guild",
        testOnly: true
    },
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const notOwnedRoleIds = new Set(await PremiumSystemRepo.getGuildRolesNotOwnedByMember(guild.id, member.id));
        const sharedCustomRole = member.roles.cache.find(r => notOwnedRoleIds.has(r.id));
        if (!sharedCustomRole) {
            await interaction.reply({
                embeds: [embed_message("Red", "You don't have any shared custom role.", "There is nothing to deassign")],
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        await member.roles.remove(sharedCustomRole);
        await interaction.reply({
            embeds: [embed_message("Green", `${sharedCustomRole} has been deassigned from you.`)],
            flags: MessageFlags.Ephemeral
        });
    }
}
export default deassignSharedRole;