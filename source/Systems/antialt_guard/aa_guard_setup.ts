/**
 * The source file for /aa-guard setup
 */

import {
    ChatInputCommandInteraction,
    CacheType,
    CategoryChannel,
    Role,
    ActionRowBuilder,
    ButtonBuilder,
    ComponentType,
    Guild,
    ChannelType,
    EmbedBuilder
} from "discord.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { confirm_button } from "../../utility_modules/button_builders.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { duration_to_milliseconds } from "../../utility_modules/utility_methods.js";
import {
    assessment_channel_perms,
    category_channel_perms,
    verification_channel_perms,
    verification_message_buttons
} from "./toolkit.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import { AntiAltGuardSetupObj } from "../../Interfaces/database_types.js";
import AntiAltGuardRepo from "../../Repositories/antialtguardsystem.js";
import { attach_aa_guard_status_collector } from "./collectors.js";

export async function aa_guard_setup(
    interaction: ChatInputCommandInteraction<CacheType>,
    config?: { category?: CategoryChannel | null, role?: Role | null }
) {
    const guild = interaction.guild as Guild;
    let category = config?.category;
    let role = config?.role;

    // send a confirmation message

    const embed_warning = embed_message(
        "Red",
        "In order to enforce this system, you should remove all permissions from everyone and assign your member permissions to " +
        "the verification role.\n" +
        "Missing input (category and/or role) will be generated and assigned by the setup process.\n\n" +
        "Press **Confirm** to generate the setup for the antialt guard system.\n" +
        "Any existing configuration will be erased.\n" +
        `${category ? `${category} will be assigned as the system category.` : ""}
        ${role ? `${role} will be assigned as the system verification role.` : ""}`
    );

    const confirmButton = confirm_button();

    await interaction.reply({
        embeds: [embed_warning],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton)]
    });

    const reply = await interaction.fetchReply();
    const collector = await message_collector<ComponentType.Button>(reply,
        {
            componentType: ComponentType.Button,
            time: duration_to_milliseconds("2m")!,
            filter: (i) => i.user.id === interaction.user.id
        },
        async (buttonInteraction) => {
            // only confirm exists, but for good measure
            if (buttonInteraction.customId === "confirm") {
                confirmButton.setDisabled(true);
                try {
                    await reply.edit({
                        components: [
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(confirmButton)
                        ]
                    });
                } catch {/* do nothing */ }
                await buttonInteraction.deferReply();

                // create role if it wasn't provided
                if (!role) {
                    role = await guild.roles.create({ name: "Papers" });
                }

                // create category if it wasn't provided
                if (!category) {
                    category = await guild.channels.create({
                        name: "Verification",
                        type: ChannelType.GuildCategory,
                        permissionOverwrites: category_channel_perms(guild.roles.everyone.id, role.id)
                    });
                }

                // create the channels
                const verifyChannel = await category.children.create({
                    name: "verify",
                    type: ChannelType.GuildText,
                    permissionOverwrites: verification_channel_perms(guild.roles.everyone.id, role.id)
                });

                const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
                if (!staffRoleId) {
                    await buttonInteraction.editReply({
                        embeds: [embed_error("The staff role couldn't be fetched during this setup session...")]
                    });
                    collector.stop();
                    return;
                }

                const assessmentChannel = await category.children.create({
                    name: "assessments",
                    type: ChannelType.GuildText,
                    permissionOverwrites: assessment_channel_perms(guild.roles.everyone.id, staffRoleId)
                });

                // send the message
                const verificationMessage = await verifyChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Purple")
                            .setAuthor({ name: "Antialt Guard", iconURL: guild.iconURL({ extension: "png" }) ?? "" })
                            .setDescription(
                                "Participation on this server requires antialt verification.\n" +
                                "Joining from multiple accounts or bypassing a ban is strictly forbidden."
                            )
                            .addFields(
                                {
                                    name: "Verify",
                                    value: "Begin the verification process",
                                    inline: true
                                },
                                {
                                    name: "Status",
                                    value: "Check your verification status",
                                    inline: true
                                }
                            )
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(verification_message_buttons())
                    ]
                });

                await attach_aa_guard_status_collector(verificationMessage);

                const setup: AntiAltGuardSetupObj = {
                    guild: guild.id,
                    category: category.id,
                    verification_channel: verifyChannel.id,
                    verification_message_menu: verificationMessage.id,
                    assessment_channel: assessmentChannel.id,
                    verified_role: role.id
                }

                await AntiAltGuardRepo.deleteSetup(guild.id); // clean tables on cascade
                await AntiAltGuardRepo.upsertSetup(setup);
                await buttonInteraction.editReply({
                    embeds: [embed_message("Green", `**${category}** has been set up for the antialt guard system.`)]
                });
                collector.stop();
            }
        },
        async () => { }
    );
}

/**
 * TODOs:
 * 
 * Attach a collector for the status button, add the neccessary cleanup in the proper guild events
 * 
 * Status button checks the verification status and replies to the user. If the user is already verified, it assigns the role directly
 * 
 * 
 */