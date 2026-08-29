import { ActionRowBuilder, APISelectMenuOption, ComponentType, GuildMember, MessageFlags, PermissionFlagsBits, RestOrArray, SlashCommandBuilder, StringSelectMenuBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import PremiumSystemRepo from "../../Repositories/premiumsystem.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { custom_uuid, message_collector } from "../../utility_modules/discord_helpers.js";
import { duration_to_milliseconds } from "../../utility_modules/utility_methods.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

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
        scope: "guild"
    },
    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;
        const notOwnedRoleIds = new Set(await PremiumSystemRepo.getGuildRolesNotOwnedByMember(guild.id, member.id));
        const sharedCustomRoles =
            Array.from(member.roles.cache.filter(r => notOwnedRoleIds.has(r.id)).values());
        if (sharedCustomRoles.length === 0) {
            await interaction.reply({
                embeds: [embed_message("Red", "You don't have any shared custom role.", "There is nothing to deassign")],
                flags: MessageFlags.Ephemeral
            });
        } else if (sharedCustomRoles.length === 1) { // auto select the role if it's only one
            const sharedRole = sharedCustomRoles[0]!;
            await member.roles.remove(sharedRole);
            await interaction.reply({
                embeds: [embed_message("Green", `${sharedRole.toString()} has been deassigned from you.`)],
                flags: MessageFlags.Ephemeral
            });
        } else { // open a select menu to remove the desired roles
            const selectOptions: RestOrArray<APISelectMenuOption> =
                sharedCustomRoles.map(r => {
                    return {
                        label: r.name.toLowerCase(),
                        description: "Remove this role from you.",
                        value: r.id
                    }
                });

            const customId = custom_uuid({ customId: member.id, separator: "-" });
            const selectRoleMenu = new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setMinValues(1)
                .setMaxValues(sharedCustomRoles.length)
                .addOptions(selectOptions);

            const embed = embed_message("Aqua", "Select the roles you desire to deassign from yourself.");
            await interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectRoleMenu)]
            });
            const reply = await interaction.fetchReply();
            const collector = message_collector<ComponentType.StringSelect>(
                reply,
                {
                    componentType: ComponentType.StringSelect,
                    time: duration_to_milliseconds("2m")!,
                    filter: (i) => i.user.id === member.id
                },
                async (selectInteraction) => {
                    // as a safety measure, reconstruct the array for each select interaction

                    // local value
                    const sharedCustomRoles =
                        Array.from(member.roles.cache.filter(r => notOwnedRoleIds.has(r.id)).values());
                    const selectedRoleIds = selectInteraction.values;
                    const selectedRoles = sharedCustomRoles.filter(r => selectedRoleIds.includes(r.id));

                    if (selectedRoles.length === 0) {
                        await selectInteraction.reply({
                            embeds: [
                                embed_message(
                                    "Red",
                                    "It seems like the selected roles were already removed",
                                    "Invalid selection"
                                )],
                            flags: MessageFlags.Ephemeral
                        });
                        (await collector).stop()
                        return;
                    }

                    try {
                        await member.roles.remove(selectedRoles);
                        await selectInteraction.reply({
                            embeds: [
                                embed_message("Green", `${selectedRoles.join(" ")} have been deassigned from you.`)
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        await errorLogHandle(error);
                        await selectInteraction.reply({
                            embeds: [embed_error("Something went wrong while removing the roles from your profile...")],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    (await collector).stop();
                },
                async () => {
                    try {
                        await reply.delete();
                    } catch {/* do nothing */ }
                }
            )
        }
    }
}
export default deassignSharedRole;